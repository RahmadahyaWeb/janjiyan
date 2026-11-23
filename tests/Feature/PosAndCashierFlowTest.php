<?php

namespace Tests\Feature;

use App\Jobs\SendTelegramBookingAlertJob;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\BookingPayment;
use App\Models\Business;
use App\Models\BusinessReview;
use App\Models\Customer;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Models\Staff;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Notifications\CustomerBookingStatusNotification;
use App\Notifications\MerchantBookingAlertNotification;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PosAndCashierFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::factory()->create([
            'name' => 'Owner Budi',
            'email' => 'owner@janjiyan.test',
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);
    }

    private function createBusiness(string $type, string $slug): Business
    {
        $business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Studio '.ucfirst($slug),
            'slug' => $slug,
            'category' => 'Jasa',
            'business_type' => $type,
            'phone' => '6281234567890',
            'address' => 'Jl. Sudirman No. 1',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);

        $business->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $business->seedDefaultOperatingHours();
        $this->owner->update(['active_business_id' => $business->id]);

        return $business;
    }

    private function nextOpenWeekday(int $daysAhead = 2): CarbonImmutable
    {
        $candidate = CarbonImmutable::now('Asia/Jakarta')->startOfDay()->addDays($daysAhead);
        while ($candidate->isSunday()) {
            $candidate = $candidate->addDay();
        }

        return $candidate;
    }

    private function downgradeOwnerToBasic(): void
    {
        $basicPlan = SubscriptionPlan::where('slug', 'basic')->firstOrFail();
        $this->owner->subscription()->update([
            'subscription_plan_id' => $basicPlan->id,
            'status' => 'active',
            'trial_ends_at' => null,
            'current_period_ends_at' => now()->addMonth(),
        ]);
    }

    public function test_service_addon_crud_enforces_permissions_business_type_rules_plan_limits_and_soft_delete(): void
    {
        $dropoffBiz = $this->createBusiness(Business::TYPE_DROPOFF, 'laundry-addons');
        $serviceA = Service::create([
            'business_id' => $dropoffBiz->id,
            'name' => 'Deep Clean',
            'price' => 50000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 10,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'pasang',
            'turnaround_days' => 2,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        $foreignOwner = User::factory()->create(['email_verified_at' => now()]);
        $foreignBiz = Business::create([
            'owner_id' => $foreignOwner->id,
            'name' => 'Foreign Shop',
            'slug' => 'foreign-shop-addons',
            'category' => 'Laundry',
            'business_type' => Business::TYPE_DROPOFF,
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);
        $foreignService = Service::create([
            'business_id' => $foreignBiz->id,
            'name' => 'Foreign Service',
            'price' => 20000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 5,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        // Staff without manage_services gets 403
        $staffUser = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $dropoffBiz->id,
        ]);
        $dropoffBiz->users()->attach($staffUser->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_bookings', 'verify_payments']),
        ]);

        $this->actingAs($staffUser)->post(route('dashboard.addons.store'), [
            'name' => 'Unauthorized',
            'price' => 10000,
        ])->assertForbidden();

        // Owner creates add-on on dropoff business: duration forced to 0, commissionable forced to false, foreign service ignored
        $this->actingAs($this->owner)->post(route('dashboard.addons.store'), [
            'name' => 'Waterproof Coating',
            'description' => 'Pelindung air',
            'price' => 25000,
            'unit_label' => 'pasang',
            'duration_minutes' => 45,
            'is_commissionable' => true,
            'applies_to_all_services' => false,
            'service_ids' => [$serviceA->id, $foreignService->id],
            'sort_order' => 1,
        ])->assertRedirect();

        $addon = ServiceAddon::where('business_id', $dropoffBiz->id)->firstOrFail();
        $this->assertSame(0, $addon->duration_minutes);
        $this->assertFalse($addon->is_commissionable);
        $this->assertFalse($addon->applies_to_all_services);
        $this->assertSame([$serviceA->id], $addon->services()->pluck('services.id')->all());

        // ServiceController@index includes addons, canCreateAddon, maxAddonsPerBusiness
        $this->actingAs($this->owner)
            ->get(route('dashboard.services'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Services/Index')
                ->where('canCreateAddon', true)
                ->where('maxAddonsPerBusiness', null)
                ->has('addons', 1)
                ->where('addons.0.name', 'Waterproof Coating')
                ->where('addons.0.service_ids', [$serviceA->id])
            );

        // Update to applies_to_all_services = true detaches assignments
        $this->actingAs($this->owner)->put(route('dashboard.addons.update', $addon), [
            'name' => 'Waterproof Coating Pro',
            'price' => 30000,
            'unit_label' => 'pasang',
            'applies_to_all_services' => true,
            'service_ids' => [$serviceA->id],
        ])->assertRedirect();

        $addon->refresh();
        $this->assertSame('Waterproof Coating Pro', $addon->name);
        $this->assertTrue($addon->applies_to_all_services);
        $this->assertSame([], $addon->services()->pluck('services.id')->all());

        // Basic plan max 5 add-ons limit
        $this->downgradeOwnerToBasic();
        for ($i = 2; $i <= 5; $i++) {
            $this->actingAs($this->owner)->post(route('dashboard.addons.store'), [
                'name' => "Addon {$i}",
                'price' => 5000 * $i,
            ])->assertRedirect();
        }
        $this->assertSame(5, $dropoffBiz->serviceAddons()->count());

        $this->actingAs($this->owner)->post(route('dashboard.addons.store'), [
            'name' => 'Addon 6 Blocked',
            'price' => 10000,
        ])->assertSessionHas('error');
        $this->assertSame(5, $dropoffBiz->serviceAddons()->count());

        // Delete unused addon hard-deletes
        $unusedAddon = ServiceAddon::where('business_id', $dropoffBiz->id)->where('name', 'Addon 5')->firstOrFail();
        $this->actingAs($this->owner)->delete(route('dashboard.addons.destroy', $unusedAddon))->assertRedirect();
        $this->assertDatabaseMissing('service_addons', ['id' => $unusedAddon->id]);

        // Delete used addon soft-deactivates instead of deleting
        $customer = Customer::create([
            'business_id' => $dropoffBiz->id,
            'name' => 'Siti',
            'phone' => '628129990001',
        ]);
        $day = $this->nextOpenWeekday();
        $booking = Booking::create([
            'business_id' => $dropoffBiz->id,
            'service_id' => $serviceA->id,
            'customer_id' => $customer->id,
            'booking_mode' => 'dropoff',
            'booking_code' => 'JNY-ADDON1',
            'booking_date' => $day->toDateString(),
            'start_at' => $day->setTime(9, 0)->utc(),
            'end_at' => $day->setTime(18, 0)->utc(),
            'buffer_end_at' => $day->setTime(18, 0)->utc(),
            'total_price' => 80000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'payment_status' => 'unpaid',
        ]);
        BookingItem::create([
            'booking_id' => $booking->id,
            'item_type' => BookingItem::TYPE_ADDON,
            'service_addon_id' => $addon->id,
            'name_snapshot' => $addon->name,
            'unit_label_snapshot' => 'pasang',
            'unit_price' => 30000,
            'quantity' => 1,
            'subtotal' => 30000,
        ]);

        $this->actingAs($this->owner)->delete(route('dashboard.addons.destroy', $addon))->assertRedirect();
        $addon->refresh();
        $this->assertFalse($addon->is_active);
    }

    public function test_time_slot_addon_duration_affects_slots_and_checkout_commission_snapshot(): void
    {
        $salon = $this->createBusiness(Business::TYPE_STAFF_APPOINTMENT, 'salon-pos');
        $service = Service::create([
            'business_id' => $salon->id,
            'name' => 'Potong Rambut',
            'price' => 60000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'booking_mode' => 'time_slot',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
        $staff = Staff::create([
            'business_id' => $salon->id,
            'name' => 'Andi',
            'commission_type' => 'percentage',
            'commission_value' => 10,
            'is_active' => true,
        ]);
        $service->staff()->attach($staff->id);

        $addonHairSpa = ServiceAddon::create([
            'business_id' => $salon->id,
            'name' => 'Hair Spa Express',
            'price' => 40000,
            'unit_label' => 'item',
            'duration_minutes' => 60,
            'is_commissionable' => true,
            'applies_to_all_services' => true,
            'is_active' => true,
        ]);
        $addonPomade = ServiceAddon::create([
            'business_id' => $salon->id,
            'name' => 'Pomade Matte',
            'price' => 80000,
            'unit_label' => 'pcs',
            'duration_minutes' => 0,
            'is_commissionable' => false,
            'applies_to_all_services' => true,
            'is_active' => true,
        ]);

        $day = $this->nextOpenWeekday(3);

        // Operating hours close at 18:00, break 12:00-13:00. Without add-on, 17:00 slot (60m) fits; with 60m add-on (120m total), 17:00 must NOT fit!
        $baseSlots = $this->getJson("/b/{$salon->slug}/slots?service_id={$service->id}&date={$day->toDateString()}")
            ->assertOk()
            ->json('slots');
        $this->assertContains('17:00', array_column($baseSlots, 'time'));

        $addonSlots = $this->getJson("/b/{$salon->slug}/slots?service_id={$service->id}&date={$day->toDateString()}&addons[0][service_addon_id]={$addonHairSpa->id}&addons[0][quantity]=1")
            ->assertOk()
            ->json('slots');
        $this->assertNotContains('17:00', array_column($addonSlots, 'time'));
        $this->assertContains('16:00', array_column($addonSlots, 'time'));

        // Public checkout with both add-ons
        $this->post(route('public.booking.store', $salon->slug), [
            'service_id' => $service->id,
            'date' => $day->toDateString(),
            'time' => '16:00',
            'staff_id' => $staff->id,
            'customer_name' => 'Rizky',
            'customer_phone' => '081234567801',
            'addons' => [
                ['service_addon_id' => $addonHairSpa->id, 'quantity' => 1],
                ['service_addon_id' => $addonPomade->id, 'quantity' => 1],
            ],
        ])->assertRedirect();

        $booking = Booking::where('business_id', $salon->id)->firstOrFail();
        // Total = 60000 + 40000 + 80000 = 180000; commissionable = 60000 + 40000 = 100000 -> 10% = 10000
        $this->assertSame(180000, $booking->total_price);
        $this->assertSame(10000, $booking->commission_amount);
        $this->assertSame(120, $booking->resolveTotalDurationMinutes());
        $this->assertSame('Potong Rambut + 2 tambahan', $booking->resolvedServiceSummary());
        $this->assertSame(3, $booking->items()->count());
    }

    public function test_dropoff_multi_service_cart_is_plan_gated_and_creates_itemized_order(): void
    {
        $dropoff = $this->createBusiness(Business::TYPE_DROPOFF, 'shoe-care-multi');
        $svc1 = Service::create([
            'business_id' => $dropoff->id,
            'name' => 'Fast Clean',
            'price' => 35000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 5,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'pasang',
            'turnaround_days' => 1,
            'supports_pickup' => true,
            'dp_type' => 'fixed',
            'dp_value' => 10000,
            'is_active' => true,
        ]);
        $svc2 = Service::create([
            'business_id' => $dropoff->id,
            'name' => 'Unyellowing',
            'price' => 75000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 3,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'pasang',
            'turnaround_days' => 4,
            'supports_pickup' => false,
            'dp_type' => 'fixed',
            'dp_value' => 25000,
            'is_active' => true,
        ]);
        $addon = ServiceAddon::create([
            'business_id' => $dropoff->id,
            'name' => 'Deodorizer Spray',
            'price' => 15000,
            'unit_label' => 'item',
            'duration_minutes' => 0,
            'is_commissionable' => false,
            'applies_to_all_services' => true,
            'is_active' => true,
        ]);

        $day = $this->nextOpenWeekday(2);

        // Basic plan cannot submit > 1 distinct dropoff services
        $this->downgradeOwnerToBasic();
        $this->post(route('public.booking.store', $dropoff->slug), [
            'services' => [
                ['service_id' => $svc1->id, 'quantity' => 2],
                ['service_id' => $svc2->id, 'quantity' => 1],
            ],
            'date' => $day->toDateString(),
            'customer_name' => 'Dian',
            'customer_phone' => '081234567802',
        ])->assertSessionHas('error');
        $this->assertSame(0, Booking::count());

        // Single service + add-on IS allowed on Basic
        $this->post(route('public.booking.store', $dropoff->slug), [
            'service_id' => $svc1->id,
            'quantity' => 1,
            'addons' => [['service_addon_id' => $addon->id, 'quantity' => 2]],
            'date' => $day->toDateString(),
            'customer_name' => 'Dian Single',
            'customer_phone' => '081234567803',
        ])->assertRedirect();
        $singleBooking = Booking::firstOrFail();
        $this->assertSame(65000, $singleBooking->total_price);

        // Upgrade to Pro unlocks multi-service dropoff cart
        $proPlan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();
        $this->owner->subscription()->update(['subscription_plan_id' => $proPlan->id]);

        $this->post(route('public.booking.store', $dropoff->slug), [
            'services' => [
                ['service_id' => $svc1->id, 'quantity' => 2],
                ['service_id' => $svc2->id, 'quantity' => 1],
            ],
            'addons' => [['service_addon_id' => $addon->id, 'quantity' => 1]],
            'date' => $day->toDateString(),
            'fulfillment_type' => 'pickup',
            'pickup_session' => 'morning',
            'pickup_address' => 'Jl. Merdeka 10',
            'customer_name' => 'Rama',
            'customer_phone' => '081234567804',
        ])->assertRedirect();

        $multiBooking = Booking::orderByDesc('id')->firstOrFail();
        // (2*35000) + (1*75000) + (1*15000) = 160000; DP = 2*10000 + 1*25000 = 45000
        $this->assertSame(160000, $multiBooking->total_price);
        $this->assertSame(45000, $multiBooking->dp_amount);
        $this->assertSame(3, $multiBooking->items()->count());
    }

    public function test_walkin_cashier_settlement_adjust_items_summary_csv_and_public_invoice(): void
    {
        $salon = $this->createBusiness(Business::TYPE_STAFF_APPOINTMENT, 'barber-cashier');
        $service = Service::create([
            'business_id' => $salon->id,
            'name' => 'Cukur Klasik',
            'price' => 50000,
            'duration_minutes' => 30,
            'buffer_minutes' => 0,
            'capacity' => 2,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'time_slot',
            'dp_type' => 'fixed',
            'dp_value' => 20000,
            'is_active' => true,
        ]);
        $addon = ServiceAddon::create([
            'business_id' => $salon->id,
            'name' => 'Cuci Rambut',
            'price' => 15000,
            'unit_label' => 'item',
            'duration_minutes' => 15,
            'is_commissionable' => false,
            'applies_to_all_services' => true,
            'is_active' => true,
        ]);

        $day = $this->nextOpenWeekday(1);

        // Walk-in booking settled via QRIS
        $this->actingAs($this->owner)->post(route('dashboard.bookings.store'), [
            'service_id' => $service->id,
            'addons' => [['service_addon_id' => $addon->id, 'quantity' => 1]],
            'date' => $day->toDateString(),
            'time' => '10:00',
            'customer_name' => '=EvilName',
            'customer_phone' => '081234567805',
            'initial_payment_status' => 'settled',
            'payment_method' => 'qris',
        ])->assertRedirect();

        $booking = Booking::where('business_id', $salon->id)->firstOrFail();
        $this->assertSame(65000, $booking->total_price);
        $this->assertSame(65000, $booking->paid_amount);
        $this->assertSame('settled', $booking->payment_status);
        $this->assertNotNull($booking->settled_at);

        // Staff without verify_payments cannot adjust items or record payments
        $nonCashierStaff = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $salon->id,
        ]);
        $salon->users()->attach($nonCashierStaff->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_bookings']),
        ]);

        $this->actingAs($nonCashierStaff)->post(route('dashboard.bookings.items.update', $booking), [
            'items' => [['item_type' => 'service', 'service_id' => $service->id, 'quantity' => 1]],
        ])->assertForbidden();
        $this->actingAs($nonCashierStaff)->post(route('dashboard.bookings.payments.store', $booking), [
            'payment_type' => 'partial',
            'payment_method' => 'cash',
            'amount' => 10000,
        ])->assertForbidden();
        $this->actingAs($nonCashierStaff)->getJson(route('dashboard.cashier.summary'))->assertForbidden();

        // Owner adds a custom item at counter -> total increases to 90000, payment_status reverts to dp_verified
        $this->actingAs($this->owner)->post(route('dashboard.bookings.items.update', $booking), [
            'items' => [
                ['item_type' => 'service', 'service_id' => $service->id, 'quantity' => 1],
                ['item_type' => 'addon', 'service_addon_id' => $addon->id, 'quantity' => 1],
                [
                    'item_type' => 'custom',
                    'name' => 'Vitamin Rambut',
                    'unit_label' => 'item',
                    'unit_price' => 25000,
                    'quantity' => 1,
                    'is_commissionable' => false,
                ],
            ],
        ])->assertRedirect();

        $booking->refresh();
        $this->assertSame(90000, $booking->total_price);
        $this->assertSame(65000, $booking->paid_amount);
        $this->assertSame(25000, $booking->remainingBalance());
        $this->assertSame('dp_verified', $booking->payment_status);
        $this->assertNull($booking->settled_at);

        // Invalid cash received < amount returns clean error flash (no 500)
        $this->actingAs($this->owner)->post(route('dashboard.bookings.payments.store', $booking), [
            'payment_type' => 'settlement',
            'payment_method' => 'cash',
            'amount' => 25000,
            'received_amount' => 10000,
        ])->assertSessionHas('error');

        // Valid cash settlement with change
        $this->actingAs($this->owner)->post(route('dashboard.bookings.payments.store', $booking), [
            'payment_type' => 'settlement',
            'payment_method' => 'cash',
            'amount' => 25000,
            'received_amount' => 50000,
            'notes' => '=FORMULA_INJECTION_NOTE',
        ])->assertRedirect()->assertSessionHas('success');

        $booking->refresh();
        $this->assertSame(90000, $booking->paid_amount);
        $this->assertSame('settled', $booking->payment_status);
        $this->assertNotNull($booking->settled_at);

        $cashPayment = BookingPayment::where('booking_id', $booking->id)
            ->where('payment_method', 'cash')
            ->firstOrFail();
        $this->assertSame(50000, $cashPayment->received_amount);
        $this->assertSame(25000, $cashPayment->change_amount);

        // Daily cashier summary endpoint (today in Asia/Jakarta)
        $todayJakarta = CarbonImmutable::now('Asia/Jakarta')->toDateString();
        $summaryRes = $this->actingAs($this->owner)
            ->getJson(route('dashboard.cashier.summary', ['date' => $todayJakarta]))
            ->assertOk()
            ->json();

        $this->assertSame($todayJakarta, $summaryRes['date']);
        $this->assertSame(90000, $summaryRes['total_collected']);
        $this->assertSame(0, $summaryRes['total_refunds']);
        $this->assertSame(90000, $summaryRes['net_collected']);
        $this->assertSame(2, $summaryRes['transactions_count']);
        $this->assertTrue($summaryRes['can_view_breakdown']);
        $this->assertTrue($summaryRes['can_export_csv']);
        $this->assertSame(65000, $summaryRes['by_method']['qris']['amount']);
        $this->assertSame(25000, $summaryRes['by_method']['cash']['amount']);

        // Cashier CSV export includes sanitized formula cells
        $csv = $this->actingAs($this->owner)
            ->get(route('dashboard.cashier.export', ['date' => $todayJakarta]))
            ->assertOk()
            ->streamedContent();
        $this->assertStringContainsString("'=EvilName", $csv);
        $this->assertStringContainsString("'=FORMULA_INJECTION_NOTE", $csv);
        $this->assertStringContainsString('QRIS', $csv);
        $this->assertStringContainsString('Tunai', $csv);

        // Bookings index exposes items, payments, dailyCashierSummary, cashierUserName, businessEmail
        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Bookings/Index')
                ->where('cashierUserName', 'Owner Budi')
                ->where('businessEmail', 'owner@janjiyan.test')
                ->where('canVerifyPayments', true)
                ->where('dailyCashierSummary.net_collected', 90000)
                ->has('bookings.0.items', 3)
                ->has('bookings.0.payments', 2)
                ->where('bookings.0.paid_amount', 90000)
                ->where('bookings.0.remaining_balance', 0)
            );

        // Public invoice page before completion -> can_review = false
        $this->get(route('public.booking.invoice', ['slug' => $salon->slug, 'token' => $booking->invoice_token]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BookingStatus')
                ->where('business.review_enabled', true)
                ->where('business.can_use_google_review', true)
                ->where('booking.paid_amount', 90000)
                ->where('booking.remaining_balance', 0)
                ->where('booking.has_review', false)
                ->where('booking.can_review', false)
                ->where('booking.review_url', null)
                ->has('booking.items', 3)
                ->has('booking.payments', 2)
                ->where('booking.payments.0.recorded_by_name', null)
            );

        // Mark booking completed -> can_review = true and review_url populated
        $booking->update(['reservation_status' => 'completed']);
        $this->get(route('public.booking.invoice', ['slug' => $salon->slug, 'token' => $booking->invoice_token]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('booking.can_review', true)
                ->where('booking.has_review', false)
                ->where('booking.review_url', fn ($url) => is_string($url) && str_contains($url, "/b/{$salon->slug}/review"))
            );

        // Once reviewed -> has_review = true, can_review = false
        BusinessReview::create([
            'business_id' => $salon->id,
            'booking_id' => $booking->id,
            'customer_id' => $booking->customer_id,
            'rating' => 5,
            'comment' => 'Mantap',
        ]);
        $this->get(route('public.booking.invoice', ['slug' => $salon->slug, 'token' => $booking->invoice_token]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('booking.has_review', true)
                ->where('booking.can_review', false)
                ->where('booking.review_url', null)
            );

        // Downgrade to Basic gates breakdown & cashier CSV export
        $this->downgradeOwnerToBasic();
        $basicSummary = $this->actingAs($this->owner)
            ->getJson(route('dashboard.cashier.summary', ['date' => $todayJakarta]))
            ->assertOk()
            ->json();
        $this->assertFalse($basicSummary['can_view_breakdown']);
        $this->assertFalse($basicSummary['can_export_csv']);
        $this->assertSame(0, $basicSummary['by_method']['cash']['amount']);
        $this->assertSame(90000, $basicSummary['net_collected']);

        $this->actingAs($this->owner)
            ->get(route('dashboard.cashier.export', ['date' => $todayJakarta]))
            ->assertSessionHas('error');
    }

    public function test_notifications_and_telegram_alert_use_itemized_summary_and_escape_html(): void
    {
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true], 200)]);

        $business = $this->createBusiness(Business::TYPE_DROPOFF, 'telegram-multi');
        $business->update([
            'telegram_notifications_enabled' => true,
            'telegram_bot_token' => '123456:TESTTOKEN',
            'telegram_chat_id' => '99999',
        ]);

        $svc1 = Service::create([
            'business_id' => $business->id,
            'name' => 'Cuci <Express>',
            'price' => 40000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 10,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'kg',
            'turnaround_days' => 1,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
        $svc2 = Service::create([
            'business_id' => $business->id,
            'name' => 'Setrika & Lipat',
            'price' => 20000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 10,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'kg',
            'turnaround_days' => 1,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        $customer = Customer::create([
            'business_id' => $business->id,
            'name' => 'Ayu',
            'phone' => '6281234567810',
            'email' => 'ayu@example.test',
        ]);

        $day = $this->nextOpenWeekday();
        $booking = Booking::create([
            'business_id' => $business->id,
            'service_id' => $svc1->id,
            'customer_id' => $customer->id,
            'booking_mode' => 'dropoff',
            'quantity' => 5,
            'unit_label' => 'kg',
            'booking_code' => 'JNY-MULTI1',
            'invoice_number' => 'INV-20261123-MULTI1',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $day->toDateString(),
            'start_at' => $day->setTime(9, 0)->utc(),
            'end_at' => $day->setTime(18, 0)->utc(),
            'buffer_end_at' => $day->setTime(18, 0)->utc(),
            'total_price' => 140000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'payment_status' => 'unpaid',
        ]);

        BookingItem::create([
            'booking_id' => $booking->id,
            'item_type' => BookingItem::TYPE_SERVICE,
            'service_id' => $svc1->id,
            'name_snapshot' => $svc1->name,
            'unit_label_snapshot' => 'kg',
            'unit_price' => 40000,
            'quantity' => 3,
            'subtotal' => 120000,
        ]);
        BookingItem::create([
            'booking_id' => $booking->id,
            'item_type' => BookingItem::TYPE_SERVICE,
            'service_id' => $svc2->id,
            'name_snapshot' => $svc2->name,
            'unit_label_snapshot' => 'kg',
            'unit_price' => 20000,
            'quantity' => 2,
            'subtotal' => 40000,
        ]);

        $customerMail = (new CustomerBookingStatusNotification($booking->fresh(), 'confirmed'))->toMail($customer);
        $customerText = implode("\n", array_merge($customerMail->introLines, $customerMail->outroLines));
        $this->assertStringContainsString('Cuci <Express> (3 kg), Setrika & Lipat (2 kg)', $customerText);

        $merchantMail = (new MerchantBookingAlertNotification($booking->fresh(), 'new_booking'))->toMail($this->owner);
        $merchantText = implode("\n", array_merge($merchantMail->introLines, $merchantMail->outroLines));
        $this->assertStringContainsString('Cuci <Express> (3 kg), Setrika & Lipat (2 kg)', $merchantText);

        (new SendTelegramBookingAlertJob($booking->id, 'new_booking'))->handle();
        Http::assertSent(function ($request) {
            $text = $request->data()['text'] ?? '';

            return str_contains($text, 'Cuci &lt;Express&gt; (3 kg), Setrika &amp; Lipat (2 kg)')
                && ! str_contains($text, '<Express>');
        });
    }

    public function test_dashboard_slots_addons_walkin_multisvc_refund_and_softlock(): void
    {
        $salon = $this->createBusiness(Business::TYPE_STAFF_APPOINTMENT, 'salon-props');
        $svc = Service::create([
            'business_id' => $salon->id,
            'name' => 'Styling',
            'price' => 50000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'booking_mode' => 'time_slot',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
        $staff = Staff::create([
            'business_id' => $salon->id,
            'name' => 'Tono',
            'is_active' => true,
        ]);
        $svc->staff()->attach($staff->id);

        $addon = ServiceAddon::create([
            'business_id' => $salon->id,
            'name' => 'Masker Rambut',
            'price' => 30000,
            'unit_label' => 'item',
            'duration_minutes' => 60,
            'is_commissionable' => false,
            'applies_to_all_services' => true,
            'is_active' => true,
        ]);
        ServiceAddon::create([
            'business_id' => $salon->id,
            'name' => 'Inactive Addon',
            'price' => 10000,
            'is_active' => false,
        ]);

        // Public booking form & dashboard create only receive active addons
        $this->get(route('public.booking.form', $salon->slug))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('addons', 1)
                ->where('addons.0.id', $addon->id)
                ->where('canUseMultiServiceDropoff', true)
            );

        $this->actingAs($this->owner)
            ->get(route('dashboard.bookings.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('addons', 1)
                ->where('addons.0.id', $addon->id)
                ->where('canUseMultiServiceDropoff', true)
            );

        // Dashboard slots respects addon_ids[] extra duration
        $day = $this->nextOpenWeekday(3);
        $dashSlots = $this->actingAs($this->owner)
            ->getJson(route('dashboard.bookings.slots', [
                'service_id' => $svc->id,
                'date' => $day->toDateString(),
                'addon_ids' => [$addon->id],
            ]))
            ->assertOk()
            ->json('slots');
        $this->assertNotContains('17:00', array_column($dashSlots, 'time'));
        $this->assertContains('16:00', array_column($dashSlots, 'time'));

        // Walk-in cash settlement with received_amount computes change accurately
        $this->actingAs($this->owner)->post(route('dashboard.bookings.store'), [
            'service_id' => $svc->id,
            'addons' => [['service_addon_id' => $addon->id, 'quantity' => 1]],
            'date' => $day->toDateString(),
            'time' => '10:00',
            'staff_id' => $staff->id,
            'customer_name' => 'Walkin Cash',
            'customer_phone' => '081234567899',
            'initial_payment_status' => 'settled',
            'payment_method' => 'cash',
            'received_amount' => 100000,
        ])->assertRedirect();

        $booking = Booking::where('business_id', $salon->id)->firstOrFail();
        $payment = BookingPayment::where('booking_id', $booking->id)->firstOrFail();
        $this->assertSame(80000, $payment->amount);
        $this->assertSame(100000, $payment->received_amount);
        $this->assertSame(20000, $payment->change_amount);

        // Partial refund updates paid_amount and transitions settled -> dp_verified
        $this->actingAs($this->owner)->post(route('dashboard.bookings.payments.store', $booking), [
            'payment_type' => 'refund',
            'payment_method' => 'cash',
            'amount' => 30000,
            'notes' => 'Diskon kompensasi',
        ])->assertRedirect();

        $booking->refresh();
        $this->assertSame(50000, $booking->paid_amount);
        $this->assertSame('dp_verified', $booking->payment_status);
        $this->assertNull($booking->settled_at);

        // Refund exceeding paid_amount is caught cleanly
        $this->actingAs($this->owner)->post(route('dashboard.bookings.payments.store', $booking), [
            'payment_type' => 'refund',
            'payment_method' => 'cash',
            'amount' => 60000,
        ])->assertSessionHas('error');

        // Date-range CSV export works and includes refund
        $todayJakarta = CarbonImmutable::now('Asia/Jakarta')->toDateString();
        $csv = $this->actingAs($this->owner)
            ->get(route('dashboard.cashier.export', [
                'date_from' => $todayJakarta,
                'date_to' => $todayJakarta,
            ]))
            ->assertOk()
            ->streamedContent();
        $this->assertStringContainsString('-30000', $csv);

        // Expired subscription triggers writable.subscription soft-lock on POS endpoints
        $this->owner->subscription()->update([
            'status' => 'trialing',
            'trial_ends_at' => now()->subDay(),
            'current_period_ends_at' => now()->subDay(),
        ]);

        $this->actingAs($this->owner)->post(route('dashboard.addons.store'), [
            'name' => 'Locked Addon',
            'price' => 10000,
        ])->assertSessionHas('error');

        $this->actingAs($this->owner)->post(route('dashboard.bookings.payments.store', $booking), [
            'payment_type' => 'settlement',
            'payment_method' => 'cash',
            'amount' => 30000,
        ])->assertSessionHas('error');
    }

    public function test_multi_service_dropoff_quota_atomic_rollback_max_turnaround_and_reschedule(): void
    {
        $dropoff = $this->createBusiness(Business::TYPE_DROPOFF, 'laundry-quota');
        $svcFast = Service::create([
            'business_id' => $dropoff->id,
            'name' => 'Cuci Lipat',
            'price' => 25000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 5,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'kg',
            'turnaround_days' => 1,
            'supports_pickup' => false,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
        $svcSlow = Service::create([
            'business_id' => $dropoff->id,
            'name' => 'Cuci Karpet',
            'price' => 90000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 3,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'pcs',
            'turnaround_days' => 5,
            'supports_pickup' => false,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        // Pick Monday so target date & +1/+5 open weekdays are predictable (Mon-Sat open, Sunday closed)
        $day1 = CarbonImmutable::now('Asia/Jakarta')->startOfDay()->next(CarbonImmutable::MONDAY);
        $day2 = $day1->addDays(1); // Tuesday

        // Order 1: qty 2 svcFast (turnaround 1) + qty 2 svcSlow (turnaround 5) -> MAX turnaround = 5 open days
        $this->post(route('public.booking.store', $dropoff->slug), [
            'services' => [
                ['service_id' => $svcFast->id, 'quantity' => 2],
                ['service_id' => $svcSlow->id, 'quantity' => 2],
            ],
            'date' => $day1->toDateString(),
            'customer_name' => 'Drop Multi 1',
            'customer_phone' => '081211112222',
        ])->assertRedirect();

        $order1 = Booking::where('business_id', $dropoff->id)->firstOrFail();
        // Monday + 5 open days (Tue, Wed, Thu, Fri, Sat) = Saturday
        $this->assertSame($day1->addDays(5)->toDateString(), $order1->estimated_ready_date?->toDateString());
        $this->assertSame(2, (int) BookingItem::where('booking_id', $order1->id)->where('service_id', $svcFast->id)->value('quantity'));

        // Order 2 asks for svcFast qty 2 (fits: 2+2<=5) + svcSlow qty 2 (exceeds: 2+2>3) -> atomic rollback!
        $this->post(route('public.booking.store', $dropoff->slug), [
            'services' => [
                ['service_id' => $svcFast->id, 'quantity' => 2],
                ['service_id' => $svcSlow->id, 'quantity' => 2],
            ],
            'date' => $day1->toDateString(),
            'customer_name' => 'Drop Overflow',
            'customer_phone' => '081211113333',
        ])->assertSessionHas('error');

        $this->assertSame(1, Booking::where('business_id', $dropoff->id)->count());

        // Reschedule Order 1 to Tuesday when Tuesday already has qty 2 of svcSlow -> qty 2 + qty 2 = 4 > 3 must fail!
        $this->post(route('public.booking.store', $dropoff->slug), [
            'service_id' => $svcSlow->id,
            'quantity' => 2,
            'date' => $day2->toDateString(),
            'customer_name' => 'Drop Tuesday Fill',
            'customer_phone' => '081211114444',
        ])->assertRedirect();

        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.reschedule', $order1->id), [
                'date' => $day2->toDateString(),
            ])
            ->assertSessionHas('error');
        $this->assertSame($day1->toDateString(), $order1->fresh()->booking_date->toDateString());

        // Reschedule Order 1 to Wednesday (free) -> succeeds & recalculates MAX turnaround (+5 days = Mon, open)
        $day3 = $day1->addDays(2);
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.reschedule', $order1->id), [
                'date' => $day3->toDateString(),
            ])
            ->assertRedirect();

        $order1->refresh();
        $this->assertSame($day3->toDateString(), $order1->booking_date->toDateString());
        $this->assertSame($day3->addDays(5)->toDateString(), $order1->estimated_ready_date?->toDateString());
    }

    public function test_timeslot_reschedule_duration_and_rbac_and_dp_verified_status_ledger(): void
    {
        $salon = $this->createBusiness(Business::TYPE_STAFF_APPOINTMENT, 'salon-resched');
        $svc = Service::create([
            'business_id' => $salon->id,
            'name' => 'Creambath',
            'price' => 100000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'booking_mode' => 'time_slot',
            'dp_type' => 'fixed',
            'dp_value' => 25000,
            'is_active' => true,
        ]);
        $staff = Staff::create([
            'business_id' => $salon->id,
            'name' => 'Bima',
            'commission_type' => 'percentage',
            'commission_value' => 20,
            'is_active' => true,
        ]);
        $svc->staff()->attach($staff->id);

        $addonComm = ServiceAddon::create([
            'business_id' => $salon->id,
            'name' => 'Serum Extra',
            'price' => 50000,
            'duration_minutes' => 60,
            'is_commissionable' => true,
            'applies_to_all_services' => true,
            'is_active' => true,
        ]);
        $addonRetail = ServiceAddon::create([
            'business_id' => $salon->id,
            'name' => 'Shampoo Botol',
            'price' => 100000,
            'duration_minutes' => 0,
            'is_commissionable' => false,
            'applies_to_all_services' => true,
            'is_active' => true,
        ]);

        // Staff with only manage_services is forbidden from bookings index
        $serviceOnlyStaff = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $salon->id,
        ]);
        $salon->users()->attach($serviceOnlyStaff->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_services']),
        ]);
        $this->actingAs($serviceOnlyStaff)->get(route('dashboard.bookings'))->assertForbidden();

        $day = $this->nextOpenWeekday(3);

        // Booking 1: 10:00 (120 min total: 60m service + 60m addon), total=250k, commission=(100k+50k)*20%=30k
        $this->post(route('public.booking.store', $salon->slug), [
            'service_id' => $svc->id,
            'addons' => [
                ['service_addon_id' => $addonComm->id, 'quantity' => 1],
                ['service_addon_id' => $addonRetail->id, 'quantity' => 1],
            ],
            'date' => $day->toDateString(),
            'time' => '10:00',
            'staff_id' => $staff->id,
            'customer_name' => 'Nadia',
            'customer_phone' => '081244445555',
        ])->assertRedirect();

        $booking = Booking::where('business_id', $salon->id)->firstOrFail();
        $this->assertSame(120, $booking->resolveTotalDurationMinutes());
        $this->assertSame(30000, $booking->commission_amount);

        // Blocking Booking 2 at 15:00 (60m)
        $this->post(route('public.booking.store', $salon->slug), [
            'service_id' => $svc->id,
            'date' => $day->toDateString(),
            'time' => '15:00',
            'staff_id' => $staff->id,
            'customer_name' => 'Raka',
            'customer_phone' => '081244446666',
        ])->assertRedirect();

        // Reschedule Booking 1 to 14:00 (would run 14:00-16:00 -> collides with 15:00 booking!) -> rejected
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.reschedule', $booking->id), [
                'date' => $day->toDateString(),
                'time' => '14:00',
                'staff_id' => $staff->id,
            ])
            ->assertSessionHas('error');

        // Reschedule Booking 1 to 13:00 (13:00-15:00) -> fits cleanly!
        $this->actingAs($this->owner)
            ->post(route('dashboard.bookings.reschedule', $booking->id), [
                'date' => $day->toDateString(),
                'time' => '13:00',
                'staff_id' => $staff->id,
            ])
            ->assertRedirect();

        $booking->refresh();
        $this->assertSame('13:00', $booking->start_at->timezone('Asia/Jakarta')->format('H:i'));
        $this->assertSame('15:00', $booking->end_at->timezone('Asia/Jakarta')->format('H:i'));

        // Updating status directly to dp_verified syncs BookingPayment + paid_amount atomically
        $this->actingAs($this->owner)
            ->patch(route('dashboard.bookings.status', $booking->id), [
                'payment_status' => 'dp_verified',
            ])
            ->assertRedirect();

        $booking->refresh();
        $this->assertSame('dp_verified', $booking->payment_status);
        $this->assertSame(25000, $booking->paid_amount);
        $this->assertDatabaseHas('booking_payments', [
            'booking_id' => $booking->id,
            'payment_type' => BookingPayment::TYPE_DP,
            'amount' => 25000,
        ]);
    }
}
