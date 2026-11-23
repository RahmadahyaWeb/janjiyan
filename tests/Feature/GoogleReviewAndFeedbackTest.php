<?php

namespace Tests\Feature;

use App\Jobs\SendTelegramReviewAlertJob;
use App\Models\Booking;
use App\Models\Business;
use App\Models\BusinessReview;
use App\Models\Customer;
use App\Models\Service;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

class GoogleReviewAndFeedbackTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private Service $service;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Review',
            'email' => 'owner-review@example.test',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        app(PlanLimitService::class)->ensureTrialSubscription($this->owner)->update([
            'subscription_plan_id' => SubscriptionPlan::where('slug', 'professional')->firstOrFail()->id,
            'status' => 'active',
        ]);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Barbershop Rapi',
            'slug' => 'barbershop-rapi',
            'category' => 'Barbershop',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'address' => 'Jl. Sudirman No. 10',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'google_review_url' => 'https://g.page/r/barbershop-rapi/review',
            'review_redirect_min_rating' => 4,
            'review_enabled' => true,
            'review_sticker_subtitle' => 'Scan & Nilai Layanan Kami',
            'telegram_notifications_enabled' => true,
            'telegram_bot_token' => '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
            'telegram_chat_id' => '-1001234567890',
            'is_active' => true,
        ]);

        $this->business->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->owner->update(['active_business_id' => $this->business->id]);

        $this->service = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Potong Rambut Premium',
            'price' => 75000,
            'duration_minutes' => 45,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'time_slot',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        $this->customer = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Budi Santoso',
            'phone' => '081234567890',
        ]);
    }

    private function createBooking(array $overrides = []): Booking
    {
        $startAt = CarbonImmutable::now('Asia/Jakarta')->addDay()->setTime(10, 0)->utc();

        return Booking::create(array_merge([
            'business_id' => $this->business->id,
            'service_id' => $this->service->id,
            'customer_id' => $this->customer->id,
            'booked_customer_name' => 'Budi Santoso',
            'booking_mode' => 'time_slot',
            'quantity' => 1,
            'booking_code' => 'BK-'.strtoupper(substr(md5((string) microtime(true).mt_rand()), 0, 6)),
            'invoice_number' => 'INV-'.strtoupper(substr(md5((string) microtime(true).mt_rand()), 0, 8)),
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $startAt->setTimezone('Asia/Jakarta')->toDateString(),
            'start_at' => $startAt,
            'end_at' => $startAt->addMinutes(45),
            'buffer_end_at' => $startAt->addMinutes(45),
            'total_price' => 75000,
            'dp_amount' => 0,
            'paid_amount' => 75000,
            'reservation_status' => 'completed',
            'payment_status' => 'settled',
        ], $overrides));
    }

    private function settingsPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => $this->business->name,
            'slug' => $this->business->slug,
            'category' => $this->business->category,
            'timezone' => $this->business->timezone,
            'dp_expiry_minutes' => $this->business->dp_expiry_minutes,
        ], $overrides);
    }

    public function test_settings_exposes_and_validates_google_review_fields_and_plan_gate(): void
    {
        $props = $this->actingAs($this->owner)
            ->get(route('dashboard.settings'))
            ->assertOk()
            ->viewData('page')['props'];

        $this->assertTrue($props['canUseGoogleReview']);
        $this->assertSame('https://g.page/r/barbershop-rapi/review', $props['business']['google_review_url']);
        $this->assertSame(4, $props['business']['review_redirect_min_rating']);
        $this->assertTrue($props['business']['review_enabled']);
        $this->assertSame('Scan & Nilai Layanan Kami', $props['business']['review_sticker_subtitle']);

        // Rejects non-HTTPS or non-Google domains
        foreach ([
            'http://g.page/r/barbershop-rapi/review',
            'https://evil.example.com/review',
            'https://google.com.evil.example.com/review',
            'https://user:pass@google.com/maps',
        ] as $badUrl) {
            $this->actingAs($this->owner)
                ->post(route('dashboard.settings.update'), $this->settingsPayload([
                    'google_review_url' => $badUrl,
                ]))
                ->assertSessionHasErrors([
                    'google_review_url' => 'URL Google Review harus memakai HTTPS dan domain Google resmi (google.com, g.page, atau maps.app.goo.gl).',
                ]);
        }

        // Accepts valid Google domains
        $this->actingAs($this->owner)
            ->post(route('dashboard.settings.update'), $this->settingsPayload([
                'google_review_url' => 'https://maps.app.goo.gl/AbCdEf123',
                'review_redirect_min_rating' => 5,
                'review_enabled' => false,
                'review_sticker_subtitle' => '  Yuk Kasih Bintang 5  ',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->business->refresh();
        $this->assertSame('https://maps.app.goo.gl/AbCdEf123', $this->business->google_review_url);
        $this->assertSame(5, $this->business->review_redirect_min_rating);
        $this->assertFalse($this->business->review_enabled);
        $this->assertSame('Yuk Kasih Bintang 5', $this->business->review_sticker_subtitle);

        // Update review sticker subtitle endpoint works on Pro
        $this->actingAs($this->owner)
            ->patch(route('dashboard.settings.review-subtitle'), [
                'review_sticker_subtitle' => '   Ulas Kami di Google   ',
            ])
            ->assertSessionHas('success');
        $this->assertSame('Ulas Kami di Google', $this->business->fresh()->review_sticker_subtitle);

        // Downgrade to Basic plan
        $this->owner->subscription()->firstOrFail()->update([
            'subscription_plan_id' => SubscriptionPlan::where('slug', 'basic')->firstOrFail()->id,
        ]);
        $this->business->update([
            'google_review_url' => null,
            'review_redirect_min_rating' => 4,
            'review_enabled' => true,
            'review_sticker_subtitle' => null,
        ]);

        // Basic merchant can still save general profile settings without error
        $this->actingAs($this->owner)
            ->post(route('dashboard.settings.update'), $this->settingsPayload([
                'name' => 'Barbershop Rapi Baru',
                'google_review_url' => '',
                'review_redirect_min_rating' => 4,
                'review_enabled' => true,
                'review_sticker_subtitle' => '',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        // Basic merchant cannot configure google_review_url or alter review settings
        $this->actingAs($this->owner)
            ->post(route('dashboard.settings.update'), $this->settingsPayload([
                'google_review_url' => 'https://g.page/r/basic-blocked',
            ]))
            ->assertSessionHas('error', 'Fitur Google Maps Review tersedia pada paket Professional dan Enterprise.');
        $this->assertNull($this->business->fresh()->google_review_url);

        foreach ([
            ['review_redirect_min_rating' => 5],
            ['review_enabled' => false],
            ['review_sticker_subtitle' => 'Custom Basic'],
        ] as $alteration) {
            $this->actingAs($this->owner)
                ->post(route('dashboard.settings.update'), $this->settingsPayload($alteration))
                ->assertSessionHas('error', 'Fitur Google Maps Review tersedia pada paket Professional dan Enterprise.');
        }

        $this->actingAs($this->owner)
            ->patch(route('dashboard.settings.review-subtitle'), [
                'review_sticker_subtitle' => 'Blocked on Basic',
            ])
            ->assertSessionHas('error', 'Fitur Google Maps Review tersedia pada paket Professional dan Enterprise.');
        $this->assertNull($this->business->fresh()->review_sticker_subtitle);
    }

    public function test_public_review_page_handles_suspended_disabled_and_token_context_safely(): void
    {
        $booking = $this->createBooking([
            'pickup_address' => 'Rahasia Jalan 99',
            'customer_notes' => 'Catatan sensitif pelanggan',
        ]);

        $page = $this->get(route('public.review.show', ['slug' => $this->business->slug, 'token' => $booking->invoice_token]))
            ->assertOk()
            ->viewData('page');

        $this->assertSame('Public/ReviewSubmit', $page['component']);
        $props = $page['props'];
        $this->assertNull($props['reviewDisabledReason']);
        $this->assertSame([
            'token' => $booking->invoice_token,
            'booking_code' => $booking->booking_code,
            'invoice_number' => $booking->invoice_number,
            'service_name' => 'Potong Rambut Premium',
            'customer_name' => 'Budi Santoso',
            'already_reviewed' => false,
        ], $props['bookingContext']);
        $this->assertArrayNotHasKey('customer_phone', $props['bookingContext']);
        $this->assertArrayNotHasKey('pickup_address', $props['bookingContext']);
        $this->assertArrayNotHasKey('customer_notes', $props['bookingContext']);

        // Cancelled or cross-tenant booking tokens are ignored cleanly
        $cancelledBooking = $this->createBooking(['reservation_status' => 'cancelled']);
        $cancelledProps = $this->get(route('public.review.show', ['slug' => $this->business->slug, 'token' => $cancelledBooking->invoice_token]))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertNull($cancelledProps['bookingContext']);

        // Suspended business renders 403 BusinessUnavailable
        $this->business->update(['suspended_at' => now(), 'suspension_reason' => 'Ditangguhkan admin']);
        $suspendedPage = $this->get(route('public.review.show', ['slug' => $this->business->slug]))
            ->assertForbidden()
            ->viewData('page');
        $this->assertSame('Public/BusinessUnavailable', $suspendedPage['component']);

        // Disabled review sets reviewDisabledReason
        $this->business->update(['suspended_at' => null, 'suspension_reason' => null, 'review_enabled' => false]);
        $disabledProps = $this->get(route('public.review.show', ['slug' => $this->business->slug]))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertNotNull($disabledProps['reviewDisabledReason']);
    }

    public function test_public_review_submission_smart_routing_honeypot_duplicate_and_telegram_alert(): void
    {
        Queue::fake();

        // 1. Honeypot drops bots silently
        $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 1,
            'comment' => 'Spam bot comment',
            'website' => 'https://spam.example.test',
        ])->assertRedirect();

        $this->assertDatabaseCount('business_reviews', 0);
        Queue::assertNothingPushed();

        // 2. High rating (>= 4) with booking token redirects via PRG to Google CTA & does NOT send Telegram alert
        $booking = $this->createBooking();
        $response = $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 5,
            'comment' => 'Pelayanan cepat dan sangat rapi!',
            'token' => $booking->invoice_token,
        ]);

        $response->assertRedirect(route('public.review.show', [
            'slug' => $this->business->slug,
            'token' => $booking->invoice_token,
        ]));
        $response->assertSessionHas('success', 'Terima kasih atas ulasan Anda!');
        Queue::assertNotPushed(SendTelegramReviewAlertJob::class);

        $review = BusinessReview::firstOrFail();
        $this->assertSame($booking->id, $review->booking_id);
        $this->assertSame($this->customer->id, $review->customer_id);
        $this->assertSame('Budi Santoso', $review->reviewer_name);
        $this->assertFalse($review->redirected_to_google);

        // Follow PRG redirect to verify submittedReview props
        $showProps = $this->get(route('public.review.show', [
            'slug' => $this->business->slug,
            'token' => $booking->invoice_token,
        ]))->assertOk()->viewData('page')['props'];

        $this->assertSame([
            'id' => $review->id,
            'rating' => 5,
            'comment' => 'Pelayanan cepat dan sangat rapi!',
            'should_redirect_google' => true,
            'google_review_url' => 'https://g.page/r/barbershop-rapi/review',
        ], $showProps['submittedReview']);
        $this->assertTrue($showProps['bookingContext']['already_reviewed']);

        // 3. Duplicate submission on same token is rejected
        $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 5,
            'token' => $booking->invoice_token,
        ])->assertSessionHasErrors([
            'token' => 'Ulasan untuk pesanan ini sudah pernah dikirim.',
        ]);

        // 4. Mark redirected endpoint works & rejects cross-tenant review IDOR
        $this->postJson(route('public.review.redirect', [
            'slug' => $this->business->slug,
            'review' => $review->id,
        ]))->assertOk()->assertJson(['ok' => true]);
        $this->assertTrue($review->fresh()->redirected_to_google);

        // Cross-tenant business cannot mark another business's review
        $otherBusiness = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Other Salon',
            'slug' => 'other-salon',
            'category' => 'Salon',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->postJson(route('public.review.redirect', [
            'slug' => $otherBusiness->slug,
            'review' => $review->id,
        ]))->assertNotFound();

        // 5. Low rating (< 4) walk-in (no token) dispatches Telegram alert and does NOT redirect to Google
        $lowResponse = $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 2,
            'reviewer_name' => 'Ani <script>alert(1)</script>',
            'reviewer_phone' => '081999888777',
            'comment' => 'AC ruang tunggu agak panas & antrean lama',
        ]);
        $lowResponse->assertRedirect(route('public.review.show', ['slug' => $this->business->slug]));
        Queue::assertPushed(SendTelegramReviewAlertJob::class, 1);

        $lowProps = $this->get(route('public.review.show', ['slug' => $this->business->slug]))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertFalse($lowProps['submittedReview']['should_redirect_google']);
        $this->assertNull($lowProps['submittedReview']['google_review_url']);

        // Second anonymous walk-in review (null booking_id) also succeeds cleanly
        $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 4,
            'comment' => 'Bagus!',
        ])->assertRedirect();
        $this->assertDatabaseCount('business_reviews', 3);

        // Cross-tenant booking token cannot be submitted on otherBusiness
        $otherBooking = $this->createBooking();
        $this->post(route('public.review.store', $otherBusiness->slug), [
            'rating' => 5,
            'token' => $otherBooking->invoice_token,
        ])->assertSessionHasErrors('token');

        // Disabled review rejects POST cleanly without creating row
        $this->business->update(['review_enabled' => false]);
        $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 5,
        ])->assertSessionHas('error');
        $this->assertDatabaseCount('business_reviews', 3);
    }

    public function test_telegram_review_alert_job_html_escapes_all_user_inputs(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $this->business->update([
            'name' => 'Salon <X&Y> "Elite"',
        ]);

        $booking = $this->createBooking([
            'booking_code' => 'BK-<123>',
            'invoice_number' => 'INV-&"99"',
        ]);

        $review = BusinessReview::create([
            'business_id' => $this->business->id,
            'booking_id' => $booking->id,
            'customer_id' => $this->customer->id,
            'reviewer_name' => '<script>alert("xss")</script>',
            'reviewer_phone' => '0812<img src=x>',
            'rating' => 1,
            'comment' => 'Kurang rapi <b>banget</b> & telat "30 menit"',
            'redirected_to_google' => false,
        ]);

        (new SendTelegramReviewAlertJob($review->id))->handle();

        Http::assertSent(function ($request) {
            $data = $request->data();
            $text = (string) ($data['text'] ?? '');

            return $data['parse_mode'] === 'HTML'
                && str_contains($text, 'Salon &lt;X&amp;Y&gt; &quot;Elite&quot;')
                && str_contains($text, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
                && str_contains($text, '0812&lt;img src=x&gt;')
                && str_contains($text, 'BK-&lt;123&gt;')
                && str_contains($text, 'INV-&amp;&quot;99&quot;')
                && str_contains($text, 'Kurang rapi &lt;b&gt;banget&lt;/b&gt; &amp; telat &quot;30 menit&quot;')
                && ! str_contains($text, '<script>');
        });
    }

    public function test_telegram_review_alert_job_handles_http_errors_cleanly(): void
    {
        $review = BusinessReview::create([
            'business_id' => $this->business->id,
            'reviewer_name' => 'Test Error Handling',
            'rating' => 1,
            'comment' => 'Testing HTTP error handling',
            'redirected_to_google' => false,
        ]);

        Http::fake([
            'https://api.telegram.org/*' => Http::sequence()
                ->push(['ok' => false, 'description' => 'Bad Request'], 400)
                ->push(['ok' => false], 500),
        ]);

        // Permanent 400 client error does not throw
        (new SendTelegramReviewAlertJob($review->id))->handle();

        // Transient 500 server error throws RuntimeException for retry
        $this->expectException(RuntimeException::class);
        (new SendTelegramReviewAlertJob($review->id))->handle();
    }

    public function test_dashboard_reviews_inbox_permissions_stats_and_filters(): void
    {
        $booking = $this->createBooking([
            'booking_code' => 'BK-CARIME',
            'invoice_number' => 'INV-2026-XYZ',
        ]);

        BusinessReview::create([
            'business_id' => $this->business->id,
            'booking_id' => $booking->id,
            'customer_id' => $this->customer->id,
            'reviewer_name' => 'Budi Santoso',
            'reviewer_phone' => '081234567890',
            'rating' => 5,
            'comment' => 'Mantap sekali',
            'redirected_to_google' => true,
        ]);

        BusinessReview::create([
            'business_id' => $this->business->id,
            'reviewer_name' => 'Citra',
            'reviewer_phone' => '085566778899',
            'rating' => 2,
            'comment' => 'Kurang bersih',
            'redirected_to_google' => false,
        ]);

        BusinessReview::create([
            'business_id' => $this->business->id,
            'reviewer_name' => 'Dodi',
            'rating' => 4,
            'comment' => 'Oke lah',
            'redirected_to_google' => false,
        ]);

        // Unrelated business review must never leak
        $otherBiz = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Tenant Lain',
            'slug' => 'tenant-lain',
            'category' => 'Salon',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        BusinessReview::create([
            'business_id' => $otherBiz->id,
            'reviewer_name' => 'Leak Guard',
            'rating' => 1,
            'comment' => 'Should not appear',
            'redirected_to_google' => false,
        ]);

        // Staff with manage_services only is forbidden
        $serviceStaff = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $this->business->id,
        ]);
        $this->business->users()->attach($serviceStaff->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_services']),
        ]);
        $this->actingAs($serviceStaff)->get(route('dashboard.reviews'))->assertForbidden();

        // Staff with manage_bookings is allowed
        $bookingStaff = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $this->business->id,
        ]);
        $this->business->users()->attach($bookingStaff->id, [
            'role' => 'staff',
            'permissions' => json_encode(['manage_bookings']),
        ]);
        $this->actingAs($bookingStaff)->get(route('dashboard.reviews'))->assertOk();

        // Owner sees accurate stats and all 3 reviews
        $props = $this->actingAs($this->owner)
            ->get(route('dashboard.reviews'))
            ->assertOk()
            ->viewData('page')['props'];

        $this->assertSame([
            'total_count' => 3,
            'average_rating' => 3.7,
            'private_feedback_count' => 1,
            'google_redirected_count' => 1,
        ], $props['stats']);
        $this->assertCount(3, $props['reviews']);
        $this->assertSame(route('public.review.show', ['slug' => $this->business->slug]), $props['publicReviewUrl']);

        // Filter type=low returns only rating < 4 while keeping full stats
        $lowProps = $this->actingAs($this->owner)
            ->get(route('dashboard.reviews', ['type' => 'low']))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertCount(1, $lowProps['reviews']);
        $this->assertSame('Citra', $lowProps['reviews'][0]['reviewer_name']);
        $this->assertTrue($lowProps['reviews'][0]['is_private_feedback']);
        $this->assertSame(3, $lowProps['stats']['total_count']);

        // Filter type=high returns rating >= 4
        $highProps = $this->actingAs($this->owner)
            ->get(route('dashboard.reviews', ['type' => 'high']))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertCount(2, $highProps['reviews']);

        // Filter rating=4 returns only 4-star review
        $ratingProps = $this->actingAs($this->owner)
            ->get(route('dashboard.reviews', ['rating' => '4']))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertCount(1, $ratingProps['reviews']);
        $this->assertSame('Dodi', $ratingProps['reviews'][0]['reviewer_name']);

        // Search by booking_code or invoice_number matches linked review
        $searchProps = $this->actingAs($this->owner)
            ->get(route('dashboard.reviews', ['search' => 'INV-2026-XYZ']))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertCount(1, $searchProps['reviews']);
        $this->assertSame('BK-CARIME', $searchProps['reviews'][0]['booking_code']);
    }

    public function test_public_review_redirect_spoofing_cancelled_tokens_and_rate_limiter(): void
    {
        Queue::fake();

        $lowReview = BusinessReview::create([
            'business_id' => $this->business->id,
            'reviewer_name' => 'Low Rating',
            'rating' => 2,
            'comment' => 'Kurang nyaman',
            'redirected_to_google' => false,
        ]);

        // Unowned high rating review in DB (never submitted by this session)
        $otherSessionHighReview = BusinessReview::create([
            'business_id' => $this->business->id,
            'reviewer_name' => 'Other User',
            'rating' => 5,
            'comment' => 'Bagus banget',
            'redirected_to_google' => false,
        ]);

        // Spoofed/unauthorized redirect marks must return 403
        $this->postJson(route('public.review.redirect', [
            'slug' => $this->business->slug,
            'review' => $lowReview->id,
        ]))->assertForbidden();

        $this->postJson(route('public.review.redirect', [
            'slug' => $this->business->slug,
            'review' => $otherSessionHighReview->id,
        ]))->assertForbidden();
        $this->assertFalse($otherSessionHighReview->fresh()->redirected_to_google);

        // Cancelled & no_show booking tokens are rejected
        foreach (['cancelled', 'no_show'] as $status) {
            $badBooking = $this->createBooking(['reservation_status' => $status]);
            $this->post(route('public.review.store', $this->business->slug), [
                'rating' => 5,
                'token' => $badBooking->invoice_token,
            ])->assertSessionHasErrors('token');
        }

        // throttle:public-review rejects > 10 submissions per minute from the same IP with 429
        $clientEnv = ['REMOTE_ADDR' => '198.51.100.77'];
        for ($i = 0; $i < 10; $i++) {
            $this->withServerVariables($clientEnv)
                ->post(route('public.review.store', $this->business->slug), [
                    'rating' => 5,
                    'comment' => "Mantap #{$i}",
                ])
                ->assertRedirect();
        }

        $this->withServerVariables($clientEnv)
            ->post(route('public.review.store', $this->business->slug), [
                'rating' => 5,
                'comment' => 'Melebihi batas',
            ])
            ->assertTooManyRequests();
    }
}
