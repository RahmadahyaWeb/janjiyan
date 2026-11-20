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

        $biz = Business::where('slug', 'rapi-studio')->firstOrFail();
        $biz->update([
            'name' => 'Soklenn Cuci Sepatu Banjarmasin & Perawatan Tas Premium Kalimantan',
            'category' => 'Laundry Sepatu, Tas, Topi & Perawatan Barang Kulit',
            'address' => 'Jl. Pangeran Antasari Komplek Ruko Mitra Plaza Blok C No. 123A, Kelurahan Pekapuran Raya, Banjarmasin Timur',
            'brand_color' => '#16423c', // dark: white text
        ]);
        // Light shop color: text and icons must switch to dark automatically.
        Business::where('slug', 'arena-padel')->update(['brand_color' => '#f5c542']);
        // toko-polos stays without color, cover, logo or photos.

        $long = 'Layanan cuci menyeluruh untuk perawatan sepatu harian. Mencakup pembersihan bagian upper, midsole, outsole, dan tali sepatu menggunakan cairan pembersih khusus yang aman untuk material, dilengkapi anti-bakteri & parfum sepatu agar kembali bersih, segar, dan siap dipakai.';

        // The exact case from the bug report: short-ish name + all drop-off badges.
        Service::updateOrCreate(['business_id' => $biz->id, 'name' => 'Regular Clean'], [
            'description' => $long, 'price' => 30000, 'duration_minutes' => 60, 'buffer_minutes' => 0,
            'capacity' => 5, 'assignment_mode' => 'capacity', 'booking_mode' => 'dropoff',
            'turnaround_days' => 3, 'supports_pickup' => true, 'dp_type' => 'none', 'dp_value' => 0, 'is_active' => true,
        ]);
        // Long name, inactive, drop-off + pickup, big price.
        Service::updateOrCreate(['business_id' => $biz->id, 'name' => 'Deep Clean Premium Unyellowing + Repaint Midsole Full Restorasi'], [
            'description' => $long, 'price' => 1250000, 'duration_minutes' => 60, 'buffer_minutes' => 0,
            'capacity' => 120, 'assignment_mode' => 'capacity', 'booking_mode' => 'dropoff',
            'turnaround_days' => 14, 'supports_pickup' => true, 'dp_type' => 'percentage', 'dp_value' => 50, 'is_active' => false,
        ]);

        Staff::updateOrCreate(['business_id' => $biz->id, 'name' => 'Muhammad Achyadi Rahmatullah Al-Banjari'], [
            'title' => 'Kepala Teknisi Perawatan Sepatu & Tas Kulit', 'phone' => '081234567899999', 'is_active' => true,
        ]);

        // Bare profile (no logo, description, phone, address, gallery): how most new merchants look.
        $bare = Business::updateOrCreate(['slug' => 'toko-polos'], [
            'owner_id' => $biz->owner_id, 'name' => 'Soklenn Cuci Sepatu Banjarbaru', 'category' => 'Jasa & Layanan',
            'timezone' => 'Asia/Jakarta', 'dp_expiry_minutes' => 120, 'is_active' => true,
        ]);
        $bare->seedDefaultOperatingHours();
        foreach ([['Regular Clean', 30000, 5, 3], ['Deep Clean', 40000, 2, 4]] as [$name, $price, $capacity, $days]) {
            Service::updateOrCreate(['business_id' => $bare->id, 'name' => $name], [
                'description' => $long, 'price' => $price, 'duration_minutes' => 60, 'buffer_minutes' => 0,
                'capacity' => $capacity, 'assignment_mode' => 'capacity', 'booking_mode' => 'dropoff',
                'turnaround_days' => $days, 'supports_pickup' => true, 'dp_type' => 'none', 'dp_value' => 0, 'is_active' => true,
            ]);
        }

        Customer::updateOrCreate(['business_id' => $biz->id, 'phone' => '6281299998888777'], [
            'name' => 'Raden Ayu Kusumawardhani Prameswari Setyaningrum',
            'email' => 'raden.ayu.kusumawardhani.prameswari@contoh-domain-panjang.test',
            'notes' => $long,
        ]);
    }
}
