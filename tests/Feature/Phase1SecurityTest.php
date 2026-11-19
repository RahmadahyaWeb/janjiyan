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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Phase1SecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Satu',
            'email' => 'owner1@example.com',
            'password' => Hash::make('secret1234'),
            'email_verified_at' => now(),
        ]);

        // Ensure Enterprise plan so CSV export and multiple staff are allowed by plan limits.
        $subscription = app(PlanLimitService::class)->ensureTrialSubscription($this->owner);
        $enterprisePlan = SubscriptionPlan::where('slug', 'enterprise')->firstOrFail();
        $subscription->update(['subscription_plan_id' => $enterprisePlan->id, 'status' => 'active']);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Studio Keamanan',
            'slug' => 'studio-keamanan',
            'category' => 'Barbershop & Grooming',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->business->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->business->seedDefaultOperatingHours();

        $this->service = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Potong Rambut',
            'price' => 75000,
            'duration_minutes' => 45,
            'buffer_minutes' => 15,
            'capacity' => 2,
            'assignment_mode' => 'capacity',
            'dp_type' => 'fixed',
            'dp_value' => 25000,
            'is_active' => true,
        ]);

        $this->owner->update(['active_business_id' => $this->business->id]);
    }

    public function test_staff_creation_blocks_attaching_existing_other_user_and_requires_password(): void
    {
        $otherMerchant = User::create([
            'name' => 'Merchant Lain',
            'email' => 'other@example.com',
            'password' => Hash::make('othersecret1'),
        ]);

        // Attempt to hijack another user's email
        $this->actingAs($this->owner)
            ->post(route('dashboard.staff.store'), [
                'name' => 'Penyusup',
                'email' => 'other@example.com',
                'grant_login' => true,
                'password' => 'newpass123',
                'role' => 'admin',
            ])
            ->assertSessionHasErrors('email');

        $this->assertFalse($this->business->users()->where('users.id', $otherMerchant->id)->exists());

        // Attempt to create a new staff login without a password
        $this->actingAs($this->owner)
            ->post(route('dashboard.staff.store'), [
                'name' => 'Staff Tanpa Password',
                'email' => 'newstaff@example.com',
                'grant_login' => true,
                'password' => '',
                'role' => 'staff',
                'permissions' => ['manage_bookings'],
            ])
            ->assertSessionHasErrors('password');

        $this->assertNull(User::where('email', 'newstaff@example.com')->first());

        // Attempt to inject unknown permission key
        $this->actingAs($this->owner)
            ->post(route('dashboard.staff.store'), [
                'name' => 'Staff Izin Palsu',
                'email' => 'badperm@example.com',
                'grant_login' => true,
                'password' => 'validpass123',
                'role' => 'staff',
                'permissions' => ['*'],
            ])
            ->assertSessionHasErrors('permissions.0');

        // Valid creation succeeds
        $this->actingAs($this->owner)
            ->post(route('dashboard.staff.store'), [
                'name' => 'Staff Valid',
                'email' => 'validstaff@example.com',
                'grant_login' => true,
                'password' => 'validpass123',
                'role' => 'staff',
                'permissions' => ['manage_bookings', 'verify_payments'],
            ])
            ->assertSessionHasNoErrors();

        $created = User::where('email', 'validstaff@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('validpass123', $created->password));
        $this->assertTrue($this->business->users()->where('users.id', $created->id)->exists());
    }

    public function test_dashboard_proof_and_csv_exports_enforce_permissions_and_sanitize_csv(): void
    {
        Storage::fake('local');

        $limitedStaffUser = User::create([
            'name' => 'Staff Terbatas',
            'email' => 'limited@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        $this->business->users()->attach($limitedStaffUser->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_services']),
        ]);
        $limitedStaffUser->update(['active_business_id' => $this->business->id]);

        $verifierStaffUser = User::create([
            'name' => 'Staff Verifier',
            'email' => 'verifier@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        $this->business->users()->attach($verifierStaffUser->id, [
            'role' => 'staff',
            'permissions' => json_encode(['verify_payments']),
        ]);
        $verifierStaffUser->update(['active_business_id' => $this->business->id]);

        $proofPath = UploadedFile::fake()->image('bukti.jpg')->store('dp-proofs', 'local');
        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => '=CMD|"/C calc"!A0',
            'phone' => '+6281234567890',
        ]);
        $booking = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->service->id,
            'customer_id' => $customer->id,
            'booking_code' => 'JNY-SEC001',
            'booking_date' => now()->addDay()->toDateString(),
            'start_at' => now()->addDay()->utc(),
            'end_at' => now()->addDay()->addMinutes(45)->utc(),
            'buffer_end_at' => now()->addDay()->addMinutes(60)->utc(),
            'total_price' => 75000,
            'dp_amount' => 25000,
            'reservation_status' => 'pending',
            'payment_status' => 'waiting_verification',
            'dp_proof_path' => $proofPath,
        ]);

        // Limited staff without verify_payments/manage_bookings gets 403
        $this->actingAs($limitedStaffUser)->get(route('dashboard.bookings.proof', $booking->id))->assertForbidden();
        $this->actingAs($limitedStaffUser)->get(route('dashboard.bookings.export'))->assertForbidden();
        $this->actingAs($limitedStaffUser)->get(route('dashboard.customers.export'))->assertForbidden();

        // Verifier staff can view proof
        $this->actingAs($verifierStaffUser)->get(route('dashboard.bookings.proof', $booking->id))->assertOk();

        // Owner exports CSV with formula-injection protection
        $bookingsCsv = $this->actingAs($this->owner)->get(route('dashboard.bookings.export'));
        $bookingsCsv->assertOk();
        $bookingsContent = $bookingsCsv->streamedContent();
        $this->assertStringContainsString("'=CMD|\"\"/C calc\"\"!A0", $bookingsContent);
        $this->assertStringContainsString("'+6281234567890", $bookingsContent);

        $customersCsv = $this->actingAs($this->owner)->get(route('dashboard.customers.export'));
        $customersCsv->assertOk();
        $customersContent = $customersCsv->streamedContent();
        $this->assertStringContainsString("'=CMD|\"\"/C calc\"\"!A0", $customersContent);
        $this->assertStringContainsString("'+6281234567890", $customersContent);
    }

    public function test_public_status_masks_phone_and_upload_proof_enforces_expiry_and_cleans_old_file(): void
    {
        Storage::fake('local');

        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Siti Aminah',
            'phone' => '6281234567890',
        ]);

        $oldProofPath = UploadedFile::fake()->image('old.jpg')->store('dp-proofs', 'local');
        $booking = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->service->id,
            'customer_id' => $customer->id,
            'booking_code' => 'JNY-MASK01',
            'booking_date' => now()->addDay()->toDateString(),
            'start_at' => now()->addDay()->utc(),
            'end_at' => now()->addDay()->addMinutes(45)->utc(),
            'buffer_end_at' => now()->addDay()->addMinutes(60)->utc(),
            'total_price' => 75000,
            'dp_amount' => 25000,
            'reservation_status' => 'pending',
            'payment_status' => 'unpaid',
            'dp_proof_path' => $oldProofPath,
            'dp_expires_at' => now()->addHour(),
        ]);

        // Public status must mask customer_phone
        $this->get(route('public.booking.status', ['slug' => $this->business->slug, 'code' => $booking->booking_code]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BookingStatus')
                ->where('booking.customer_phone', '62812*****890')
            );

        // Uploading new proof deletes old file
        $this->post(route('public.booking.proof', ['slug' => $this->business->slug, 'code' => $booking->booking_code]), [
            'dp_proof' => UploadedFile::fake()->image('new.jpg'),
        ])->assertRedirect();

        $booking->refresh();
        Storage::disk('local')->assertMissing($oldProofPath);
        Storage::disk('local')->assertExists($booking->dp_proof_path);

        // Expired DP booking cannot upload proof even before scheduler runs
        $expiredBooking = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->service->id,
            'customer_id' => $customer->id,
            'booking_code' => 'JNY-EXP001',
            'booking_date' => now()->addDay()->toDateString(),
            'start_at' => now()->addDay()->utc(),
            'end_at' => now()->addDay()->addMinutes(45)->utc(),
            'buffer_end_at' => now()->addDay()->addMinutes(60)->utc(),
            'total_price' => 75000,
            'dp_amount' => 25000,
            'reservation_status' => 'pending',
            'payment_status' => 'unpaid',
            'dp_expires_at' => now()->subMinute(),
        ]);

        $this->post(route('public.booking.proof', ['slug' => $this->business->slug, 'code' => $expiredBooking->booking_code]), [
            'dp_proof' => UploadedFile::fake()->image('late.jpg'),
        ])->assertSessionHas('error');

        $expiredBooking->refresh();
        $this->assertSame('cancelled', $expiredBooking->reservation_status);
        $this->assertSame('dp_expired', $expiredBooking->cancellation_reason);
        $this->assertNull($expiredBooking->dp_proof_path);
    }

    public function test_login_and_public_booking_routes_are_rate_limited(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->post(route('login.attempt'), [
                'email' => 'brute@example.com',
                'password' => 'wrong-password',
            ])->assertRedirect();
        }

        $this->post(route('login.attempt'), [
            'email' => 'brute@example.com',
            'password' => 'wrong-password',
        ])->assertStatus(429);

        $date = now('Asia/Jakarta')->addDays(5)->toDateString();
        for ($i = 0; $i < 10; $i++) {
            $this->post(route('public.booking.store', $this->business->slug), [
                'service_id' => $this->service->id,
                'date' => $date,
                'time' => '10:00',
                'customer_name' => 'Tester',
                'customer_phone' => '08123456789',
            ])->assertRedirect();
        }

        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $date,
            'time' => '10:00',
            'customer_name' => 'Tester',
            'customer_phone' => '08123456789',
        ])->assertStatus(429);
    }
}
