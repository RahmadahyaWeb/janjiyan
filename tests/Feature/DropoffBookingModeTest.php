<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\User;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class DropoffBookingModeTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private Service $dropoffService;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::factory()->create([
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Soklenn Shoe Care',
            'slug' => 'soklenn-shoe-care',
            'category' => 'Cuci Sepatu & Care',
            'phone' => '6281234567890',
            'address' => 'Jl. Melati No. 10',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);

        $this->business->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->business->seedDefaultOperatingHours();
        $this->owner->update(['active_business_id' => $this->business->id]);

        $this->dropoffService = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Deep Clean Sepatu',
            'price' => 50000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 5,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'turnaround_days' => 2,
            'supports_pickup' => true,
            'dp_type' => 'fixed',
            'dp_value' => 15000,
            'is_active' => true,
        ]);
    }

    private function nextOpenWeekday(int $daysAhead = 1): CarbonImmutable
    {
        $candidate = CarbonImmutable::now('Asia/Jakarta')->startOfDay()->addDays($daysAhead);
        while ($candidate->isSunday()) {
            $candidate = $candidate->addDay();
        }

        return $candidate;
    }

    public function test_merchant_can_create_dropoff_service_without_time_slot_duration(): void
    {
        $response = $this->actingAs($this->owner)->post('/dashboard/services', [
            'name' => 'Unyellowing Midsole',
            'description' => 'Treatment sol menguning',
            'price' => 75000,
            'booking_mode' => 'dropoff',
            'turnaround_days' => 3,
            'supports_pickup' => true,
            'capacity' => 12,
            'dp_type' => 'none',
            'dp_value' => 0,
        ]);

        $response->assertRedirect();

        $service = Service::where('name', 'Unyellowing Midsole')->firstOrFail();
        $this->assertSame('dropoff', $service->booking_mode);
        $this->assertSame(3, $service->turnaround_days);
        $this->assertTrue($service->supports_pickup);
        $this->assertSame(12, $service->capacity);
        $this->assertSame('capacity', $service->assignment_mode);
    }

    public function test_public_dropoff_availability_and_booking_without_time_slot(): void
    {
        $targetDate = $this->nextOpenWeekday(2);

        $availRes = $this->getJson("/b/{$this->business->slug}/slots?service_id={$this->dropoffService->id}&date={$targetDate->toDateString()}");
        $availRes->assertOk()
            ->assertJsonPath('booking_mode', 'dropoff')
            ->assertJsonPath('dropoff.available', true)
            ->assertJsonPath('dropoff.remaining_capacity', 5)
            ->assertJsonPath('dropoff.total_capacity', 5)
            ->assertJsonPath('slots', []);

        // Book 3 pairs without specifying time
        $bookRes = $this->post("/b/{$this->business->slug}/book", [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 3,
            'fulfillment_type' => 'dropoff',
            'customer_name' => 'Rizky Pratama',
            'customer_phone' => '08111222333',
            'customer_email' => 'rizky@example.com',
            'customer_notes' => '2 putih 1 hitam',
        ]);

        $bookRes->assertRedirect();

        $booking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();
        $this->assertSame('dropoff', $booking->booking_mode);
        $this->assertSame(3, $booking->quantity);
        $this->assertSame(150000, $booking->total_price);
        $this->assertSame(45000, $booking->dp_amount);
        $this->assertSame('awaiting_dropoff', $booking->work_status);
        $this->assertSame('dropoff', $booking->fulfillment_type);
        $this->assertNotNull($booking->estimated_ready_date);

        // Remaining quota should now be 2
        $afterAvail = $this->getJson("/b/{$this->business->slug}/slots?service_id={$this->dropoffService->id}&date={$targetDate->toDateString()}");
        $afterAvail->assertOk()->assertJsonPath('dropoff.remaining_capacity', 2);

        // Requesting 3 more pairs must fail because only 2 quota left
        $overRes = $this->post("/b/{$this->business->slug}/book", [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 3,
            'fulfillment_type' => 'dropoff',
            'customer_name' => 'Andi',
            'customer_phone' => '08111999888',
        ]);

        $overRes->assertSessionHas('error');
        $this->assertSame(1, Booking::where('business_id', $this->business->id)->count());
    }

    public function test_pickup_requires_address_and_saves_session_when_provided(): void
    {
        $targetDate = $this->nextOpenWeekday(2);

        $missingAddress = $this->post("/b/{$this->business->slug}/book", [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 1,
            'fulfillment_type' => 'pickup',
            'pickup_session' => 'morning',
            'customer_name' => 'Siti Aminah',
            'customer_phone' => '08129876543',
        ]);

        $missingAddress->assertSessionHasErrors('pickup_address');

        $validPickup = $this->post("/b/{$this->business->slug}/book", [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 2,
            'fulfillment_type' => 'pickup',
            'pickup_session' => 'afternoon',
            'pickup_address' => 'Jl. Anggrek No. 45',
            'customer_name' => 'Siti Aminah',
            'customer_phone' => '08129876543',
        ]);

        $validPickup->assertRedirect();

        $booking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();
        $this->assertSame('pickup', $booking->fulfillment_type);
        $this->assertSame('afternoon', $booking->pickup_session);
        $this->assertSame('Jl. Anggrek No. 45', $booking->pickup_address);
    }

    public function test_dropoff_booking_does_not_block_time_slot_services_and_supports_work_status_flow(): void
    {
        $targetDate = $this->nextOpenWeekday(2);

        $staff = Staff::create([
            'business_id' => $this->business->id,
            'name' => 'Dimas',
            'is_active' => true,
        ]);

        $expressService = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Express Clean On-Site',
            'price' => 40000,
            'duration_minutes' => 30,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'booking_mode' => 'time_slot',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
        $expressService->staff()->attach($staff->id);

        // Create manual drop-off booking
        $this->actingAs($this->owner)->post('/dashboard/bookings', [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 2,
            'fulfillment_type' => 'dropoff',
            'customer_name' => 'Budi',
            'customer_phone' => '081333444555',
            'initial_payment_status' => 'dp_verified',
        ])->assertRedirect();

        $dropoffBooking = Booking::where('service_id', $this->dropoffService->id)->firstOrFail();
        $this->assertSame('confirmed', $dropoffBooking->reservation_status);
        $this->assertSame('awaiting_dropoff', $dropoffBooking->work_status);

        // Time-slot service must still have slots available on the exact same day
        $slotsRes = $this->getJson("/b/{$this->business->slug}/slots?service_id={$expressService->id}&date={$targetDate->toDateString()}");
        $slotsRes->assertOk()->assertJsonStructure(['slots']);
        $this->assertNotEmpty($slotsRes->json('slots'));

        // Progress dropoff work_status -> in_progress -> ready_for_pickup -> picked_up
        $this->actingAs($this->owner)->patch("/dashboard/bookings/{$dropoffBooking->id}/status", [
            'work_status' => 'in_progress',
        ])->assertRedirect();
        $this->assertSame('in_progress', $dropoffBooking->fresh()->work_status);

        $this->actingAs($this->owner)->patch("/dashboard/bookings/{$dropoffBooking->id}/status", [
            'work_status' => 'ready_for_pickup',
        ])->assertRedirect();
        $this->assertSame('ready_for_pickup', $dropoffBooking->fresh()->work_status);

        $this->actingAs($this->owner)->patch("/dashboard/bookings/{$dropoffBooking->id}/status", [
            'work_status' => 'picked_up',
        ])->assertRedirect();
        $fresh = $dropoffBooking->fresh();
        $this->assertSame('picked_up', $fresh->work_status);
        $this->assertSame('completed', $fresh->reservation_status);
    }

    public function test_dropoff_reschedule_and_ready_for_pickup_template_and_h2_reminder_skip(): void
    {
        $targetDate = $this->nextOpenWeekday(2);
        $newDate = $this->nextOpenWeekday(4);

        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Dina',
            'phone' => '6281555666777',
            'email' => 'dina@example.com',
        ]);

        // Booking starting in 2 hours (within H-2 window)
        $soonUtc = CarbonImmutable::now('UTC')->addHours(2);
        $booking = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->dropoffService->id,
            'customer_id' => $customer->id,
            'booking_mode' => 'dropoff',
            'quantity' => 1,
            'fulfillment_type' => 'dropoff',
            'booking_code' => 'JNY-DROP01',
            'invoice_number' => 'INV-20261120-DROP01',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $targetDate->toDateString(),
            'start_at' => $soonUtc,
            'end_at' => $soonUtc->addHours(4),
            'buffer_end_at' => $soonUtc->addHours(4),
            'estimated_ready_date' => $targetDate->addDays(2)->toDateString(),
            'total_price' => 50000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'work_status' => 'awaiting_dropoff',
            'payment_status' => 'unpaid',
        ]);

        // Run reminder scheduler: H-2 must NOT fire for dropoff bookings
        $this->artisan('bookings:send-reminders')->assertExitCode(0);
        $this->assertNull($booking->fresh()->reminder_h2_sent_at);

        // Reschedule dropoff date without time
        $this->actingAs($this->owner)->post("/dashboard/bookings/{$booking->id}/reschedule", [
            'date' => $newDate->toDateString(),
        ])->assertRedirect();

        $this->assertSame($newDate->toDateString(), $booking->fresh()->booking_date->toDateString());
        $this->assertSame(1, $booking->fresh()->rescheduled_count);

        // Save ready_for_pickup WA template in Settings
        $this->actingAs($this->owner)->post('/dashboard/settings', [
            'name' => $this->business->name,
            'slug' => $this->business->slug,
            'category' => $this->business->category,
            'timezone' => $this->business->timezone,
            'dp_expiry_minutes' => 120,
            'whatsapp_templates' => [
                'ready_for_pickup' => 'Halo {customer_name}, {service_name} ({quantity} pasang) siap diambil!',
            ],
        ])->assertRedirect();

        $templates = $this->business->fresh()->resolvedWhatsappTemplates();
        $this->assertSame(
            'Halo {customer_name}, {service_name} ({quantity} pasang) siap diambil!',
            $templates['ready_for_pickup']
        );
    }
}
