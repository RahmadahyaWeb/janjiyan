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

class OwnerPanelEnhancementsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private Service $serviceA;

    private Service $serviceB;

    private Staff $staffA;

    private Staff $staffB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Panel',
            'email' => 'owner-panel@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Studio Panel',
            'slug' => 'studio-panel',
            'category' => 'Barbershop',
            'phone' => '081234567890',
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

        $this->staffA = Staff::create([
            'business_id' => $this->business->id,
            'name' => 'Andi Staff',
            'is_active' => true,
        ]);
        $this->staffB = Staff::create([
            'business_id' => $this->business->id,
            'name' => 'Bima Staff',
            'is_active' => true,
        ]);

        $this->serviceA = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Haircut',
            'price' => 80000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'fixed',
            'dp_value' => 25000,
            'is_active' => true,
        ]);

        $this->serviceB = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Beard Trim',
            'price' => 50000,
            'duration_minutes' => 30,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
    }

    public function test_bookings_index_defaults_to_pending_sorted_newest_and_supports_staff_and_service_filters(): void
    {
        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Raka',
            'phone' => '628111111111',
        ]);

        $day1 = CarbonImmutable::now('Asia/Jakarta')->addDays(1);
        $day2 = CarbonImmutable::now('Asia/Jakarta')->addDays(2);

        $olderPending = Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $customer->id,
            'service_id' => $this->serviceA->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'JNY-OLD01',
            'booking_date' => $day1->toDateString(),
            'start_at' => $day1->setTime(10, 0)->utc(),
            'end_at' => $day1->setTime(11, 0)->utc(),
            'buffer_end_at' => $day1->setTime(11, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'pending',
            'payment_status' => 'unpaid',
        ]);

        $newerPending = Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $customer->id,
            'service_id' => $this->serviceB->id,
            'staff_id' => $this->staffB->id,
            'booking_code' => 'JNY-NEW02',
            'booking_date' => $day2->toDateString(),
            'start_at' => $day2->setTime(14, 0)->utc(),
            'end_at' => $day2->setTime(14, 30)->utc(),
            'buffer_end_at' => $day2->setTime(14, 30)->utc(),
            'total_price' => 50000,
            'dp_amount' => 0,
            'reservation_status' => 'pending',
            'payment_status' => 'waiting_verification',
        ]);

        Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $customer->id,
            'service_id' => $this->serviceA->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'JNY-CONF03',
            'booking_date' => $day2->toDateString(),
            'start_at' => $day2->setTime(16, 0)->utc(),
            'end_at' => $day2->setTime(17, 0)->utc(),
            'buffer_end_at' => $day2->setTime(17, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'confirmed',
            'payment_status' => 'dp_verified',
        ]);

        Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $customer->id,
            'service_id' => $this->serviceA->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'JNY-DONE04',
            'booking_date' => $day2->toDateString(),
            'start_at' => $day2->setTime(18, 0)->utc(),
            'end_at' => $day2->setTime(19, 0)->utc(),
            'buffer_end_at' => $day2->setTime(19, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'completed',
            'payment_status' => 'settled',
        ]);

        // Default view returns active bookings (pending + confirmed), newest schedule date first, excluding completed
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Bookings/Index')
                ->where('filters.status', 'active')
                ->where('pendingBookingsCount', 2)
                ->has('bookings', 3)
                ->where('bookings.0.booking_code', 'JNY-CONF03')
                ->where('bookings.1.id', $newerPending->id)
                ->where('bookings.2.id', $olderPending->id)
            );

        // Filter by staff_id returns bookings across statuses when status not pinned
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings', ['staff_id' => $this->staffA->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.status', 'all')
                ->where('filters.staff_id', (string) $this->staffA->id)
                ->has('bookings', 3)
            );

        // Filter by service_id
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings', ['service_id' => $this->serviceB->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.service_id', (string) $this->serviceB->id)
                ->has('bookings', 1)
                ->where('bookings.0.id', $newerPending->id)
            );
    }

    public function test_owner_can_settle_payment_and_cancel_with_reason(): void
    {
        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Dimas',
            'phone' => '628222222222',
        ]);

        $day = CarbonImmutable::now('Asia/Jakarta')->addDay();
        $booking = Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $customer->id,
            'service_id' => $this->serviceA->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'JNY-SET01',
            'booking_date' => $day->toDateString(),
            'start_at' => $day->setTime(11, 0)->utc(),
            'end_at' => $day->setTime(12, 0)->utc(),
            'buffer_end_at' => $day->setTime(12, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'completed',
            'payment_status' => 'dp_verified',
        ]);

        $this->actingAs($this->owner)
            ->patch(route('dashboard.bookings.status', $booking->id), [
                'payment_status' => 'settled',
            ])
            ->assertRedirect();

        $this->assertSame('settled', $booking->fresh()->payment_status);

        $this->actingAs($this->owner)
            ->patch(route('dashboard.bookings.status', $booking->id), [
                'reservation_status' => 'cancelled',
                'cancellation_reason' => 'Pelanggan berhalangan hadir',
            ])
            ->assertRedirect();

        $fresh = $booking->fresh();
        $this->assertSame('cancelled', $fresh->reservation_status);
        $this->assertSame('Pelanggan berhalangan hadir', $fresh->cancellation_reason);
    }

    public function test_dashboard_overview_and_customer_segments_and_sorting(): void
    {
        $repeatCustomer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Surya Repeat',
            'phone' => '628333333333',
        ]);
        $noShowCustomer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Budi NoShow',
            'phone' => '628444444444',
        ]);

        $today = CarbonImmutable::now('Asia/Jakarta');

        Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $repeatCustomer->id,
            'service_id' => $this->serviceA->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'JNY-RPT01',
            'booking_date' => $today->toDateString(),
            'start_at' => $today->setTime(9, 0)->utc(),
            'end_at' => $today->setTime(10, 0)->utc(),
            'buffer_end_at' => $today->setTime(10, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'completed',
            'payment_status' => 'settled',
        ]);
        Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $repeatCustomer->id,
            'service_id' => $this->serviceA->id,
            'staff_id' => $this->staffA->id,
            'booking_code' => 'JNY-RPT02',
            'booking_date' => $today->toDateString(),
            'start_at' => $today->setTime(11, 0)->utc(),
            'end_at' => $today->setTime(12, 0)->utc(),
            'buffer_end_at' => $today->setTime(12, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'confirmed',
            'payment_status' => 'dp_verified',
        ]);
        Booking::create([
            'business_id' => $this->business->id,
            'customer_id' => $noShowCustomer->id,
            'service_id' => $this->serviceB->id,
            'staff_id' => $this->staffB->id,
            'booking_code' => 'JNY-NOS01',
            'booking_date' => $today->toDateString(),
            'start_at' => $today->setTime(13, 0)->utc(),
            'end_at' => $today->setTime(13, 30)->utc(),
            'buffer_end_at' => $today->setTime(13, 30)->utc(),
            'total_price' => 50000,
            'dp_amount' => 0,
            'reservation_status' => 'no_show',
            'payment_status' => 'unpaid',
        ]);

        $this->actingAs($this->owner)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->where('onboarding.has_services', true)
                ->where('onboarding.has_staff', true)
                ->where('onboarding.has_payment_info', false)
                ->has('weeklyTrend', 7)
            );

        $this->actingAs($this->owner)
            ->get(route('dashboard.customers', ['segment' => 'has_no_show']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.segment', 'has_no_show')
                ->has('customers', 1)
                ->where('customers.0.id', $noShowCustomer->id)
            );

        $this->actingAs($this->owner)
            ->get(route('dashboard.customers', ['segment' => 'repeat', 'sort' => 'top_spent']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.segment', 'repeat')
                ->where('filters.sort', 'top_spent')
                ->has('customers', 1)
                ->where('customers.0.id', $repeatCustomer->id)
            );
    }
}
