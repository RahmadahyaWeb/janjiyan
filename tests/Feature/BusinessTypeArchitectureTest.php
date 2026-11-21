<?php

namespace Tests\Feature;

use App\Jobs\SendTelegramBookingAlertJob;
use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\StaffTimeOff;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Notifications\CustomerBookingStatusNotification;
use App\Notifications\MerchantBookingAlertNotification;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class BusinessTypeArchitectureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);
    }

    private function createVerifiedOwnerWithBusiness(string $businessType, string $slug, string $planSlug = 'professional'): array
    {
        $owner = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $plan = SubscriptionPlan::where('slug', $planSlug)->firstOrFail();
        app(PlanLimitService::class)->ensureTrialSubscription($owner)->update([
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
        ]);

        $business = Business::create([
            'owner_id' => $owner->id,
            'name' => "Bisnis {$slug}",
            'slug' => $slug,
            'category' => 'Jasa Umum',
            'business_type' => $businessType,
            'phone' => '6281234567890',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);

        $business->users()->attach($owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $business->seedDefaultOperatingHours();
        $owner->update(['active_business_id' => $business->id]);

        return [$owner, $business];
    }

    private function nextOpenWeekday(int $daysAhead = 2): CarbonImmutable
    {
        $day = CarbonImmutable::now('Asia/Jakarta')->startOfDay()->addDays($daysAhead);
        while ($day->isSunday()) {
            $day = $day->addDay();
        }

        return $day;
    }

    // -------------------------------------------------------------------------
    // 1. Onboarding Guard & Whitelist
    // -------------------------------------------------------------------------

    public function test_register_and_google_oauth_do_not_create_placeholder_business(): void
    {
        Notification::fake();

        // Email registration creates user with null active_business_id and 0 businesses
        $this->post(route('register.store'), [
            'name' => 'Pemilik Baru',
            'email' => 'pemilik-baru@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect(route('verification.notice'));

        $emailUser = User::where('email', 'pemilik-baru@example.com')->firstOrFail();
        $this->assertNull($emailUser->active_business_id);
        $this->assertSame(0, $emailUser->businesses()->count());
        $this->assertSame(0, Business::count());

        // verification.* and logout remain accessible before onboarding
        $this->actingAs($emailUser)
            ->get(route('verification.notice'))
            ->assertOk();
        $this->actingAs($emailUser)
            ->post(route('logout'))
            ->assertRedirect(route('home'));
        $this->app['auth']->forgetGuards();

        // Google OAuth login for a brand-new user does not auto-create placeholder business
        $socialUser = (new SocialiteUser)
            ->setRaw(['email_verified' => true])
            ->map([
                'id' => 'google-new-123',
                'email' => 'google-new@example.com',
                'name' => 'Google Owner',
                'avatar' => null,
            ]);
        Socialite::shouldReceive('driver->user')->once()->andReturn($socialUser);

        $this->get(route('auth.google.callback'))
            ->assertRedirect(route('dashboard'));

        $googleUser = User::where('email', 'google-new@example.com')->firstOrFail();
        $this->assertNotNull($googleUser->email_verified_at);
        $this->assertNull($googleUser->active_business_id);
        $this->assertSame(0, $googleUser->businesses()->count());
        $this->assertSame(0, Business::count());
    }

    public function test_verified_owner_without_business_is_guarded_to_onboarding_whitelist_and_can_complete_onboarding(): void
    {
        $owner = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => null,
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($owner);

        // All dashboard routes (including profile & billing) redirect to onboarding.business
        foreach ([
            route('dashboard'),
            route('dashboard.services'),
            route('dashboard.bookings'),
            route('dashboard.settings'),
            route('dashboard.profile'),
            route('dashboard.billing'),
            route('dashboard.businesses.create'),
        ] as $protectedUrl) {
            $this->actingAs($owner)
                ->get($protectedUrl)
                ->assertRedirect(route('onboarding.business'));
        }

        // Onboarding page itself is accessible
        $this->actingAs($owner)
            ->get(route('onboarding.business'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Dashboard/Onboarding'));

        // Invalid business_type rejected on onboarding
        $this->actingAs($owner)
            ->post(route('onboarding.business.store'), [
                'name' => 'Bisnis Invalid',
                'business_type' => 'invalid_type',
                'category' => 'Lainnya',
            ])
            ->assertSessionHasErrors('business_type');
        $this->assertSame(0, Business::count());

        // Valid onboarding submission creates business, attaches owner pivot, sets active_business_id, redirects to dashboard
        $this->actingAs($owner)
            ->post(route('onboarding.business.store'), [
                'name' => 'Arena Padel Nusantara',
                'business_type' => Business::TYPE_SPACE_BOOKING,
                'category' => 'Lapangan Olahraga',
                'phone' => '081234567890',
                'address' => 'Jl. Olahraga No. 1',
            ])
            ->assertRedirect(route('dashboard'));

        $owner->refresh();
        $this->assertNotNull($owner->active_business_id);

        $business = Business::findOrFail($owner->active_business_id);
        $this->assertSame(Business::TYPE_SPACE_BOOKING, $business->business_type);
        $this->assertSame($owner->id, $business->owner_id);
        $this->assertSame('owner', $business->users()->where('users.id', $owner->id)->firstOrFail()->pivot->role);

        // Now dashboard & profile are accessible
        $this->actingAs($owner)->get(route('dashboard'))->assertOk();
        $this->actingAs($owner)->get(route('dashboard.profile'))->assertOk();

        // Logout works
        $this->actingAs($owner)->post(route('logout'))->assertRedirect(route('home'));
    }

    // -------------------------------------------------------------------------
    // 2. Invited Staff Bypass
    // -------------------------------------------------------------------------

    public function test_invited_staff_with_null_active_business_id_bypasses_onboarding(): void
    {
        [, $business] = $this->createVerifiedOwnerWithBusiness(Business::TYPE_STAFF_APPOINTMENT, 'barber-bypass');

        $staffUser = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => null,
        ]);
        $business->users()->attach($staffUser->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_bookings']),
        ]);

        // Accessing /dashboard resolves attached business and returns HTTP 200
        $this->actingAs($staffUser)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->where('activeBusiness.id', $business->id)
                ->where('activeBusiness.business_type', Business::TYPE_STAFF_APPOINTMENT)
            );

        $this->assertSame($business->id, $staffUser->fresh()->active_business_id);

        // Visiting onboarding or posting onboarding redirects straight to /dashboard without creating a business
        $this->actingAs($staffUser)
            ->get(route('onboarding.business'))
            ->assertRedirect(route('dashboard'));

        $this->actingAs($staffUser)
            ->post(route('onboarding.business.store'), [
                'name' => 'Staff Trying To Create',
                'business_type' => Business::TYPE_DROPOFF,
                'category' => 'Laundry',
            ])
            ->assertRedirect(route('dashboard'));

        $this->assertSame(1, Business::count());
    }

    // -------------------------------------------------------------------------
    // 3. Permanent business_type Lock
    // -------------------------------------------------------------------------

    public function test_business_type_is_permanently_locked_across_settings_onboarding_and_create_business(): void
    {
        $allTypes = Business::TYPES;

        foreach ($allTypes as $idx => $lockedType) {
            [$owner, $business] = $this->createVerifiedOwnerWithBusiness($lockedType, "locked-biz-{$idx}");
            $tamperedType = $allTypes[($idx + 1) % count($allTypes)];

            // Settings update ignores tampered business_type
            $this->actingAs($owner)
                ->post(route('dashboard.settings.update'), [
                    'name' => "Bisnis Updated {$idx}",
                    'slug' => $business->slug,
                    'category' => 'Kategori Baru',
                    'business_type' => $tamperedType,
                    'timezone' => 'Asia/Jakarta',
                    'dp_expiry_minutes' => 120,
                ])
                ->assertRedirect();

            $business->refresh();
            $this->assertSame($lockedType, $business->business_type);
            $this->assertSame("Bisnis Updated {$idx}", $business->name);

            // Re-posting onboarding when already onboarded cannot mutate existing business_type or create a second business
            $countBefore = Business::count();
            $this->actingAs($owner)
                ->post(route('onboarding.business.store'), [
                    'name' => 'Bypass Onboarding',
                    'business_type' => $tamperedType,
                    'category' => 'Lainnya',
                ])
                ->assertRedirect(route('dashboard'));

            $this->assertSame($countBefore, Business::count());
            $this->assertSame($lockedType, $business->fresh()->business_type);
        }

        // BusinessController::store rejects invalid business_type (HTTP 422 on JSON) and locks valid business_type
        [$multiOwner] = $this->createVerifiedOwnerWithBusiness(Business::TYPE_STAFF_APPOINTMENT, 'multi-owner-base');

        $this->actingAs($multiOwner)
            ->postJson(route('dashboard.businesses.store'), [
                'name' => 'Invalid Type Biz',
                'business_type' => 'hybrid_mix',
                'category' => 'Campuran',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('business_type');

        $this->actingAs($multiOwner)
            ->post(route('dashboard.businesses.store'), [
                'name' => 'Laundry Kilat Baru',
                'business_type' => Business::TYPE_DROPOFF,
                'category' => 'Laundry',
            ])
            ->assertRedirect(route('dashboard'));

        $created = Business::where('name', 'Laundry Kilat Baru')->firstOrFail();
        $this->assertSame(Business::TYPE_DROPOFF, $created->business_type);
    }

    // -------------------------------------------------------------------------
    // 4. Server-Side Mode Derivation (ServiceController)
    // -------------------------------------------------------------------------

    public function test_service_controller_derives_booking_and_assignment_mode_server_side(): void
    {
        $matrix = [
            Business::TYPE_STAFF_APPOINTMENT => [
                'expected_booking_mode' => 'time_slot',
                'expected_assignment_mode' => 'staff',
                'tampered_booking_mode' => 'dropoff',
                'tampered_assignment_mode' => 'capacity',
            ],
            Business::TYPE_SPACE_BOOKING => [
                'expected_booking_mode' => 'time_slot',
                'expected_assignment_mode' => 'capacity',
                'tampered_booking_mode' => 'dropoff',
                'tampered_assignment_mode' => 'staff',
            ],
            Business::TYPE_DROPOFF => [
                'expected_booking_mode' => 'dropoff',
                'expected_assignment_mode' => 'capacity',
                'tampered_booking_mode' => 'time_slot',
                'tampered_assignment_mode' => 'staff',
            ],
        ];

        foreach ($matrix as $businessType => $spec) {
            [$owner, $business] = $this->createVerifiedOwnerWithBusiness($businessType, "derive-{$businessType}");
            $staff = Staff::create([
                'business_id' => $business->id,
                'name' => 'Staff Uji',
                'is_active' => true,
            ]);

            // Create service with tampered booking_mode & assignment_mode
            $this->actingAs($owner)
                ->post(route('dashboard.services.store'), [
                    'name' => "Layanan {$businessType}",
                    'price' => 50000,
                    'duration_minutes' => 45,
                    'buffer_minutes' => 15,
                    'capacity' => 3,
                    'booking_mode' => $spec['tampered_booking_mode'],
                    'assignment_mode' => $spec['tampered_assignment_mode'],
                    'dp_type' => 'none',
                    'dp_value' => 0,
                    'staff_ids' => [$staff->id],
                ])
                ->assertRedirect(route('dashboard.services'));

            $service = Service::where('business_id', $business->id)->firstOrFail();
            $this->assertSame($spec['expected_booking_mode'], $service->booking_mode);
            $this->assertSame($spec['expected_assignment_mode'], $service->assignment_mode);
            $this->assertSame($businessType === Business::TYPE_STAFF_APPOINTMENT ? 1 : 0, $service->staff()->count());

            // Update service with tampered booking_mode & assignment_mode
            $this->actingAs($owner)
                ->put(route('dashboard.services.update', $service->id), [
                    'name' => "Layanan {$businessType} Updated",
                    'price' => 60000,
                    'duration_minutes' => 60,
                    'buffer_minutes' => 0,
                    'capacity' => 4,
                    'booking_mode' => $spec['tampered_booking_mode'],
                    'assignment_mode' => $spec['tampered_assignment_mode'],
                    'dp_type' => 'none',
                    'dp_value' => 0,
                    'staff_ids' => [$staff->id],
                ])
                ->assertRedirect(route('dashboard.services'));

            $service->refresh();
            $this->assertSame($spec['expected_booking_mode'], $service->booking_mode);
            $this->assertSame($spec['expected_assignment_mode'], $service->assignment_mode);
            $this->assertSame($businessType === Business::TYPE_STAFF_APPOINTMENT ? 1 : 0, $service->staff()->count());
        }
    }

    // -------------------------------------------------------------------------
    // 5. Non-staff_appointment HTTP 403 Permission Guards & Commission / No-Show Guards
    // -------------------------------------------------------------------------

    public function test_non_staff_appointment_blocks_commissions_staff_schedules_and_strips_commissions(): void
    {
        foreach ([Business::TYPE_SPACE_BOOKING, Business::TYPE_DROPOFF] as $nonStaffType) {
            [$owner, $business] = $this->createVerifiedOwnerWithBusiness($nonStaffType, "guard-{$nonStaffType}");

            $staff = Staff::create([
                'business_id' => $business->id,
                'name' => 'Admin Tim',
                'is_active' => true,
            ]);
            $timeOff = StaffTimeOff::create([
                'business_id' => $business->id,
                'staff_id' => $staff->id,
                'start_date' => now()->addDays(2)->toDateString(),
                'end_date' => now()->addDays(2)->toDateString(),
                'reason' => 'Cuti',
            ]);

            // Commission routes return 403
            $this->actingAs($owner)->get(route('dashboard.commissions'))->assertForbidden();
            $this->actingAs($owner)->get(route('dashboard.commissions.export'))->assertForbidden();

            // Staff schedule & time-off & calendar.ics routes return 403
            $this->actingAs($owner)->get(route('dashboard.staff.schedule.edit', $staff->id))->assertForbidden();
            $this->actingAs($owner)->get(route('dashboard.staff.schedule.show', $staff->id))->assertForbidden();
            $this->actingAs($owner)->put(route('dashboard.staff.schedule.update', $staff->id), [
                'use_business_default' => true,
            ])->assertForbidden();
            $this->actingAs($owner)->post(route('dashboard.staff.time-offs.store', $staff->id), [
                'start_date' => now()->addDays(5)->toDateString(),
                'end_date' => now()->addDays(5)->toDateString(),
                'reason' => 'Izin',
            ])->assertForbidden();
            $this->actingAs($owner)->delete(route('dashboard.staff.time-offs.destroy', [
                'staff' => $staff->id,
                'timeOff' => $timeOff->id,
            ]))->assertForbidden();
            $this->actingAs($owner)->get(route('dashboard.staff.calendar.ics', $staff->id))->assertForbidden();

            // StaffController::store strips commission_type/commission_value to none/0
            $this->actingAs($owner)
                ->post(route('dashboard.staff.store'), [
                    'name' => "Anggota {$nonStaffType}",
                    'title' => 'Operasional',
                    'commission_type' => 'percentage',
                    'commission_value' => 30,
                    'grant_login' => false,
                ])
                ->assertRedirect(route('dashboard.staff'));

            $createdStaff = Staff::where('business_id', $business->id)
                ->where('name', "Anggota {$nonStaffType}")
                ->firstOrFail();
            $this->assertSame('none', $createdStaff->commission_type);
            $this->assertSame(0, $createdStaff->commission_value);

            // StaffController::update also forces commission_type/commission_value to none/0
            $this->actingAs($owner)
                ->put(route('dashboard.staff.update', $createdStaff->id), [
                    'name' => "Anggota {$nonStaffType} Updated",
                    'is_active' => true,
                    'commission_type' => 'fixed',
                    'commission_value' => 25000,
                ])
                ->assertRedirect(route('dashboard.staff'));

            $createdStaff->refresh();
            $this->assertSame('none', $createdStaff->commission_type);
            $this->assertSame(0, $createdStaff->commission_value);
        }
    }

    public function test_booking_controller_rejects_no_show_on_dropoff_business(): void
    {
        [$owner, $business] = $this->createVerifiedOwnerWithBusiness(Business::TYPE_DROPOFF, 'dropoff-noshow-guard');

        $service = Service::create([
            'business_id' => $business->id,
            'name' => 'Cuci Kiloan',
            'price' => 15000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 20,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'kg',
            'turnaround_days' => 2,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        $customer = Customer::create([
            'business_id' => $business->id,
            'name' => 'Pelanggan Dropoff',
            'phone' => '6281234500001',
        ]);

        $day = $this->nextOpenWeekday();
        $booking = Booking::create([
            'business_id' => $business->id,
            'customer_id' => $customer->id,
            'service_id' => $service->id,
            'booking_mode' => 'dropoff',
            'unit_label' => 'kg',
            'quantity' => 3,
            'fulfillment_type' => 'dropoff',
            'booking_code' => 'JNY-NOSHOW',
            'invoice_number' => 'INV-20261121-NOSHOW',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $day->toDateString(),
            'start_at' => $day->setTime(9, 0)->utc(),
            'end_at' => $day->setTime(10, 0)->utc(),
            'buffer_end_at' => $day->setTime(10, 0)->utc(),
            'total_price' => 45000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'work_status' => 'awaiting_dropoff',
            'payment_status' => 'unpaid',
        ]);

        $this->actingAs($owner)
            ->patchJson(route('dashboard.bookings.status', $booking->id), [
                'reservation_status' => 'no_show',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reservation_status');

        $this->assertSame('confirmed', $booking->fresh()->reservation_status);
    }

    // -------------------------------------------------------------------------
    // 6. services.unit_label Whitelist, bookings.unit_label Snapshot & Quota Errors
    // -------------------------------------------------------------------------

    public function test_service_unit_label_whitelist_accepts_allowed_values_and_rejects_invalid(): void
    {
        [$owner, $business] = $this->createVerifiedOwnerWithBusiness(Business::TYPE_DROPOFF, 'laundry-whitelist');

        // Reject arbitrary unit_label like 'karung'
        $this->actingAs($owner)
            ->postJson(route('dashboard.services.store'), [
                'name' => 'Cuci Karung',
                'price' => 20000,
                'capacity' => 10,
                'unit_label' => 'karung',
                'turnaround_days' => 2,
                'dp_type' => 'none',
                'dp_value' => 0,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('unit_label');

        // Accept all 5 allowed preset unit labels
        foreach (Service::UNIT_LABELS as $unit) {
            $this->actingAs($owner)
                ->post(route('dashboard.services.store'), [
                    'name' => "Layanan {$unit}",
                    'price' => 10000,
                    'capacity' => 10,
                    'unit_label' => $unit,
                    'turnaround_days' => 2,
                    'dp_type' => 'none',
                    'dp_value' => 0,
                ])
                ->assertRedirect(route('dashboard.services'));

            $this->assertDatabaseHas('services', [
                'business_id' => $business->id,
                'name' => "Layanan {$unit}",
                'unit_label' => $unit,
                'booking_mode' => 'dropoff',
            ]);
        }
    }

    public function test_booking_unit_label_snapshot_persists_across_invoice_dashboard_and_notifications_and_quota_uses_unit_label(): void
    {
        Notification::fake();
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        [$owner, $business] = $this->createVerifiedOwnerWithBusiness(Business::TYPE_DROPOFF, 'laundry-snapshot');
        $business->update([
            'telegram_notifications_enabled' => true,
            'telegram_bot_token' => '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
            'telegram_chat_id' => '987654321',
        ]);

        $service = Service::create([
            'business_id' => $business->id,
            'name' => 'Cuci Lipat Express',
            'price' => 12000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 5,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'unit_label' => 'kg',
            'turnaround_days' => 2,
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        $targetDate = $this->nextOpenWeekday(2)->toDateString();

        // Book 3 kg -> remaining quota becomes 2 kg
        $this->post(route('public.booking.store', $business->slug), [
            'service_id' => $service->id,
            'date' => $targetDate,
            'quantity' => 3,
            'fulfillment_type' => 'dropoff',
            'customer_name' => 'Siti Laundry',
            'customer_phone' => '081234567890',
            'customer_email' => 'siti.laundry@example.com',
        ])->assertRedirect();

        $booking = Booking::where('business_id', $business->id)->latest('id')->firstOrFail();
        $this->assertSame('kg', $booking->unit_label);

        // Requesting 4 kg when only 2 kg remains must show unit-aware quota error
        $this->post(route('public.booking.store', $business->slug), [
            'service_id' => $service->id,
            'date' => $targetDate,
            'quantity' => 4,
            'fulfillment_type' => 'dropoff',
            'customer_name' => 'Budi Laundry',
            'customer_phone' => '081299998888',
        ])->assertSessionHas('error', 'Sisa kuota pada tanggal tersebut hanya 2 kg.');

        // Now merchant edits service unit_label from 'kg' to 'pcs'
        $this->actingAs($owner)
            ->put(route('dashboard.services.update', $service->id), [
                'name' => 'Cuci Lipat Express',
                'price' => 12000,
                'capacity' => 5,
                'unit_label' => 'pcs',
                'turnaround_days' => 2,
                'dp_type' => 'none',
                'dp_value' => 0,
            ])
            ->assertRedirect(route('dashboard.services'));

        $this->assertSame('pcs', $service->fresh()->unit_label);
        $this->assertSame('kg', $booking->fresh()->unit_label);

        // 1. Public invoice page still shows 'kg' snapshot
        $this->get(route('public.booking.invoice', [
            'slug' => $business->slug,
            'token' => $booking->invoice_token,
        ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BookingStatus')
                ->where('booking.unit_label', 'kg')
            );

        // 2. Public invoice lookup still shows 'kg' snapshot
        $this->post(route('public.booking.invoices.lookup', $business->slug), [
            'invoice_number' => $booking->invoice_number,
            'phone_last4' => '7890',
        ])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/InvoiceLookup')
                ->where('history.0.unit_label', 'kg')
            );

        // 3. Dashboard bookings still shows 'kg' snapshot
        $this->actingAs($owner)
            ->get(route('dashboard.bookings'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Bookings/Index')
                ->where('bookings.0.unit_label', 'kg')
            );

        // 4. Customer & Merchant Mail notifications use 'kg' snapshot (not 'pcs')
        $customerMail = (new CustomerBookingStatusNotification($booking->fresh(), 'confirmed'))->toMail($booking->customer);
        $customerMailText = implode("\n", array_merge($customerMail->introLines, $customerMail->outroLines));
        $this->assertStringContainsString('(3 kg)', $customerMailText);
        $this->assertStringNotContainsString('(3 pcs)', $customerMailText);

        $merchantMail = (new MerchantBookingAlertNotification($booking->fresh(), 'new_booking'))->toMail($owner);
        $merchantMailText = implode("\n", array_merge($merchantMail->introLines, $merchantMail->outroLines));
        $this->assertStringContainsString('(3 kg)', $merchantMailText);
        $this->assertStringNotContainsString('(3 pcs)', $merchantMailText);

        // 5. Telegram alert job uses 'kg' snapshot (not 'pcs')
        (new SendTelegramBookingAlertJob($booking->id, 'new_booking'))->handle();
        Http::assertSent(function ($request) {
            $text = $request->data()['text'] ?? '';

            return str_contains($text, '(3 kg)') && ! str_contains($text, '(3 pcs)');
        });
    }
}
