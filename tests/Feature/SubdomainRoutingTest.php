<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Service;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\SubscriptionActivationService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SubdomainRoutingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private string $tenantDomain;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SubscriptionPlanSeeder::class);

        $this->tenantDomain = (string) config('app.tenant_domain', 'localhost');

        $this->owner = User::create([
            'name' => 'Owner Subdomain',
            'email' => 'subdomain-owner@janjiyan.test',
            'password' => 'password123',
            'email_verified_at' => now(),
        ]);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Rapi Studio',
            'slug' => 'rapi-studio',
            'category' => 'Barbershop',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
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

        Service::create([
            'business_id' => $this->business->id,
            'name' => 'Haircut',
            'price' => 50000,
            'duration_minutes' => 30,
            'buffer_minutes' => 0,
            'capacity' => 1,
            'assignment_mode' => 'capacity',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
    }

    public function test_active_business_is_accessible_on_tenant_subdomain(): void
    {
        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BusinessHome')
                ->where('business.slug', 'rapi-studio'));

        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/pesan")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BookingPortal')
                ->where('business.slug', 'rapi-studio'));

        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/invoices")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/InvoiceLookup')
                ->where('business.slug', 'rapi-studio'));
    }

    public function test_unknown_inactive_and_suspended_subdomains_behave_correctly(): void
    {
        $this->get("http://toko-tidak-terdaftar.{$this->tenantDomain}/")
            ->assertNotFound();

        $this->business->update(['suspended_at' => now(), 'suspension_reason' => 'Pelanggaran TOS']);
        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/")
            ->assertStatus(403)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BusinessUnavailable')
                ->where('businessName', 'Rapi Studio'));

        $this->business->update(['suspended_at' => null, 'suspension_reason' => null, 'is_active' => false]);
        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/")
            ->assertNotFound();
    }

    public function test_reserved_subdomains_do_not_resolve_to_public_booking_controller(): void
    {
        foreach (['admin', 'www', 'app', 'api', 'dashboard', 'support', 'webhooks'] as $reserved) {
            $this->get("http://{$reserved}.{$this->tenantDomain}/")
                ->assertNotFound();
            $this->get("http://{$reserved}.{$this->tenantDomain}/pesan")
                ->assertNotFound();
        }
    }

    public function test_removed_legacy_b_slug_routes_return_404_on_root_domain(): void
    {
        $this->get("http://{$this->tenantDomain}/b/{$this->business->slug}")
            ->assertNotFound();
        $this->get("http://{$this->tenantDomain}/b/{$this->business->slug}/pesan")
            ->assertNotFound();
        $this->get("http://{$this->tenantDomain}/b/{$this->business->slug}/review")
            ->assertNotFound();
        $this->post("http://{$this->tenantDomain}/b/{$this->business->slug}/book", [])
            ->assertNotFound();
    }

    public function test_root_domain_routes_are_not_exposed_on_tenant_subdomains(): void
    {
        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/login")
            ->assertNotFound();
        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/dashboard")
            ->assertNotFound();
        $this->get("http://{$this->business->slug}.{$this->tenantDomain}/admin")
            ->assertNotFound();
    }

    public function test_settings_controller_enforces_rfc_1123_dns_slug_and_reserved_subdomains(): void
    {
        $basePayload = [
            'name' => 'Rapi Studio',
            'category' => 'Barbershop',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
        ];

        $invalidSlugs = [
            'my_studio',
            'ab',
            '-leading-hyphen',
            'trailing-hyphen-',
            str_repeat('a', 64),
            'admin',
            'www',
            'support',
            'dashboard',
        ];

        foreach ($invalidSlugs as $invalidSlug) {
            $this->actingAs($this->owner)
                ->from(route('dashboard.settings'))
                ->post(route('dashboard.settings.update'), [
                    ...$basePayload,
                    'slug' => $invalidSlug,
                ])
                ->assertSessionHasErrors('slug');
        }

        // Valid RFC 1123 slug (with uppercase & whitespace normalization) succeeds
        $this->actingAs($this->owner)
            ->post(route('dashboard.settings.update'), [
                ...$basePayload,
                'slug' => '  Rapi-Studio-2026  ',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('rapi-studio-2026', $this->business->fresh()->slug);
    }

    public function test_generate_unique_slug_avoids_reserved_words_short_names_and_collisions(): void
    {
        $this->assertSame('admin-1', Business::generateUniqueSlug('Admin'));
        $this->assertSame('support-1', Business::generateUniqueSlug('Support'));
        $this->assertSame('ab-bisnis', Business::generateUniqueSlug('AB'));
        $this->assertSame('rapi-studio-1', Business::generateUniqueSlug('Rapi Studio'));
    }

    public function test_onboarding_and_create_business_never_assign_reserved_subdomain_slugs(): void
    {
        $newMerchant = User::create([
            'name' => 'Merchant Baru',
            'email' => 'new-merchant@janjiyan.test',
            'password' => 'password123',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($newMerchant)
            ->post(route('onboarding.business.store'), [
                'name' => 'Admin',
                'business_type' => Business::TYPE_STAFF_APPOINTMENT,
                'category' => 'Konsultan',
            ])
            ->assertRedirect(route('dashboard'));

        $onboardedBusiness = $newMerchant->fresh()->resolveActiveBusiness();
        $this->assertNotNull($onboardedBusiness);
        $this->assertSame('admin-1', $onboardedBusiness->slug);

        // Upgrade owner to professional plan so they can create another business named "Support"
        $proPlan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();
        app(SubscriptionActivationService::class)->activatePlan($this->owner, $proPlan, 'monthly');

        $this->actingAs($this->owner)
            ->post(route('dashboard.businesses.store'), [
                'name' => 'Support',
                'business_type' => Business::TYPE_DROPOFF,
                'category' => 'Laundry',
            ])
            ->assertRedirect(route('dashboard'));

        $createdBusiness = Business::where('owner_id', $this->owner->id)
            ->where('name', 'Support')
            ->firstOrFail();
        $this->assertSame('support-1', $createdBusiness->slug);
    }

    public function test_business_public_url_helpers_inertia_shared_props_sitemap_and_storage_url(): void
    {
        $this->assertStringContainsString("rapi-studio.{$this->tenantDomain}", $this->business->publicUrl());
        $this->assertStringEndsWith('/review?token=abc123', $this->business->publicReviewUrl('abc123'));
        $this->assertSame('/storage/logos/test.png', Storage::url('logos/test.png'));

        $this->actingAs($this->owner)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tenantBaseDomain', $this->tenantDomain)
                ->where('activeBusiness.public_url', $this->business->publicUrl())
                ->where('activeBusiness.public_review_url', $this->business->publicReviewUrl()));

        Cache::forget('sitemap.xml');
        $sitemap = $this->get(route('sitemap'))->assertOk();
        $sitemap->assertSee("http://rapi-studio.{$this->tenantDomain}");
        $sitemap->assertDontSee('/b/rapi-studio');
    }
}
