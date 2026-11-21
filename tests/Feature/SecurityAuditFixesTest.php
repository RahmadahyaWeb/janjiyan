<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Notifications\CustomerBookingStatusNotification;
use App\Services\BookingNotificationService;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

/** Regression tests for the high/medium findings of the 2026-11-21 security audit. */
class SecurityAuditFixesTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake();
        Mail::fake();
        Queue::fake();
        Notification::fake();
        Storage::fake('local');
        Storage::fake('public');
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create(['name' => 'Owner', 'email' => 'owner@example.test', 'password' => Hash::make('owner-pass-1'), 'email_verified_at' => now()]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner)->update([
            'subscription_plan_id' => SubscriptionPlan::where('slug', 'enterprise')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->business = Business::create(['owner_id' => $this->owner->id, 'name' => 'Dummy Studio', 'slug' => 'dummy-studio', 'category' => 'Barbershop', 'business_type' => Business::TYPE_SPACE_BOOKING, 'timezone' => 'Asia/Jakarta', 'dp_expiry_minutes' => 120, 'is_active' => true]);
        $this->business->users()->attach($this->owner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $this->business->seedDefaultOperatingHours();
        $this->owner->update(['active_business_id' => $this->business->id]);
    }

    private function member(string $email, string $role, array $permissions): User
    {
        $u = User::create(['name' => $email, 'email' => $email, 'password' => Hash::make('member-pass-1'), 'email_verified_at' => now(), 'active_business_id' => $this->business->id]);
        $this->business->users()->attach($u->id, ['role' => $role, 'permissions' => json_encode($permissions)]);

        return $u;
    }

    private function pivotOf(User $u)
    {
        return $this->business->users()->where('users.id', $u->id)->first()?->pivot;
    }

    private function mockGoogle(string $email, string $id = 'g-1'): void
    {
        $g = (new SocialiteUser)->setRaw(['email_verified' => true])->map(['id' => $id, 'email' => $email, 'name' => 'Victim', 'avatar' => null]);
        Socialite::shouldReceive('driver->user')->andReturn($g);
    }

    private function freshGuest(): void
    {
        $this->post('/logout');
        $this->app['auth']->forgetGuards();
    }

    public function test_google_login_claims_unverified_preregistered_account_and_locks_out_preregistrant(): void
    {
        $this->post('/register', [
            'name' => 'Attacker', 'email' => 'victim@example.test', 'password' => 'attackerpw1', 'password_confirmation' => 'attackerpw1',
        ])->assertRedirect(route('verification.notice'));
        $row = User::where('email', 'victim@example.test')->firstOrFail();
        $this->freshGuest();

        $this->mockGoogle('victim@example.test');
        $this->get('/auth/google/callback')->assertRedirect();
        $this->assertSame($row->id, auth()->id());
        $this->freshGuest();

        $this->post('/login', ['email' => 'victim@example.test', 'password' => 'attackerpw1']);
        $this->assertGuest();
    }

    public function test_google_login_keeps_password_of_already_verified_account(): void
    {
        $user = User::create(['name' => 'Legit', 'email' => 'legit@example.test', 'password' => Hash::make('legit-pass-1'), 'email_verified_at' => now()]);

        $this->mockGoogle('legit@example.test');
        $this->get('/auth/google/callback');
        $this->assertSame($user->id, auth()->id());
        $this->assertTrue(Hash::check('legit-pass-1', $user->fresh()->password));
    }

    public function test_staff_login_is_created_unverified_and_cannot_capture_owners_google_login(): void
    {
        $this->actingAs($this->owner)->post(route('dashboard.staff.store'), [
            'name' => 'Target', 'email' => 'target@example.test', 'grant_login' => true, 'password' => 'grantorpw99', 'role' => 'staff', 'permissions' => ['manage_bookings'],
        ])->assertRedirect();
        $minted = User::where('email', 'target@example.test')->firstOrFail();
        $this->assertNull($minted->email_verified_at);
        Notification::assertSentTo($minted, VerifyEmail::class);
        $this->freshGuest();

        $this->mockGoogle('target@example.test', 'g-target');
        $this->get('/auth/google/callback');
        $this->assertSame($minted->id, auth()->id());
        $this->freshGuest();

        $this->post('/login', ['email' => 'target@example.test', 'password' => 'grantorpw99']);
        $this->assertGuest();
    }

    public function test_make_superadmin_refuses_existing_account_without_new_password(): void
    {
        $pre = User::create(['name' => 'Pre', 'email' => 'ops@example.test', 'password' => Hash::make('attackerpw1')]);

        $this->artisan('janjiyan:make-superadmin', ['email' => 'ops@example.test'])->assertExitCode(1);
        $this->assertFalse((bool) $pre->fresh()->is_superadmin);

        $this->artisan('janjiyan:make-superadmin', ['email' => 'ops@example.test', '--password' => 'operatorpw9'])->assertExitCode(0);
        $pre->refresh();
        $this->assertTrue((bool) $pre->is_superadmin);
        $this->assertFalse(Hash::check('attackerpw1', $pre->password));
    }

    public function test_manage_staff_member_cannot_grant_permissions_it_lacks(): void
    {
        $manager = $this->member('manager@example.test', 'staff', ['manage_staff']);

        // New login with more power than the grantor: refused.
        $this->actingAs($manager)->post(route('dashboard.staff.store'), [
            'name' => 'Puppet', 'email' => 'puppet@example.test', 'grant_login' => true, 'password' => 'dummy-pass-9', 'role' => 'staff', 'permissions' => User::BUSINESS_PERMISSIONS,
        ])->assertSessionHasErrors('permissions');
        $this->assertNull(User::where('email', 'puppet@example.test')->first());

        // Within the grantor's own permissions: allowed.
        $this->actingAs($manager)->post(route('dashboard.staff.store'), [
            'name' => 'Helper', 'email' => 'helper@example.test', 'grant_login' => true, 'password' => 'dummy-pass-9', 'role' => 'staff', 'permissions' => ['manage_staff'],
        ])->assertSessionHasNoErrors();

        // Self-link (then self-edit) path: refused for a limited member.
        $this->actingAs($manager)->post(route('dashboard.staff.store'), [
            'name' => 'Manager', 'email' => 'manager@example.test', 'grant_login' => true,
        ])->assertSessionHasErrors('email');

        // Even with a staff row linked to themselves, a limited member cannot change their own access.
        $selfRow = Staff::create(['business_id' => $this->business->id, 'user_id' => $manager->id, 'name' => 'Manager', 'is_active' => true]);
        $this->actingAs($manager)->put(route('dashboard.staff.update', $selfRow), [
            'name' => 'Manager', 'is_active' => true, 'role' => 'staff', 'permissions' => User::BUSINESS_PERMISSIONS,
        ]);
        $this->assertSame(['manage_staff'], json_decode((string) $this->pivotOf($manager)->permissions, true));
    }

    public function test_manage_staff_member_cannot_demote_or_remove_admin(): void
    {
        $manager = $this->member('manager@example.test', 'staff', ['manage_staff']);
        $admin = $this->member('admin@example.test', 'admin', ['*']);
        $adminRow = Staff::create(['business_id' => $this->business->id, 'user_id' => $admin->id, 'name' => 'Admin', 'is_active' => true]);

        $this->actingAs($manager)->put(route('dashboard.staff.update', $adminRow), ['name' => 'Admin', 'is_active' => true, 'permissions' => []])->assertForbidden();
        $this->actingAs($manager)->delete(route('dashboard.staff.destroy', $adminRow))->assertForbidden();
        $this->assertSame('admin', $this->pivotOf($admin)->role);

        // The owner still can.
        $this->actingAs($this->owner)->delete(route('dashboard.staff.destroy', $adminRow))->assertRedirect();
        $this->assertNull($this->pivotOf($admin));
    }

    private function bookPublic(string $name, string $phone, ?string $email, string $time): Booking
    {
        $svc = Service::firstOrCreate(['business_id' => $this->business->id, 'name' => 'Cut'], [
            'price' => 50000, 'duration_minutes' => 30, 'buffer_minutes' => 0, 'capacity' => 5, 'assignment_mode' => 'capacity', 'dp_type' => 'none', 'dp_value' => 0, 'is_active' => true,
        ]);
        $d = CarbonImmutable::now('Asia/Jakarta')->addDays(2);
        while ($d->dayOfWeek === 0) {
            $d = $d->addDay();
        }
        $this->post(route('public.booking.store', 'dummy-studio'), array_filter([
            'service_id' => $svc->id, 'date' => $d->toDateString(), 'time' => $time,
            'customer_name' => $name, 'customer_phone' => $phone, 'customer_email' => $email,
        ]))->assertRedirect();

        return Booking::latest('id')->firstOrFail();
    }

    public function test_invoice_lookup_only_discloses_the_matched_booking(): void
    {
        $victim = $this->bookPublic('Victim', '081299990001', null, '10:00');
        $attacker = $this->bookPublic('Attacker', '+62 812-9999-0001', null, '13:00');
        $this->assertSame($victim->customer_id, $attacker->customer_id);

        $props = $this->post(route('public.booking.invoices.lookup', 'dummy-studio'), ['invoice_number' => $attacker->invoice_number, 'phone_last4' => '0001'])
            ->assertOk()->viewData('page')['props'];

        $this->assertSame([$attacker->invoice_token], collect($props['history'])->pluck('invoice_token')->all());
        $this->assertSame('Attacker', $props['customerName']);
    }

    public function test_public_booking_does_not_redirect_existing_customers_emails(): void
    {
        $victim = $this->bookPublic('Victim', '081299990000', 'victim@example.test', '10:00');
        $this->bookPublic('Attacker', '+62 812-9999-0000', 'attacker@example.test', '13:00');

        $this->assertSame('victim@example.test', Customer::findOrFail($victim->customer_id)->email);

        app(BookingNotificationService::class)->notifyCustomerStatusChanged($victim->fresh(), 'confirmed');
        Notification::assertSentOnDemand(CustomerBookingStatusNotification::class, fn ($n, $channels, $notifiable) => ($notifiable->routes['mail'] ?? null) === 'victim@example.test');
    }
}
