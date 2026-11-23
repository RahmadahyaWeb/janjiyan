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
            'business_type' => Business::TYPE_DROPOFF,
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
            'unit_label' => 'pasang',
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

    private function makeBooking(Service $service, string $code, array $attrs = []): Booking
    {
        $customer = Customer::firstOrCreate(
            ['business_id' => $this->business->id, 'phone' => '6281200000000'],
            ['name' => 'Rina']
        );
        $day = $this->nextOpenWeekday(1);

        return Booking::create(array_merge([
            'business_id' => $this->business->id,
            'customer_id' => $customer->id,
            'service_id' => $service->id,
            'booking_mode' => $service->booking_mode,
            'booking_code' => $code,
            'booking_date' => $day->toDateString(),
            'start_at' => $day->setTime(10, 0)->utc(),
            'end_at' => $day->setTime(11, 0)->utc(),
            'buffer_end_at' => $day->setTime(11, 0)->utc(),
            'total_price' => 50000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'payment_status' => 'unpaid',
        ], $attrs));
    }

    public function test_dropoff_business_bookings_index_filters_work_statuses_and_exports_csv(): void
    {
        $this->makeBooking($this->dropoffService, 'JNY-DROP1', ['work_status' => 'awaiting_dropoff']);
        $this->makeBooking($this->dropoffService, 'JNY-DROP2', ['work_status' => 'ready_for_pickup']);

        $codes = fn ($res) => collect($res->viewData('page')['props']['bookings'])->pluck('booking_code')->sort()->values()->all();

        $res = $this->actingAs($this->owner)->get(route('dashboard.bookings'))->assertOk();
        $props = $res->viewData('page')['props'];
        $this->assertArrayNotHasKey('hasBothModes', $props);
        $this->assertArrayNotHasKey('modeCounts', $props);
        $this->assertSame('dropoff', $props['filters']['mode']);
        $this->assertSame(['JNY-DROP1', 'JNY-DROP2'], $codes($res));

        // Drop-off tab filters by work status.
        $res = $this->actingAs($this->owner)->get(route('dashboard.bookings', ['status' => 'ready_for_pickup']));
        $this->assertSame(['JNY-DROP2'], $codes($res));
        $res = $this->actingAs($this->owner)->get(route('dashboard.bookings', ['status' => 'awaiting_dropoff']));
        $this->assertSame(['JNY-DROP1'], $codes($res));

        // Invalid/non-dropoff status (like no_show) sanitizes back to active.
        $res = $this->actingAs($this->owner)->get(route('dashboard.bookings', ['status' => 'no_show']));
        $this->assertSame('active', $res->viewData('page')['props']['filters']['status']);
        $this->assertSame(['JNY-DROP1', 'JNY-DROP2'], $codes($res));

        // Export follows the same work-status filter and includes Satuan snapshot.
        $csv = $this->actingAs($this->owner)
            ->get(route('dashboard.bookings.export', ['status' => 'ready_for_pickup']))
            ->assertOk()
            ->streamedContent();
        $this->assertStringContainsString('Satuan', $csv);
        $this->assertStringContainsString('pasang', $csv);
        $this->assertStringContainsString('JNY-DROP2', $csv);
        $this->assertStringNotContainsString('JNY-DROP1', $csv);

        // Drop-off mode never renders the calendar.
        $res = $this->actingAs($this->owner)->get(route('dashboard.bookings', ['view' => 'calendar']));
        $this->assertSame('list', $res->viewData('page')['props']['filters']['view']);
    }

    public function test_dropoff_only_shop_defaults_to_dropoff_without_mode_switch(): void
    {
        $this->makeBooking($this->dropoffService, 'JNY-DROP1', ['work_status' => 'in_progress']);

        $res = $this->actingAs($this->owner)->get(route('dashboard.bookings', ['status' => 'in_progress']))->assertOk();
        $props = $res->viewData('page')['props'];
        $this->assertArrayNotHasKey('hasBothModes', $props);
        $this->assertArrayNotHasKey('modeCounts', $props);
        $this->assertSame('dropoff', $props['filters']['mode']);
        $this->assertSame('pasang', $props['bookings'][0]['unit_label']);
        $this->assertSame(['JNY-DROP1'], collect($props['bookings'])->pluck('booking_code')->all());
    }

    public function test_merchant_can_create_dropoff_service_without_time_slot_duration(): void
    {
        $response = $this->actingAs($this->owner)->post('/dashboard/services', [
            'name' => 'Unyellowing Midsole',
            'description' => 'Treatment sol menguning',
            'price' => 75000,
            'turnaround_days' => 3,
            'supports_pickup' => true,
            'capacity' => 12,
            'unit_label' => 'pasang',
            'dp_type' => 'none',
            'dp_value' => 0,
        ]);

        $response->assertRedirect();

        $service = Service::where('name', 'Unyellowing Midsole')->firstOrFail();
        $this->assertSame('dropoff', $service->booking_mode);
        $this->assertSame('pasang', $service->unit_label);
        $this->assertSame(3, $service->turnaround_days);
        $this->assertTrue($service->supports_pickup);
        $this->assertSame(12, $service->capacity);
        $this->assertSame('capacity', $service->assignment_mode);
    }

    public function test_public_dropoff_availability_and_booking_without_time_slot(): void
    {
        $targetDate = $this->nextOpenWeekday(2);

        $availRes = $this->getJson(route('public.booking.slots', [
            'slug' => $this->business->slug,
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
        ]));
        $availRes->assertOk()
            ->assertJsonPath('booking_mode', 'dropoff')
            ->assertJsonPath('dropoff.available', true)
            ->assertJsonPath('dropoff.unit_label', 'pasang')
            ->assertJsonPath('dropoff.remaining_capacity', 5)
            ->assertJsonPath('dropoff.total_capacity', 5)
            ->assertJsonPath('slots', []);

        // Book 3 pairs without specifying time
        $bookRes = $this->post(route('public.booking.store', $this->business->slug), [
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
        $this->assertSame('pasang', $booking->unit_label);
        $this->assertSame(3, $booking->quantity);
        $this->assertSame(150000, $booking->total_price);
        $this->assertSame(45000, $booking->dp_amount);
        $this->assertSame('awaiting_dropoff', $booking->work_status);
        $this->assertSame('dropoff', $booking->fulfillment_type);
        $this->assertNotNull($booking->estimated_ready_date);

        // Remaining quota should now be 2
        $afterAvail = $this->getJson(route('public.booking.slots', [
            'slug' => $this->business->slug,
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
        ]));
        $afterAvail->assertOk()->assertJsonPath('dropoff.remaining_capacity', 2);

        // Requesting 3 more pairs must fail because only 2 quota left
        $overRes = $this->post(route('public.booking.store', $this->business->slug), [
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

        $missingAddress = $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 1,
            'fulfillment_type' => 'pickup',
            'pickup_session' => 'morning',
            'customer_name' => 'Siti Aminah',
            'customer_phone' => '08129876543',
        ]);

        $missingAddress->assertSessionHasErrors('pickup_address');

        $validPickup = $this->post(route('public.booking.store', $this->business->slug), [
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

        $slotBusiness = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Barber Express',
            'slug' => 'barber-express',
            'category' => 'Barbershop',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $slotBusiness->users()->attach($this->owner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $slotBusiness->seedDefaultOperatingHours();

        $staff = Staff::create([
            'business_id' => $slotBusiness->id,
            'name' => 'Dimas',
            'is_active' => true,
        ]);

        $expressService = Service::create([
            'business_id' => $slotBusiness->id,
            'name' => 'Express Haircut',
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
        $this->assertSame('pasang', $dropoffBooking->unit_label);

        // Time-slot service must still have slots available on the exact same day
        $slotsRes = $this->getJson(route('public.booking.slots', [
            'slug' => $slotBusiness->slug,
            'service_id' => $expressService->id,
            'date' => $targetDate->toDateString(),
        ]));
        $slotsRes->assertOk()->assertJsonStructure(['slots']);
        $this->assertNotEmpty($slotsRes->json('slots'));

        // Progress dropoff work_status -> in_progress -> ready_for_pickup -> picked_up
        $this->actingAs($this->owner)->patch(route('dashboard.bookings.status', $dropoffBooking->id), [
            'work_status' => 'in_progress',
        ])->assertRedirect();
        $this->assertSame('in_progress', $dropoffBooking->fresh()->work_status);

        $this->actingAs($this->owner)->patch(route('dashboard.bookings.status', $dropoffBooking->id), [
            'work_status' => 'ready_for_pickup',
        ])->assertRedirect();
        $this->assertSame('ready_for_pickup', $dropoffBooking->fresh()->work_status);

        $this->actingAs($this->owner)->patch(route('dashboard.bookings.status', $dropoffBooking->id), [
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

    public function test_dropoff_business_type_and_derived_modes_shared_in_inertia(): void
    {
        $fresh = $this->business->fresh();
        $this->assertSame(Business::TYPE_DROPOFF, $fresh->resolvedBusinessType());
        $this->assertSame('dropoff', $fresh->serviceBookingMode());
        $this->assertSame('capacity', $fresh->serviceAssignmentMode());
        $this->assertSame('dropoff', $fresh->primaryBookingMode());

        $res = $this->actingAs($this->owner)->get(route('dashboard'))->assertOk();
        $activeBusinessProp = $res->viewData('page')['props']['activeBusiness'];
        $this->assertSame(Business::TYPE_DROPOFF, $activeBusinessProp['business_type']);
        $this->assertArrayNotHasKey('primary_booking_mode', $activeBusinessProp);
    }

    public function test_dropoff_stage_counts_today_date_and_smart_fifo_sorting(): void
    {
        $day = $this->nextOpenWeekday(1);

        // Create active drop-off bookings across stages and estimated_ready_dates
        $this->makeBooking($this->dropoffService, 'JNY-LATER', [
            'booking_date' => $day->toDateString(),
            'estimated_ready_date' => $day->addDays(4)->toDateString(),
            'work_status' => 'in_progress',
            'reservation_status' => 'confirmed',
        ]);
        $this->makeBooking($this->dropoffService, 'JNY-URGENT', [
            'booking_date' => $day->addDay()->toDateString(),
            'estimated_ready_date' => $day->toDateString(),
            'work_status' => 'awaiting_dropoff',
            'reservation_status' => 'pending',
        ]);
        $this->makeBooking($this->dropoffService, 'JNY-READY', [
            'booking_date' => $day->toDateString(),
            'estimated_ready_date' => $day->addDays(1)->toDateString(),
            'work_status' => 'ready_for_pickup',
            'reservation_status' => 'confirmed',
        ]);
        $this->makeBooking($this->dropoffService, 'JNY-DONE', [
            'booking_date' => $day->toDateString(),
            'estimated_ready_date' => $day->toDateString(),
            'work_status' => 'picked_up',
            'reservation_status' => 'completed',
        ]);

        $res = $this->actingAs($this->owner)
            ->get(route('dashboard.bookings', ['mode' => 'dropoff', 'status' => 'active']))
            ->assertOk();

        $props = $res->viewData('page')['props'];

        $this->assertNotEmpty($props['todayDate']);
        $this->assertSame([
            'active' => 3,
            'awaiting_dropoff' => 1,
            'in_progress' => 1,
            'ready_for_pickup' => 1,
        ], $props['dropoffStageCounts']);

        // Active queue must be ordered FIFO by earliest estimated_ready_date first
        $orderedCodes = collect($props['bookings'])->pluck('booking_code')->all();
        $this->assertSame(['JNY-URGENT', 'JNY-READY', 'JNY-LATER'], $orderedCodes);
    }

    public function test_manual_walkin_dropoff_supports_start_in_progress_direct_intake(): void
    {
        $targetDate = $this->nextOpenWeekday(1);

        // Walk-in direct intake (start_in_progress = true, fulfillment_type = dropoff)
        $res = $this->actingAs($this->owner)->post('/dashboard/bookings', [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 2,
            'fulfillment_type' => 'dropoff',
            'start_in_progress' => true,
            'customer_name' => 'Walkin Customer',
            'customer_phone' => '081234567800',
            'initial_payment_status' => 'unpaid',
        ]);

        $res->assertRedirect();
        $booking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();
        $this->assertSame('in_progress', $booking->work_status);
        $this->assertSame('confirmed', $booking->reservation_status);
        $res->assertSessionHas('success', "Pesanan manual {$booking->booking_code} berhasil dibuat.");

        // Pickup orders ignore start_in_progress and remain awaiting_dropoff
        $this->actingAs($this->owner)->post('/dashboard/bookings', [
            'service_id' => $this->dropoffService->id,
            'date' => $targetDate->toDateString(),
            'quantity' => 1,
            'fulfillment_type' => 'pickup',
            'pickup_session' => 'morning',
            'pickup_address' => 'Jl. Kenanga No. 12',
            'start_in_progress' => true,
            'customer_name' => 'Pickup Customer',
            'customer_phone' => '081234567801',
            'initial_payment_status' => 'unpaid',
        ])->assertRedirect();

        $pickupBooking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();
        $this->assertSame('awaiting_dropoff', $pickupBooking->work_status);
    }
}
