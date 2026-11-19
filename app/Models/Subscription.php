<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    protected $fillable = [
        'user_id',
        'subscription_plan_id',
        'status',
        'trial_ends_at',
        'current_period_ends_at',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'current_period_ends_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    public function isTrial(): bool
    {
        return $this->status === 'trialing' && ($this->trial_ends_at?->isFuture() ?? false);
    }

    public function isActiveSubscription(): bool
    {
        return $this->status === 'active'
            && ($this->current_period_ends_at === null || $this->current_period_ends_at->isFuture());
    }

    public function hasActiveAccess(): bool
    {
        return $this->isTrial() || $this->isActiveSubscription();
    }

    public function isExpired(): bool
    {
        return ! $this->hasActiveAccess();
    }

    public function effectiveStatus(): string
    {
        if ($this->isTrial()) {
            return 'trialing';
        }

        if ($this->isActiveSubscription()) {
            return 'active';
        }

        return $this->status === 'cancelled' ? 'cancelled' : 'expired';
    }

    public function daysRemaining(): int
    {
        if ($this->isExpired()) {
            return 0;
        }

        $end = $this->isTrial() ? $this->trial_ends_at : $this->current_period_ends_at;
        if (! $end) {
            return 0;
        }

        return max(0, (int) now()->diffInDays($end, false));
    }
}
