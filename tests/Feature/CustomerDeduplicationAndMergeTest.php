<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\User;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Database\Seeders\SubscriptionPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerDeduplicationAndMergeTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $otherOwner;

    private Business $business;

    private Business $dropoffBusiness;

    private Business $otherBusiness;

    private Service $slotService;

    private Service $dropoffService;

    private Staff $staff;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SubscriptionPlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner CRM',
            'email' => 'owner-crm@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->owner);

        $this->business = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Barbershop Raka',
            'slug' => 'barbershop-raka',
            'category' => 'Barbershop',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'phone' => '081234567890',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'min_booking_lead_minutes' => 15,
            'max_booking_advance_days' => 30,
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
            'name' => 'Raka Barber',
            'title' => 'Master Barber',
            'is_active' => true,
        ]);

        $this->slotService = Service::create([
            'business_id' => $this->business->id,
            'name' => 'Gentleman Haircut',
            'booking_mode' => 'time_slot',
            'price' => 75000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 2,
            'assignment_mode' => 'staff',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);
        $this->slotService->staff()->attach([$this->staff->id]);

        $this->dropoffBusiness = Business::create([
            'owner_id' => $this->owner->id,
            'name' => 'Shoe Care Raka',
            'slug' => 'shoe-care-raka',
            'category' => 'Cuci Sepatu & Care',
            'business_type' => Business::TYPE_DROPOFF,
            'phone' => '081234567890',
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $this->dropoffBusiness->users()->attach($this->owner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->dropoffBusiness->seedDefaultOperatingHours();

        $this->dropoffService = Service::create([
            'business_id' => $this->dropoffBusiness->id,
            'name' => 'Deep Clean Sneakers',
            'booking_mode' => 'dropoff',
            'unit_label' => 'pasang',
            'price' => 65000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 10,
            'turnaround_days' => 2,
            'supports_pickup' => false,
            'assignment_mode' => 'capacity',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        $this->otherOwner = User::create([
            'name' => 'Other Owner CRM',
            'email' => 'other-crm@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        app(PlanLimitService::class)->ensureTrialSubscription($this->otherOwner);

        $this->otherBusiness = Business::create([
            'owner_id' => $this->otherOwner->id,
            'name' => 'Salon Sebelah',
            'slug' => 'salon-sebelah',
            'category' => 'Salon',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'timezone' => 'Asia/Jakarta',
            'is_active' => true,
        ]);
        $this->otherBusiness->users()->attach($this->otherOwner->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $this->otherBusiness->seedDefaultOperatingHours();
        $this->otherOwner->update(['active_business_id' => $this->otherBusiness->id]);
    }

    private function nextWeekday(int $daysAhead = 2): CarbonImmutable
    {
        $date = CarbonImmutable::now('Asia/Jakarta')->addDays($daysAhead)->startOfDay();
        while ($date->isSunday()) {
            $date = $date->addDay();
        }

        return $date;
    }

    public function test_existing_customer_rebooking_with_different_name_preserves_primary_name_and_saves_alias_and_snapshot(): void
    {
        Notification::fake();

        $day1 = $this->nextWeekday(2)->toDateString();
        $day2 = $this->nextWeekday(3)->toDateString();

        // First booking creates customer with primary name "Budi Santoso"
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->slotService->id,
            'date' => $day1,
            'time' => '10:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '0812-3456-7899',
            'customer_email' => 'budi@example.com',
        ])->assertRedirect();

        $this->assertSame(1, Customer::where('business_id', $this->business->id)->count());
        $customer = Customer::where('business_id', $this->business->id)->firstOrFail();
        $this->assertSame('6281234567899', $customer->phone);
        $this->assertSame('Budi Santoso', $customer->name);
        $this->assertSame([], $customer->name_aliases ?? []);

        $firstBooking = Booking::where('business_id', $this->business->id)->firstOrFail();
        $this->assertSame('Budi Santoso', $firstBooking->booked_customer_name);

        // Second booking (time_slot) using same WhatsApp in +62 format but different name ("Andi Anak Pak Budi")
        $this->post(route('public.booking.store', $this->business->slug), [
            'service_id' => $this->slotService->id,
            'date' => $day1,
            'time' => '11:00',
            'staff_id' => $this->staff->id,
            'customer_name' => 'Andi Anak Pak Budi',
            'customer_phone' => '+62 812 3456 7899',
        ])->assertRedirect();

        // Still 1 customer, primary name preserved, alias added
        $this->assertSame(1, Customer::where('business_id', $this->business->id)->count());
        $customer->refresh();
        $this->assertSame('Budi Santoso', $customer->name);
        $this->assertSame(['Andi Anak Pak Budi'], $customer->name_aliases);

        $secondBooking = Booking::where('business_id', $this->business->id)->latest('id')->firstOrFail();
        $this->assertSame($customer->id, $secondBooking->customer_id);
        $this->assertSame('Andi Anak Pak Budi', $secondBooking->booked_customer_name);

        // Third & fourth bookings (dropoff business) using 62812... and +62 formats across different names
        $this->post(route('public.booking.store', $this->dropoffBusiness->slug), [
            'service_id' => $this->dropoffService->id,
            'date' => $day2,
            'quantity' => 2,
            'fulfillment_type' => 'dropoff',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '6281234567899',
        ])->assertRedirect();

        $this->post(route('public.booking.store', $this->dropoffBusiness->slug), [
            'service_id' => $this->dropoffService->id,
            'date' => $day2,
            'quantity' => 1,
            'fulfillment_type' => 'dropoff',
            'customer_name' => 'Budi S.',
            'customer_phone' => '+62 812-3456-7899',
        ])->assertRedirect();

        $this->assertSame(1, Customer::where('business_id', $this->dropoffBusiness->id)->count());
        $dropoffCustomer = Customer::where('business_id', $this->dropoffBusiness->id)->firstOrFail();
        $this->assertSame('Budi Santoso', $dropoffCustomer->name);
        $this->assertSame(['Budi S.'], $dropoffCustomer->name_aliases);

        $dropoffBooking = Booking::where('business_id', $this->dropoffBusiness->id)->latest('id')->firstOrFail();
        $this->assertSame($dropoffCustomer->id, $dropoffBooking->customer_id);
        $this->assertSame('Budi S.', $dropoffBooking->booked_customer_name);
        $this->assertSame('pasang', $dropoffBooking->unit_label);
    }

    public function test_customer_lookup_returns_scoped_matches_and_never_leaks_cross_tenant_customers(): void
    {
        $custA = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'hendra wijaya',
            'name_aliases' => ['Hendra W.', 'Ko Hendra'],
            'phone' => '6281122334455',
            'email' => 'hendra@example.com',
            'tags' => ['VIP'],
        ]);

        $custB = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Siska Pratama',
            'phone' => '6281988776655',
        ]);

        $otherTenantCust = Customer::create([
            'business_id' => $this->otherBusiness->id,
            'name' => 'Hendra Secret',
            'phone' => '6281122339999',
        ]);

        // Lookup by partial phone in 08... format finds custA
        $respPhone = $this->actingAs($this->owner)
            ->getJson(route('dashboard.customers.lookup', ['q' => '08112233']))
            ->assertOk();

        $ids = collect($respPhone->json('customers'))->pluck('id')->all();
        $this->assertContains($custA->id, $ids);
        $this->assertNotContains($otherTenantCust->id, $ids);

        // Lookup by alias finds custA
        $respAlias = $this->actingAs($this->owner)
            ->getJson(route('dashboard.customers.lookup', ['q' => 'Ko Hendra']))
            ->assertOk();

        $this->assertCount(1, $respAlias->json('customers'));
        $this->assertSame($custA->id, $respAlias->json('customers.0.id'));

        // Lookup with exclude_id excludes custA
        $respExcluded = $this->actingAs($this->owner)
            ->getJson(route('dashboard.customers.lookup', [
                'q' => 'Hendra',
                'exclude_id' => $custA->id,
            ]))
            ->assertOk();

        $this->assertCount(0, $respExcluded->json('customers'));
    }

    public function test_customer_update_normalizes_phone_updates_aliases_and_rejects_duplicate_phone_in_same_business(): void
    {
        $cust1 = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Dewi Sartika',
            'name_aliases' => ['Dewi S.', 'Bu Dewi'],
            'phone' => '6281211112222',
        ]);

        $cust2 = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Dewi Lestari',
            'phone' => '6281233334444',
        ]);

        // Updating cust1 phone to a new number in 08... format normalizes to 62... and sanitizes aliases
        $this->actingAs($this->owner)
            ->patch(route('dashboard.customers.update', $cust1->id), [
                'name' => 'Bu Dewi',
                'phone' => '0812-9999-8888',
                'name_aliases' => ['Dewi Sartika', 'Bu Dewi', 'Dewi S.', 'dewi s.'],
            ])
            ->assertSessionHas('success');

        $cust1->refresh();
        $this->assertSame('Bu Dewi', $cust1->name);
        $this->assertSame('6281299998888', $cust1->phone);
        // 'Bu Dewi' excluded because it matches primary name; 'dewi s.' deduplicated case-insensitively
        $this->assertSame(['Dewi Sartika', 'Dewi S.'], $cust1->name_aliases);

        // Attempting to change cust1 phone to cust2's phone (even formatted as 0812...) must fail with error on 'phone'
        $this->actingAs($this->owner)
            ->patch(route('dashboard.customers.update', $cust1->id), [
                'name' => 'Bu Dewi',
                'phone' => '0812 3333 4444',
            ])
            ->assertSessionHasErrors(['phone']);

        $cust1->refresh();
        $this->assertSame('6281299998888', $cust1->phone);
    }

    public function test_customer_merge_moves_bookings_merges_metadata_deletes_source_and_blocks_cross_business_merge(): void
    {
        $target = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Ahmad Fauzi',
            'name_aliases' => ['Fauzi'],
            'phone' => '6281200000001',
            'email' => null,
            'tags' => ['VIP'],
            'notes' => 'Langganan pomade.',
        ]);

        $source = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Ahmad Fauzi (Nomor Lama)',
            'name_aliases' => ['A. Fauzi'],
            'phone' => '6281200000002',
            'email' => 'fauzi@example.com',
            'tags' => ['VIP', 'Repeat'],
            'notes' => 'Pernah ganti nomor WA.',
        ]);

        $startAt = now()->addDays(2);
        $sourceBookingWithNullName = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->slotService->id,
            'staff_id' => $this->staff->id,
            'customer_id' => $source->id,
            'booked_customer_name' => null,
            'booking_code' => 'JNY-MRG001',
            'invoice_number' => 'INV-20261121-MRG001',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $startAt->toDateString(),
            'start_at' => $startAt,
            'end_at' => $startAt->copy()->addHour(),
            'buffer_end_at' => $startAt->copy()->addHour(),
            'total_price' => 75000,
            'dp_amount' => 0,
            'reservation_status' => 'completed',
            'payment_status' => 'settled',
        ]);

        $sourceBookingWithSnapshot = Booking::create([
            'business_id' => $this->business->id,
            'service_id' => $this->slotService->id,
            'staff_id' => $this->staff->id,
            'customer_id' => $source->id,
            'booked_customer_name' => 'Fauzi Junior',
            'booking_code' => 'JNY-MRG002',
            'invoice_number' => 'INV-20261121-MRG002',
            'invoice_token' => bin2hex(random_bytes(16)),
            'booking_date' => $startAt->copy()->addDay()->toDateString(),
            'start_at' => $startAt->copy()->addDay(),
            'end_at' => $startAt->copy()->addDay()->addHour(),
            'buffer_end_at' => $startAt->copy()->addDay()->addHour(),
            'total_price' => 75000,
            'dp_amount' => 0,
            'reservation_status' => 'confirmed',
            'payment_status' => 'unpaid',
        ]);

        // Merge source into target
        $this->actingAs($this->owner)
            ->post(route('dashboard.customers.merge', $target->id), [
                'source_customer_id' => $source->id,
            ])
            ->assertRedirect(route('dashboard.customers.show', $target->id))
            ->assertSessionHas('success');

        // Source customer must be deleted
        $this->assertDatabaseMissing('customers', ['id' => $source->id]);

        // Bookings moved to target and booked_customer_name preserved / backfilled
        $sourceBookingWithNullName->refresh();
        $sourceBookingWithSnapshot->refresh();
        $this->assertSame($target->id, $sourceBookingWithNullName->customer_id);
        $this->assertSame('Ahmad Fauzi (Nomor Lama)', $sourceBookingWithNullName->booked_customer_name);
        $this->assertSame($target->id, $sourceBookingWithSnapshot->customer_id);
        $this->assertSame('Fauzi Junior', $sourceBookingWithSnapshot->booked_customer_name);

        // Target metadata merged
        $target->refresh();
        $this->assertSame('fauzi@example.com', $target->email);
        $this->assertEqualsCanonicalizing(['VIP', 'Repeat'], $target->tags);
        $this->assertContains('Fauzi', $target->name_aliases);
        $this->assertContains('Ahmad Fauzi (Nomor Lama)', $target->name_aliases);
        $this->assertContains('A. Fauzi', $target->name_aliases);
        $this->assertStringContainsString('Langganan pomade.', (string) $target->notes);
        $this->assertStringContainsString('Pernah ganti nomor WA.', (string) $target->notes);

        // Prevent cross-business merge
        $otherBusinessCustomer = Customer::create([
            'business_id' => $this->otherBusiness->id,
            'name' => 'Other Customer',
            'phone' => '6281299990001',
        ]);

        $this->actingAs($this->owner)
            ->post(route('dashboard.customers.merge', $target->id), [
                'source_customer_id' => $otherBusinessCustomer->id,
            ])
            ->assertNotFound();

        $this->assertDatabaseHas('customers', ['id' => $otherBusinessCustomer->id]);
    }

    public function test_duplicates_segment_filters_customers_with_same_normalized_name_within_same_business(): void
    {
        $dup1 = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Rina Nose',
            'phone' => '6281300000001',
        ]);

        $dup2 = Customer::create([
            'business_id' => $this->business->id,
            'name' => '  rina nose ',
            'phone' => '6281300000002',
        ]);

        $unique = Customer::create([
            'business_id' => $this->business->id,
            'name' => 'Tunggal Saputra',
            'phone' => '6281300000003',
        ]);

        // Customer in another business with same name as $unique must NOT make $unique a duplicate
        Customer::create([
            'business_id' => $this->otherBusiness->id,
            'name' => 'Tunggal Saputra',
            'phone' => '6281300000099',
        ]);

        $this->actingAs($this->owner)
            ->get(route('dashboard.customers', ['segment' => 'duplicates']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Customers/Index')
                ->where('duplicateCustomersCount', 2)
                ->has('customers', 2)
                ->where('customers.0.has_duplicate_name', true)
                ->where('customers.1.has_duplicate_name', true)
            );

        // Customer Show page for dup1 includes dup2 in potentialDuplicates
        $this->actingAs($this->owner)
            ->get(route('dashboard.customers.show', $dup1->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Customers/Show')
                ->has('potentialDuplicates', 1)
                ->where('potentialDuplicates.0.id', $dup2->id)
            );
    }
}
