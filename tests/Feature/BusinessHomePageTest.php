<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Service;
use App\Models\User;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BusinessHomePageTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Hub',
            'email' => 'hub@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Cuci Sepatu Hub',
            'slug' => 'cuci-hub',
            'category' => 'Laundry Sepatu',
            'business_type' => Business::TYPE_DROPOFF,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->business->users()->attach($this->owner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $this->owner->update(['active_business_id' => $this->business->id]);

        foreach ([['Cuci Biasa', 30000], ['Deep Clean', 55000]] as [$name, $price]) {
            Service::create([
                'business_id' => $this->business->id,
                'name' => $name,
                'price' => $price,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 5,
                'assignment_mode' => 'capacity',
                'booking_mode' => 'dropoff',
                'unit_label' => 'pasang',
                'turnaround_days' => 2,
                'dp_type' => 'none',
                'dp_value' => 0,
                'is_active' => true,
                'image_path' => $name === 'Deep Clean' ? 'services/deep.jpg' : null,
            ]);
        }
    }

    private function settingsPayload(array $extra = []): array
    {
        return array_merge([
            'name' => $this->business->name,
            'slug' => $this->business->slug,
            'category' => $this->business->category,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
        ], $extra);
    }

    public function test_hub_and_booking_form_render_separate_pages(): void
    {
        $this->get('/b/cuci-hub')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BusinessHome')
                ->where('business.business_type', Business::TYPE_DROPOFF)
                ->has('services', 2)
                ->where('services.0.price', 30000)
                ->where('services.0.unit_label', 'pasang')
                // No cover and no gallery: falls back to the first service photo.
                ->where('business.cover_url', Storage::url('services/deep.jpg')));

        $this->get('/b/cuci-hub/pesan')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/BookingPortal')
                ->where('business.business_type', Business::TYPE_DROPOFF)
                ->has('services', 2)
                ->where('selectedServiceId', null));
    }

    public function test_booking_form_preselects_service_from_hub_link(): void
    {
        $deep = $this->business->services()->where('name', 'Deep Clean')->first();
        $other = Service::create([
            'business_id' => Business::create([
                'owner_id' => $this->owner->id, 'name' => 'Lain', 'slug' => 'lain', 'category' => 'X',
                'business_type' => Business::TYPE_SPACE_BOOKING,
                'timezone' => 'Asia/Jakarta', 'dp_expiry_minutes' => 120, 'is_active' => true,
            ])->id,
            'name' => 'Bukan milik toko ini', 'price' => 1000, 'duration_minutes' => 30, 'buffer_minutes' => 0,
            'capacity' => 1, 'assignment_mode' => 'capacity', 'dp_type' => 'none', 'dp_value' => 0, 'is_active' => true,
        ]);

        $this->get("/b/cuci-hub/pesan?layanan={$deep->id}")
            ->assertInertia(fn (Assert $page) => $page->where('selectedServiceId', $deep->id));

        $this->get("/b/cuci-hub/pesan?layanan={$other->id}")
            ->assertInertia(fn (Assert $page) => $page->where('selectedServiceId', null));
    }

    public function test_gallery_photo_used_as_cover_is_not_repeated_in_strip(): void
    {
        $this->business->galleries()->create(['image_path' => 'gallery/a.jpg']);
        $this->business->galleries()->create(['image_path' => 'gallery/b.jpg']);

        $this->get('/b/cuci-hub')->assertInertia(fn (Assert $page) => $page
            ->where('business.cover_url', Storage::url('gallery/a.jpg'))
            ->has('galleries', 1)
            ->where('galleries.0.image_url', Storage::url('gallery/b.jpg')));
    }

    public function test_dedicated_cover_wins_over_fallbacks(): void
    {
        $this->business->update(['cover_path' => 'covers/own.jpg']);

        $this->get('/b/cuci-hub')->assertInertia(fn (Assert $page) => $page
            ->where('business.cover_url', Storage::url('covers/own.jpg')));
    }

    public function test_suspended_business_blocks_hub_and_booking_form(): void
    {
        $this->business->update(['suspended_at' => now(), 'suspension_reason' => 'Spam']);

        foreach (['/b/cuci-hub', '/b/cuci-hub/pesan'] as $url) {
            $this->get($url)
                ->assertStatus(403)
                ->assertInertia(fn (Assert $page) => $page->component('Public/BusinessUnavailable'));
        }
    }

    public function test_settings_saves_brand_color_and_rejects_invalid_hex(): void
    {
        $this->actingAs($this->owner)
            ->post(route('dashboard.settings.update'), $this->settingsPayload(['brand_color' => '#16423C']))
            ->assertSessionHasNoErrors();
        $this->assertSame('#16423c', $this->business->fresh()->brand_color);

        $this->actingAs($this->owner)
            ->post(route('dashboard.settings.update'), $this->settingsPayload(['brand_color' => 'red']))
            ->assertSessionHasErrors('brand_color');
        $this->assertSame('#16423c', $this->business->fresh()->brand_color);

        // Omitting the field keeps the saved color.
        $this->actingAs($this->owner)->post(route('dashboard.settings.update'), $this->settingsPayload());
        $this->assertSame('#16423c', $this->business->fresh()->brand_color);

        $this->actingAs($this->owner)->post(route('dashboard.settings.update'), $this->settingsPayload(['brand_color' => null]));
        $this->assertNull($this->business->fresh()->brand_color);
    }

    public function test_settings_uploads_and_removes_cover(): void
    {
        Storage::fake('public');

        $this->actingAs($this->owner)->post(route('dashboard.settings.update'), $this->settingsPayload([
            'cover_image' => UploadedFile::fake()->image('cover.jpg', 1200, 600),
        ]))->assertSessionHasNoErrors();

        $path = $this->business->fresh()->cover_path;
        $this->assertNotNull($path);
        Storage::disk('public')->assertExists($path);

        $this->actingAs($this->owner)->post(route('dashboard.settings.update'), $this->settingsPayload(['remove_cover' => true]));

        $this->assertNull($this->business->fresh()->cover_path);
        Storage::disk('public')->assertMissing($path);
    }
}
