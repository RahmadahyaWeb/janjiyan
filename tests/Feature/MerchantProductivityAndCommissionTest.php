<?php

namespace Tests\Feature;

use App\Jobs\SendTelegramBookingAlertJob;
use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MerchantProductivityAndCommissionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private Service $service;

    private Staff $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $proPlan = SubscriptionPlan::create([
            'slug' => 'professional',
            'name' => 'Professional',
            'price_monthly' => 129000,
            'price_yearly' => 1290000,
            'max_businesses' => 3,
            'max_services_per_business' => 10,
            'max_staff_per_business' => 10,
            'max_bookings_per_month' => 500,
            'max_customers_per_business' => 2500,
            'can_export_csv' => true,
        ]);

        $this->owner = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'subscription_plan_id' => $proPlan->id,
            'status' => 'active',
            'current_period_ends_at' => now()->addMonth(),
        ]);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Barber Nusantara',
            'slug' => 'barber-nusantara',
            'category' => 'Barbershop',
            'phone' => '6281234567890',
            'address' => 'Jl. Sudirman No. 10, Jakarta',
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

        $this->staff = $this->business->staff()->create([
            'name' => 'Raka Barber',
            'title' => 'Senior Barber',
            'is_active' => true,
            'commission_type' => 'percentage',
            'commission_value' => 25,
        ]);

        $this->service = $this->business->services()->create([
            'name' => 'Signature Haircut',
            'price' => 100000,
            'duration_minutes' => 45,
            'buffer_minutes' => 15,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'fixed',
            'dp_value' => 20000,
            'is_active' => true,
        ]);
        $this->service->staff()->attach($this->staff->id);
    }

    private function nextOpenWeekdayDate(): string
    {
        $date = CarbonImmutable::now('Asia/Jakarta')->addDays(2);
        while ($date->dayOfWeek === 0) {
            $date = $date->addDay();
        }

        return $date->toDateString();
    }

    public function test_merchant_can_customize_whatsapp_templates_and_fallback_to_defaults(): void
    {
        $response = $this->actingAs($this->owner)->post(route('dashboard.settings.update'), [
            'name' => $this->business->name,
            'slug' => $this->business->slug,
            'category' => $this->business->category,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'whatsapp_templates' => [
                'reminder' => 'Halo {customer_name}, jangan lupa jadwal {service_name} besok jam {time}!',
                'dp_verified' => '',
            ],
        ]);

        $response->assertRedirect();
        $this->business->refresh();

        $resolved = $this->business->resolvedWhatsappTemplates();
        $this->assertSame(
            'Halo {customer_name}, jangan lupa jadwal {service_name} besok jam {time}!',
            $resolved['reminder']
        );
        $this->assertSame(Business::defaultWhatsappTemplates()['dp_verified'], $resolved['dp_verified']);
    }

    public function test_telegram_token_is_encrypted_never_leaked_and_alerts_are_queued(): void
    {
        Queue::fake();

        $rawToken = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ12345';

        $this->actingAs($this->owner)->post(route('dashboard.settings.update'), [
            'name' => $this->business->name,
            'slug' => $this->business->slug,
            'category' => $this->business->category,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'telegram_notifications_enabled' => true,
            'telegram_bot_token' => $rawToken,
            'telegram_chat_id' => '987654321',
        ])->assertRedirect();

        // Raw DB column must be encrypted (never plaintext)
        $rawDbValue = DB::table('businesses')->where('id', $this->business->id)->value('telegram_bot_token');
        $this->assertNotSame($rawToken, $rawDbValue);

        // Decrypted via Eloquent cast matches
        $this->business->refresh();
        $this->assertSame($rawToken, $this->business->telegram_bot_token);

        // Settings Inertia response must NOT leak raw token
        $settingsResponse = $this->actingAs($this->owner)->get(route('dashboard.settings'));
        $settingsResponse->assertOk();
        $this->assertStringNotContainsString($rawToken, $settingsResponse->getContent());

        // Public booking dispatches queued Telegram job
        $date = $this->nextOpenWeekdayDate();
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $date,
            'time' => '10:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Andi <script>alert(1)</script>',
            'customer_phone' => '081299988877',
        ])->assertRedirect();

        Queue::assertPushed(SendTelegramBookingAlertJob::class, function (SendTelegramBookingAlertJob $job) {
            return $job->eventType === 'new_booking';
        });

        // Execute job directly with Http::fake() to verify HTML escaping and API call
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $booking = Booking::latest('id')->firstOrFail();
        (new SendTelegramBookingAlertJob($booking->id, 'new_booking'))->handle();

        Http::assertSent(function ($request) {
            $body = $request->data();

            return str_contains($request->url(), 'api.telegram.org/bot123456789:')
                && $body['chat_id'] === '987654321'
                && str_contains($body['text'], '&lt;script&gt;')
                && ! str_contains($body['text'], '<script>');
        });

        // Test message endpoint works
        $this->actingAs($this->owner)
            ->post(route('dashboard.settings.telegram.test'))
            ->assertRedirect()
            ->assertSessionHas('success');
    }

    public function test_public_and_staff_ics_calendar_downloads_enforce_format_and_tenant_isolation(): void
    {
        $date = $this->nextOpenWeekdayDate();

        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $date,
            'time' => '10:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Siti Aminah',
            'customer_phone' => '081211112222',
        ])->assertRedirect();

        $booking = Booking::latest('id')->firstOrFail();

        // Public invoice .ics download
        $icsResponse = $this->get(route('public.booking.invoice.ics', [
            'slug' => $this->business->slug,
            'token' => $booking->invoice_token,
        ]));
        $icsResponse->assertOk();
        $icsResponse->assertHeader('Content-Type', 'text/calendar; charset=utf-8');
        $content = $icsResponse->getContent();
        $this->assertStringContainsString('BEGIN:VCALENDAR', $content);
        $this->assertStringContainsString('BEGIN:VEVENT', $content);
        $this->assertStringContainsString("UID:booking-{$booking->booking_code}@janjiyan.id", $content);
        $this->assertStringContainsString('Signature Haircut', $content);

        // Staff .ics download for own business
        $staffIcs = $this->actingAs($this->owner)
            ->get(route('dashboard.staff.calendar.ics', $this->staff->id));
        $staffIcs->assertOk();
        $staffIcs->assertHeader('Content-Type', 'text/calendar; charset=utf-8');
        $this->assertStringContainsString('Siti Aminah', $staffIcs->getContent());

        // Cross-tenant staff .ics download must be forbidden (403)
        $otherOwner = User::factory()->create(['email_verified_at' => now()]);
        $otherBusiness = Business::create([
            'owner_id' => $otherOwner->id,
            'name' => 'Other Salon',
            'slug' => 'other-salon',
            'category' => 'Salon',
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);
        $otherBusiness->users()->attach($otherOwner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $otherOwner->update(['active_business_id' => $otherBusiness->id]);

        $this->actingAs($otherOwner)
            ->get(route('dashboard.staff.calendar.ics', $this->staff->id))
            ->assertForbidden();
    }

    public function test_staff_commission_snapshot_reporting_and_csv_export(): void
    {
        $date = $this->nextOpenWeekdayDate();

        // Create a fixed-commission staff member via StaffController
        $this->actingAs($this->owner)->post(route('dashboard.staff.store'), [
            'name' => 'Dika Fixed',
            'title' => 'Junior Barber',
            'commission_type' => 'fixed',
            'commission_value' => 15000,
            'grant_login' => false,
        ])->assertRedirect();

        $fixedStaff = Staff::where('name', 'Dika Fixed')->firstOrFail();
        $this->service->staff()->attach($fixedStaff->id);

        // Booking 1: Raka (25% of 100.000 = 25.000), mark completed
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $date,
            'time' => '10:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Pelanggan A',
            'customer_phone' => '081233334444',
        ])->assertRedirect();

        $booking1 = Booking::latest('id')->firstOrFail();
        $this->assertSame(25000, $booking1->commission_amount);
        $booking1->update(['reservation_status' => 'completed', 'payment_status' => 'settled']);

        // Booking 2: Dika (fixed 15.000), mark completed
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $date,
            'time' => '11:00',
            'staff_id' => $fixedStaff->id,
            'customer_name' => 'Pelanggan B',
            'customer_phone' => '081255556666',
        ])->assertRedirect();

        $booking2 = Booking::latest('id')->firstOrFail();
        $this->assertSame(15000, $booking2->commission_amount);
        $booking2->update(['reservation_status' => 'completed', 'payment_status' => 'settled']);

        // Commission report page renders and aggregates both
        $reportResponse = $this->actingAs($this->owner)->get(route('dashboard.commissions', [
            'date_from' => $date,
            'date_to' => $date,
        ]));
        $reportResponse->assertOk();

        // CSV Export succeeds for Pro plan
        $csvResponse = $this->actingAs($this->owner)->get(route('dashboard.commissions.export', [
            'date_from' => $date,
            'date_to' => $date,
        ]));
        $csvResponse->assertOk();
        $csvContent = $csvResponse->streamedContent();
        $this->assertStringContainsString('Raka Barber', $csvContent);
        $this->assertStringContainsString('25000', $csvContent);
        $this->assertStringContainsString('Dika Fixed', $csvContent);
        $this->assertStringContainsString('15000', $csvContent);
    }

    public function test_crm_tags_customer_blocking_and_auto_no_show_full_dp_protection(): void
    {
        Storage::fake('local');

        // Enable auto No-Show Protection (threshold = 2)
        $this->business->update([
            'no_show_require_full_dp' => true,
            'no_show_dp_threshold' => 2,
        ]);

        $customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Rudi NoShow',
            'phone' => '6281277778888',
        ]);

        // Update CRM tags & verify persistence
        $this->actingAs($this->owner)->patch(route('dashboard.customers.update', $customer->id), [
            'name' => 'Rudi NoShow',
            'email' => 'rudi@example.com',
            'notes' => 'Alergi parfum kuat',
            'tags' => ['VIP', 'Perhatian Khusus', 'VIP'],
            'is_blocked' => false,
        ])->assertRedirect();

        $customer->refresh();
        $this->assertSame(['VIP', 'Perhatian Khusus'], $customer->tags);
        $this->assertFalse($customer->is_blocked);

        // Create 2 prior no_show bookings for Rudi
        $pastDate = CarbonImmutable::now('Asia/Jakarta')->subDays(5);
        for ($i = 0; $i < 2; $i++) {
            Booking::create([
                'business_id' => $this->business->id,
                'service_id' => $this->service->id,
                'staff_id' => $this->staff->id,
                'customer_id' => $customer->id,
                'booking_code' => 'NS-TEST-'.$i,
                'booking_date' => $pastDate->subDays($i)->toDateString(),
                'start_at' => $pastDate->subDays($i)->setTime(10, 0)->utc(),
                'end_at' => $pastDate->subDays($i)->setTime(10, 45)->utc(),
                'buffer_end_at' => $pastDate->subDays($i)->setTime(11, 0)->utc(),
                'total_price' => 100000,
                'dp_amount' => 20000,
                'reservation_status' => 'no_show',
                'payment_status' => 'unpaid',
            ]);
        }

        // Next public booking should automatically require 100% DP (Rp 100.000 instead of Rp 20.000)
        $date = $this->nextOpenWeekdayDate();
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $date,
            'time' => '14:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Rudi NoShow',
            'customer_phone' => '081277778888',
            'dp_proof' => UploadedFile::fake()->image('dp.jpg'),
        ])->assertRedirect();

        $protectedBooking = Booking::latest('id')->firstOrFail();
        $this->assertSame(100000, $protectedBooking->dp_amount);

        // Now block the customer from online booking
        $this->actingAs($this->owner)->patch(route('dashboard.customers.update', $customer->id), [
            'name' => 'Rudi NoShow',
            'email' => 'rudi@example.com',
            'notes' => 'Diblokir karena berulang kali tidak hadir',
            'tags' => ['Perhatian Khusus'],
            'is_blocked' => true,
        ])->assertRedirect();

        // Public booking attempt by blocked customer must be rejected
        $blockedResponse = $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $date,
            'time' => '15:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Rudi NoShow',
            'customer_phone' => '081277778888',
        ]);
        $blockedResponse->assertRedirect();
        $blockedResponse->assertSessionHas('error');
        $this->assertSame(3, Booking::where('customer_id', $customer->id)->count());
    }
}
