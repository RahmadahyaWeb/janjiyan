<?php

namespace Tests\Feature;

use App\Jobs\SendTelegramBookingAlertJob;
use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Notifications\CustomerBookingReminderNotification;
use App\Notifications\CustomerBookingStatusNotification;
use App\Notifications\MerchantBookingAlertNotification;
use App\Notifications\SubscriptionActivatedNotification;
use App\Services\MayarService;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class ProductionHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);
    }

    public function test_all_email_notifications_implement_should_queue(): void
    {
        $this->assertTrue(is_subclass_of(CustomerBookingReminderNotification::class, ShouldQueue::class));
        $this->assertTrue(is_subclass_of(CustomerBookingStatusNotification::class, ShouldQueue::class));
        $this->assertTrue(is_subclass_of(MerchantBookingAlertNotification::class, ShouldQueue::class));
        $this->assertTrue(is_subclass_of(SubscriptionActivatedNotification::class, ShouldQueue::class));
    }

    public function test_mayar_service_fails_closed_on_missing_amount_and_wraps_connection_exception(): void
    {
        $service = app(MayarService::class);

        $this->assertFalse($service->isPaidRemoteInvoice(['status' => 'paid'], 100000));
        $this->assertFalse($service->isPaidRemoteInvoice(['status' => 'paid', 'amount' => 50000], 100000));
        $this->assertTrue($service->isPaidRemoteInvoice(['status' => 'paid', 'amount' => 100000], 100000));

        config(['services.mayar.api_key' => 'test-key']);

        Http::fake(function () {
            throw new ConnectionException('Connection timed out');
        });

        $this->expectException(RuntimeException::class);
        $service->getInvoiceDetail('inv_123');
    }

    public function test_billing_checkout_reuses_existing_non_expired_pending_invoice(): void
    {
        config(['services.mayar.api_key' => 'test-key']);

        $owner = User::create([
            'name' => 'Owner Billing',
            'email' => 'owner-billing@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        $subscription = app(PlanLimitService::class)->ensureTrialSubscription($owner);
        $plan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();

        $existing = SubscriptionInvoice::create([
            'user_id' => $owner->id,
            'subscription_id' => $subscription->id,
            'subscription_plan_id' => $plan->id,
            'invoice_number' => 'SUB-20261119-REUSE1',
            'billing_cycle' => 'monthly',
            'amount' => (int) $plan->price_monthly,
            'status' => 'pending',
            'provider' => 'mayar',
            'payment_url' => 'https://mayar.id/pay/reused-link',
            'expires_at' => now()->addHours(12),
        ]);

        Http::fake();

        $response = $this->actingAs($owner)
            ->withSession(['_token' => 'csrf-token'])
            ->post(route('dashboard.billing.checkout'), [
                '_token' => 'csrf-token',
                'plan_slug' => $plan->slug,
                'billing_cycle' => 'monthly',
            ]);

        $response->assertRedirect('https://mayar.id/pay/reused-link');
        $this->assertSame(1, SubscriptionInvoice::where('user_id', $owner->id)->count());
        $this->assertSame($existing->id, SubscriptionInvoice::where('user_id', $owner->id)->first()->id);
        Http::assertNothingSent();
    }

    public function test_google_oauth_rejects_unverified_email_auto_linking_and_regenerates_session(): void
    {
        $existingUser = User::create([
            'name' => 'Existing Merchant',
            'email' => 'merchant@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $unverifiedGoogleUser = new SocialiteUser;
        $unverifiedGoogleUser->id = 'google-unverified-1';
        $unverifiedGoogleUser->name = 'Attacker';
        $unverifiedGoogleUser->email = 'merchant@example.com';
        $unverifiedGoogleUser->user = ['email_verified' => false];

        $provider = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider->shouldReceive('user')->once()->andReturn($unverifiedGoogleUser);
        Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);

        $this->get(route('auth.google.callback'))
            ->assertRedirect(route('login'))
            ->assertSessionHas('error');

        $this->assertGuest();
        $this->assertNull($existingUser->fresh()->google_id);

        $verifiedGoogleUser = new SocialiteUser;
        $verifiedGoogleUser->id = 'google-verified-1';
        $verifiedGoogleUser->name = 'Existing Merchant';
        $verifiedGoogleUser->email = 'merchant@example.com';
        $verifiedGoogleUser->user = ['email_verified' => true];

        $provider2 = Mockery::mock('Laravel\Socialite\Contracts\Provider');
        $provider2->shouldReceive('user')->once()->andReturn($verifiedGoogleUser);
        Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider2);

        $this->startSession();
        $oldSessionId = session()->getId();

        $this->get(route('auth.google.callback'))
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($existingUser);
        $this->assertNotSame($oldSessionId, session()->getId());
    }

    public function test_forgot_password_does_not_enumerate_unknown_emails(): void
    {
        $this->withSession(['_token' => 'csrf-token'])
            ->post(route('password.email'), [
                '_token' => 'csrf-token',
                'email' => 'nonexistent@example.com',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status');
    }

    public function test_staff_rbac_blocks_unauthorized_read_routes_and_prevents_admin_role_escalation(): void
    {
        $owner = User::create([
            'name' => 'Owner',
            'email' => 'owner-rbac@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($owner);

        $business = Business::create([
            'owner_id' => $owner->id,
            'name' => 'RBAC Studio',
            'slug' => 'rbac-studio',
            'category' => 'Barbershop',
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);
        $business->users()->attach($owner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);

        $limitedStaffUser = User::create([
            'name' => 'Limited Staff',
            'email' => 'limited-staff@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
            'active_business_id' => $business->id,
        ]);
        $business->users()->attach($limitedStaffUser->id, [
            'role' => 'staff',
            'permissions' => json_encode(['verify_payments']),
        ]);

        $this->actingAs($limitedStaffUser)->get(route('dashboard.billing'))->assertForbidden();
        $this->actingAs($limitedStaffUser)->get(route('dashboard.settings'))->assertForbidden();
        $this->actingAs($limitedStaffUser)->get(route('dashboard.staff'))->assertForbidden();
        $this->actingAs($limitedStaffUser)->get(route('dashboard.commissions'))->assertForbidden();
        $this->actingAs($limitedStaffUser)->get(route('dashboard.customers'))->assertForbidden();

        // Staff manager with manage_staff (but not '*') cannot escalate to admin
        $managerUser = User::create([
            'name' => 'Staff Manager',
            'email' => 'manager@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
            'active_business_id' => $business->id,
        ]);
        $business->users()->attach($managerUser->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_staff']),
        ]);

        $this->actingAs($managerUser)
            ->withSession(['_token' => 'csrf-token'])
            ->post(route('dashboard.staff.store'), [
                '_token' => 'csrf-token',
                'name' => 'Escalated Account',
                'email' => 'escalated@example.com',
                'grant_login' => true,
                'password' => 'password123',
                'role' => 'admin',
                // Only permissions the grantor holds may be granted (see SecurityAuditFixesTest).
                'permissions' => ['manage_staff'],
            ])
            ->assertRedirect();

        $createdUser = User::where('email', 'escalated@example.com')->firstOrFail();
        $pivot = $business->users()->where('users.id', $createdUser->id)->firstOrFail()->pivot;
        $this->assertSame('staff', $pivot->role);
        $this->assertNotContains('*', json_decode((string) $pivot->permissions, true));
    }

    public function test_security_headers_seo_sitemap_and_public_ziggy_route_filtering(): void
    {
        $owner = User::create([
            'name' => 'SEO Owner',
            'email' => 'seo-owner@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        Business::create([
            'owner_id' => $owner->id,
            'name' => 'Active Salon',
            'slug' => 'active-salon',
            'category' => 'Salon',
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);

        Business::create([
            'owner_id' => $owner->id,
            'name' => 'Suspended Salon',
            'slug' => 'suspended-salon',
            'category' => 'Salon',
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
            'suspended_at' => now(),
        ]);

        $homeResponse = $this->get(route('home'))
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Public HTML must not expose /admin routes in Ziggy
        $homeResponse->assertDontSee('admin.users.extend-trial');
        $homeResponse->assertSee('rel="canonical"', false);

        // Auth pages must include noindex
        $this->get(route('login'))
            ->assertOk()
            ->assertSee('name="robots" content="noindex, nofollow"', false);

        // Sitemap includes active business and excludes suspended business
        Cache::forget('sitemap.xml');
        $sitemap = $this->get(route('sitemap'))
            ->assertOk()
            ->assertHeader('Content-Type', 'application/xml; charset=utf-8');

        $sitemap->assertSee('/b/active-salon');
        $sitemap->assertDontSee('/b/suspended-salon');
    }

    public function test_legal_pages_receive_env_driven_legal_config(): void
    {
        config([
            'app.legal.entity_name' => 'PT Janjiyan Digital Nusantara',
            'app.legal.support_email' => 'help@janjiyan.test',
        ]);

        $this->get(route('legal.privacy'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Legal/Privacy')
                ->where('legal.entity_name', 'PT Janjiyan Digital Nusantara')
                ->where('legal.support_email', 'help@janjiyan.test')
            );

        $this->get(route('legal.terms'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Legal/Terms')
                ->where('legal.entity_name', 'PT Janjiyan Digital Nusantara')
            );
    }

    public function test_admin_dashboard_sql_aggregate_stats_are_accurate(): void
    {
        $plan = SubscriptionPlan::firstOrFail();

        $admin = User::create([
            'name' => 'Superadmin',
            'email' => 'admin-stats@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        $admin->forceFill(['is_superadmin' => true])->save();

        $activeUser = User::create([
            'name' => 'Active User',
            'email' => 'active@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        Subscription::create([
            'user_id' => $activeUser->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'current_period_ends_at' => now()->addDays(20),
        ]);

        $expiredUser = User::create([
            'name' => 'Expired User',
            'email' => 'expired@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        Subscription::create([
            'user_id' => $expiredUser->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'trialing',
            'trial_ends_at' => now()->subDays(2),
            'current_period_ends_at' => now()->subDays(2),
        ]);

        $this->actingAs($admin)
            ->get(route('admin.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Index')
                ->where('stats.total_merchants', 2)
                ->where('stats.active_paid', 1)
                ->where('stats.expired', 1)
            );
    }

    public function test_telegram_job_rethrows_on_server_error_for_queue_retry(): void
    {
        $owner = User::create([
            'name' => 'TG Owner',
            'email' => 'tg-owner@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $business = Business::create([
            'owner_id' => $owner->id,
            'name' => 'TG Studio',
            'slug' => 'tg-studio',
            'category' => 'Studio',
            'timezone' => 'Asia/Jakarta',
            'telegram_notifications_enabled' => true,
            'telegram_bot_token' => '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
            'telegram_chat_id' => '987654321',
            'is_active' => true,
        ]);

        $service = Service::create([
            'business_id' => $business->id,
            'name' => 'Haircut',
            'duration_minutes' => 30,
            'buffer_minutes' => 0,
            'price' => 50000,
            'dp_type' => 'none',
            'dp_value' => 0,
            'assignment_mode' => 'capacity',
            'max_concurrent_capacity' => 1,
            'is_active' => true,
        ]);

        $customer = Customer::create([
            'business_id' => $business->id,
            'name' => 'Budi',
            'phone' => '628123456789',
        ]);

        $booking = Booking::create([
            'business_id' => $business->id,
            'service_id' => $service->id,
            'customer_id' => $customer->id,
            'booking_code' => 'JNY-TG0001',
            'invoice_number' => 'INV-20261119-TG0001',
            'invoice_token' => str_repeat('a', 32),
            'booking_date' => now()->addDay()->toDateString(),
            'start_at' => now()->addDay(),
            'end_at' => now()->addDay()->addMinutes(30),
            'buffer_end_at' => now()->addDay()->addMinutes(30),
            'total_price' => 50000,
            'dp_amount' => 0,
            'reservation_status' => 'pending',
            'payment_status' => 'unpaid',
        ]);

        Http::fake([
            'api.telegram.org/*' => Http::sequence()
                ->push(['ok' => false], 400)
                ->push(['ok' => false], 500),
        ]);

        // Permanent 400 error should NOT throw (do not retry invalid token/chat)
        (new SendTelegramBookingAlertJob($booking->id, 'new_booking'))->handle();

        // Transient 500 error MUST throw so Laravel queue retries with backoff
        $this->expectException(RuntimeException::class);
        (new SendTelegramBookingAlertJob($booking->id, 'new_booking'))->handle();
    }
}
