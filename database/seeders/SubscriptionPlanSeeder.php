<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class SubscriptionPlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'slug' => 'basic',
                'name' => 'Basic',
                'price_monthly' => 49000,
                'price_yearly' => 490000,
                'max_businesses' => 1,
                'max_services_per_business' => 5,
                'max_staff_per_business' => 2,
                'max_bookings_per_month' => 100,
                'max_customers_per_business' => 500,
                'can_export_csv' => false,
            ],
            [
                'slug' => 'professional',
                'name' => 'Professional',
                'price_monthly' => 129000,
                'price_yearly' => 1290000,
                'max_businesses' => 3,
                'max_services_per_business' => 10,
                'max_staff_per_business' => 10,
                'max_bookings_per_month' => 500,
                'max_customers_per_business' => 2500,
                'can_export_csv' => true,
            ],
            [
                'slug' => 'enterprise',
                'name' => 'Enterprise',
                'price_monthly' => 249000,
                'price_yearly' => 2490000,
                'max_businesses' => 10,
                'max_services_per_business' => null,
                'max_staff_per_business' => null,
                'max_bookings_per_month' => null,
                'max_customers_per_business' => null,
                'can_export_csv' => true,
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
