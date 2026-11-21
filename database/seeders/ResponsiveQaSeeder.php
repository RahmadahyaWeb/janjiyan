<?php

namespace Database\Seeders;

use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use Illuminate\Database\Seeder;
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

        Customer::updateOrCreate(['business_id' => $soklenn->id, 'phone' => '6281299998888777'], [
            'name' => 'Raden Ayu Kusumawardhani Prameswari Setyaningrum',
            'email' => 'raden.ayu.kusumawardhani.prameswari@contoh-domain-panjang.test',
            'notes' => $longDropoffDesc,
        ]);

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
    }
}
