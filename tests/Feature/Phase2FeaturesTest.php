<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Phase2FeaturesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);
    }

    public function test_manual_registration_requires_email_verification_before_dashboard_access(): void
    {
        Notification::fake();

        $response = $this->post(route('register.store'), [
            'name' => 'Merchant Baru',
            'business_name' => 'Klinik Sehat',
            'business_category' => 'Klinik & Kesehatan',
            'email' => 'baru@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertRedirect(route('verification.notice'));

        $user = User::where('email', 'baru@example.com')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmail::class);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertRedirect(route('verification.notice'));
    }

    public function test_registration_survives_mail_failure_and_resend_reports_error(): void
    {
        // Simulates a broken SMTP: anything sent on Registered blows up.
        Event::listen(Registered::class, fn () => throw new \RuntimeException('SMTP down'));

        $this->post(route('register.store'), [
            'name' => 'Merchant Mail Rusak',
            'business_name' => 'Salon Cantik',
            'business_category' => 'Salon & Kecantikan',
            'email' => 'mailrusak@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect(route('verification.notice'));

        $user = User::where('email', 'mailrusak@example.com')->firstOrFail();
        $this->assertNotNull($user->active_business_id);
        $this->assertAuthenticatedAs($user);

        Notification::shouldReceive('send')->andThrow(new \RuntimeException('SMTP down'));

        $this->actingAs($user)
            ->from(route('verification.notice'))
            ->post(route('verification.send'))
            ->assertRedirect(route('verification.notice'))
            ->assertSessionHas('error');
    }

    public function test_forgot_and_reset_password_flow_updates_password(): void
    {
        $user = User::create([
            'name' => 'Lupa Sandi',
            'email' => 'reset@example.com',
            'password' => Hash::make('oldpassword'),
            'email_verified_at' => now(),
        ]);

        $this->get(route('password.request'))->assertOk();

        $this->post(route('password.email'), ['email' => 'reset@example.com'])
            ->assertSessionHas('status');

        $token = Password::createToken($user);

        $this->get(route('password.reset', ['token' => $token, 'email' => 'reset@example.com']))
            ->assertOk();

        $this->post(route('password.update'), [
            'token' => $token,
            'email' => 'reset@example.com',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertRedirect(route('login'));

        $user->refresh();
        $this->assertTrue(Hash::check('newpassword123', $user->password));
    }

    public function test_profile_update_and_password_change_work(): void
    {
        Notification::fake();

        $user = User::create([
            'name' => 'Nama Awal',
            'email' => 'awal@example.com',
            'password' => Hash::make('secret1234'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($user);

        $this->actingAs($user)->get(route('dashboard.profile'))->assertOk();

        // Change password
        $this->actingAs($user)
            ->put(route('dashboard.profile.password'), [
                'current_password' => 'secret1234',
                'password' => 'newsecret123',
                'password_confirmation' => 'newsecret123',
            ])
            ->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertTrue(Hash::check('newsecret123', $user->password));

        // Change email -> resets verification and sends notification
        $this->actingAs($user)
            ->put(route('dashboard.profile.update'), [
                'name' => 'Nama Baru',
                'email' => 'ganti@example.com',
            ])
            ->assertRedirect(route('verification.notice'));

        $user->refresh();
        $this->assertSame('Nama Baru', $user->name);
        $this->assertSame('ganti@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_staff_edit_settings_qris_removal_and_business_deletion(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $owner = User::create([
            'name' => 'Owner Bisnis',
            'email' => 'owner@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($owner);

        $qrisPath = UploadedFile::fake()->image('qris.png')->store('qris', 'public');

        $business = Business::create([
            'owner_id' => $owner->id,
            'name' => 'Studio Uji',
            'slug' => 'studio-uji',
            'category' => 'Studio Foto',
            'timezone' => 'Asia/Jakarta',
            'qris_path' => $qrisPath,
            'is_active' => true,
        ]);
        $business->users()->attach($owner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $business->seedDefaultOperatingHours();
        $owner->update(['active_business_id' => $business->id]);

        // Create & update staff
        $this->actingAs($owner)->post(route('dashboard.staff.store'), [
            'name' => 'Staff Satu',
            'email' => 'staff1@example.com',
            'grant_login' => true,
            'password' => 'staffpass123',
            'role' => 'staff',
            'permissions' => ['manage_bookings'],
        ])->assertSessionHasNoErrors();

        $staff = Staff::where('business_id', $business->id)->firstOrFail();

        $this->actingAs($owner)->put(route('dashboard.staff.update', $staff->id), [
            'name' => 'Staff Satu Diubah',
            'title' => 'Lead Stylist',
            'phone' => '08123456789',
            'is_active' => false,
            'role' => 'admin',
            'permissions' => ['manage_bookings', 'verify_payments'],
        ])->assertSessionHasNoErrors();

        $staff->refresh();
        $this->assertSame('Staff Satu Diubah', $staff->name);
        $this->assertFalse($staff->is_active);
        $this->assertSame('admin', $business->users()->where('users.id', $staff->user_id)->first()->pivot->role);

        // Remove QRIS & deactivate portal via Settings
        $this->actingAs($owner)->post(route('dashboard.settings.update'), [
            'name' => 'Studio Uji',
            'slug' => 'studio-uji',
            'category' => 'Studio Foto',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'remove_qris' => true,
            'is_active' => false,
        ])->assertSessionHasNoErrors();

        $business->refresh();
        $this->assertNull($business->qris_path);
        $this->assertFalse($business->is_active);
        Storage::disk('public')->assertMissing($qrisPath);
        $this->get('/b/studio-uji')->assertNotFound();

        // Wrong confirmation name fails deletion
        $this->actingAs($owner)->delete(route('dashboard.businesses.destroy', $business->id), [
            'confirm_name' => 'Salah Nama',
        ])->assertSessionHasErrors('confirm_name');

        // Exact confirmation name deletes business & cleans up files
        $this->actingAs($owner)->delete(route('dashboard.businesses.destroy', $business->id), [
            'confirm_name' => 'Studio Uji',
        ])->assertRedirect(route('dashboard'));

        $this->assertNull(Business::find($business->id));
    }

    public function test_manual_walkin_booking_schedule_validation_and_customer_quota(): void
    {
        $owner = User::create([
            'name' => 'Owner Kuota',
            'email' => 'quota@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $basicPlan = SubscriptionPlan::where('slug', 'basic')->firstOrFail();
        $basicPlan->update(['max_customers_per_business' => 1]);
        $sub = app(PlanLimitService::class)->ensureTrialSubscription($owner);
        $sub->update(['subscription_plan_id' => $basicPlan->id, 'status' => 'active']);

        $business = Business::create([
            'owner_id' => $owner->id,
            'name' => 'Barber Kuota',
            'slug' => 'barber-kuota',
            'category' => 'Barbershop',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $business->users()->attach($owner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $business->seedDefaultOperatingHours();
        $owner->update(['active_business_id' => $business->id]);

        $service = Service::create([
            'business_id' => $business->id,
            'name' => 'Potong',
            'price' => 50000,
            'duration_minutes' => 30,
            'buffer_minutes' => 0,
            'capacity' => 2,
            'assignment_mode' => 'capacity',
            'dp_type' => 'fixed',
            'dp_value' => 20000,
            'is_active' => true,
        ]);

        // Schedule validation: close_time <= open_time must fail
        $invalidHours = collect(range(0, 6))->map(fn ($d) => [
            'day_of_week' => $d,
            'is_open' => true,
            'open_time' => '09:00',
            'close_time' => $d === 1 ? '08:00' : '18:00',
            'break_start' => $d === 2 ? '12:00' : null,
            'break_end' => $d === 2 ? '11:00' : null,
        ])->all();

        $this->actingAs($owner)
            ->put(route('dashboard.schedule.hours'), ['hours' => $invalidHours])
            ->assertSessionHasErrors(['hours.1.close_time', 'hours.2.break_end']);

        // Manual walk-in booking creates first customer and marks DP verified
        $candidate = now('Asia/Jakarta')->addDay();
        if ($candidate->isSunday()) {
            $candidate = $candidate->addDay();
        }
        $date = $candidate->toDateString();
        $this->actingAs($owner)
            ->getJson(route('dashboard.bookings.slots', ['service_id' => $service->id, 'date' => $date]))
            ->assertOk();

        $this->actingAs($owner)
            ->post(route('dashboard.bookings.store'), [
                'service_id' => $service->id,
                'date' => $date,
                'time' => '10:00',
                'customer_name' => 'Pelanggan Pertama',
                'customer_phone' => '081111111111',
                'initial_payment_status' => 'dp_verified',
            ])
            ->assertSessionHasNoErrors();

        $booking = Booking::where('business_id', $business->id)->firstOrFail();
        $this->assertSame('dp_verified', $booking->payment_status);
        $this->assertSame('confirmed', $booking->reservation_status);

        // Second NEW customer exceeds max_customers_per_business = 1
        $this->actingAs($owner)
            ->post(route('dashboard.bookings.store'), [
                'service_id' => $service->id,
                'date' => $date,
                'time' => '11:00',
                'customer_name' => 'Pelanggan Kedua',
                'customer_phone' => '082222222222',
                'initial_payment_status' => 'settled',
            ])
            ->assertSessionHas('error');

        $this->assertSame(1, Customer::where('business_id', $business->id)->count());

        // Returning first customer can still book
        $this->actingAs($owner)
            ->post(route('dashboard.bookings.store'), [
                'service_id' => $service->id,
                'date' => $date,
                'time' => '11:00',
                'customer_name' => 'Pelanggan Pertama',
                'customer_phone' => '081111111111',
                'initial_payment_status' => 'settled',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(2, Booking::where('business_id', $business->id)->count());
    }
}
