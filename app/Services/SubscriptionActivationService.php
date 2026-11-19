<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Notifications\SubscriptionActivatedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class SubscriptionActivationService
{
    public function __construct(
        private readonly PlanLimitService $planLimitService
    ) {}

    public function activatePlan(User $user, SubscriptionPlan $plan, string $billingCycle = 'monthly'): Subscription
    {
        return DB::transaction(function () use ($user, $plan, $billingCycle) {
            $ensured = $this->planLimitService->ensureTrialSubscription($user);
            $subscription = Subscription::whereKey($ensured->id)->lockForUpdate()->firstOrFail();

            $isSameActivePlan = $subscription->status === 'active'
                && (int) $subscription->subscription_plan_id === (int) $plan->id
                && $subscription->current_period_ends_at !== null
                && $subscription->current_period_ends_at->isFuture();

            $baseDate = $isSameActivePlan
                ? $subscription->current_period_ends_at->copy()
                : now();

            $newPeriodEnd = $billingCycle === 'yearly'
                ? $baseDate->addYear()
                : $baseDate->addMonth();

            $subscription->update([
                'subscription_plan_id' => $plan->id,
                'status' => 'active',
                'current_period_ends_at' => $newPeriodEnd,
            ]);

            return $subscription->fresh('plan');
        });
    }

    /**
     * Idempotently mark a subscription invoice as paid, activate the plan, and notify the owner.
     *
     * @param  array<string, mixed>  $payload
     */
    public function fulfillPaidInvoice(SubscriptionInvoice $invoice, array $payload = []): bool
    {
        $activatedSubscription = DB::transaction(function () use ($invoice, $payload) {
            $locked = SubscriptionInvoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === 'paid') {
                return null;
            }

            $locked->loadMissing(['user', 'plan']);

            $subscription = $this->activatePlan($locked->user, $locked->plan, $locked->billing_cycle);

            $locked->update([
                'subscription_id' => $subscription->id,
                'status' => 'paid',
                'paid_at' => now(),
                'raw_payload' => $payload !== [] ? $payload : $locked->raw_payload,
            ]);

            return $subscription;
        });

        if ($activatedSubscription === null) {
            return false;
        }

        $invoice->refresh();
        $invoice->loadMissing(['user', 'plan']);

        try {
            $invoice->user->notify(new SubscriptionActivatedNotification($invoice, $activatedSubscription));
        } catch (Throwable $e) {
            report($e);
        }

        return true;
    }

    public function generateInvoiceNumber(): string
    {
        $date = now()->format('Ymd');
        do {
            $number = 'SUB-'.$date.'-'.strtoupper(Str::random(6));
        } while (SubscriptionInvoice::where('invoice_number', $number)->exists());

        return $number;
    }
}
