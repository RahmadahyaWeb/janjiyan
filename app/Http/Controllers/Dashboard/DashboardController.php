<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Business;
use App\Models\Service;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
                'todaySchedule' => [],
                'dropoffPipeline' => null,
                'topServices' => [],
            ]);
        }

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $nowLocal = now($tz);
        // Revenue and setup steps are owner/manager matters; plain staff don't receive them at all.
        $canManage = $user->hasBusinessPermission($business, 'manage_settings');
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

        $mapOverviewBooking = fn (Booking $b): array => [
            'id' => $b->id,
            'booking_code' => $b->booking_code,
            'customer_name' => $b->customer->name,
            'customer_phone' => $b->customer->phone,
            'service_name' => $b->resolvedServiceSummary(),
            'staff_name' => $b->staff?->name,
            'booking_mode' => $b->booking_mode ?? 'time_slot',
            'quantity' => (int) ($b->quantity ?? 1),
            'unit_label' => $b->resolvedUnitLabel(),
            'fulfillment_type' => $b->fulfillment_type ?? 'dropoff',
            'work_status' => $b->work_status,
            'estimated_ready_date' => $b->estimated_ready_date?->toDateString(),
            'booking_date' => $b->booking_date->toDateString(),
            'start_time_local' => $b->start_at->setTimezone($tz)->format('H:i'),
            'total_price' => $b->total_price,
            'dp_amount' => $b->dp_amount,
            'reservation_status' => $b->reservation_status,
            'payment_status' => $b->payment_status,
        ];

        $recentBookings = $business->bookings()
            ->with(['service', 'staff', 'customer', 'items'])
            ->latest()
            ->limit(8)
            ->get()
            ->map($mapOverviewBooking);

        $isDropoff = $business->isDropoff();
        $todaySchedule = $isDropoff
            ? $business->bookings()
                ->with(['service', 'staff', 'customer', 'items'])
                ->where('booking_mode', 'dropoff')
                ->whereIn('reservation_status', ['pending', 'confirmed'])
                ->orderByRaw('CASE WHEN estimated_ready_date IS NULL THEN 1 ELSE 0 END ASC')
                ->orderBy('estimated_ready_date', 'asc')
                ->orderBy('booking_date', 'asc')
                ->orderBy('id', 'asc')
                ->limit(8)
                ->get()
                ->map($mapOverviewBooking)
            : $business->bookings()
                ->with(['service', 'staff', 'customer', 'items'])
                ->whereBookingDate($todayLocal)
                ->whereIn('reservation_status', ['pending', 'confirmed'])
                ->orderBy('start_at', 'asc')
                ->limit(8)
                ->get()
                ->map($mapOverviewBooking);

        $dropoffPipeline = null;
        if ($isDropoff) {
            $activeDropoffRows = $business->bookings()
                ->where('booking_mode', 'dropoff')
                ->whereIn('reservation_status', ['pending', 'confirmed'])
                ->get(['work_status', 'estimated_ready_date']);

            $dropoffPipeline = [
                'awaiting_dropoff' => $activeDropoffRows->filter(fn ($r) => $r->work_status === null || $r->work_status === 'awaiting_dropoff')->count(),
                'in_progress' => $activeDropoffRows->filter(fn ($r) => $r->work_status === 'in_progress')->count(),
                'ready_for_pickup' => $activeDropoffRows->filter(fn ($r) => $r->work_status === 'ready_for_pickup')->count(),
                'overdue' => $activeDropoffRows->filter(function ($r) use ($todayLocal): bool {
                    if (! $r->estimated_ready_date || in_array($r->work_status, ['ready_for_pickup', 'picked_up'], true)) {
                        return false;
                    }

                    return $r->estimated_ready_date->toDateString() < $todayLocal;
                })->count(),
            ];
        }

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
            'has_payment_info' => ! empty($business->bank_accounts) || ! empty($business->qris_path),
            'has_bookings' => $business->bookings()->exists(),
        ];

        if ($business->supportsStaffScheduling()) {
            $onboarding['has_staff'] = $business->staff()->where('is_active', true)->exists();
        }

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
                'revenue' => $canManage
                    ? (int) $dayBookings->whereIn('payment_status', ['dp_verified', 'settled'])->sum('total_price')
                    : null,
            ];
        }

        return Inertia::render('Dashboard/Index', [
            'stats' => [
                'today_bookings' => $todayBookingsCount,
                'pending_dp' => $pendingDpCount,
                'monthly_revenue' => $canManage ? $monthlyRevenue : null,
                'total_customers' => $totalCustomers,
            ],
            'todayDate' => $todayLocal,
            'onboarding' => $canManage ? $onboarding : null,
            'weeklyTrend' => $weeklyTrend,
            'recentBookings' => $recentBookings,
            'todaySchedule' => $todaySchedule,
            'dropoffPipeline' => $dropoffPipeline,
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
            $business->cover_path,
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
                $service->addons()->detach();
            });
            $business->serviceAddons()->each(function ($addon): void {
                $addon->services()->detach();
            });
            $business->serviceAddons()->delete();
            $business->services()->delete();
            $business->reviews()->delete();

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
