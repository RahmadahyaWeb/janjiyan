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
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BookingOperationsUxTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $appointmentBiz;

    private Service $appointmentService;

    private Staff $staffA;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner UX',
            'email' => 'owner-ux@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->appointmentBiz = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Studio UX',
            'slug' => 'studio-ux',
            'category' => 'Barbershop',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'phone' => '081234567890',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->appointmentBiz->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->appointmentBiz->seedDefaultOperatingHours();
        $this->owner->update(['active_business_id' => $this->appointmentBiz->id]);

        $this->staffA = Staff::create([
            'business_id' => $this->appointmentBiz->id,
            'name' => 'Andi UX',
            'is_active' => true,
        ]);

        $this->appointmentService = Service::create([
            'business_id' => $this->appointmentBiz->id,
            'name' => 'Haircut UX',
            'price' => 80000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'fixed',
            'dp_value' => 20000,
            'is_active' => true,
        ]);
        $this->appointmentService->staff()->attach($this->staffA->id);
    }

    public function test_upcoming_sort_and_calendar_filters_and_prefill_work_cleanly(): void
    {
        $tz = 'Asia/Jakarta';
        $today = CarbonImmutable::now($tz)->startOfDay();
        $tomorrow = $today->addDay();

        $customer = Customer::create([
            'business_id' => $this->appointmentBiz->id,
            'name' => 'Budi UX',
            'phone' => '628111111111',
        ]);

        Booking::create([
            'business_id' => $this->appointmentBiz->id,
            'customer_id' => $customer->id,
            'service_id' => $this->appointmentService->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'UX-LATER',
            'booking_date' => $tomorrow->toDateString(),
            'start_at' => $tomorrow->setTime(15, 0)->utc(),
            'end_at' => $tomorrow->setTime(16, 0)->utc(),
            'buffer_end_at' => $tomorrow->setTime(16, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 20000,
            'reservation_status' => 'confirmed',
            'payment_status' => 'dp_verified',
        ]);

        Booking::create([
            'business_id' => $this->appointmentBiz->id,
            'customer_id' => $customer->id,
            'service_id' => $this->appointmentService->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'UX-SOON',
            'booking_date' => $today->toDateString(),
            'start_at' => $today->setTime(10, 0)->utc(),
            'end_at' => $today->setTime(11, 0)->utc(),
            'buffer_end_at' => $today->setTime(11, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 20000,
            'reservation_status' => 'confirmed',
            'payment_status' => 'dp_verified',
        ]);

        // sort=upcoming returns nearest schedule first
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings', ['status' => 'active', 'sort' => 'upcoming']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sort', 'upcoming')
                ->where('bookings.0.booking_code', 'UX-SOON')
                ->where('bookings.1.booking_code', 'UX-LATER')
            );

        // Overview returns todaySchedule for today's active bookings
        $this->actingAs($this->owner)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->has('todaySchedule', 1)
                ->where('todaySchedule.0.booking_code', 'UX-SOON')
            );

        // Create page supports date/time/staff_id/customer_id prefill
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings.create', [
                'date' => $tomorrow->toDateString(),
                'time' => '14:00',
                'staff_id' => $this->staffA->id,
                'customer_id' => $customer->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Bookings/Create')
                ->where('prefill.date', $tomorrow->toDateString())
                ->where('prefill.time', '14:00')
                ->where('prefill.staff_id', (string) $this->staffA->id)
                ->where('prefill.customer.id', $customer->id)
            );
    }

    public function test_mark_completed_on_payment_and_stay_on_page_reschedule_and_post_action_receipt(): void
    {
        $tz = 'Asia/Jakarta';
        $day = CarbonImmutable::now($tz)->addDays(2)->startOfDay();
        while ($day->dayOfWeek === 0) {
            $day = $day->addDay();
        }

        $storeRes = $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.store'), [
                'service_id' => $this->appointmentService->id,
                'date' => $day->toDateString(),
                'time' => '10:00',
                'staff_id' => $this->staffA->id,
                'customer_name' => 'Siti POS',
                'customer_phone' => '081299990000',
                'initial_payment_status' => 'dp_verified',
                'payment_method' => 'qris',
                'post_action' => 'receipt',
            ]);

        $booking = Booking::where('business_id', $this->appointmentBiz->id)->latest('id')->firstOrFail();
        $storeRes->assertRedirect(route('dashboard.bookings', ['open_receipt' => $booking->id]));

        // Reschedule with stay_on_page redirects back instead of resetting filters
        $this->actingAs($this->owner)
            ->from(route('dashboard.bookings', ['view' => 'calendar']))
            ->post(route('dashboard.bookings.reschedule', $booking->id), [
                'date' => $day->toDateString(),
                'time' => '13:00',
                'staff_id' => $this->staffA->id,
                'stay_on_page' => true,
            ])
            ->assertRedirect(route('dashboard.bookings', ['view' => 'calendar']));

        // Settle remaining balance + mark_completed atomically
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.payments.store', $booking->id), [
                'payment_type' => 'settlement',
                'payment_method' => 'cash',
                'amount' => 60000,
                'received_amount' => 100000,
                'mark_completed' => true,
            ])
            ->assertSessionHas('success');

        $booking->refresh();
        $this->assertSame('settled', $booking->payment_status);
        $this->assertSame('completed', $booking->reservation_status);
        $this->assertSame(0, $booking->remainingBalance());
    }

    public function test_dropoff_sla_filters_and_overview_pipeline(): void
    {
        $dropoffBiz = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Clean Shoes UX',
            'slug' => 'clean-shoes-ux',
            'category' => 'Cuci Sepatu & Tas',
            'business_type' => Business::TYPE_DROPOFF,
            'phone' => '081234567899',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $dropoffBiz->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $dropoffBiz->seedDefaultOperatingHours();
        $this->owner->update(['active_business_id' => $dropoffBiz->id]);

        $svc = Service::create([
            'business_id' => $dropoffBiz->id,
            'name' => 'Deep Clean',
            'price' => 50000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 20,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'pasang',
            'turnaround_days' => 2,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        $cust = Customer::create([
            'business_id' => $dropoffBiz->id,
            'name' => 'Raka Dropoff',
            'phone' => '628133334444',
        ]);

        $today = CarbonImmutable::now('Asia/Jakarta')->toDateString();
        $yesterday = CarbonImmutable::now('Asia/Jakarta')->subDay()->toDateString();

        Booking::create([
            'business_id' => $dropoffBiz->id,
            'customer_id' => $cust->id,
            'service_id' => $svc->id,
            'booking_code' => 'DRP-OVERDUE',
            'booking_mode' => 'dropoff',
            'quantity' => 1,
            'unit_label' => 'pasang',
            'fulfillment_type' => 'dropoff',
            'work_status' => 'in_progress',
            'booking_date' => $yesterday,
            'estimated_ready_date' => $yesterday,
            'start_at' => CarbonImmutable::now('Asia/Jakarta')->subDay()->utc(),
            'end_at' => CarbonImmutable::now('Asia/Jakarta')->subDay()->addHour()->utc(),
            'buffer_end_at' => CarbonImmutable::now('Asia/Jakarta')->subDay()->addHour()->utc(),
            'total_price' => 50000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'payment_status' => 'unpaid',
        ]);

        Booking::create([
            'business_id' => $dropoffBiz->id,
            'customer_id' => $cust->id,
            'service_id' => $svc->id,
            'booking_code' => 'DRP-READY',
            'booking_mode' => 'dropoff',
            'quantity' => 1,
            'unit_label' => 'pasang',
            'fulfillment_type' => 'dropoff',
            'work_status' => 'ready_for_pickup',
            'booking_date' => $yesterday,
            'estimated_ready_date' => $yesterday,
            'start_at' => CarbonImmutable::now('Asia/Jakarta')->subDay()->utc(),
            'end_at' => CarbonImmutable::now('Asia/Jakarta')->subDay()->addHour()->utc(),
            'buffer_end_at' => CarbonImmutable::now('Asia/Jakarta')->subDay()->addHour()->utc(),
            'total_price' => 50000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'payment_status' => 'unpaid',
        ]);

        // SLA overdue only counts items not yet ready_for_pickup/picked_up
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings', ['status' => 'active', 'sla' => 'overdue']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sla', 'overdue')
                ->where('dropoffSlaCounts.overdue', 1)
                ->has('bookings', 1)
                ->where('bookings.0.booking_code', 'DRP-OVERDUE')
            );

        // Overview exposes dropoffPipeline counts
        $this->actingAs($this->owner)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('dropoffPipeline.in_progress', 1)
                ->where('dropoffPipeline.ready_for_pickup', 1)
                ->where('dropoffPipeline.overdue', 1)
            );
    }
}
