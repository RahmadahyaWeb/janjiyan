<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Services\MayarService;
use App\Services\PlanLimitService;
use App\Services\SubscriptionActivationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class BillingController extends Controller
{
    public function index(
        Request $request,
        PlanLimitService $planLimitService,
        MayarService $mayarService
    ): Response {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        $owner = $business?->owner ?? $user;

        abort_unless(
            $owner->id === $user->id || ($business && $user->hasBusinessPermission($business, 'manage_settings')),
            403
        );

        $planLimitService->ensureTrialSubscription($owner);

        $tz = $business?->timezone ?: 'Asia/Jakarta';
        $monthStartUtc = CarbonImmutable::now($tz)->startOfMonth()->utc();
        $monthEndUtc = CarbonImmutable::now($tz)->endOfMonth()->utc();

        $usage = [
            'businesses' => $owner->ownedBusinesses()->count(),
            'services' => $business ? $business->services()->count() : 0,
            'staff' => $business ? $business->staff()->count() : 0,
            'monthly_bookings' => $business
                ? $business->bookings()->whereBetween('created_at', [$monthStartUtc, $monthEndUtc])->count()
                : 0,
            'customers' => $business ? $business->customers()->count() : 0,
        ];

        $invoices = $owner->subscriptionInvoices()
            ->with('plan')
            ->latest()
            ->limit(15)
            ->get()
            ->map(fn (SubscriptionInvoice $inv) => [
                'id' => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'plan_name' => $inv->plan?->name ?? '-',
                'billing_cycle' => $inv->billing_cycle,
                'amount' => $inv->amount,
                'status' => $inv->status,
                'provider' => $inv->provider,
                'payment_url' => $inv->payment_url,
                'paid_at' => $inv->paid_at?->toIso8601String(),
                'created_at' => $inv->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Dashboard/Billing/Index', [
            'plans' => SubscriptionPlan::orderBy('price_monthly')->get(),
            'usage' => $usage,
            'billingSimulationEnabled' => ! app()->isProduction(),
            'mayarEnabled' => $mayarService->isConfigured(),
            'isOwner' => $owner->id === $user->id,
            'invoices' => $invoices,
        ]);
    }

    public function checkout(
        Request $request,
        PlanLimitService $planLimitService,
        MayarService $mayarService,
        SubscriptionActivationService $activationService
    ): SymfonyResponse|RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        $owner = $business?->owner ?? $user;

        abort_unless($owner->id === $user->id, 403, 'Hanya pemilik bisnis yang dapat melakukan pembayaran langganan.');

        if (! $mayarService->isConfigured()) {
            return back()->with('error', 'Gateway pembayaran Mayar belum dikonfigurasi.');
        }

        $validated = $request->validate([
            'plan_slug' => ['required', 'exists:subscription_plans,slug'],
            'billing_cycle' => ['required', 'in:monthly,yearly'],
        ]);

        $plan = SubscriptionPlan::where('slug', $validated['plan_slug'])->firstOrFail();
        $subscription = $planLimitService->ensureTrialSubscription($owner);
        $amount = $validated['billing_cycle'] === 'yearly'
            ? (int) $plan->price_yearly
            : (int) $plan->price_monthly;

        $existingPending = SubscriptionInvoice::where('user_id', $owner->id)
            ->where('subscription_plan_id', $plan->id)
            ->where('billing_cycle', $validated['billing_cycle'])
            ->where('amount', $amount)
            ->where('status', 'pending')
            ->whereNotNull('payment_url')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if ($existingPending) {
            return Inertia::location((string) $existingPending->payment_url);
        }

        $invoice = SubscriptionInvoice::create([
            'user_id' => $owner->id,
            'subscription_id' => $subscription->id,
            'subscription_plan_id' => $plan->id,
            'invoice_number' => $activationService->generateInvoiceNumber(),
            'billing_cycle' => $validated['billing_cycle'],
            'amount' => $amount,
            'status' => 'pending',
            'provider' => 'mayar',
            'expires_at' => now()->addHours(24),
        ]);

        try {
            $mayarData = $mayarService->createInvoice(
                $owner,
                $plan,
                $validated['billing_cycle'],
                $invoice,
                route('dashboard.billing', ['payment' => 'returned', 'invoice' => $invoice->invoice_number])
            );
        } catch (RuntimeException $e) {
            $invoice->update(['status' => 'failed', 'notes' => $e->getMessage()]);

            return back()->with('error', $e->getMessage());
        }

        $invoice->update([
            'mayar_invoice_id' => (string) ($mayarData['id'] ?? ''),
            'mayar_transaction_id' => isset($mayarData['transactionId']) ? (string) $mayarData['transactionId'] : null,
            'payment_url' => (string) $mayarData['link'],
            'raw_payload' => $mayarData,
        ]);

        return Inertia::location((string) $mayarData['link']);
    }

    public function checkInvoice(
        Request $request,
        SubscriptionInvoice $invoice,
        MayarService $mayarService,
        SubscriptionActivationService $activationService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        $owner = $business?->owner ?? $user;

        abort_unless((int) $invoice->user_id === (int) $owner->id && $owner->id === $user->id, 403);

        if ($invoice->status === 'paid') {
            return back()->with('success', "Invoice {$invoice->invoice_number} sudah lunas dan paket aktif.");
        }

        if (! $invoice->mayar_invoice_id || ! $mayarService->isConfigured()) {
            return back()->with('error', 'Status invoice belum dapat diverifikasi secara otomatis.');
        }

        try {
            $remote = $mayarService->getInvoiceDetail($invoice->mayar_invoice_id);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        if (! $mayarService->isPaidRemoteInvoice($remote, $invoice->amount)) {
            return back()->with('error', "Pembayaran untuk invoice {$invoice->invoice_number} belum selesai di Mayar.");
        }

        $activationService->fulfillPaidInvoice($invoice, $remote);

        return back()->with('success', "Pembayaran {$invoice->invoice_number} berhasil diverifikasi! Paket Anda sudah aktif.");
    }

    public function switchPlan(Request $request, PlanLimitService $planLimitService): RedirectResponse
    {
        if (app()->isProduction()) {
            abort(403, 'Perubahan paket langganan otomatis belum tersedia.');
        }

        $validated = $request->validate([
            'plan_slug' => ['required', 'exists:subscription_plans,slug'],
        ]);

        $user = $request->user();
        $plan = SubscriptionPlan::where('slug', $validated['plan_slug'])->firstOrFail();
        $subscription = $planLimitService->ensureTrialSubscription($user);

        $subscription->update([
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'current_period_ends_at' => now()->addMonth(),
        ]);

        return back()->with('success', "Paket langganan berhasil diubah ke {$plan->name} (Simulasi MVP).");
    }
}
