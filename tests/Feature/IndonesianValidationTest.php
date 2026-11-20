<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\User;
use App\Services\PlanLimitService;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IndonesianValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_validation_errors_are_in_indonesian(): void
    {
        $this->seed(SubscriptionPlanSeeder::class);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        app(PlanLimitService::class)->ensureTrialSubscription($owner);
        $business = Business::create([
            'owner_id' => $owner->id,
            'name' => 'Rapi Studio',
            'slug' => 'rapi-studio-id',
            'category' => 'Barbershop',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $business->users()->attach($owner->id, ['role' => 'owner', 'permissions' => json_encode(['*'])]);
        $owner->update(['active_business_id' => $business->id]);

        $this->actingAs($owner)
            ->post(route('dashboard.settings.update'), ['name' => ''])
            ->assertSessionHasErrors(['name' => 'Nama wajib diisi.']);
    }
}
