<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\PlanLimitService;
use App\Services\SubscriptionActivationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search', ''));
        $statusFilter = trim((string) $request->string('status', ''));

        $merchantsQuery = User::query()
            ->with(['subscription.plan'])
            ->withCount('ownedBusinesses')
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->latest();

        $now = now();
        $totalSubscriptions = Subscription::count();
        $activePaidCount = Subscription::where('status', 'active')
            ->where(fn ($q) => $q->whereNull('current_period_ends_at')->orWhere('current_period_ends_at', '>', $now))
            ->count();
        $trialingCount = Subscription::where('status', 'trialing')
            ->where('trial_ends_at', '>', $now)
            ->count();

        $stats = [
            'total_merchants' => User::count(),
            'active_paid' => $activePaidCount,
            'trialing' => $trialingCount,
            'expired' => max(0, $totalSubscriptions - $activePaidCount - $trialingCount),
            'suspended_businesses' => Business::whereNotNull('suspended_at')->count(),
            'total_revenue' => (int) SubscriptionInvoice::where('status', 'paid')->sum('amount'),
        ];

        $merchants = $merchantsQuery
            ->limit(100)
            ->get()
            ->map(function (User $u) {
                $sub = $u->subscription;

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'is_superadmin' => (bool) $u->is_superadmin,
                    'owned_businesses_count' => $u->owned_businesses_count,
                    'created_at' => $u->created_at?->toIso8601String(),
                    'subscription' => $sub ? [
                        'id' => $sub->id,
                        'plan_name' => $sub->plan?->name ?? '-',
                        'plan_slug' => $sub->plan?->slug ?? 'professional',
                        'effective_status' => $sub->effectiveStatus(),
                        'trial_ends_at' => $sub->trial_ends_at?->toIso8601String(),
                        'current_period_ends_at' => $sub->current_period_ends_at?->toIso8601String(),
                        'days_remaining' => $sub->daysRemaining(),
                    ] : null,
                ];
            })
            ->when($statusFilter !== '', fn ($col) => $col->filter(
                fn (array $m) => ($m['subscription']['effective_status'] ?? 'none') === $statusFilter
            ))
            ->values();

        $businesses = Business::query()
            ->with('owner:id,name,email')
            ->withCount(['bookings', 'services', 'staff'])
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('slug', 'like', "%{$search}%")
                        ->orWhereHas('owner', fn ($oq) => $oq->where('email', 'like', "%{$search}%"));
                });
            })
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (Business $b) => [
                'id' => $b->id,
                'name' => $b->name,
                'slug' => $b->slug,
                'category' => $b->category,
                'owner_name' => $b->owner?->name ?? '-',
                'owner_email' => $b->owner?->email ?? '-',
                'is_active' => $b->is_active,
                'is_suspended' => $b->isSuspended(),
                'suspended_at' => $b->suspended_at?->toIso8601String(),
                'suspension_reason' => $b->suspension_reason,
                'bookings_count' => $b->bookings_count,
                'services_count' => $b->services_count,
                'staff_count' => $b->staff_count,
            ]);

        $invoices = SubscriptionInvoice::query()
            ->with(['user:id,name,email', 'plan:id,name,slug'])
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn (SubscriptionInvoice $inv) => [
                'id' => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'user_name' => $inv->user?->name ?? '-',
                'user_email' => $inv->user?->email ?? '-',
                'plan_name' => $inv->plan?->name ?? '-',
                'billing_cycle' => $inv->billing_cycle,
                'amount' => $inv->amount,
                'provider' => $inv->provider,
                'status' => $inv->status,
                'notes' => $inv->notes,
                'paid_at' => $inv->paid_at?->toIso8601String(),
                'created_at' => $inv->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Index', [
            'stats' => $stats,
            'merchants' => $merchants,
            'businesses' => $businesses,
            'invoices' => $invoices,
            'plans' => SubscriptionPlan::orderBy('price_monthly')->get(['id', 'slug', 'name', 'price_monthly', 'price_yearly']),
            'filters' => [
                'search' => $search,
                'status' => $statusFilter,
            ],
        ]);
    }

    public function extendTrial(
        Request $request,
        User $user,
        PlanLimitService $planLimitService
    ): RedirectResponse {
        $validated = $request->validate([
            'days' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        $subscription = $planLimitService->ensureTrialSubscription($user);
        $base = ($subscription->trial_ends_at && $subscription->trial_ends_at->isFuture())
            ? $subscription->trial_ends_at->copy()
            : now();

        $newTrialEnd = $base->addDays((int) $validated['days']);

        $subscription->update([
            'status' => 'trialing',
            'trial_ends_at' => $newTrialEnd,
            'current_period_ends_at' => $newTrialEnd,
        ]);

        return back()->with('success', "Trial untuk {$user->email} diperpanjang {$validated['days']} hari.");
    }

    public function activatePlan(
        Request $request,
        User $user,
        SubscriptionActivationService $activationService
    ): RedirectResponse {
        $validated = $request->validate([
            'plan_slug' => ['required', 'exists:subscription_plans,slug'],
            'billing_cycle' => ['required', 'in:monthly,yearly'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $plan = SubscriptionPlan::where('slug', $validated['plan_slug'])->firstOrFail();
        $amount = $validated['billing_cycle'] === 'yearly'
            ? (int) $plan->price_yearly
            : (int) $plan->price_monthly;

        $subscription = $activationService->activatePlan($user, $plan, $validated['billing_cycle']);

        SubscriptionInvoice::create([
            'user_id' => $user->id,
            'subscription_id' => $subscription->id,
            'subscription_plan_id' => $plan->id,
            'invoice_number' => $activationService->generateInvoiceNumber(),
            'billing_cycle' => $validated['billing_cycle'],
            'amount' => $amount,
            'status' => 'paid',
            'provider' => 'manual',
            'paid_at' => now(),
            'notes' => $validated['notes'] ?: 'Aktivasi manual oleh Superadmin',
        ]);

        return back()->with('success', "Paket {$plan->name} ({$validated['billing_cycle']}) untuk {$user->email} berhasil diaktifkan.");
    }

    public function suspendBusiness(Request $request, Business $business): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $business->update([
            'suspended_at' => now(),
            'suspension_reason' => $validated['reason'],
        ]);

        return back()->with('success', "Bisnis {$business->name} telah ditangguhkan.");
    }

    public function unsuspendBusiness(Business $business): RedirectResponse
    {
        $business->update([
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        return back()->with('success', "Penangguhan bisnis {$business->name} telah dicabut.");
    }
}
