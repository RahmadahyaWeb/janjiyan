<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\User;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PanelPermissionsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $staff;

    private Business $business;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::factory()->create(['email_verified_at' => now()]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Rapi Studio',
            'slug' => 'rapi-studio-perm',
            'category' => 'Barbershop',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);

        $this->staff = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $this->business->id,
        ]);

        $this->business->users()->attach([
            $this->owner->id => ['role' => 'owner', 'permissions' => json_encode(['*'])],
            $this->staff->id => ['role' => 'staff', 'permissions' => json_encode(['manage_bookings', 'verify_payments'])],
        ]);
        $this->owner->update(['active_business_id' => $this->business->id]);
    }

    public function test_staff_gets_permission_map_and_no_revenue_or_setup_steps(): void
    {
        $props = $this->actingAs($this->staff)->get(route('dashboard'))->assertOk()->viewData('page')['props'];

        $this->assertSame([
            'manage_bookings' => true,
            'verify_payments' => true,
            'manage_services' => false,
            'manage_staff' => false,
            'manage_settings' => false,
            'owner' => false,
        ], $props['activeBusiness']['can']);
        $this->assertNull($props['stats']['monthly_revenue']);
        $this->assertNull($props['onboarding']);
        $this->assertNull($props['weeklyTrend'][0]['revenue']);
    }

    public function test_owner_sees_everything(): void
    {
        $props = $this->actingAs($this->owner)->get(route('dashboard'))->assertOk()->viewData('page')['props'];

        $this->assertNotContains(false, $props['activeBusiness']['can']);
        $this->assertIsInt($props['stats']['monthly_revenue']);
        $this->assertIsArray($props['onboarding']);
        $this->assertIsInt($props['weeklyTrend'][0]['revenue']);
    }

    public function test_pages_outside_staff_permissions_are_refused(): void
    {
        foreach (['dashboard.services', 'dashboard.schedule', 'dashboard.staff', 'dashboard.commissions', 'dashboard.settings', 'dashboard.billing'] as $name) {
            $this->actingAs($this->staff)->get(route($name))->assertForbidden();
        }

        $this->actingAs($this->staff)->get(route('dashboard.bookings'))->assertOk();
        $this->actingAs($this->staff)->get(route('dashboard.customers'))->assertOk();
        $this->actingAs($this->owner)->get(route('dashboard.services'))->assertOk();
        $this->actingAs($this->owner)->get(route('dashboard.schedule'))->assertOk();
    }
}
