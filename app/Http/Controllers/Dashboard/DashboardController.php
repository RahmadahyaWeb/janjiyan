<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Business;
use App\Models\Service;
use App\Services\PlanLimitService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        if (! $business) {
            return Inertia::render('Dashboard/Index', [
                'stats' => [
                    'today_bookings' => 0,
                    'pending_dp' => 0,
                    'monthly_revenue' => 0,
                    'total_customers' => 0,
                ],
                'todayDate' => now('Asia/Jakarta')->toDateString(),
                'onboarding' => [
                    'has_services' => false,
                    'has_staff' => false,
                    'has_payment_info' => false,
                    'has_bookings' => false,
                ],
                'weeklyTrend' => [],
                'recentBookings' => [],
                'topServices' => [],
            ]);
        }

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $nowLocal = now($tz);
        $todayLocal = $nowLocal->toDateString();

        $todayBookingsCount = $business->bookings()
            ->whereBookingDate($todayLocal)
            ->whereIn('reservation_status', ['pending', 'confirmed', 'completed'])
            ->count();

        $pendingDpCount = $business->bookings()
            ->where('reservation_status', 'pending')
            ->where('payment_status', 'waiting_verification')
            ->count();

        $monthStartUtc = $nowLocal->copy()->startOfMonth()->utc();
        $monthEndUtc = $nowLocal->copy()->endOfMonth()->utc();

        $monthlyRevenue = (int) $business->bookings()
            ->whereBetween('created_at', [$monthStartUtc, $monthEndUtc])
            ->whereIn('payment_status', ['dp_verified', 'settled'])
            ->sum('total_price');

        $totalCustomers = $business->customers()->count();

        $recentBookings = $business->bookings()
            ->with(['service', 'staff', 'customer'])
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (Booking $b) => [
                'id' => $b->id,
                'booking_code' => $b->booking_code,
                'customer_name' => $b->customer->name,
                'customer_phone' => $b->customer->phone,
                'service_name' => $b->service->name,
                'staff_name' => $b->staff?->name,
                'booking_mode' => $b->booking_mode ?? 'time_slot',
                'quantity' => (int) ($b->quantity ?? 1),
                'fulfillment_type' => $b->fulfillment_type ?? 'dropoff',
                'work_status' => $b->work_status,
                'estimated_ready_date' => $b->estimated_ready_date?->toDateString(),
                'booking_date' => $b->booking_date->toDateString(),
                'start_time_local' => $b->start_at->setTimezone($tz)->format('H:i'),
                'total_price' => $b->total_price,
                'dp_amount' => $b->dp_amount,
                'reservation_status' => $b->reservation_status,
                'payment_status' => $b->payment_status,
            ]);

        $topServices = $business->services()
            ->withCount('bookings')
            ->orderByDesc('bookings_count')
            ->limit(5)
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'price' => $s->price,
                'bookings_count' => $s->bookings_count,
            ]);

        $onboarding = [
            'has_services' => $business->services()->where('is_active', true)->exists(),
            'has_staff' => $business->staff()->where('is_active', true)->exists(),
            'has_payment_info' => ! empty($business->bank_accounts) || ! empty($business->qris_path),
            'has_bookings' => $business->bookings()->exists(),
        ];

        $trendStart = now($tz)->subDays(6)->toDateString();
        $trendRows = $business->bookings()
            ->whereBookingDateBetween($trendStart, $todayLocal)
            ->whereIn('reservation_status', ['pending', 'confirmed', 'completed'])
            ->get(['booking_date', 'total_price', 'payment_status']);

        $shortDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        $weeklyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now($tz)->subDays($i);
            $dateStr = $day->toDateString();
            $dayBookings = $trendRows->filter(fn (Booking $b) => $b->booking_date->toDateString() === $dateStr);
            $weeklyTrend[] = [
                'date' => $dateStr,
                'label' => $shortDays[$day->dayOfWeek],
                'full_label' => $day->format('d/m'),
                'bookings_count' => $dayBookings->count(),
                'revenue' => (int) $dayBookings
                    ->whereIn('payment_status', ['dp_verified', 'settled'])
                    ->sum('total_price'),
            ];
        }

        return Inertia::render('Dashboard/Index', [
            'stats' => [
                'today_bookings' => $todayBookingsCount,
                'pending_dp' => $pendingDpCount,
                'monthly_revenue' => $monthlyRevenue,
                'total_customers' => $totalCustomers,
            ],
            'todayDate' => $todayLocal,
            'onboarding' => $onboarding,
            'weeklyTrend' => $weeklyTrend,
            'recentBookings' => $recentBookings,
            'topServices' => $topServices,
        ]);
    }

    public function switchBusiness(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'business_id' => ['required', 'integer'],
        ]);

        $user = $request->user();
        $business = $user->businesses()->where('businesses.id', $validated['business_id'])->firstOrFail();

        $user->update(['active_business_id' => $business->id]);

        return back()->with('success', "Berhasil beralih ke {$business->name}.");
    }

    public function createBusinessPage(): Response
    {
        return Inertia::render('Dashboard/Businesses/Create');
    }

    public function createBusiness(Request $request, PlanLimitService $planLimitService): RedirectResponse
    {
        $user = $request->user();
        if (! $planLimitService->canCreateBusiness($user)) {
            return back()->with('error', 'Jumlah bisnis sudah mencapai batas paket Anda. Silakan upgrade paket.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'category' => ['required', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $baseSlug = Str::slug($validated['name']) ?: 'bisnis';
        $slug = $baseSlug;
        $counter = 1;
        while (Business::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $business = Business::create([
            'owner_id' => $user->id,
            'name' => $validated['name'],
            'slug' => $slug,
            'category' => $validated['category'],
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'] ?? null,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
        ]);

        $business->users()->attach($user->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $business->seedDefaultOperatingHours();

        $user->update(['active_business_id' => $business->id]);

        return to_route('dashboard')->with('success', "Bisnis {$business->name} berhasil dibuat!");
    }

    public function destroyBusiness(Request $request, Business $business): RedirectResponse
    {
        $user = $request->user();
        abort_unless((int) $business->owner_id === (int) $user->id, 403);

        $validated = $request->validate([
            'confirm_name' => ['required', 'string'],
        ]);

        if (trim($validated['confirm_name']) !== $business->name) {
            throw ValidationException::withMessages([
                'confirm_name' => "Ketik persis \"{$business->name}\" untuk mengonfirmasi penghapusan bisnis.",
            ]);
        }

        $publicFiles = array_values(array_filter([
            $business->logo_path,
            $business->qris_path,
            ...$business->galleries()->pluck('image_path')->all(),
            ...$business->services()->pluck('image_path')->all(),
        ]));

        $privateFiles = array_values(array_filter(
            $business->bookings()->whereNotNull('dp_proof_path')->pluck('dp_proof_path')->all()
        ));

        $deletedName = $business->name;

        DB::transaction(function () use ($user, $business): void {
            $business->bookings()->delete();

            $business->services()->each(function (Service $service): void {
                $service->staff()->detach();
            });
            $business->services()->delete();

            $business->staff()->delete();
            $business->customers()->delete();
            $business->galleries()->delete();
            $business->operatingHours()->delete();
            $business->holidays()->delete();
            $business->users()->detach();

            $business->delete();

            $nextBusiness = $user->businesses()->first();
            $user->update(['active_business_id' => $nextBusiness?->id]);
        });

        foreach ($publicFiles as $path) {
            Storage::disk('public')->delete($path);
        }

        foreach ($privateFiles as $path) {
            Storage::disk('local')->delete($path);
        }

        return redirect()->route('dashboard')
            ->with('success', "Bisnis {$deletedName} beserta seluruh datanya berhasil dihapus.");
    }
}
