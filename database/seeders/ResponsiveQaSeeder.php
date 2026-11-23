<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Business;
use App\Models\BusinessReview;
use App\Models\Customer;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Models\Staff;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Worst-case data for the responsive sweep (tests/e2e/responsive.spec.ts).
 * Long names, long text, big numbers, every badge on. Short demo data hides layout bugs.
 * Run on a throwaway DB: DB_DATABASE=database/qa.sqlite php artisan migrate:fresh --seed --seeder=ResponsiveQaSeeder
 */
class ResponsiveQaSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('ResponsiveQaSeeder cannot run in production.');
        }

        $this->call(DemoSeeder::class);

        $longAppointmentDesc = 'Layanan perawatan rambut dan grooming menyeluruh dengan konsultasi gaya rambut personal, pencucian rambut relaksasi, pemotongan presisi, pijat kepala ringan, serta penataan menggunakan produk premium.';
        $longDropoffDesc = 'Layanan cuci menyeluruh untuk perawatan sepatu harian. Mencakup pembersihan bagian upper, midsole, outsole, dan tali sepatu menggunakan cairan pembersih khusus yang aman untuk material, dilengkapi anti-bakteri & parfum sepatu agar kembali bersih, segar, dan siap dipakai.';

        // 1. Keep rapi-studio strictly staff_appointment with long stress-test strings (no dropoff mixing).
        $rapiStudio = Business::where('slug', 'rapi-studio')->firstOrFail();
        $rapiStudio->update([
            'name' => 'Rapi Studio Barbershop & Grooming Signature Banjarmasin Kalimantan',
            'category' => 'Barbershop & Salon',
            'business_type' => Business::TYPE_STAFF_APPOINTMENT,
            'address' => 'Jl. Pangeran Antasari Komplek Ruko Mitra Plaza Blok C No. 123A, Kelurahan Pekapuran Raya, Banjarmasin Timur',
            'brand_color' => '#16423c', // dark: white text
        ]);

        $longStaff = Staff::updateOrCreate(
            ['business_id' => $rapiStudio->id, 'name' => 'Muhammad Achyadi Rahmatullah Al-Banjari'],
            [
                'title' => 'Master Barber & Direktur Artistik Grooming Pria',
                'phone' => '081234567899999',
                'is_active' => true,
            ]
        );

        $rapiStaffIds = Staff::where('business_id', $rapiStudio->id)->pluck('id')->all();

        $svcPremiumCut = Service::updateOrCreate(
            ['business_id' => $rapiStudio->id, 'name' => 'Signature Executive Haircut + Scalp Spa + Hot Towel Styling'],
            [
                'description' => $longAppointmentDesc,
                'price' => 350000,
                'duration_minutes' => 90,
                'buffer_minutes' => 15,
                'capacity' => 1,
                'assignment_mode' => 'staff',
                'booking_mode' => 'time_slot',
                'unit_label' => Service::DEFAULT_UNIT_LABEL,
                'dp_type' => 'percentage',
                'dp_value' => 50,
                'is_active' => true,
            ]
        );
        $svcPremiumCut->staff()->sync($rapiStaffIds);

        $svcInactiveAppointment = Service::updateOrCreate(
            ['business_id' => $rapiStudio->id, 'name' => 'Paket Grooming Pengantin Full Treatment & Pewarnaan Rambut Premium'],
            [
                'description' => $longAppointmentDesc,
                'price' => 1250000,
                'duration_minutes' => 120,
                'buffer_minutes' => 15,
                'capacity' => 1,
                'assignment_mode' => 'staff',
                'booking_mode' => 'time_slot',
                'unit_label' => Service::DEFAULT_UNIT_LABEL,
                'dp_type' => 'fixed',
                'dp_value' => 300000,
                'is_active' => false,
            ]
        );
        $svcInactiveAppointment->staff()->sync([$longStaff->id]);

        foreach ([
            'Hair Perming & Korean Down Perm Treatment Profesional',
            'Creambath Aromaterapi & Relaksasi Bahu Lengkap',
        ] as $extraName) {
            $extraSvc = Service::updateOrCreate(
                ['business_id' => $rapiStudio->id, 'name' => $extraName],
                [
                    'description' => $longAppointmentDesc,
                    'price' => 175000,
                    'duration_minutes' => 60,
                    'buffer_minutes' => 10,
                    'capacity' => 1,
                    'assignment_mode' => 'staff',
                    'booking_mode' => 'time_slot',
                    'unit_label' => Service::DEFAULT_UNIT_LABEL,
                    'dp_type' => 'none',
                    'dp_value' => 0,
                    'is_active' => true,
                ]
            );
            $extraSvc->staff()->sync($rapiStaffIds);
        }

        Customer::updateOrCreate(['business_id' => $rapiStudio->id, 'phone' => '6281299998888777'], [
            'name' => 'Raden Ayu Kusumawardhani Prameswari Setyaningrum',
            'email' => 'raden.ayu.kusumawardhani.prameswari@contoh-domain-panjang.test',
            'notes' => $longAppointmentDesc,
        ]);

        // 2. Light shop color on space_booking: text and icons must switch to dark automatically.
        Business::where('slug', 'arena-padel')->update([
            'business_type' => Business::TYPE_SPACE_BOOKING,
            'brand_color' => '#f5c542',
        ]);

        // 3. Worst-case long drop-off stress-test data on soklenn-shoes (dropoff).
        $soklenn = Business::where('slug', 'soklenn-shoes')->firstOrFail();
        $soklenn->update([
            'name' => 'Soklenn Cuci Sepatu Banjarmasin & Perawatan Tas Premium Kalimantan',
            'category' => 'Cuci Sepatu & Tas',
            'business_type' => Business::TYPE_DROPOFF,
            'address' => 'Jl. Pangeran Antasari Komplek Ruko Mitra Plaza Blok C No. 123A, Kelurahan Pekapuran Raya, Banjarmasin Timur',
            'brand_color' => '#16423c',
        ]);

        Service::updateOrCreate(['business_id' => $soklenn->id, 'name' => 'Regular Clean'], [
            'description' => $longDropoffDesc,
            'price' => 30000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 5,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'turnaround_days' => 3,
            'supports_pickup' => true,
            'unit_label' => 'pasang',
            'dp_type' => 'none',
            'dp_value' => 0,
            'is_active' => true,
        ]);

        Service::updateOrCreate(['business_id' => $soklenn->id, 'name' => 'Deep Clean Premium Unyellowing + Repaint Midsole Full Restorasi'], [
            'description' => $longDropoffDesc,
            'price' => 1250000,
            'duration_minutes' => 60,
            'buffer_minutes' => 0,
            'capacity' => 120,
            'assignment_mode' => 'capacity',
            'booking_mode' => 'dropoff',
            'turnaround_days' => 14,
            'supports_pickup' => true,
            'unit_label' => 'pasang',
            'dp_type' => 'percentage',
            'dp_value' => 50,
            'is_active' => false,
        ]);

        foreach ([
            ['Cuci Topi & Tas Kanvas', 'pcs'],
            ['Repaint Sepatu Kulit Full Warna Custom Sesuai Permintaan', 'pasang'],
        ] as [$svcName, $unitLabel]) {
            Service::updateOrCreate(['business_id' => $soklenn->id, 'name' => $svcName], [
                'description' => $longDropoffDesc,
                'price' => 75000,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 3,
                'assignment_mode' => 'capacity',
                'booking_mode' => 'dropoff',
                'turnaround_days' => 5,
                'supports_pickup' => false,
                'unit_label' => $unitLabel,
                'dp_type' => 'none',
                'dp_value' => 0,
                'is_active' => true,
            ]);
        }

        $dropoffLongCustomer = Customer::updateOrCreate(['business_id' => $soklenn->id, 'phone' => '6281299998888777'], [
            'name' => 'Raden Ayu Kusumawardhani Prameswari Setyaningrum',
            'email' => 'raden.ayu.kusumawardhani.prameswari@contoh-domain-panjang.test',
            'notes' => $longDropoffDesc,
        ]);

        // Dedicated drop-off owner user so parallel E2E tests can test dropoff dashboard without mutating owner@janjiyan.test.
        $proPlan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();
        $dropoffOwner = User::updateOrCreate(
            ['email' => 'dropoff@janjiyan.test'],
            [
                'name' => 'Siti Rahma (Drop-off Owner)',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'is_superadmin' => false,
                'active_business_id' => $soklenn->id,
            ]
        );
        Subscription::updateOrCreate(
            ['user_id' => $dropoffOwner->id],
            [
                'subscription_plan_id' => $proPlan->id,
                'status' => 'active',
                'trial_ends_at' => null,
                'current_period_ends_at' => now()->addDays(25),
            ]
        );
        $soklenn->users()->syncWithoutDetaching([
            $dropoffOwner->id => ['role' => 'owner', 'permissions' => json_encode(['*'])],
        ]);

        // Stress-test drop-off booking with long customer/service names & pickup address.
        $dropoffStressService = Service::where('business_id', $soklenn->id)
            ->where('name', 'Repaint Sepatu Kulit Full Warna Custom Sesuai Permintaan')
            ->firstOrFail();
        $qaToday = CarbonImmutable::now('Asia/Jakarta');
        if ($qaToday->isSunday()) {
            $qaToday = $qaToday->addDay();
        }
        Booking::updateOrCreate(
            ['booking_code' => 'JNY-QADROP'],
            [
                'business_id' => $soklenn->id,
                'service_id' => $dropoffStressService->id,
                'staff_id' => null,
                'customer_id' => $dropoffLongCustomer->id,
                'booked_customer_name' => $dropoffLongCustomer->name,
                'booked_customer_email' => $dropoffLongCustomer->email,
                'booking_mode' => 'dropoff',
                'quantity' => 4,
                'unit_label' => 'pasang',
                'fulfillment_type' => 'pickup',
                'pickup_session' => 'afternoon',
                'pickup_address' => 'Jl. Pangeran Antasari Komplek Ruko Mitra Plaza Blok C No. 123A, Kelurahan Pekapuran Raya, Banjarmasin Timur',
                'invoice_number' => 'INV-'.$qaToday->format('Ymd').'-QADROP',
                'invoice_token' => substr(hash('sha256', 'qa-JNY-QADROP'), 0, 32),
                'booking_date' => $qaToday->toDateString(),
                'start_at' => $qaToday->setTime(9, 0)->utc(),
                'end_at' => $qaToday->setTime(18, 0)->utc(),
                'buffer_end_at' => $qaToday->setTime(18, 0)->utc(),
                'estimated_ready_date' => $qaToday->addDays(5)->toDateString(),
                'total_price' => $dropoffStressService->price * 4,
                'dp_amount' => 100000,
                'reservation_status' => 'confirmed',
                'work_status' => 'ready_for_pickup',
                'payment_status' => 'waiting_verification',
                'dp_proof_path' => 'dp-proofs/demo-dp-proof.png',
                'dp_expires_at' => null,
                'customer_notes' => '4 pasang sepatu kulit premium warna cokelat tua & sneakers putih suede.',
            ]
        );

        // 4. Bare profile (no logo, description, phone, address, gallery): how most new merchants look.
        $bare = Business::updateOrCreate(['slug' => 'toko-polos'], [
            'owner_id' => $rapiStudio->owner_id,
            'name' => 'Soklenn Cuci Sepatu Banjarbaru',
            'category' => 'Cuci Sepatu & Tas',
            'business_type' => Business::TYPE_DROPOFF,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
            'is_active' => true,
        ]);
        $bare->seedDefaultOperatingHours();
        foreach ([['Regular Clean', 30000, 5, 3], ['Deep Clean', 40000, 2, 4]] as [$name, $price, $capacity, $days]) {
            Service::updateOrCreate(['business_id' => $bare->id, 'name' => $name], [
                'description' => $longDropoffDesc,
                'price' => $price,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => $capacity,
                'assignment_mode' => 'capacity',
                'booking_mode' => 'dropoff',
                'turnaround_days' => $days,
                'supports_pickup' => true,
                'unit_label' => 'pasang',
                'dp_type' => 'none',
                'dp_value' => 0,
                'is_active' => true,
            ]);
        }

        // 5. v2.2 QA worst-case add-ons, multi-items, payments, and long-text review records
        ServiceAddon::updateOrCreate(
            ['business_id' => $rapiStudio->id, 'name' => 'Paket Perawatan Kulit Kepala Anti-Ketombe + Hair Tonic Vitamin Ekstra'],
            [
                'description' => $longAppointmentDesc,
                'price' => 95000,
                'unit_label' => 'item',
                'duration_minutes' => 20,
                'is_commissionable' => true,
                'applies_to_all_services' => true,
                'is_active' => true,
                'sort_order' => 10,
            ]
        );

        $qaDropBooking = Booking::where('booking_code', 'JNY-QADROP')->first();
        if ($qaDropBooking && ! $qaDropBooking->items()->exists()) {
            BookingItem::create([
                'booking_id' => $qaDropBooking->id,
                'item_type' => BookingItem::TYPE_SERVICE,
                'service_id' => $dropoffStressService->id,
                'name_snapshot' => $dropoffStressService->name,
                'unit_label_snapshot' => 'pasang',
                'unit_price' => (int) $dropoffStressService->price,
                'quantity' => 4,
                'duration_minutes_snapshot' => 0,
                'turnaround_days_snapshot' => 5,
                'is_commissionable' => true,
                'subtotal' => (int) $dropoffStressService->price * 4,
            ]);
        }

        if (! BusinessReview::where('business_id', $rapiStudio->id)->where('reviewer_name', 'Raden Ayu Kusumawardhani Prameswari Setyaningrum')->exists()) {
            BusinessReview::create([
                'business_id' => $rapiStudio->id,
                'booking_id' => null,
                'customer_id' => null,
                'reviewer_name' => 'Raden Ayu Kusumawardhani Prameswari Setyaningrum',
                'reviewer_phone' => '6281299998888777',
                'rating' => 3,
                'comment' => 'Pelayanan staf sangat ramah dan hasil rapi, namun antrean akhir pekan cukup padat sehingga perlu penyesuaian estimasi waktu tunggu di ruang depan.',
                'redirected_to_google' => false,
            ]);
        }
    }
}
