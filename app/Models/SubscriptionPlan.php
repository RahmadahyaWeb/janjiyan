<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'price_monthly',
        'price_yearly',
        'max_businesses',
        'max_services_per_business',
        'max_addons_per_business',
        'max_staff_per_business',
        'max_bookings_per_month',
        'max_customers_per_business',
        'can_export_csv',
        'can_use_google_review',
    ];

    protected function casts(): array
    {
        return [
            'max_addons_per_business' => 'integer',
            'can_export_csv' => 'boolean',
            'can_use_google_review' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
