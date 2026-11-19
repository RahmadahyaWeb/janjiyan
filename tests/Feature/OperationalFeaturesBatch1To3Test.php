<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\StaffTimeOff;
use App\Models\User;
use App\Notifications\CustomerBookingReminderNotification;
use App\Notifications\CustomerBookingStatusNotification;
use App\Notifications\MerchantBookingAlertNotification;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OperationalFeaturesBatch1To3Test extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $otherOwner;

    private Business $business;

    private Business $otherBusiness;

    private Service $service;

    private Staff $staffA;

    private Staff $staffB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Utama',
            'email' => 'owner-ops@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Barber Operasional',
            'slug' => 'barber-operasional',
            'category' => 'Barbershop',
            'phone' => '081234567890',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'min_booking_lead_minutes' => 15,
            'max_booking_advance_days' => 30,
            'reminder_h1_enabled' => true,
            'reminder_h2_enabled' => true,
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
            'name' => 'Andi Barber',
            'title' => 'Senior Barber',
            'is_active' => true,
        ]);
        $this->staffB = Staff::create([
            'business_id' => $this->business->id,
            'name' => 'Budi Barber',
            'title' => 'Junior Barber',
            'is_active' => true,
        ]);

        $this->service = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Haircut Signature',
            'price' => 80000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'fixed',
            'dp_value' => 25000,
            'is_active' => true,
        ]);
        $this->service->staff()->attach([$this->staffA->id, $this->staffB->id]);

        // Second tenant for cross-tenant authorization tests
        $this->otherOwner = User::create([
            'name' => 'Other Owner',
            'email' => 'other-owner@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->otherOwner);

        $this->otherBusiness = Business::create([
            'owner_id' => $this->otherOwner->id,
            'name' => 'Salon Tetangga',
            'slug' => 'salon-tetangga',
            'category' => 'Salon',
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);
        $this->otherBusiness->users()->attach($this->otherOwner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->otherBusiness->seedDefaultOperatingHours();
        $this->otherOwner->update(['active_business_id' => $this->otherBusiness->id]);
    }

    private function nextWeekday(int $daysAhead = 2): CarbonImmutable
    {
        $date = CarbonImmutable::now('Asia/Jakarta')->addDays($daysAhead)->startOfDay();
        while ($date->isSunday()) {
            $date = $date->addDay();
        }

        return $date;
    }

    public function test_public_booking_and_dp_upload_send_email_notifications_and_respect_booking_window(): void
    {
        Notification::fake();
        Storage::fake('local');

        $tooFarDate = CarbonImmutable::now('Asia/Jakarta')->addDays(45)->toDateString();

        // Exceeding max_booking_advance_days (30) must be blocked both in slots and POST
        $this->getJson(route('public.booking.slots', [
            'slug' => $this->business->slug,
            'service_id' => $this->service->id,
            'date' => $tooFarDate,
        ]))->assertOk()->assertExactJson(['slots' => []]);

        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $tooFarDate,
            'time' => '10:00',
            'staff_id' => $this->staffA->id,
            'customer_name' => 'Siti Far',
            'customer_phone' => '081200001111',
            'customer_email' => 'siti@example.com',
        ])->assertSessionHas('error');

        // Valid booking within window sends merchant alert + customer confirmation
        $validDate = $this->nextWeekday(2)->toDateString();
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $validDate,
            'time' => '10:00',
            'staff_id' => $this->staffA->id,
            'customer_name' => 'Siti Valid',
            'customer_phone' => '081200002222',
            'customer_email' => 'siti.valid@example.com',
        ])->assertRedirect();

        $booking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();

        Notification::assertSentTo($this->owner, MerchantBookingAlertNotification::class);
        Notification::assertSentTo(
            new AnonymousNotifiable,
            CustomerBookingStatusNotification::class,
            fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'siti.valid@example.com'
        );

        // Upload DP proof triggers merchant alert
        $this->post(route('public.booking.invoice.proof', [
            'slug' => $this->business->slug,
            'token' => $booking->invoice_token,
        ]), [
            'dp_proof' => UploadedFile::fake()->image('dp.jpg'),
        ])->assertRedirect();

        Notification::assertSentToTimes($this->owner, MerchantBookingAlertNotification::class, 2);

        // Verify DP notifies customer
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.verify-dp', $booking->id))
            ->assertRedirect();

        $booking->refresh();
        $this->assertSame('dp_verified', $booking->payment_status);
        $this->assertSame('confirmed', $booking->reservation_status);
    }

    public function test_merchant_can_reschedule_booking_atomically_and_mark_no_show(): void
    {
        Notification::fake();

        $day1 = $this->nextWeekday(2)->toDateString();
        $day2 = $this->nextWeekday(4)->toDateString();

        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $day1,
            'time' => '10:00',
            'staff_id' => $this->staffA->id,
            'customer_name' => 'Dedi Reschedule',
            'customer_phone' => '081233334444',
            'customer_email' => 'dedi@example.com',
        ])->assertRedirect();

        $booking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();
        $booking->update([
            'reservation_status' => 'confirmed',
            'reminder_h1_sent_at' => now(),
            'reminder_h2_sent_at' => now(),
        ]);

        // Another booking occupies day2 11:00 for staffA
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $day2,
            'time' => '11:00',
            'staff_id' => $this->staffA->id,
            'customer_name' => 'Eka Blocker',
            'customer_phone' => '081255556666',
        ])->assertRedirect();

        // Rescheduling into occupied slot must fail
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.reschedule', $booking->id), [
                'date' => $day2,
                'time' => '11:00',
                'staff_id' => $this->staffA->id,
            ])
            ->assertSessionHas('error');

        // Rescheduling into free slot succeeds, increments rescheduled_count, and resets reminder timestamps
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.reschedule', $booking->id), [
                'date' => $day2,
                'time' => '14:00',
                'staff_id' => $this->staffA->id,
            ])
            ->assertSessionHas('success');

        $booking->refresh();
        $this->assertSame($day2, $booking->booking_date->toDateString());
        $this->assertSame('14:00', $booking->start_at->setTimezone('Asia/Jakarta')->format('H:i'));
        $this->assertSame(1, $booking->rescheduled_count);
        $this->assertNotNull($booking->last_rescheduled_at);
        $this->assertNull($booking->reminder_h1_sent_at);
        $this->assertNull($booking->reminder_h2_sent_at);

        // Mark as no_show
        $this->actingAs($this->owner)
            ->patch(route('dashboard.bookings.status', $booking->id), [
                'reservation_status' => 'no_show',
            ])
            ->assertSessionHas('success');

        $booking->refresh();
        $this->assertSame('no_show', $booking->reservation_status);

        // Cannot reschedule a no_show booking
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.reschedule', $booking->id), [
                'date' => $day2,
                'time' => '15:00',
                'staff_id' => $this->staffA->id,
            ])
            ->assertSessionHas('error');

        // Cross-tenant reschedule must return 403
        $this->actingAs($this->otherOwner)
            ->post(route('dashboard.bookings.reschedule', $booking->id), [
                'date' => $day2,
                'time' => '15:00',
            ])
            ->assertForbidden();
    }

    public function test_staff_custom_shift_and_time_off_filter_slots_and_block_bookings(): void
    {
        $targetDate = $this->nextWeekday(3);
        $dateStr = $targetDate->toDateString();
        $targetDow = $targetDate->dayOfWeek;

        // Configure staffA to only work 14:00–17:00 on targetDow
        $hours = [];
        for ($d = 0; $d <= 6; $d++) {
            $hours[] = [
                'day_of_week' => $d,
                'is_working' => $d === $targetDow,
                'start_time' => '14:00',
                'end_time' => '17:00',
                'break_start' => null,
                'break_end' => null,
            ];
        }

        $this->actingAs($this->owner)
            ->put(route('dashboard.staff.schedule.update', $this->staffA->id), [
                'use_business_default' => false,
                'hours' => $hours,
            ])
            ->assertSessionHas('success');

        // Slots for staffA must only include 14:00, 15:00, 16:00 (not 09:00 or 10:00)
        $slotsResp = $this->getJson(route('public.booking.slots', [
            'slug' => $this->business->slug,
            'service_id' => $this->service->id,
            'date' => $dateStr,
            'staff_id' => $this->staffA->id,
        ]))->assertOk();

        $times = collect($slotsResp->json('slots'))->pluck('time')->all();
        $this->assertSame(['14:00', '15:00', '16:00'], $times);

        // Raw POST at 10:00 for staffA must be rejected
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $dateStr,
            'time' => '10:00',
            'staff_id' => $this->staffA->id,
            'customer_name' => 'Outside Shift',
            'customer_phone' => '081277778888',
        ])->assertSessionHas('error');

        // Add time-off for staffA covering targetDate
        $this->actingAs($this->owner)
            ->post(route('dashboard.staff.time-offs.store', $this->staffA->id), [
                'start_date' => $dateStr,
                'end_date' => $dateStr,
                'reason' => 'Cuti tahunan',
            ])
            ->assertSessionHas('success');

        // StaffA now has zero slots on targetDate
        $this->getJson(route('public.booking.slots', [
            'slug' => $this->business->slug,
            'service_id' => $this->service->id,
            'date' => $dateStr,
            'staff_id' => $this->staffA->id,
        ]))->assertOk()->assertExactJson(['slots' => []]);

        // Cross-tenant access to staff schedule & time-offs must be forbidden
        $timeOff = StaffTimeOff::where('staff_id', $this->staffA->id)->firstOrFail();
        $this->actingAs($this->otherOwner)
            ->getJson(route('dashboard.staff.schedule.show', $this->staffA->id))
            ->assertForbidden();
        $this->actingAs($this->otherOwner)
            ->delete(route('dashboard.staff.time-offs.destroy', ['staff' => $this->staffA->id, 'timeOff' => $timeOff->id]))
            ->assertForbidden();
    }

    public function test_bookings_pagination_date_filter_and_calendar_view(): void
    {
        $day1 = $this->nextWeekday(2)->toDateString();
        $day2 = $this->nextWeekday(5)->toDateString();

        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $day1,
            'time' => '09:00',
            'staff_id' => $this->staffA->id,
            'customer_name' => 'Alpha Client',
            'customer_phone' => '081211110001',
        ])->assertRedirect();

        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $day2,
            'time' => '10:00',
            'staff_id' => $this->staffB->id,
            'customer_name' => 'Beta Client',
            'customer_phone' => '081211110002',
        ])->assertRedirect();

        // Filter date_from & date_to to day1 only
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings', [
                'date_from' => $day1,
                'date_to' => $day1,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Bookings/Index')
                ->has('bookings', 1)
                ->where('bookings.0.customer_name', 'Alpha Client')
                ->where('pagination.total', 1)
            );

        // Calendar view returns 7 days and selected day's bookings
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings', [
                'view' => 'calendar',
                'calendar_date' => $day2,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Bookings/Index')
                ->where('filters.view', 'calendar')
                ->has('calendar.days', 7)
                ->has('calendar.bookings', 1)
                ->where('calendar.bookings.0.customer_name', 'Beta Client')
                ->has('calendar.staff_columns', 2)
            );
    }

    public function test_customer_crm_detail_internal_notes_and_tenant_isolation(): void
    {
        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Rudi Loyal',
            'phone' => '6281299990000',
            'email' => 'rudi@example.com',
        ]);

        $this->actingAs($this->owner)
            ->patch(route('dashboard.customers.update', $customer->id), [
                'name' => 'Rudi Loyal VIP',
                'email' => 'rudi.vip@example.com',
                'notes' => 'Biasa potong low fade 2mm, alergi pomade kuat.',
            ])
            ->assertSessionHas('success');

        $customer->refresh();
        $this->assertSame('Rudi Loyal VIP', $customer->name);
        $this->assertSame('Biasa potong low fade 2mm, alergi pomade kuat.', $customer->notes);

        $this->actingAs($this->owner)
            ->get(route('dashboard.customers.show', $customer->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Customers/Show')
                ->where('customer.name', 'Rudi Loyal VIP')
                ->where('customer.notes', 'Biasa potong low fade 2mm, alergi pomade kuat.')
            );

        // Cross-tenant access must return 403
        $this->actingAs($this->otherOwner)
            ->get(route('dashboard.customers.show', $customer->id))
            ->assertForbidden();
        $this->actingAs($this->otherOwner)
            ->patch(route('dashboard.customers.update', $customer->id), [
                'name' => 'Hacked',
            ])
            ->assertForbidden();
    }

    public function test_automated_booking_reminders_command_sends_h1_and_h2_idempotently(): void
    {
        Notification::fake();

        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Nina Reminder',
            'phone' => '6281288889999',
            'email' => 'nina@example.com',
        ]);

        // Booking 24 hours from now -> eligible for H-1 reminder
        $h1Start = now()->addHours(24);
        $h1Booking = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->service->id,
            'staff_id' => $this->staffA->id,
            'customer_id' => $customer->id,
            'booking_code' => 'JNY-REMH01',
            'invoice_number' => 'INV-20261119-REMH01',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $h1Start->toDateString(),
            'start_at' => $h1Start,
            'end_at' => $h1Start->copy()->addHour(),
            'buffer_end_at' => $h1Start->copy()->addHour(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'confirmed',
            'payment_status' => 'dp_verified',
        ]);

        // Booking 2 hours from now -> eligible for H-2 reminder
        $h2Start = now()->addHours(2);
        $h2Booking = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->service->id,
            'staff_id' => $this->staffB->id,
            'customer_id' => $customer->id,
            'booking_code' => 'JNY-REMH02',
            'invoice_number' => 'INV-20261119-REMH02',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $h2Start->toDateString(),
            'start_at' => $h2Start,
            'end_at' => $h2Start->copy()->addHour(),
            'buffer_end_at' => $h2Start->copy()->addHour(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'confirmed',
            'payment_status' => 'dp_verified',
        ]);

        // Cancelled booking 2 hours from now -> must NOT receive reminder
        Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->service->id,
            'staff_id' => $this->staffA->id,
            'customer_id' => $customer->id,
            'booking_code' => 'JNY-REMCAN',
            'invoice_number' => 'INV-20261119-REMCAN',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $h2Start->toDateString(),
            'start_at' => $h2Start,
            'end_at' => $h2Start->copy()->addHour(),
            'buffer_end_at' => $h2Start->copy()->addHour(),
            'total_price' => 80000,
            'dp_amount' => 25000,
            'reservation_status' => 'cancelled',
            'payment_status' => 'unpaid',
        ]);

        // First run sends both H-1 and H-2
        $this->artisan('bookings:send-reminders')->assertSuccessful();

        Notification::assertSentTimes(CustomerBookingReminderNotification::class, 2);
        $this->assertNotNull($h1Booking->fresh()->reminder_h1_sent_at);
        $this->assertNotNull($h2Booking->fresh()->reminder_h2_sent_at);

        // Second run must be idempotent (0 additional notifications)
        $this->artisan('bookings:send-reminders')->assertSuccessful();
        Notification::assertSentTimes(CustomerBookingReminderNotification::class, 2);
    }
}
