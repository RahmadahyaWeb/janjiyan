<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Service;
use App\Models\Staff;
use App\Models\User;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class JanjiyanBookingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $staffBusiness;

    private Business $capacityBusiness;

    private Staff $staff;

    private Service $staffService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Test',
            'email' => 'owner@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->staffBusiness = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Studio Haircut Test',
            'slug' => 'studio-haircut-test',
            'category' => 'Barbershop & Grooming',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->staffBusiness->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->staffBusiness->seedDefaultOperatingHours();

        $this->staff = Staff::create([
            'business_id' => $this->staffBusiness->id,
            'name' => 'Stylist Satu',
            'title' => 'Senior Stylist',
            'is_active' => true,
        ]);

        $this->staffService = Service::create([
            'business_id' => $this->staffBusiness->id,
            'name' => 'Signature Haircut',
            'price' => 85000,
            'duration_minutes' => 45,
            'buffer_minutes' => 15,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'fixed',
            'dp_value' => 25000,
            'is_active' => true,
        ]);
        $this->staffService->staff()->attach($this->staff->id);

        $this->capacityBusiness = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Court Arena Test',
            'slug' => 'court-arena-test',
            'category' => 'Fitness & Sports',
            'business_type' => Business::TYPE_SPACE_BOOKING,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->capacityBusiness->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->capacityBusiness->seedDefaultOperatingHours();

        Service::create([
            'business_id' => $this->capacityBusiness->id,
            'name' => 'Sewa Court 1 Jam',
            'price' => 350000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 2,
            'assignment_mode' => 'capacity',
            'dp_type' => 'fixed',
            'dp_value' => 100000,
            'is_active' => true,
        ]);

        $this->owner->update(['active_business_id' => $this->staffBusiness->id]);
    }

    public function test_landing_page_and_public_booking_portal_render(): void
    {
        $this->get('/')->assertStatus(200);
        $this->get("/b/{$this->staffBusiness->slug}")->assertStatus(200);
        $this->get("/b/{$this->capacityBusiness->slug}")->assertStatus(200);
    }

    public function test_slot_availability_returns_slots_for_valid_date(): void
    {
        $targetCarbon = now('Asia/Jakarta')->addDays(2);
        if ($targetCarbon->isSunday()) {
            $targetCarbon = $targetCarbon->addDay();
        }
        $tomorrow = $targetCarbon->toDateString();

        $response = $this->getJson("/b/{$this->staffBusiness->slug}/slots?service_id={$this->staffService->id}&date={$tomorrow}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'slots' => [
                    ['time', 'available_capacity', 'available_staff_ids'],
                ],
            ]);

        $this->assertNotEmpty($response->json('slots'));
    }

    public function test_customer_can_book_with_pay_later_dp_and_scheduler_expires_it(): void
    {
        $targetCarbon = now('Asia/Jakarta')->addDays(3);
        if ($targetCarbon->isSunday()) {
            $targetCarbon = $targetCarbon->addDay();
        }
        $targetDate = $targetCarbon->toDateString();

        // Book without DP proof (Pay Later)
        $response = $this->post("/b/{$this->staffBusiness->slug}/book", [
            'service_id' => $this->staffService->id,
            'date' => $targetDate,
            'time' => '10:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
        ]);

        $response->assertRedirect();

        $booking = Booking::where('business_id', $this->staffBusiness->id)->latest('id')->firstOrFail();
        $this->assertSame('pending', $booking->reservation_status);
        $this->assertSame('unpaid', $booking->payment_status);
        $this->assertNotNull($booking->dp_expires_at);

        // Attempt double-booking the exact same staff & time -> must fail
        $doubleResponse = $this->post("/b/{$this->staffBusiness->slug}/book", [
            'service_id' => $this->staffService->id,
            'date' => $targetDate,
            'time' => '10:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Citra Dewi',
            'customer_phone' => '081299998888',
        ]);
        $doubleResponse->assertSessionHas('error');

        // Simulate expiry & run scheduler command
        $booking->update(['dp_expires_at' => now()->subMinute()]);
        $this->artisan('bookings:expire-unpaid')->assertExitCode(0);

        $booking->refresh();
        $this->assertSame('cancelled', $booking->reservation_status);
        $this->assertSame('dp_expired', $booking->cancellation_reason);
    }

    public function test_merchant_can_verify_uploaded_dp_proof(): void
    {
        Storage::fake('local');

        $targetDate = now('Asia/Jakarta')->addDays(4)->toDateString();

        $this->post("/b/{$this->staffBusiness->slug}/book", [
            'service_id' => $this->staffService->id,
            'date' => $targetDate,
            'time' => '14:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Eko Prasetyo',
            'customer_phone' => '081355556666',
            'dp_proof' => UploadedFile::fake()->image('bukti.jpg'),
        ])->assertRedirect();

        $booking = Booking::where('business_id', $this->staffBusiness->id)->latest('id')->firstOrFail();
        $this->assertSame('waiting_verification', $booking->payment_status);

        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.verify-dp', $booking->id))
            ->assertRedirect();

        $booking->refresh();
        $this->assertSame('dp_verified', $booking->payment_status);
        $this->assertSame('confirmed', $booking->reservation_status);
    }
}
