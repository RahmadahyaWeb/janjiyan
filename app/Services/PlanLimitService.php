<?php

namespace App\Services;

use App\Models\Business;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;

class PlanLimitService
{
    public function ensureTrialSubscription(User $user): Subscription
    {
        $existing = $user->subscription()->with('plan')->first();
        if ($existing) {
            return $existing;
        }

        $proPlan = SubscriptionPlan::where('slug', 'professional')->first()
            ?? SubscriptionPlan::firstOrFail();

        try {
            return Subscription::create([
                'user_id' => $user->id,
                'subscription_plan_id' => $proPlan->id,
                'status' => 'trialing',
                'trial_ends_at' => now()->addDays(14),
                'current_period_ends_at' => now()->addDays(14),
            ])->load('plan');
        } catch (UniqueConstraintViolationException) {
            return $user->subscription()->with('plan')->firstOrFail();
        }
    }

    public function hasActiveSubscription(User $owner): bool
    {
        return $this->ensureTrialSubscription($owner)->hasActiveAccess();
    }

    public function canWriteToBusiness(Business $business): bool
    {
        return ! $business->isSuspended() && $this->hasActiveSubscription($business->owner);
    }

    public function canCreateBusiness(User $owner): bool
    {
        $subscription = $this->ensureTrialSubscription($owner);
        if (! $subscription->hasActiveAccess()) {
            return false;
        }

        $plan = $subscription->plan;
        if ($plan->max_businesses === null) {
            return true;
        }

        return $owner->ownedBusinesses()->count() < $plan->max_businesses;
    }

    public function canCreateService(Business $business): bool
    {
        $subscription = $this->ensureTrialSubscription($business->owner);
        if ($business->isSuspended() || ! $subscription->hasActiveAccess()) {
            return false;
        }

        $plan = $subscription->plan;
        if ($plan->max_services_per_business === null) {
            return true;
        }

        return $business->services()->count() < $plan->max_services_per_business;
    }

    public function canCreateStaff(Business $business): bool
    {
        $subscription = $this->ensureTrialSubscription($business->owner);
        if ($business->isSuspended() || ! $subscription->hasActiveAccess()) {
            return false;
        }

        $plan = $subscription->plan;
        if ($plan->max_staff_per_business === null) {
            return true;
        }

        return $business->staff()->count() < $plan->max_staff_per_business;
    }

    public function canCreateCustomer(Business $business): bool
    {
        $subscription = $this->ensureTrialSubscription($business->owner);
        if ($business->isSuspended() || ! $subscription->hasActiveAccess()) {
            return false;
        }

        $plan = $subscription->plan;
        if ($plan->max_customers_per_business === null) {
            return true;
        }

        return $business->customers()->count() < $plan->max_customers_per_business;
    }

    public function canCreateMonthlyBooking(Business $business): bool
    {
        $subscription = $this->ensureTrialSubscription($business->owner);
        if ($business->isSuspended() || ! $subscription->hasActiveAccess()) {
            return false;
        }

        $plan = $subscription->plan;
        if ($plan->max_bookings_per_month === null) {
            return true;
        }

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $monthStartUtc = CarbonImmutable::now($tz)->startOfMonth()->utc();
        $monthEndUtc = CarbonImmutable::now($tz)->endOfMonth()->utc();

        $monthlyCount = $business->bookings()
            ->whereBetween('created_at', [$monthStartUtc, $monthEndUtc])
            ->count();

        return $monthlyCount < $plan->max_bookings_per_month;
    }

    public function canExportCsv(User $owner): bool
    {
        $subscription = $this->ensureTrialSubscription($owner);
        if (! $subscription->hasActiveAccess()) {
            return false;
        }

        return (bool) $subscription->plan->can_export_csv;
    }

    public function canCreateAddon(Business $business): bool
    {
        $subscription = $this->ensureTrialSubscription($business->owner);
        if ($business->isSuspended() || ! $subscription->hasActiveAccess()) {
            return false;
        }

        $plan = $subscription->plan;
        if ($plan->max_addons_per_business === null) {
            return true;
        }

        return $business->serviceAddons()->count() < $plan->max_addons_per_business;
    }

    public function canUseGoogleReview(User $owner): bool
    {
        $subscription = $this->ensureTrialSubscription($owner);
        if (! $subscription->hasActiveAccess()) {
            return false;
        }

        return (bool) $subscription->plan->can_use_google_review;
    }

    public function canUseMultiServiceDropoff(User $owner): bool
    {
        $subscription = $this->ensureTrialSubscription($owner);
        if (! $subscription->hasActiveAccess()) {
            return false;
        }

        return $subscription->plan->slug !== 'basic' || (bool) $subscription->plan->can_export_csv;
    }

    public function canUseDailyCashierBreakdown(User $owner): bool
    {
        $subscription = $this->ensureTrialSubscription($owner);
        if (! $subscription->hasActiveAccess()) {
            return false;
        }

        return $subscription->plan->slug !== 'basic' || (bool) $subscription->plan->can_export_csv;
    }
}
