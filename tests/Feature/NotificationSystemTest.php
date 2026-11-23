<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Service;
use App\Models\Staff;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Notifications\MerchantInAppNotification;
use App\Services\PlanLimitService;
use App\Services\SubscriptionActivationService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class NotificationSystemTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $bookingStaff;

    private User $limitedStaff;

    private Business $business;

    private Business $otherBusiness;

    private Staff $staffRecord;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::factory()->create(['email_verified_at' => now()]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Salon Utama',
            'slug' => 'salon-utama-notif',
            'category' => 'Salon & Kecantikan',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'review_enabled' => true,
            'review_redirect_min_rating' => 4,
            'is_active' => true,
        ]);
        $this->business->seedDefaultOperatingHours();

        $this->otherBusiness = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Cabang Kedua',
            'slug' => 'cabang-kedua-notif',
            'category' => 'Salon & Kecantikan',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->otherBusiness->seedDefaultOperatingHours();

        $this->bookingStaff = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $this->business->id,
        ]);

        // Staff who only has manage_services (no booking/payment/review permissions)
        $this->limitedStaff = User::factory()->create([
            'email_verified_at' => now(),
            'active_business_id' => $this->business->id,
        ]);

        $this->business->users()->attach([
            $this->owner->id => ['role' => 'owner', 'permissions' => json_encode(['*'])],
            $this->bookingStaff->id => ['role' => 'staff', 'permissions' => json_encode(['manage_bookings', 'verify_payments'])],
            $this->limitedStaff->id => ['role' => 'staff', 'permissions' => json_encode(['manage_services'])],
        ]);
        $this->otherBusiness->users()->attach([
            $this->owner->id => ['role' => 'owner', 'permissions' => json_encode(['*'])],
        ]);
        $this->owner->update(['active_business_id' => $this->business->id]);

        $this->staffRecord = Staff::create([
            'business_id' => $this->business->id,
            'name' => 'Stylist Andi',
            'title' => 'Senior Stylist',
            'is_active' => true,
        ]);

        $this->service = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Hair Spa',
            'price' => 120000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'fixed',
            'dp_value' => 30000,
            'is_active' => true,
        ]);
        $this->service->staff()->attach($this->staffRecord->id);
    }

    public function test_public_booking_and_dp_upload_create_in_app_notifications_for_permitted_recipients(): void
    {
        Storage::fake('local');

        $targetCarbon = now('Asia/Jakarta')->addDays(2);
        if ($targetCarbon->isSunday()) {
            $targetCarbon = $targetCarbon->addDay();
        }

        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'staff_id' => $this->staffRecord->id,
            'date' => $targetCarbon->toDateString(),
            'time' => '10:00',
            'customer_name' => 'Rina Kusuma',
            'customer_phone' => '081234567890',
            'customer_email' => 'rina@example.com',
        ])->assertRedirect();

        $booking = Booking::firstOrFail();

        $this->assertSame(1, $this->owner->notifications()->count());
        $this->assertSame(1, $this->bookingStaff->notifications()->count());
        $this->assertSame(0, $this->limitedStaff->notifications()->count());

        $bookingNotif = $this->owner->notifications()->firstOrFail();
        $this->assertSame(MerchantInAppNotification::CATEGORY_BOOKING_NEW, $bookingNotif->data['category']);
        $this->assertSame($this->business->id, $bookingNotif->data['business_id']);
        $this->assertStringContainsString($booking->booking_code, $bookingNotif->data['title']);

        $this->post(route('public.booking.invoice.proof', [
            'slug' => $this->business->slug,
            'token' => $booking->invoice_token,
        ]), [
            'dp_proof' => UploadedFile::fake()->image('bukti.jpg', 400, 400),
        ])->assertRedirect();

        $this->assertSame(2, $this->owner->notifications()->count());
        $this->assertSame(2, $this->bookingStaff->notifications()->count());
        $this->assertSame(0, $this->limitedStaff->notifications()->count());

        $dpNotif = $this->owner->notifications()->latest()->get()->firstWhere('data.category', MerchantInAppNotification::CATEGORY_DP_UPLOADED);
        $this->assertNotNull($dpNotif);
        $this->assertStringContainsString($booking->booking_code, $dpNotif->data['title']);
    }

    public function test_public_reviews_create_in_app_notifications_for_low_and_high_ratings(): void
    {
        $proPlan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();
        app(SubscriptionActivationService::class)->activatePlan($this->owner, $proPlan, 'monthly');

        $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 5,
            'comment' => 'Sangat rapi dan memuaskan!',
            'reviewer_name' => 'Dina',
        ])->assertRedirect();

        $this->post(route('public.review.store', $this->business->slug), [
            'rating' => 2,
            'comment' => 'Menunggu agak lama.',
            'reviewer_name' => 'Bima',
        ])->assertRedirect();

        $reviewNotifs = $this->owner->notifications()
            ->get()
            ->filter(fn (DatabaseNotification $n) => ($n->data['category'] ?? null) === MerchantInAppNotification::CATEGORY_REVIEW_NEW);

        $this->assertCount(2, $reviewNotifs);
        $this->assertSame(2, $this->bookingStaff->notifications()->count());
        $this->assertSame(0, $this->limitedStaff->notifications()->count());
    }

    public function test_subscription_activation_and_trial_extension_create_billing_notifications(): void
    {
        Mail::fake();

        $plan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();
        $activationService = app(SubscriptionActivationService::class);
        $subscription = app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $invoice = SubscriptionInvoice::create([
            'user_id' => $this->owner->id,
            'subscription_id' => $subscription->id,
            'subscription_plan_id' => $plan->id,
            'invoice_number' => $activationService->generateInvoiceNumber(),
            'billing_cycle' => 'monthly',
            'amount' => $plan->price_monthly,
            'status' => 'pending',
            'provider' => 'mayar',
            'expires_at' => now()->addHours(24),
        ]);

        $activationService->fulfillPaidInvoice($invoice, ['status' => 'paid']);

        $billingNotif = $this->owner->notifications()->firstOrFail();
        $this->assertSame(MerchantInAppNotification::CATEGORY_BILLING_ACTIVATED, $billingNotif->data['category']);
        $this->assertNull($billingNotif->data['business_id']);

        $superadmin = User::factory()->create([
            'email_verified_at' => now(),
            'is_superadmin' => true,
        ]);

        $this->actingAs($superadmin)
            ->post(route('admin.users.extend-trial', $this->owner->id), ['days' => 7])
            ->assertRedirect(route('admin.index'));

        $this->assertSame(2, $this->owner->notifications()->count());
        $trialNotif = $this->owner->notifications()
            ->get()
            ->firstWhere('data.category', MerchantInAppNotification::CATEGORY_TRIAL_EXTENDED);
        $this->assertNotNull($trialNotif);
    }

    public function test_notification_endpoints_scope_by_active_business_and_enforce_ownership(): void
    {
        // 1 notification for active business, 1 for other business, 1 account-level billing notification
        $this->owner->notify(new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_BOOKING_NEW,
            businessId: $this->business->id,
            businessName: $this->business->name,
            title: 'Booking Aktif',
            message: 'Untuk bisnis aktif',
            actionUrl: '/dashboard/bookings',
        ));
        $this->owner->notify(new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_BOOKING_NEW,
            businessId: $this->otherBusiness->id,
            businessName: $this->otherBusiness->name,
            title: 'Booking Cabang Lain',
            message: 'Untuk cabang kedua',
            actionUrl: '/dashboard/bookings',
        ));
        $this->owner->notify(new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_BILLING_ACTIVATED,
            businessId: null,
            businessName: null,
            title: 'Paket Aktif',
            message: 'Account level billing',
            actionUrl: '/dashboard/billing',
        ));

        $listResponse = $this->actingAs($this->owner)
            ->getJson(route('dashboard.notifications.index'))
            ->assertOk();

        $listResponse->assertJsonPath('unread_count', 2);
        $titles = collect($listResponse->json('items'))->pluck('title')->all();
        $this->assertContains('Booking Aktif', $titles);
        $this->assertContains('Paket Aktif', $titles);
        $this->assertNotContains('Booking Cabang Lain', $titles);

        // Shared Inertia props include unreadNotificationsCount and flash channels
        $pageProps = $this->actingAs($this->owner)
            ->get(route('dashboard'))
            ->assertOk()
            ->viewData('page')['props'];
        $this->assertSame(2, $pageProps['unreadNotificationsCount']);
        $this->assertArrayHasKey('warning', $pageProps['flash']);
        $this->assertArrayHasKey('info', $pageProps['flash']);

        // Other user cannot mark owner's notification as read
        $activeNotifId = $listResponse->json('items.0.id');
        $this->actingAs($this->bookingStaff)
            ->postJson(route('dashboard.notifications.read', $activeNotifId))
            ->assertForbidden();

        // Owner marks single notification as read
        $this->actingAs($this->owner)
            ->postJson(route('dashboard.notifications.read', $activeNotifId))
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        // Owner marks all remaining for active business as read; other business remains unread
        $this->actingAs($this->owner)
            ->postJson(route('dashboard.notifications.read-all'))
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $otherBusinessNotif = $this->owner->unreadNotifications()
            ->get()
            ->firstWhere('data.business_id', $this->otherBusiness->id);
        $this->assertNotNull($otherBusinessNotif);
    }
}
