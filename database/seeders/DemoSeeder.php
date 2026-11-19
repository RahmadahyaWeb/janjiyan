<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Business;
use App\Models\BusinessGallery;
use App\Models\BusinessHoliday;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\StaffOperatingHour;
use App\Models\StaffTimeOff;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class DemoSeeder extends Seeder
{
    /**
     * Seed comprehensive local demo data for testing all Janjiyan features.
     * Run manually with: php artisan db:seed --class=DemoSeeder
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('DemoSeeder cannot be executed in production environment.');
        }

        $this->call(SubscriptionPlanSeeder::class);

        $proPlan = SubscriptionPlan::where('slug', 'professional')->firstOrFail();

        // 1. Superadmin
        User::updateOrCreate(
            ['email' => 'admin@janjiyan.test'],
            [
                'name' => 'Superadmin Janjiyan',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'is_superadmin' => true,
            ]
        );

        // 2. Merchant Owner (Professional Plan for Multi-Business & CSV Export)
        $owner = User::updateOrCreate(
            ['email' => 'owner@janjiyan.test'],
            [
                'name' => 'Budi Santoso (Owner)',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'is_superadmin' => false,
            ]
        );

        Subscription::updateOrCreate(
            ['user_id' => $owner->id],
            [
                'subscription_plan_id' => $proPlan->id,
                'status' => 'active',
                'trial_ends_at' => null,
                'current_period_ends_at' => now()->addDays(25),
            ]
        );

        // 3. Staff Login Users
        $adminStaffUser = User::updateOrCreate(
            ['email' => 'admin.studio@janjiyan.test'],
            [
                'name' => 'Citra Kasir',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );

        $barberStaffUser = User::updateOrCreate(
            ['email' => 'staff.andi@janjiyan.test'],
            [
                'name' => 'Andi Pratama',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );

        // 4. Download Unsplash Demo Photos into public disk (idempotent)
        $barberLogoPath = $this->downloadDemoPhoto(
            'demo-assets/barber-logo.jpg',
            'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&q=80&auto=format&fit=crop'
        );
        $padelLogoPath = $this->downloadDemoPhoto(
            'demo-assets/padel-logo.jpg',
            'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=500&q=80&auto=format&fit=crop'
        );
        $svcHaircutPath = $this->downloadDemoPhoto(
            'demo-assets/svc-haircut.jpg',
            'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80&auto=format&fit=crop'
        );
        $svcBeardPath = $this->downloadDemoPhoto(
            'demo-assets/svc-beard.jpg',
            'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80&auto=format&fit=crop'
        );
        $svcExpressPath = $this->downloadDemoPhoto(
            'demo-assets/svc-express.jpg',
            'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format&fit=crop'
        );
        $svcPadelPath = $this->downloadDemoPhoto(
            'demo-assets/svc-padel.jpg',
            'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80&auto=format&fit=crop'
        );
        $galleryBarber1 = $this->downloadDemoPhoto(
            'demo-assets/gallery-barber-1.jpg',
            'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1000&q=80&auto=format&fit=crop'
        );
        $galleryBarber2 = $this->downloadDemoPhoto(
            'demo-assets/gallery-barber-2.jpg',
            'https://images.unsplash.com/photo-1593702288056-7927b442d0fa?w=1000&q=80&auto=format&fit=crop'
        );
        $galleryBarber3 = $this->downloadDemoPhoto(
            'demo-assets/gallery-barber-3.jpg',
            'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1000&q=80&auto=format&fit=crop'
        );
        $galleryPadel1 = $this->downloadDemoPhoto(
            'demo-assets/gallery-padel-1.jpg',
            'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1000&q=80&auto=format&fit=crop'
        );

        // 5. Business #1: Staff-Assigned Mode (Barbershop)
        $barbershop = Business::updateOrCreate(
            ['slug' => 'rapi-studio'],
            [
                'owner_id' => $owner->id,
                'name' => 'Rapi Studio Barbershop',
                'category' => 'Barbershop & Grooming',
                'description' => 'Barbershop modern dengan layanan potong rambut presisi, grooming, dan perawatan pria.',
                'phone' => '6281234567890',
                'address' => 'Jl. Kemang Raya No. 45, Jakarta Selatan',
                'timezone' => 'Asia/Jakarta',
                'logo_path' => $barberLogoPath,
                'dp_expiry_minutes' => 120,
                'min_booking_lead_minutes' => 15,
                'max_booking_advance_days' => 60,
                'reminder_h1_enabled' => true,
                'reminder_h2_enabled' => true,
                'bank_accounts' => [
                    [
                        'bank_name' => 'BCA',
                        'account_number' => '8820192831',
                        'account_holder' => 'PT Rapi Studio Indonesia',
                    ],
                    [
                        'bank_name' => 'Mandiri',
                        'account_number' => '1310009988776',
                        'account_holder' => 'Budi Santoso',
                    ],
                ],
                'is_active' => true,
                'suspended_at' => null,
                'suspension_reason' => null,
            ]
        );
        $barbershop->seedDefaultOperatingHours();
        $barbershop->users()->syncWithoutDetaching([
            $owner->id => ['role' => 'owner', 'permissions' => json_encode(['*'])],
            $adminStaffUser->id => ['role' => 'admin', 'permissions' => json_encode(['*'])],
            $barberStaffUser->id => ['role' => 'staff', 'permissions' => json_encode(['manage_bookings', 'verify_payments'])],
        ]);

        // 6. Business #2: Capacity-Based Mode (Sports Court)
        $padelArena = Business::updateOrCreate(
            ['slug' => 'arena-padel'],
            [
                'owner_id' => $owner->id,
                'name' => 'Arena Padel & Badminton',
                'category' => 'Olahraga & Lapangan',
                'description' => 'Penyewaan lapangan padel dan badminton indoor dengan sistem booking slot per jam.',
                'phone' => '6281298765432',
                'address' => 'Jl. Senopati No. 12, Jakarta Selatan',
                'timezone' => 'Asia/Jakarta',
                'logo_path' => $padelLogoPath,
                'dp_expiry_minutes' => 90,
                'min_booking_lead_minutes' => 30,
                'max_booking_advance_days' => 30,
                'reminder_h1_enabled' => true,
                'reminder_h2_enabled' => true,
                'bank_accounts' => [
                    [
                        'bank_name' => 'BCA',
                        'account_number' => '5540112233',
                        'account_holder' => 'Arena Padel Nusantara',
                    ],
                ],
                'is_active' => true,
            ]
        );
        $padelArena->seedDefaultOperatingHours();
        $padelArena->users()->syncWithoutDetaching([
            $owner->id => ['role' => 'owner', 'permissions' => json_encode(['*'])],
        ]);

        $owner->update(['active_business_id' => $barbershop->id]);
        $adminStaffUser->update(['active_business_id' => $barbershop->id]);
        $barberStaffUser->update(['active_business_id' => $barbershop->id]);

        // 6. Staff for Rapi Studio (including custom shift & time-off)
        $staffAndi = Staff::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Andi Pratama'],
            [
                'user_id' => $barberStaffUser->id,
                'title' => 'Master Barber',
                'email' => $barberStaffUser->email,
                'phone' => '081234560001',
                'is_active' => true,
            ]
        );

        $staffBima = Staff::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Bima Sakti'],
            [
                'user_id' => null,
                'title' => 'Senior Stylist',
                'email' => null,
                'phone' => '081234560002',
                'is_active' => true,
            ]
        );

        $staffDimas = Staff::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Dimas Nugroho'],
            [
                'user_id' => null,
                'title' => 'Junior Barber',
                'email' => null,
                'phone' => '081234560003',
                'is_active' => true,
            ]
        );

        // Andi works custom shift (10:00–19:00 Mon-Sat, off Sunday)
        for ($day = 0; $day <= 6; $day++) {
            StaffOperatingHour::updateOrCreate(
                ['staff_id' => $staffAndi->id, 'day_of_week' => $day],
                [
                    'is_working' => $day !== 0,
                    'start_time' => '10:00',
                    'end_time' => '19:00',
                    'break_start' => '13:00',
                    'break_end' => '14:00',
                ]
            );
        }

        // Bima has time-off 3 days from now
        $bimaOffDate = $this->nextOpenDay(3)->toDateString();
        $hasTimeOff = StaffTimeOff::where('business_id', $barbershop->id)
            ->where('staff_id', $staffBima->id)
            ->whereDate('start_date', $bimaOffDate)
            ->exists();
        if (! $hasTimeOff) {
            StaffTimeOff::create([
                'business_id' => $barbershop->id,
                'staff_id' => $staffBima->id,
                'start_date' => $bimaOffDate,
                'end_date' => $bimaOffDate,
                'reason' => 'Cuti keluarga',
            ]);
        }

        // Business holiday 10 days from now
        $holidayDate = CarbonImmutable::now('Asia/Jakarta')->addDays(10)->toDateString();
        $hasHoliday = BusinessHoliday::where('business_id', $barbershop->id)
            ->whereDate('date', $holidayDate)
            ->exists();
        if (! $hasHoliday) {
            BusinessHoliday::create([
                'business_id' => $barbershop->id,
                'date' => $holidayDate,
                'reason' => 'Renovasi Interior Studio',
            ]);
        }

        // 7. Services
        $svcHaircut = Service::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Signature Haircut & Wash'],
            [
                'description' => 'Konsultasi gaya rambut, potong presisi, keramas, dan styling pomade.',
                'image_path' => $svcHaircutPath,
                'price' => 85000,
                'duration_minutes' => 45,
                'buffer_minutes' => 15,
                'capacity' => 1,
                'assignment_mode' => 'staff',
                'dp_type' => 'fixed',
                'dp_value' => 25000,
                'is_active' => true,
            ]
        );
        $svcHaircut->staff()->sync([$staffAndi->id, $staffBima->id, $staffDimas->id]);

        $svcGrooming = Service::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Beard Trim & Hot Towel'],
            [
                'description' => 'Perapian jenggot & kumis lengkap dengan kompres handuk hangat.',
                'image_path' => $svcBeardPath,
                'price' => 60000,
                'duration_minutes' => 30,
                'buffer_minutes' => 10,
                'capacity' => 1,
                'assignment_mode' => 'staff',
                'dp_type' => 'percentage',
                'dp_value' => 50,
                'is_active' => true,
            ]
        );
        $svcGrooming->staff()->sync([$staffAndi->id, $staffBima->id]);

        $svcBasicCut = Service::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Express Cut (Tanpa DP)'],
            [
                'description' => 'Potong rambut cepat tanpa keramas, bayar di tempat.',
                'image_path' => $svcExpressPath,
                'price' => 50000,
                'duration_minutes' => 30,
                'buffer_minutes' => 0,
                'capacity' => 1,
                'assignment_mode' => 'staff',
                'dp_type' => 'none',
                'dp_value' => 0,
                'is_active' => true,
            ]
        );
        $svcBasicCut->staff()->sync([$staffDimas->id]);

        $svcPadel = Service::updateOrCreate(
            ['business_id' => $padelArena->id, 'name' => 'Sewa Lapangan Padel (1 Jam)'],
            [
                'description' => 'Lapangan padel indoor standar internasional (tersedia 2 court).',
                'image_path' => $svcPadelPath,
                'price' => 250000,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 2,
                'assignment_mode' => 'capacity',
                'dp_type' => 'fixed',
                'dp_value' => 100000,
                'is_active' => true,
            ]
        );

        // Business Portfolio Galleries
        $galleryRows = [
            [$barbershop->id, $galleryBarber1, 'Interior studio nyaman dengan pencahayaan hangat', 1],
            [$barbershop->id, $galleryBarber2, 'Hasil potongan skin fade & styling rapi', 2],
            [$barbershop->id, $galleryBarber3, 'Area grooming & pencucian rambut premium', 3],
            [$padelArena->id, $galleryPadel1, 'Lapangan indoor berstandar turnamen', 1],
        ];
        foreach ($galleryRows as [$bizId, $imgPath, $caption, $sortOrder]) {
            if (! $imgPath) {
                continue;
            }
            BusinessGallery::updateOrCreate(
                ['business_id' => $bizId, 'image_path' => $imgPath],
                ['caption' => $caption, 'sort_order' => $sortOrder]
            );
        }

        // 8. Customers with CRM Internal Notes
        $customersData = [
            ['name' => 'Raka Wijaya', 'phone' => '6281211112222', 'email' => 'raka@example.test', 'notes' => 'VIP. Biasa model low fade 2mm, pakai clay matte.'],
            ['name' => 'Dimas Pratama', 'phone' => '6281222223333', 'email' => 'dimas@example.test', 'notes' => 'Alergi parfum beraroma kuat, gunakan tonic netral.'],
            ['name' => 'Siti Nurhaliza', 'phone' => '6281233334444', 'email' => 'siti@example.test', 'notes' => 'Booking untuk anaknya setiap awal bulan.'],
            ['name' => 'Fajar Ramadhan', 'phone' => '6281244445555', 'email' => 'fajar@example.test', 'notes' => null],
            ['name' => 'Hendra Kusuma', 'phone' => '6281255556666', 'email' => null, 'notes' => 'Pernah no-show 1x, wajib DP sebelum konfirmasi.'],
        ];

        $customers = [];
        foreach ($customersData as $cData) {
            $customers[] = Customer::updateOrCreate(
                ['business_id' => $barbershop->id, 'phone' => $cData['phone']],
                [
                    'name' => $cData['name'],
                    'email' => $cData['email'],
                    'notes' => $cData['notes'],
                ]
            );
        }

        // Create a dummy DP proof image in local storage so "Bukti DP" preview works
        $dummyProofPath = 'dp-proofs/demo-dp-proof.png';
        if (! Storage::disk('local')->exists($dummyProofPath)) {
            $pngBinary = base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC'
            );
            Storage::disk('local')->put($dummyProofPath, $pngBinary);
        }

        // 9. Sample Bookings across all states (Calendar, List, CRM, Reminders)
        $today = $this->nextOpenDay(0);
        $tomorrow = $this->nextOpenDay(1);
        $yesterday = CarbonImmutable::now('Asia/Jakarta')->subDay();
        if ($yesterday->isSunday()) {
            $yesterday = $yesterday->subDay();
        }

        $demoBookings = [
            // Today: Confirmed + DP Verified (for Calendar View)
            [
                'code' => 'JNY-DEMO01',
                'business' => $barbershop,
                'service' => $svcHaircut,
                'staff' => $staffAndi,
                'customer' => $customers[0],
                'date' => $today,
                'time' => '10:00',
                'reservation_status' => 'confirmed',
                'payment_status' => 'dp_verified',
                'dp_proof_path' => $dummyProofPath,
                'dp_expires_at' => null,
                'notes' => 'Potong rapi untuk acara malam.',
                'rescheduled_count' => 1,
            ],
            // Today: Pending + Waiting Verification (ready for merchant to click "Verifikasi DP")
            [
                'code' => 'JNY-DEMO02',
                'business' => $barbershop,
                'service' => $svcGrooming,
                'staff' => $staffBima,
                'customer' => $customers[1],
                'date' => $today,
                'time' => '14:00',
                'reservation_status' => 'pending',
                'payment_status' => 'waiting_verification',
                'dp_proof_path' => $dummyProofPath,
                'dp_expires_at' => null,
                'notes' => 'Transfer via BCA a.n. Dimas.',
                'rescheduled_count' => 0,
            ],
            // Today: Pending + Unpaid (Pay Later with active countdown)
            [
                'code' => 'JNY-DEMO03',
                'business' => $barbershop,
                'service' => $svcHaircut,
                'staff' => $staffDimas,
                'customer' => $customers[3],
                'date' => $today,
                'time' => '16:00',
                'reservation_status' => 'pending',
                'payment_status' => 'unpaid',
                'dp_proof_path' => null,
                'dp_expires_at' => now()->addMinutes(95),
                'notes' => null,
                'rescheduled_count' => 0,
            ],
            // Tomorrow: Confirmed (for H-1 Reminder & Calendar View)
            [
                'code' => 'JNY-DEMO04',
                'business' => $barbershop,
                'service' => $svcHaircut,
                'staff' => $staffAndi,
                'customer' => $customers[2],
                'date' => $tomorrow,
                'time' => '11:00',
                'reservation_status' => 'confirmed',
                'payment_status' => 'settled',
                'dp_proof_path' => null,
                'dp_expires_at' => null,
                'notes' => 'Datang bersama anak.',
                'rescheduled_count' => 0,
            ],
            // Yesterday: Completed
            [
                'code' => 'JNY-DEMO05',
                'business' => $barbershop,
                'service' => $svcHaircut,
                'staff' => $staffAndi,
                'customer' => $customers[0],
                'date' => $yesterday,
                'time' => '15:00',
                'reservation_status' => 'completed',
                'payment_status' => 'settled',
                'dp_proof_path' => null,
                'dp_expires_at' => null,
                'notes' => null,
                'rescheduled_count' => 0,
            ],
            // Yesterday: No-Show
            [
                'code' => 'JNY-DEMO06',
                'business' => $barbershop,
                'service' => $svcGrooming,
                'staff' => $staffBima,
                'customer' => $customers[4],
                'date' => $yesterday,
                'time' => '11:00',
                'reservation_status' => 'no_show',
                'payment_status' => 'dp_verified',
                'dp_proof_path' => null,
                'dp_expires_at' => null,
                'notes' => 'Tidak hadir tanpa konfirmasi.',
                'rescheduled_count' => 0,
            ],
        ];

        foreach ($demoBookings as $item) {
            /** @var CarbonImmutable $dateObj */
            $dateObj = $item['date'];
            $startLocal = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$dateObj->toDateString()} {$item['time']}", 'Asia/Jakarta');
            $endLocal = $startLocal->addMinutes($item['service']->duration_minutes);
            $bufferEndLocal = $endLocal->addMinutes($item['service']->buffer_minutes);

            Booking::updateOrCreate(
                ['booking_code' => $item['code']],
                [
                    'business_id' => $item['business']->id,
                    'service_id' => $item['service']->id,
                    'staff_id' => $item['staff']?->id,
                    'customer_id' => $item['customer']->id,
                    'invoice_number' => 'INV-'.$dateObj->format('Ymd').'-'.substr($item['code'], 4),
                    'invoice_token' => hash('sha256', 'demo-'.$item['code']) ? substr(hash('sha256', 'demo-'.$item['code']), 0, 32) : bin2hex(random_bytes(16)),
                    'booking_date' => $dateObj->toDateString(),
                    'start_at' => $startLocal->utc(),
                    'end_at' => $endLocal->utc(),
                    'buffer_end_at' => $bufferEndLocal->utc(),
                    'total_price' => $item['service']->price,
                    'dp_amount' => $item['service']->calculateDpAmount(),
                    'reservation_status' => $item['reservation_status'],
                    'payment_status' => $item['payment_status'],
                    'dp_proof_path' => $item['dp_proof_path'],
                    'dp_expires_at' => $item['dp_expires_at'],
                    'customer_notes' => $item['notes'],
                    'rescheduled_count' => $item['rescheduled_count'],
                    'last_rescheduled_at' => $item['rescheduled_count'] > 0 ? now()->subHours(3) : null,
                ]
            );
        }

        // Capacity-based booking for Business #2
        $padelCustomer = Customer::updateOrCreate(
            ['business_id' => $padelArena->id, 'phone' => '6281399990001'],
            ['name' => 'Komunitas Padel Jaksel', 'email' => 'padel@example.test', 'notes' => 'Rutin main setiap minggu.']
        );

        $padelStart = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$tomorrow->toDateString()} 17:00", 'Asia/Jakarta');
        Booking::updateOrCreate(
            ['booking_code' => 'JNY-PADEL1'],
            [
                'business_id' => $padelArena->id,
                'service_id' => $svcPadel->id,
                'staff_id' => null,
                'customer_id' => $padelCustomer->id,
                'invoice_number' => 'INV-'.$tomorrow->format('Ymd').'-PADEL1',
                'invoice_token' => substr(hash('sha256', 'demo-JNY-PADEL1'), 0, 32),
                'booking_date' => $tomorrow->toDateString(),
                'start_at' => $padelStart->utc(),
                'end_at' => $padelStart->addMinutes(60)->utc(),
                'buffer_end_at' => $padelStart->addMinutes(60)->utc(),
                'total_price' => $svcPadel->price,
                'dp_amount' => $svcPadel->calculateDpAmount(),
                'reservation_status' => 'confirmed',
                'payment_status' => 'dp_verified',
                'customer_notes' => 'Court 1',
            ]
        );
    }

    private function downloadDemoPhoto(string $relativePath, string $url): ?string
    {
        if (Storage::disk('public')->exists($relativePath)) {
            return $relativePath;
        }

        try {
            $response = Http::timeout(10)->get($url);
            if ($response->successful() && strlen($response->body()) > 500) {
                Storage::disk('public')->put($relativePath, $response->body());

                return $relativePath;
            }
        } catch (\Throwable) {
            // Fallback gracefully if offline
        }

        return null;
    }

    private function nextOpenDay(int $offsetDays): CarbonImmutable
    {
        $date = CarbonImmutable::now('Asia/Jakarta')->addDays($offsetDays)->startOfDay();
        while ($date->isSunday()) {
            $date = $date->addDay();
        }

        return $date;
    }
}
