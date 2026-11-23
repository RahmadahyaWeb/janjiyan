<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\BookingPayment;
use App\Models\Business;
use App\Models\BusinessGallery;
use App\Models\BusinessHoliday;
use App\Models\BusinessReview;
use App\Models\Customer;
use App\Models\Service;
use App\Models\ServiceAddon;
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

        // 5. Business #1: Staff Appointment Mode (Barbershop)
        $barbershop = Business::updateOrCreate(
            ['slug' => 'rapi-studio'],
            [
                'owner_id' => $owner->id,
                'name' => 'Rapi Studio Barbershop',
                'category' => 'Barbershop & Salon',
                'business_type' => Business::TYPE_STAFF_APPOINTMENT,
                'description' => 'Barbershop modern dengan layanan potong rambut presisi, grooming, dan perawatan pria.',
                'phone' => '6281234567890',
                'address' => 'Jl. Kemang Raya No. 45, Jakarta Selatan',
                'timezone' => 'Asia/Jakarta',
                'logo_path' => $barberLogoPath,
                'google_review_url' => 'https://g.page/r/rapi-studio-demo/review',
                'review_redirect_min_rating' => 4,
                'review_enabled' => true,
                'review_sticker_subtitle' => 'Puas dengan potongan hari ini? Scan & beri bintang 5!',
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

        // 6. Business #2: Space Booking Mode (Sports Court)
        $padelArena = Business::updateOrCreate(
            ['slug' => 'arena-padel'],
            [
                'owner_id' => $owner->id,
                'name' => 'Arena Padel & Badminton',
                'category' => 'Lapangan & Olahraga',
                'business_type' => Business::TYPE_SPACE_BOOKING,
                'description' => 'Penyewaan lapangan padel dan badminton indoor dengan sistem booking slot per jam.',
                'phone' => '6281298765432',
                'address' => 'Jl. Senopati No. 12, Jakarta Selatan',
                'timezone' => 'Asia/Jakarta',
                'logo_path' => $padelLogoPath,
                'google_review_url' => 'https://maps.app.goo.gl/ArenaPadelDemo',
                'review_redirect_min_rating' => 4,
                'review_enabled' => true,
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

        // 7. Business #3: Drop-off Mode (Shoe & Bag Care)
        $soklenn = Business::updateOrCreate(
            ['slug' => 'soklenn-shoes'],
            [
                'owner_id' => $owner->id,
                'name' => 'Soklenn Cuci Sepatu & Tas',
                'category' => 'Cuci Sepatu & Tas',
                'business_type' => Business::TYPE_DROPOFF,
                'description' => 'Spesialis cuci sepatu, tas, dan unyellowing midsole dengan layanan jemput-antar area Jakarta Selatan.',
                'phone' => '6281277778888',
                'address' => 'Jl. Dharmawangsa No. 88, Jakarta Selatan',
                'timezone' => 'Asia/Jakarta',
                'google_review_url' => 'https://www.google.com/maps/search/?api=1&query=Soklenn+Cuci+Sepatu',
                'review_redirect_min_rating' => 4,
                'review_enabled' => true,
                'review_sticker_subtitle' => 'Sepatu makin bersih? Bagikan ulasan Anda!',
                'dp_expiry_minutes' => 120,
                'min_booking_lead_minutes' => 0,
                'max_booking_advance_days' => 30,
                'reminder_h1_enabled' => true,
                'reminder_h2_enabled' => false,
                'bank_accounts' => [
                    [
                        'bank_name' => 'BCA',
                        'account_number' => '7710293847',
                        'account_holder' => 'Soklenn Care Indonesia',
                    ],
                ],
                'is_active' => true,
            ]
        );
        $soklenn->seedDefaultOperatingHours();
        $soklenn->users()->syncWithoutDetaching([
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

        // 8. Services
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
                'booking_mode' => 'time_slot',
                'unit_label' => Service::DEFAULT_UNIT_LABEL,
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
                'booking_mode' => 'time_slot',
                'unit_label' => Service::DEFAULT_UNIT_LABEL,
                'dp_type' => 'percentage',
                'dp_value' => 50,
                'is_active' => true,
            ]
        );
        $svcGrooming->staff()->sync([$staffAndi->id, $staffBima->id]);

        $svcBasicCut = Service::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Express Cut (Tanpa Uang Muka)'],
            [
                'description' => 'Potong rambut cepat tanpa keramas, bayar di tempat.',
                'image_path' => $svcExpressPath,
                'price' => 50000,
                'duration_minutes' => 30,
                'buffer_minutes' => 0,
                'capacity' => 1,
                'assignment_mode' => 'staff',
                'booking_mode' => 'time_slot',
                'unit_label' => Service::DEFAULT_UNIT_LABEL,
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
                'booking_mode' => 'time_slot',
                'unit_label' => Service::DEFAULT_UNIT_LABEL,
                'dp_type' => 'fixed',
                'dp_value' => 100000,
                'is_active' => true,
            ]
        );

        $svcRegularShoes = Service::updateOrCreate(
            ['business_id' => $soklenn->id, 'name' => 'Regular Clean Sepatu'],
            [
                'description' => 'Pembersihan menyeluruh upper, midsole, dan tali sepatu dengan cairan khusus aman material.',
                'price' => 35000,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 8,
                'assignment_mode' => 'capacity',
                'booking_mode' => 'dropoff',
                'turnaround_days' => 3,
                'supports_pickup' => true,
                'unit_label' => 'pasang',
                'dp_type' => 'none',
                'dp_value' => 0,
                'is_active' => true,
            ]
        );

        $svcDeepShoes = Service::updateOrCreate(
            ['business_id' => $soklenn->id, 'name' => 'Deep Clean & Unyellowing'],
            [
                'description' => 'Cuci mendalam plus treatment penghilang noda kuning pada midsole dan outsole.',
                'price' => 65000,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 5,
                'assignment_mode' => 'capacity',
                'booking_mode' => 'dropoff',
                'turnaround_days' => 5,
                'supports_pickup' => true,
                'unit_label' => 'pasang',
                'dp_type' => 'fixed',
                'dp_value' => 20000,
                'is_active' => true,
            ]
        );

        $svcBagClean = Service::updateOrCreate(
            ['business_id' => $soklenn->id, 'name' => 'Cuci Tas Kanvas & Kulit'],
            [
                'description' => 'Perawatan khusus tas ransel, totebag kanvas, hingga leather conditioning.',
                'price' => 55000,
                'duration_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 4,
                'assignment_mode' => 'capacity',
                'booking_mode' => 'dropoff',
                'turnaround_days' => 4,
                'supports_pickup' => false,
                'unit_label' => 'pcs',
                'dp_type' => 'percentage',
                'dp_value' => 50,
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
            ['name' => 'Hendra Kusuma', 'phone' => '6281255556666', 'email' => null, 'notes' => 'Pernah no-show 1x, wajib uang muka sebelum konfirmasi.'],
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

        // Drop-off bookings across all 4 work statuses for Business #3 (soklenn-shoes)
        $dropoffCustomersData = [
            ['name' => 'Nadia Kusuma', 'phone' => '6281310002001', 'email' => 'nadia@example.test', 'notes' => 'Sneakers putih, minta ekstra hati-hati di bagian suede.'],
            ['name' => 'Bagus Prasetyo', 'phone' => '6281310002002', 'email' => 'bagus@example.test', 'notes' => null],
            ['name' => 'Tari Wulandari', 'phone' => '6281310002003', 'email' => 'tari@example.test', 'notes' => 'Biasa ambil sore hari setelah jam kerja.'],
            ['name' => 'Rendi Saputra', 'phone' => '6281310002004', 'email' => null, 'notes' => 'Pelanggan tetap bulanan.'],
        ];

        $dropoffCustomers = [];
        foreach ($dropoffCustomersData as $dc) {
            $dropoffCustomers[] = Customer::updateOrCreate(
                ['business_id' => $soklenn->id, 'phone' => $dc['phone']],
                [
                    'name' => $dc['name'],
                    'email' => $dc['email'],
                    'notes' => $dc['notes'],
                ]
            );
        }

        $dropoffDemoBookings = [
            [
                'code' => 'JNY-DROP01',
                'service' => $svcDeepShoes,
                'customer' => $dropoffCustomers[0],
                'date' => $today,
                'quantity' => 2,
                'fulfillment_type' => 'pickup',
                'pickup_session' => 'morning',
                'pickup_address' => 'Jl. Panglima Polim IX No. 14, Jakarta Selatan',
                'reservation_status' => 'pending',
                'work_status' => 'awaiting_dropoff',
                'payment_status' => 'waiting_verification',
                'dp_proof_path' => $dummyProofPath,
                'notes' => '2 pasang Nike Air Force & New Balance 550.',
            ],
            [
                'code' => 'JNY-DROP02',
                'service' => $svcRegularShoes,
                'customer' => $dropoffCustomers[1],
                'date' => $today,
                'quantity' => 3,
                'fulfillment_type' => 'dropoff',
                'pickup_session' => null,
                'pickup_address' => null,
                'reservation_status' => 'confirmed',
                'work_status' => 'in_progress',
                'payment_status' => 'unpaid',
                'dp_proof_path' => null,
                'notes' => 'Sepatu lari 3 pasang.',
            ],
            [
                'code' => 'JNY-DROP03',
                'service' => $svcBagClean,
                'customer' => $dropoffCustomers[2],
                'date' => $yesterday,
                'quantity' => 1,
                'fulfillment_type' => 'dropoff',
                'pickup_session' => null,
                'pickup_address' => null,
                'reservation_status' => 'confirmed',
                'work_status' => 'ready_for_pickup',
                'payment_status' => 'dp_verified',
                'dp_proof_path' => $dummyProofPath,
                'notes' => 'Tas kanvas warna krem.',
            ],
            [
                'code' => 'JNY-DROP04',
                'service' => $svcDeepShoes,
                'customer' => $dropoffCustomers[3],
                'date' => $yesterday,
                'quantity' => 1,
                'fulfillment_type' => 'pickup',
                'pickup_session' => 'afternoon',
                'pickup_address' => 'Jl. Cipete Raya No. 22, Jakarta Selatan',
                'reservation_status' => 'completed',
                'work_status' => 'picked_up',
                'payment_status' => 'settled',
                'dp_proof_path' => null,
                'notes' => 'Sudah diantar kembali ke rumah.',
            ],
        ];

        foreach ($dropoffDemoBookings as $dItem) {
            /** @var CarbonImmutable $dDate */
            $dDate = $dItem['date'];
            /** @var Service $dService */
            $dService = $dItem['service'];
            $dStart = $dDate->setTime(9, 0);
            $dEnd = $dDate->setTime(18, 0);
            $qty = $dItem['quantity'];
            $estimatedReady = $dDate->addDays(max(0, (int) $dService->turnaround_days))->toDateString();

            Booking::updateOrCreate(
                ['booking_code' => $dItem['code']],
                [
                    'business_id' => $soklenn->id,
                    'service_id' => $dService->id,
                    'staff_id' => null,
                    'customer_id' => $dItem['customer']->id,
                    'booked_customer_name' => $dItem['customer']->name,
                    'booked_customer_email' => $dItem['customer']->email,
                    'booking_mode' => 'dropoff',
                    'quantity' => $qty,
                    'unit_label' => $dService->resolvedUnitLabel(),
                    'fulfillment_type' => $dItem['fulfillment_type'],
                    'pickup_session' => $dItem['pickup_session'],
                    'pickup_address' => $dItem['pickup_address'],
                    'invoice_number' => 'INV-'.$dDate->format('Ymd').'-'.substr($dItem['code'], 4),
                    'invoice_token' => substr(hash('sha256', 'demo-'.$dItem['code']), 0, 32),
                    'booking_date' => $dDate->toDateString(),
                    'start_at' => $dStart->utc(),
                    'end_at' => $dEnd->utc(),
                    'buffer_end_at' => $dEnd->utc(),
                    'estimated_ready_date' => $estimatedReady,
                    'total_price' => $dService->price * $qty,
                    'dp_amount' => $dService->calculateDpAmount() * $qty,
                    'reservation_status' => $dItem['reservation_status'],
                    'work_status' => $dItem['work_status'],
                    'payment_status' => $dItem['payment_status'],
                    'dp_proof_path' => $dItem['dp_proof_path'],
                    'dp_expires_at' => null,
                    'customer_notes' => $dItem['notes'],
                ]
            );
        }

        // 9. v2.2 Service Add-ons across all 3 business types
        $addonCreambath = ServiceAddon::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Creambath & Pijat Kepala'],
            [
                'description' => 'Perawatan kulit kepala menyegarkan selama 15 menit.',
                'price' => 35000,
                'unit_label' => 'item',
                'duration_minutes' => 15,
                'is_commissionable' => true,
                'applies_to_all_services' => true,
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        $addonPomade = ServiceAddon::updateOrCreate(
            ['business_id' => $barbershop->id, 'name' => 'Pomade Matte Clay 100g'],
            [
                'description' => 'Produk styling rambut matte hold tahan lama (non-komisi).',
                'price' => 75000,
                'unit_label' => 'pcs',
                'duration_minutes' => 0,
                'is_commissionable' => false,
                'applies_to_all_services' => true,
                'is_active' => true,
                'sort_order' => 2,
            ]
        );

        $addonRacket = ServiceAddon::updateOrCreate(
            ['business_id' => $padelArena->id, 'name' => 'Sewa Raket Padel Carbon'],
            [
                'description' => 'Sewa raket carbon per sesi permainan.',
                'price' => 45000,
                'unit_label' => 'unit',
                'duration_minutes' => 0,
                'is_commissionable' => false,
                'applies_to_all_services' => true,
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        $addonExtraTime = ServiceAddon::updateOrCreate(
            ['business_id' => $padelArena->id, 'name' => 'Perpanjangan Sesi 30 Menit'],
            [
                'description' => 'Tambahan durasi sewa lapangan 30 menit.',
                'price' => 125000,
                'unit_label' => 'item',
                'duration_minutes' => 30,
                'is_commissionable' => false,
                'applies_to_all_services' => false,
                'is_active' => true,
                'sort_order' => 2,
            ]
        );
        $addonExtraTime->services()->sync([$svcPadel->id]);

        $addonCoating = ServiceAddon::updateOrCreate(
            ['business_id' => $soklenn->id, 'name' => 'Anti-Waterproof Coating'],
            [
                'description' => 'Pelapis pelindung air dan noda agar sepatu awet bersih.',
                'price' => 25000,
                'unit_label' => 'pasang',
                'duration_minutes' => 0,
                'is_commissionable' => false,
                'applies_to_all_services' => true,
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        ServiceAddon::updateOrCreate(
            ['business_id' => $soklenn->id, 'name' => 'Parfum & Silica Gel Pack'],
            [
                'description' => 'Anti-lembap dan pengharum ekstra untuk penyimpanan sepatu.',
                'price' => 10000,
                'unit_label' => 'pcs',
                'duration_minutes' => 0,
                'is_commissionable' => false,
                'applies_to_all_services' => true,
                'is_active' => true,
                'sort_order' => 2,
            ]
        );

        // 10. Multi-service drop-off demo order & itemized booking_items + booking_payments backfill for demo bookings
        $multiDropBooking = Booking::updateOrCreate(
            ['booking_code' => 'JNY-DROP05'],
            [
                'business_id' => $soklenn->id,
                'service_id' => $svcRegularShoes->id,
                'staff_id' => null,
                'customer_id' => $dropoffCustomers[0]->id,
                'booked_customer_name' => $dropoffCustomers[0]->name,
                'booked_customer_email' => $dropoffCustomers[0]->email,
                'booking_mode' => 'dropoff',
                'quantity' => 3,
                'unit_label' => 'item',
                'fulfillment_type' => 'dropoff',
                'invoice_number' => 'INV-'.$today->format('Ymd').'-DROP05',
                'invoice_token' => substr(hash('sha256', 'demo-JNY-DROP05'), 0, 32),
                'booking_date' => $today->toDateString(),
                'start_at' => $today->setTime(9, 0)->utc(),
                'end_at' => $today->setTime(18, 0)->utc(),
                'buffer_end_at' => $today->setTime(18, 0)->utc(),
                'estimated_ready_date' => $today->addDays(4)->toDateString(),
                'total_price' => 150000,
                'dp_amount' => 27500,
                'paid_amount' => 150000,
                'reservation_status' => 'confirmed',
                'work_status' => 'in_progress',
                'payment_status' => 'settled',
                'settled_at' => now()->subMinutes(20),
                'customer_notes' => '2 pasang sepatu lari + 1 tas kanvas + coating waterproof.',
            ]
        );

        if (! $multiDropBooking->items()->exists()) {
            BookingItem::create([
                'booking_id' => $multiDropBooking->id,
                'item_type' => BookingItem::TYPE_SERVICE,
                'service_id' => $svcRegularShoes->id,
                'name_snapshot' => $svcRegularShoes->name,
                'unit_label_snapshot' => 'pasang',
                'unit_price' => $svcRegularShoes->price,
                'quantity' => 2,
                'duration_minutes_snapshot' => 0,
                'turnaround_days_snapshot' => $svcRegularShoes->turnaround_days,
                'is_commissionable' => true,
                'subtotal' => $svcRegularShoes->price * 2,
            ]);
            BookingItem::create([
                'booking_id' => $multiDropBooking->id,
                'item_type' => BookingItem::TYPE_SERVICE,
                'service_id' => $svcBagClean->id,
                'name_snapshot' => $svcBagClean->name,
                'unit_label_snapshot' => 'pcs',
                'unit_price' => $svcBagClean->price,
                'quantity' => 1,
                'duration_minutes_snapshot' => 0,
                'turnaround_days_snapshot' => $svcBagClean->turnaround_days,
                'is_commissionable' => true,
                'subtotal' => $svcBagClean->price,
            ]);
            BookingItem::create([
                'booking_id' => $multiDropBooking->id,
                'item_type' => BookingItem::TYPE_ADDON,
                'service_addon_id' => $addonCoating->id,
                'name_snapshot' => $addonCoating->name,
                'unit_label_snapshot' => $addonCoating->unit_label,
                'unit_price' => $addonCoating->price,
                'quantity' => 1,
                'duration_minutes_snapshot' => 0,
                'turnaround_days_snapshot' => 0,
                'is_commissionable' => false,
                'subtotal' => $addonCoating->price,
            ]);
        }

        if (! $multiDropBooking->payments()->exists()) {
            BookingPayment::create([
                'booking_id' => $multiDropBooking->id,
                'business_id' => $soklenn->id,
                'payment_type' => BookingPayment::TYPE_SETTLEMENT,
                'payment_method' => BookingPayment::METHOD_QRIS,
                'amount' => 150000,
                'received_amount' => 150000,
                'change_amount' => 0,
                'recorded_by_user_id' => $owner->id,
                'paid_at' => now()->subMinutes(20),
                'notes' => 'Pelunasan QRIS di konter',
            ]);
        }

        // Backfill booking_items & today's cashier payments for other demo bookings if empty
        $allDemoBookings = Booking::whereIn('business_id', [$barbershop->id, $padelArena->id, $soklenn->id])
            ->with('service')
            ->get();

        foreach ($allDemoBookings as $demoBooking) {
            if (! $demoBooking->items()->exists() && $demoBooking->service) {
                $svc = $demoBooking->service;
                $qty = max(1, (int) $demoBooking->quantity);
                BookingItem::create([
                    'booking_id' => $demoBooking->id,
                    'item_type' => BookingItem::TYPE_SERVICE,
                    'service_id' => $svc->id,
                    'name_snapshot' => $svc->name,
                    'unit_label_snapshot' => $svc->resolvedUnitLabel(),
                    'unit_price' => (int) $svc->price,
                    'quantity' => $qty,
                    'duration_minutes_snapshot' => $demoBooking->isDropoff() ? 0 : (int) $svc->duration_minutes,
                    'turnaround_days_snapshot' => $demoBooking->isDropoff() ? (int) ($svc->turnaround_days ?? 1) : 0,
                    'is_commissionable' => true,
                    'subtotal' => (int) $demoBooking->total_price,
                ]);
            }

            if (! $demoBooking->payments()->exists()) {
                if ($demoBooking->payment_status === 'settled' && (int) $demoBooking->total_price > 0) {
                    $paidAt = $demoBooking->booking_code === 'JNY-DEMO05' ? now()->subMinutes(45) : now()->subMinutes(30);
                    BookingPayment::create([
                        'booking_id' => $demoBooking->id,
                        'business_id' => $demoBooking->business_id,
                        'payment_type' => BookingPayment::TYPE_SETTLEMENT,
                        'payment_method' => $demoBooking->booking_code === 'JNY-DEMO05'
                            ? BookingPayment::METHOD_CASH
                            : BookingPayment::METHOD_EDC,
                        'amount' => (int) $demoBooking->total_price,
                        'received_amount' => $demoBooking->booking_code === 'JNY-DEMO05'
                            ? (int) $demoBooking->total_price + 15000
                            : (int) $demoBooking->total_price,
                        'change_amount' => $demoBooking->booking_code === 'JNY-DEMO05' ? 15000 : 0,
                        'recorded_by_user_id' => $owner->id,
                        'paid_at' => $paidAt,
                        'notes' => 'Pelunasan kasir demo',
                    ]);
                    $demoBooking->update([
                        'paid_amount' => (int) $demoBooking->total_price,
                        'settled_at' => $paidAt,
                    ]);
                } elseif ($demoBooking->payment_status === 'dp_verified' && (int) $demoBooking->dp_amount > 0) {
                    BookingPayment::create([
                        'booking_id' => $demoBooking->id,
                        'business_id' => $demoBooking->business_id,
                        'payment_type' => BookingPayment::TYPE_DP,
                        'payment_method' => BookingPayment::METHOD_TRANSFER,
                        'amount' => (int) $demoBooking->dp_amount,
                        'received_amount' => (int) $demoBooking->dp_amount,
                        'change_amount' => 0,
                        'recorded_by_user_id' => $owner->id,
                        'paid_at' => now()->subMinutes(15),
                        'notes' => 'Verifikasi uang muka demo',
                    ]);
                    $demoBooking->update([
                        'paid_amount' => (int) $demoBooking->dp_amount,
                        'settled_at' => null,
                    ]);
                }
            }
        }

        // Attach sample add-on items to completed JNY-DEMO05 if still 1 item
        $demo05 = Booking::where('booking_code', 'JNY-DEMO05')->first();
        if ($demo05 && $demo05->items()->count() === 1) {
            BookingItem::create([
                'booking_id' => $demo05->id,
                'item_type' => BookingItem::TYPE_ADDON,
                'service_addon_id' => $addonCreambath->id,
                'name_snapshot' => $addonCreambath->name,
                'unit_label_snapshot' => $addonCreambath->unit_label,
                'unit_price' => $addonCreambath->price,
                'quantity' => 1,
                'duration_minutes_snapshot' => $addonCreambath->duration_minutes,
                'turnaround_days_snapshot' => 0,
                'is_commissionable' => true,
                'subtotal' => $addonCreambath->price,
            ]);
            BookingItem::create([
                'booking_id' => $demo05->id,
                'item_type' => BookingItem::TYPE_ADDON,
                'service_addon_id' => $addonPomade->id,
                'name_snapshot' => $addonPomade->name,
                'unit_label_snapshot' => $addonPomade->unit_label,
                'unit_price' => $addonPomade->price,
                'quantity' => 1,
                'duration_minutes_snapshot' => 0,
                'turnaround_days_snapshot' => 0,
                'is_commissionable' => false,
                'subtotal' => $addonPomade->price,
            ]);
            $newTotal = (int) $demo05->items()->sum('subtotal');
            $delta = max(0, $newTotal - (int) $demo05->paid_amount);
            if ($delta > 0) {
                BookingPayment::create([
                    'booking_id' => $demo05->id,
                    'business_id' => $barbershop->id,
                    'payment_type' => BookingPayment::TYPE_SETTLEMENT,
                    'payment_method' => BookingPayment::METHOD_QRIS,
                    'amount' => $delta,
                    'received_amount' => $delta,
                    'change_amount' => 0,
                    'recorded_by_user_id' => $owner->id,
                    'paid_at' => now()->subMinutes(10),
                    'notes' => 'Tambahan creambath & pomade di kasir',
                ]);
            }
            $demo05->update([
                'total_price' => $newTotal,
                'paid_amount' => $newTotal,
                'payment_status' => 'settled',
                'settled_at' => now()->subMinutes(10),
            ]);
        }

        // 11. Demo Google & Private Reviews
        if ($demo05) {
            BusinessReview::updateOrCreate(
                ['booking_id' => $demo05->id],
                [
                    'business_id' => $barbershop->id,
                    'customer_id' => $demo05->customer_id,
                    'reviewer_name' => $demo05->customer->name,
                    'reviewer_phone' => $demo05->customer->phone,
                    'rating' => 5,
                    'comment' => 'Potongannya super rapi, pijat kepala nyaman banget, dan kasir langsung kirim struk digital ke WA!',
                    'redirected_to_google' => true,
                ]
            );
        }

        if (! BusinessReview::where('business_id', $barbershop->id)->where('rating', '<', 4)->exists()) {
            BusinessReview::create([
                'business_id' => $barbershop->id,
                'booking_id' => null,
                'customer_id' => $customers[2]->id ?? null,
                'reviewer_name' => 'Farhan Maulana',
                'reviewer_phone' => '6281200010003',
                'rating' => 2,
                'comment' => 'Ruang tunggu agak ramai sore tadi dan AC kurang dingin, mohon diperhatikan ya.',
                'redirected_to_google' => false,
            ]);
        }

        $drop04 = Booking::where('booking_code', 'JNY-DROP04')->first();
        if ($drop04) {
            BusinessReview::updateOrCreate(
                ['booking_id' => $drop04->id],
                [
                    'business_id' => $soklenn->id,
                    'customer_id' => $drop04->customer_id,
                    'reviewer_name' => $drop04->customer->name,
                    'reviewer_phone' => $drop04->customer->phone,
                    'rating' => 5,
                    'comment' => 'Sepatu putih kembali kinclong seperti baru dan antar-jemput tepat waktu.',
                    'redirected_to_google' => true,
                ]
            );
        }

        if (! BusinessReview::where('business_id', $padelArena->id)->exists()) {
            BusinessReview::create([
                'business_id' => $padelArena->id,
                'booking_id' => null,
                'customer_id' => $padelCustomer->id,
                'reviewer_name' => 'Dimas Padel',
                'reviewer_phone' => '6281399990001',
                'rating' => 5,
                'comment' => 'Karpet lapangan mantap, pencahayaan indoor terang, dan sewa raketnya praktis.',
                'redirected_to_google' => true,
            ]);
        }
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
