<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\User;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Phase3Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);
    }

    public function test_favicon_and_og_image_assets_exist_and_are_non_empty(): void
    {
        foreach ([
            'favicon.ico',
            'favicon.svg',
            'favicon-16x16.png',
            'favicon-32x32.png',
            'apple-touch-icon.png',
            'og-default.png',
        ] as $asset) {
            $path = public_path($asset);
            $this->assertFileExists($path);
            $this->assertGreaterThan(0, filesize($path), "{$asset} must not be empty");
        }
    }

    public function test_landing_and_public_booking_render_server_side_seo_and_favicon_tags(): void
    {
        $landing = $this->get(route('home'))->assertOk();
        $landing->assertSee('/favicon.svg', false);
        $landing->assertSee('og:title', false);
        $landing->assertSee('og:description', false);
        $landing->assertSee('og-default.png', false);

        $owner = User::create([
            'name' => 'Owner SEO',
            'email' => 'seo@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($owner);

        $business = Business::create([
            'owner_id' => $owner->id,
            'name' => 'Studio Kencana',
            'slug' => 'studio-kencana',
            'category' => 'Studio Foto',
            'business_type' => Business::TYPE_SPACE_BOOKING,
            'description' => 'Foto potret dan keluarga berkualitas tinggi.',
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);

        $portal = $this->get(route('public.booking', $business->slug))->assertOk();
        $portal->assertSee('Studio Kencana — Booking Online | Janjiyan', false);
        $portal->assertSee('Foto potret dan keluarga berkualitas tinggi.', false);
    }

    public function test_legal_pages_and_custom_error_pages_render_correctly(): void
    {
        $this->get(route('legal.terms'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Legal/Terms'));

        $this->get(route('legal.privacy'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Legal/Privacy'));

        $notFound = $this->get('/b/bisnis-yang-tidak-ada');
        $notFound->assertNotFound();
        $notFound->assertSee('Halaman tidak ditemukan', false);
        $notFound->assertSee('Kembali ke Beranda', false);
    }
}
