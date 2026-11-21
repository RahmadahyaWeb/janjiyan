<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Service;
use App\Models\Staff;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Notifications\SubscriptionActivatedNotification;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Phase4MonetizationAndAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private Service $service;

    private Staff $staff;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Phase4',
            'email' => 'owner4@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Studio Phase 4',
            'slug' => 'studio-phase-4',
            'category' => 'Barbershop & Grooming',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
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

        $this->staff = Staff::create([
            'business_id' => $this->business->id,
            'name' => 'Barber Satu',
            'is_active' => true,
        ]);

        $this->service = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Potong Rambut',
            'price' => 75000,
            'duration_minutes' => 45,
            'buffer_minutes' => 15,
            'capacity' => 1,
            'assignment_mode' => 'staff',
            'dp_type' => 'fixed',
            'dp_value' => 25000,
            'is_active' => true,
        ]);
        $this->service->staff()->attach($this->staff->id);
    }

    public function test_expired_subscription_enforces_soft_lock_on_writes_and_public_booking(): void
    {
        $subscription = $this->owner->subscription()->firstOrFail();
        $subscription->update([
            'status' => 'trialing',
            'trial_ends_at' => now()->subDay(),
            'current_period_ends_at' => now()->subDay(),
        ]);

        // Read-only dashboard & billing pages remain accessible
        $this->actingAs($this->owner)->get(route('dashboard'))->assertOk();
        $this->actingAs($this->owner)->get(route('dashboard.billing'))->assertOk();

        // Dashboard write actions are blocked
        $this->actingAs($this->owner)
            ->post(route('dashboard.services.store'), [
                'name' => 'Creambath',
                'price' => 100000,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 1,
                'assignment_mode' => 'capacity',
                'dp_type' => 'none',
                'dp_value' => 0,
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame(1, $this->business->services()->count());

        // Public booking store is blocked
        $targetDate = now('Asia/Jakarta')->addDays(2)->toDateString();
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $targetDate,
            'time' => '10:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Pelanggan Trial Habis',
            'customer_phone' => '081233334444',
        ])->assertSessionHas('error');

        $this->assertSame(0, $this->business->bookings()->count());
    }

    public function test_mayar_checkout_and_double_verified_webhook_activates_subscription_idempotently(): void
    {
        Notification::fake();

        config()->set('services.mayar.api_key', 'test-mayar-key');
        config()->set('services.mayar.base_url', 'https://api.mayar.io/hl/v2');
        config()->set('services.mayar.webhook_token', 'secret-webhook-token');

        Http::fake([
            'https://api.mayar.io/hl/v2/invoice/create' => Http::response([
                'statusCode' => 200,
                'messages' => 'success',
                'data' => [
                    'id' => 'mayar-inv-uuid-123',
                    'transactionId' => 'mayar-trx-uuid-456',
                    'link' => 'https://janjiyan.mayar.io/invoices/abc123',
                ],
            ], 200),
            'https://api.mayar.io/hl/v2/invoices/mayar-inv-uuid-123' => Http::sequence()
                ->push([
                    'statusCode' => 200,
                    'data' => [
                        'id' => 'mayar-inv-uuid-123',
                        'status' => 'unpaid',
                        'amount' => 2490000,
                    ],
                ], 200)
                ->push([
                    'statusCode' => 200,
                    'data' => [
                        'id' => 'mayar-inv-uuid-123',
                        'status' => 'paid',
                        'amount' => 2490000,
                    ],
                ], 200),
        ]);

        $response = $this->actingAs($this->owner)
            ->post(route('dashboard.billing.checkout'), [
                'plan_slug' => 'enterprise',
                'billing_cycle' => 'yearly',
            ]);

        $response->assertRedirect('https://janjiyan.mayar.io/invoices/abc123');

        $invoice = SubscriptionInvoice::where('user_id', $this->owner->id)->firstOrFail();
        $this->assertSame('pending', $invoice->status);
        $this->assertSame(2490000, $invoice->amount);
        $this->assertSame('mayar-inv-uuid-123', $invoice->mayar_invoice_id);

        // Unauthorized webhook token must fail closed
        $this->postJson(route('webhooks.mayar', ['token' => 'wrong-token']), [
            'event' => 'payment.received',
            'data' => ['id' => 'mayar-inv-uuid-123'],
        ])->assertStatus(401);

        // Remote verification mismatch (first HTTP mock returns unpaid) -> 422
        $this->postJson(route('webhooks.mayar', ['token' => 'secret-webhook-token']), [
            'event' => 'payment.received',
            'data' => ['id' => 'mayar-inv-uuid-123'],
        ])->assertStatus(422);

        $invoice->refresh();
        $this->assertSame('pending', $invoice->status);

        // Remote verification succeeds (second HTTP mock returns paid) -> activates plan & notifies once
        $this->postJson(route('webhooks.mayar', ['token' => 'secret-webhook-token']), [
            'event' => 'payment.received',
            'data' => [
                'id' => 'mayar-inv-uuid-123',
                'extraData' => ['idProd' => $invoice->invoice_number],
            ],
        ])->assertOk();

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertNotNull($invoice->paid_at);

        $subscription = $this->owner->subscription()->with('plan')->firstOrFail();
        $this->assertSame('active', $subscription->status);
        $this->assertSame('enterprise', $subscription->plan->slug);
        $this->assertTrue($subscription->current_period_ends_at->greaterThan(now()->addMonths(11)));

        Notification::assertSentToTimes($this->owner, SubscriptionActivatedNotification::class, 1);

        // Replay webhook must be idempotent
        $this->postJson(route('webhooks.mayar', ['token' => 'secret-webhook-token']), [
            'event' => 'payment.received',
            'data' => ['id' => 'mayar-inv-uuid-123'],
        ])->assertOk();

        Notification::assertSentToTimes($this->owner, SubscriptionActivatedNotification::class, 1);
    }

    public function test_superadmin_panel_and_business_suspension_flow(): void
    {
        // Regular user cannot access /admin
        $this->actingAs($this->owner)->get(route('admin.index'))->assertForbidden();

        // Create dedicated superadmin directly via CLI without creating any business or trial subscription
        $this->artisan('janjiyan:make-superadmin', [
            'email' => 'admin@janjiyan.test',
            '--name' => 'Superadmin Janjiyan',
            '--password' => 'password123',
        ])->assertExitCode(0);

        $admin = User::where('email', 'admin@janjiyan.test')->firstOrFail();
        $this->assertTrue($admin->is_superadmin);
        $this->assertNotNull($admin->email_verified_at);
        $this->assertSame(0, $admin->businesses()->count());
        $this->assertNull($admin->subscription);

        // Superadmin cannot access merchant /dashboard and is redirected to /admin
        $this->actingAs($admin)
            ->get(route('dashboard'))
            ->assertRedirect(route('admin.index'));

        $this->actingAs($admin)
            ->get(route('admin.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Index'));

        // Extend trial
        $this->actingAs($admin)
            ->post(route('admin.users.extend-trial', $this->owner->id), ['days' => 10])
            ->assertRedirect();

        $sub = $this->owner->subscription()->firstOrFail();
        $this->assertTrue($sub->trial_ends_at->greaterThan(now()->addDays(20)));

        // Manual plan activation
        $proPlan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();
        $this->actingAs($admin)
            ->post(route('admin.users.activate-plan', $this->owner->id), [
                'plan_slug' => $proPlan->slug,
                'billing_cycle' => 'monthly',
                'notes' => 'Transfer BCA terkonfirmasi',
            ])
            ->assertRedirect();

        $sub->refresh();
        $this->assertSame('active', $sub->status);
        $this->assertDatabaseHas('subscription_invoices', [
            'user_id' => $this->owner->id,
            'provider' => 'manual',
            'status' => 'paid',
            'notes' => 'Transfer BCA terkonfirmasi',
        ]);

        // Suspend business blocks public portal and dashboard writes
        $this->actingAs($admin)
            ->post(route('admin.businesses.suspend', $this->business->id), [
                'reason' => 'Spam booking terdeteksi',
            ])
            ->assertRedirect();

        $this->get(route('public.booking', $this->business->slug))
            ->assertStatus(403)
            ->assertInertia(fn (Assert $page) => $page->component('Public/BusinessUnavailable'));

        $this->actingAs($this->owner)
            ->post(route('dashboard.services.store'), [
                'name' => 'Blocked Service',
                'price' => 50000,
                'duration_minutes' => 30,
                'buffer_minutes' => 0,
                'capacity' => 1,
                'assignment_mode' => 'capacity',
                'dp_type' => 'none',
                'dp_value' => 0,
            ])
            ->assertSessionHas('error');

        // Unsuspend restores access
        $this->actingAs($admin)
            ->post(route('admin.businesses.unsuspend', $this->business->id))
            ->assertRedirect();

        $this->get(route('public.booking', $this->business->slug))->assertOk();
    }

    public function test_customer_booking_generates_hashed_invoice_url_and_supports_history_lookup(): void
    {
        Storage::fake('local');

        $targetCarbon = now('Asia/Jakarta')->addDays(3);
        if ($targetCarbon->isSunday()) {
            $targetCarbon = $targetCarbon->addDay();
        }
        $targetDate = $targetCarbon->toDateString();

        $response = $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->service->id,
            'date' => $targetDate,
            'time' => '11:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Rina Wijaya',
            'customer_phone' => '081288887777',
        ]);

        $booking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();
        $this->assertNotEmpty($booking->invoice_number);
        $this->assertStringStartsWith('INV-', $booking->invoice_number);
        $this->assertSame(32, strlen($booking->invoice_token));

        $invoiceUrl = route('public.booking.invoice', [
            'slug' => $this->business->slug,
            'token' => $booking->invoice_token,
        ]);
        $response->assertRedirect($invoiceUrl);

        // Hashed invoice URL renders BookingStatus with invoice_number
        $this->get($invoiceUrl)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BookingStatus')
                ->where('booking.invoice_number', $booking->invoice_number)
                ->where('booking.invoice_token', $booking->invoice_token)
            );

        // Legacy booking_code URL redirects to hashed invoice URL
        $this->get(route('public.booking.status', ['slug' => $this->business->slug, 'code' => $booking->booking_code]))
            ->assertRedirect($invoiceUrl);

        // Customer can upload DP proof via hashed invoice URL
        $this->post(route('public.booking.invoice.proof', ['slug' => $this->business->slug, 'token' => $booking->invoice_token]), [
            'dp_proof' => UploadedFile::fake()->image('dp.jpg'),
        ])->assertRedirect();

        $booking->refresh();
        $this->assertSame('waiting_verification', $booking->payment_status);

        // Wrong last 4 phone digits must fail lookup
        $this->post(route('public.booking.invoices.lookup', $this->business->slug), [
            'invoice_number' => $booking->invoice_number,
            'phone_last4' => '0000',
        ])->assertSessionHasErrors('invoice_number');

        // Valid invoice number + last 4 digits returns customer history
        $this->post(route('public.booking.invoices.lookup', $this->business->slug), [
            'invoice_number' => $booking->invoice_number,
            'phone_last4' => '7777',
        ])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/InvoiceLookup')
                ->where('matchedInvoiceToken', $booking->invoice_token)
                ->has('history', 1)
                ->where('history.0.invoice_number', $booking->invoice_number)
            );
    }
}
