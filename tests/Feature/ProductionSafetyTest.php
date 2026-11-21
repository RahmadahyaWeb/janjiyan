<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductionSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);
    }

    public function test_login_page_does_not_expose_demo_credentials(): void
    {
        $this->get(route('login'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->missing('showDemoCredentials')
            );
    }

    public function test_billing_plan_switch_is_blocked_in_production_environment(): void
    {
        $user = User::create([
            'name' => 'Merchant Production',
            'email' => 'merchant@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $subscription = app(PlanLimitService::class)->ensureTrialSubscription($user);
        $business = Business::create([
            'owner_id' => $user->id,
            'name' => 'Production Studio',
            'slug' => 'production-studio',
            'category' => 'Barbershop',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);
        $business->users()->attach($user->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $user->update(['active_business_id' => $business->id]);
        $initialPlanId = $subscription->subscription_plan_id;
        $enterprisePlan = SubscriptionPlan::where('slug', 'enterprise')->firstOrFail();

        $originalEnv = $this->app['env'];
        $this->app['env'] = 'production';

        try {
            $this->actingAs($user)
                ->get(route('dashboard.billing'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Dashboard/Billing/Index')
                    ->where('billingSimulationEnabled', false)
                );

            $this->actingAs($user)
                ->withSession(['_token' => 'test-csrf-token'])
                ->post(route('dashboard.billing.switch'), [
                    '_token' => 'test-csrf-token',
                    'plan_slug' => $enterprisePlan->slug,
                ])
                ->assertForbidden();

            $subscription->refresh();
            $this->assertSame($initialPlanId, $subscription->subscription_plan_id);
        } finally {
            $this->app['env'] = $originalEnv;
        }
    }
}
