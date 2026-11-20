<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Business;
use App\Models\Service;
use App\Services\BookingNotificationService;
use App\Services\PlanLimitService;
use App\Services\SlotAvailabilityService;
use App\Support\CsvHelper;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingController extends Controller
{
    public function index(Request $request, PlanLimitService $planLimitService): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        $tz = $business?->timezone ?: 'Asia/Jakarta';

        $staffFilter = $request->integer('staff_id') ?: null;
        $serviceFilter = $request->integer('service_id') ?: null;

        $hasExplicitFilter = $request->has('status')
            || $request->filled('payment')
            || $request->filled('search')
            || $request->filled('date_from')
            || $request->filled('date_to')
            || $staffFilter !== null
            || $serviceFilter !== null;

        $statusFilter = $request->has('status')
            ? $request->string('status')->toString()
            : ($hasExplicitFilter ? 'all' : 'active');
        $paymentFilter = $request->string('payment')->toString();
        $search = $request->string('search')->toString();
        $dateFrom = $this->sanitizeDateString($request->string('date_from')->toString());
        $dateTo = $this->sanitizeDateString($request->string('date_to')->toString());
        $viewMode = $request->string('view')->toString() === 'calendar' ? 'calendar' : 'list';
        $calendarDateString = $this->sanitizeDateString($request->string('calendar_date')->toString())
            ?? CarbonImmutable::now($tz)->toDateString();

        $mapBooking = fn (Booking $b): array => [
            'id' => $b->id,
            'booking_code' => $b->booking_code,
            'invoice_number' => $b->invoice_number,
            'invoice_token' => $b->invoice_token,
            'invoice_url' => ($business && $b->invoice_token)
                ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $b->invoice_token])
                : null,
            'customer_id' => $b->customer_id,
            'customer_name' => $b->customer->name,
            'customer_phone' => $b->customer->phone,
            'customer_tags' => is_array($b->customer->tags) ? array_values($b->customer->tags) : [],
            'customer_no_show_count' => (int) ($b->customer->no_show_count ?? 0),
            'customer_is_blocked' => (bool) ($b->customer->is_blocked ?? false),
            'service_id' => $b->service_id,
            'service_name' => $b->service->name,
            'service_assignment_mode' => $b->service->assignment_mode,
            'booking_mode' => $b->booking_mode ?? 'time_slot',
            'quantity' => (int) ($b->quantity ?? 1),
            'fulfillment_type' => $b->fulfillment_type ?? 'dropoff',
            'pickup_session' => $b->pickup_session,
            'pickup_address' => $b->pickup_address,
            'estimated_ready_date' => $b->estimated_ready_date?->toDateString(),
            'work_status' => $b->work_status,
            'schedule_label' => $b->scheduleDisplayLabel($tz),
            'staff_id' => $b->staff_id,
            'staff_name' => $b->staff?->name,
            'booking_date' => $b->booking_date->toDateString(),
            'start_time_local' => $b->start_at->setTimezone($tz)->format('H:i'),
            'end_time_local' => $b->end_at->setTimezone($tz)->format('H:i'),
            'total_price' => $b->total_price,
            'dp_amount' => $b->dp_amount,
            'reservation_status' => $b->reservation_status,
            'payment_status' => $b->payment_status,
            'has_dp_proof' => filled($b->dp_proof_path),
            'dp_proof_url' => $b->dp_proof_path ? route('dashboard.bookings.proof', $b->id) : null,
            'dp_expires_at' => $b->dp_expires_at?->toIso8601String(),
            'customer_notes' => $b->customer_notes,
            'cancellation_reason' => $b->cancellation_reason,
            'rescheduled_count' => (int) ($b->rescheduled_count ?? 0),
        ];

        $paginatedBookings = $business
            ? $business->bookings()
                ->with([
                    'service',
                    'staff',
                    'customer' => fn ($cq) => $cq->withCount([
                        'bookings as no_show_count' => fn ($bq) => $bq->where('reservation_status', 'no_show'),
                    ]),
                ])
                ->when(
                    $statusFilter === 'active',
                    fn ($q) => $q->whereIn('reservation_status', ['pending', 'confirmed'])
                )
                ->when(
                    $statusFilter !== '' && $statusFilter !== 'all' && $statusFilter !== 'active',
                    fn ($q) => $q->where('reservation_status', $statusFilter)
                )
                ->when($paymentFilter, fn ($q) => $q->where('payment_status', $paymentFilter))
                ->when($staffFilter, fn ($q) => $q->where('staff_id', $staffFilter))
                ->when($serviceFilter, fn ($q) => $q->where('service_id', $serviceFilter))
                ->whereBookingDateBetween($dateFrom, $dateTo)
                ->when($search, function ($q) use ($search) {
                    $q->where(function ($sub) use ($search) {
                        $sub->where('booking_code', 'like', "%{$search}%")
                            ->orWhere('invoice_number', 'like', "%{$search}%")
                            ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
                    });
                })
                ->orderByDesc('booking_date')
                ->orderByDesc('start_at')
                ->orderByDesc('id')
                ->paginate(20)
                ->withQueryString()
                ->through($mapBooking)
            : null;

        // Build 7-day calendar week data around calendar_date (Monday -> Sunday)
        $selectedDate = CarbonImmutable::createFromFormat('Y-m-d', $calendarDateString, $tz)->startOfDay();
        $weekStart = $selectedDate->startOfWeek(CarbonImmutable::MONDAY);
        $weekEnd = $weekStart->addDays(6);

        $weekBookingsCollection = ($business && $viewMode === 'calendar')
            ? $business->bookings()
                ->with([
                    'service',
                    'staff',
                    'customer' => fn ($cq) => $cq->withCount([
                        'bookings as no_show_count' => fn ($bq) => $bq->where('reservation_status', 'no_show'),
                    ]),
                ])
                ->whereBookingDateBetween($weekStart->toDateString(), $weekEnd->toDateString())
                ->whereNotIn('reservation_status', ['cancelled'])
                ->orderBy('start_at')
                ->get()
            : collect();

        $weekCountsByDate = $weekBookingsCollection->groupBy(fn (Booking $b) => $b->booking_date->toDateString())
            ->map(fn ($group) => $group->count());

        $calendarDays = [];
        for ($i = 0; $i < 7; $i++) {
            $day = $weekStart->addDays($i);
            $dayStr = $day->toDateString();
            $calendarDays[] = [
                'date' => $dayStr,
                'day_of_week' => $day->dayOfWeek,
                'count' => (int) ($weekCountsByDate->get($dayStr) ?? 0),
            ];
        }

        $calendarDayBookings = $weekBookingsCollection
            ->filter(fn (Booking $b) => $b->booking_date->toDateString() === $calendarDateString)
            ->map($mapBooking)
            ->values();

        $staffColumns = $business
            ? $business->staff()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'title'])
                ->map(fn ($st) => [
                    'id' => $st->id,
                    'name' => $st->name,
                    'title' => $st->title,
                ])
                ->values()
            : collect();

        $dayOperatingHour = $business
            ? $business->operatingHours()->where('day_of_week', $selectedDate->dayOfWeek)->first()
            : null;

        $services = $business
            ? $business->services()
                ->where('is_active', true)
                ->with(['staff' => fn ($sq) => $sq->where('staff.is_active', true)])
                ->orderBy('name')
                ->get()
                ->map(fn (Service $s) => [
                    'id' => $s->id,
                    'name' => $s->name,
                    'price' => $s->price,
                    'duration_minutes' => $s->duration_minutes,
                    'capacity' => $s->capacity,
                    'assignment_mode' => $s->assignment_mode,
                    'booking_mode' => $s->booking_mode ?? 'time_slot',
                    'turnaround_days' => (int) ($s->turnaround_days ?? 1),
                    'supports_pickup' => (bool) ($s->supports_pickup ?? false),
                    'dp_amount' => $s->calculateDpAmount(),
                    'staff' => $s->staff->map(fn ($st) => [
                        'id' => $st->id,
                        'name' => $st->name,
                        'title' => $st->title,
                    ])->values(),
                ])
                ->values()
            : collect();

        return Inertia::render('Dashboard/Bookings/Index', [
            'bookings' => $paginatedBookings ? $paginatedBookings->items() : [],
            'pagination' => $paginatedBookings ? [
                'current_page' => $paginatedBookings->currentPage(),
                'last_page' => $paginatedBookings->lastPage(),
                'per_page' => $paginatedBookings->perPage(),
                'total' => $paginatedBookings->total(),
                'from' => $paginatedBookings->firstItem(),
                'to' => $paginatedBookings->lastItem(),
                'prev_page_url' => $paginatedBookings->previousPageUrl(),
                'next_page_url' => $paginatedBookings->nextPageUrl(),
            ] : null,
            'services' => $services,
            'staffOptions' => $staffColumns,
            'filters' => [
                'status' => $statusFilter,
                'payment' => $paymentFilter,
                'staff_id' => $staffFilter ? (string) $staffFilter : '',
                'service_id' => $serviceFilter ? (string) $serviceFilter : '',
                'search' => $search,
                'date_from' => $dateFrom ?? '',
                'date_to' => $dateTo ?? '',
                'view' => $viewMode,
                'calendar_date' => $calendarDateString,
            ],
            'calendar' => [
                'selected_date' => $calendarDateString,
                'days' => $calendarDays,
                'bookings' => $calendarDayBookings,
                'staff_columns' => $staffColumns,
                'open_time' => $dayOperatingHour?->open_time ?? '08:00',
                'close_time' => $dayOperatingHour?->close_time ?? '20:00',
                'is_open' => $dayOperatingHour ? (bool) $dayOperatingHour->is_open : true,
            ],
            'businessName' => $business?->name ?? 'Janjiyan',
            'businessAddress' => $business?->address ?? '',
            'whatsappTemplates' => $business ? $business->resolvedWhatsappTemplates() : Business::defaultWhatsappTemplates(),
            'canExportCsv' => $business ? $planLimitService->canExportCsv($business->owner) : false,
        ]);
    }

    public function slots(Request $request, SlotAvailabilityService $slotService): JsonResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $validated = $request->validate([
            'service_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'staff_id' => ['nullable', 'integer'],
            'exclude_booking_id' => ['nullable', 'integer'],
        ]);

        $service = $business->services()
            ->where('id', $validated['service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $excludeBookingId = null;
        if (! empty($validated['exclude_booking_id'])) {
            // Strictly scope excluded booking ID to the active business
            $ownedBooking = $business->bookings()->where('id', (int) $validated['exclude_booking_id'])->first();
            $excludeBookingId = $ownedBooking?->id;
        }

        if ($service->isDropoff()) {
            return response()->json([
                'booking_mode' => 'dropoff',
                'dropoff' => $slotService->getDropoffAvailability($business, $service, $validated['date'], true, $excludeBookingId),
                'slots' => [],
            ]);
        }

        $slots = $slotService->getAvailableSlots(
            $business,
            $service,
            $validated['date'],
            isset($validated['staff_id']) ? (int) $validated['staff_id'] : null,
            true,
            $excludeBookingId
        );

        return response()->json([
            'slots' => $slots,
        ]);
    }

    public function store(
        Request $request,
        SlotAvailabilityService $slotService,
        PlanLimitService $planLimitService,
        BookingNotificationService $notificationService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        if (! $planLimitService->canCreateMonthlyBooking($business)) {
            return back()->with('error', 'Kuota booking bulanan bisnis ini telah mencapai batas paket.');
        }

        $validated = $request->validate([
            'service_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['nullable', 'date_format:H:i'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:50'],
            'fulfillment_type' => ['nullable', 'in:dropoff,pickup'],
            'pickup_session' => ['nullable', 'in:morning,afternoon,evening,anytime'],
            'pickup_address' => ['nullable', 'string', 'max:500'],
            'staff_id' => ['nullable', 'integer'],
            'customer_name' => ['required', 'string', 'max:120'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_notes' => ['nullable', 'string', 'max:500'],
            'initial_payment_status' => ['required', 'in:unpaid,dp_verified,settled'],
        ]);

        if ($validated['initial_payment_status'] !== 'unpaid') {
            abort_unless($user->hasBusinessPermission($business, 'verify_payments'), 403);
        }

        $service = $business->services()
            ->where('id', $validated['service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        if ($service->isDropoff()) {
            $fulfillmentType = $validated['fulfillment_type'] ?? 'dropoff';
            if ($service->supports_pickup && $fulfillmentType === 'pickup' && trim((string) ($validated['pickup_address'] ?? '')) === '') {
                return back()
                    ->withErrors(['pickup_address' => 'Alamat penjemputan wajib diisi untuk layanan Jemput & Antar.'])
                    ->withInput();
            }

            try {
                $booking = $slotService->reserveDropoff(
                    $business,
                    $service,
                    $validated['date'],
                    (int) ($validated['quantity'] ?? 1),
                    $fulfillmentType,
                    $validated['pickup_session'] ?? 'anytime',
                    $validated['pickup_address'] ?? null,
                    $validated['customer_name'],
                    $validated['customer_phone'],
                    $validated['customer_email'] ?? null,
                    $validated['customer_notes'] ?? null,
                    null,
                    true
                );
            } catch (RuntimeException $e) {
                return back()->with('error', $e->getMessage());
            }
        } else {
            if (empty($validated['time'])) {
                return back()
                    ->withErrors(['time' => 'Jam reservasi wajib dipilih.'])
                    ->withInput();
            }

            try {
                $booking = $slotService->reserveSlot(
                    $business,
                    $service,
                    $validated['date'],
                    $validated['time'],
                    isset($validated['staff_id']) ? (int) $validated['staff_id'] : null,
                    $validated['customer_name'],
                    $validated['customer_phone'],
                    $validated['customer_email'] ?? null,
                    $validated['customer_notes'] ?? null,
                    null,
                    true
                );
            } catch (RuntimeException $e) {
                return back()->with('error', $e->getMessage());
            }
        }

        if ($validated['initial_payment_status'] !== 'unpaid') {
            $booking->update([
                'payment_status' => $validated['initial_payment_status'],
                'reservation_status' => 'confirmed',
                'dp_expires_at' => null,
            ]);
        }

        $notificationService->notifyCustomerStatusChanged(
            $booking,
            $booking->reservation_status === 'confirmed' ? 'confirmed' : 'created'
        );

        return back()->with('success', "Reservasi manual {$booking->booking_code} berhasil dibuat.");
    }

    public function reschedule(
        Request $request,
        Booking $booking,
        SlotAvailabilityService $slotService,
        BookingNotificationService $notificationService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $booking->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['nullable', 'date_format:H:i'],
            'staff_id' => ['nullable', 'integer'],
        ]);

        if (! $booking->isDropoff() && empty($validated['time'])) {
            return back()
                ->withErrors(['time' => 'Jam reservasi wajib dipilih.'])
                ->withInput();
        }

        try {
            $updated = $slotService->rescheduleBooking(
                $booking,
                $validated['date'],
                $validated['time'] ?? null,
                isset($validated['staff_id']) ? (int) $validated['staff_id'] : null,
                true
            );
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $notificationService->notifyCustomerStatusChanged($updated, 'rescheduled');

        $message = $updated->isDropoff()
            ? "Tanggal drop-off {$updated->booking_code} berhasil diubah ke {$validated['date']}."
            : "Jadwal reservasi {$updated->booking_code} berhasil diubah ke {$validated['date']} pukul {$validated['time']}.";

        return back()->with('success', $message);
    }

    public function updateStatus(
        Request $request,
        Booking $booking,
        BookingNotificationService $notificationService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $booking->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $validated = $request->validate([
            'reservation_status' => ['sometimes', 'in:pending,confirmed,completed,cancelled,no_show'],
            'work_status' => ['sometimes', 'in:awaiting_dropoff,in_progress,ready_for_pickup,picked_up'],
            'payment_status' => ['sometimes', 'in:unpaid,waiting_verification,dp_verified,settled'],
            'cancellation_reason' => ['nullable', 'string', 'max:255'],
        ]);

        if (isset($validated['payment_status']) && in_array($validated['payment_status'], ['dp_verified', 'settled'], true)) {
            abort_unless($user->hasBusinessPermission($business, 'verify_payments'), 403);
        }

        if ($booking->isDropoff()) {
            if (isset($validated['work_status'])) {
                if ($validated['work_status'] === 'picked_up' && ! isset($validated['reservation_status'])) {
                    $validated['reservation_status'] = 'completed';
                } elseif (
                    in_array($validated['work_status'], ['in_progress', 'ready_for_pickup'], true)
                    && $booking->reservation_status === 'pending'
                    && ! isset($validated['reservation_status'])
                ) {
                    $validated['reservation_status'] = 'confirmed';
                }
            } elseif (isset($validated['reservation_status']) && $validated['reservation_status'] === 'completed') {
                $validated['work_status'] = 'picked_up';
            }
        }

        $previousStatus = $booking->reservation_status;
        $booking->update($validated);

        $newStatus = $booking->reservation_status;
        if ($newStatus !== $previousStatus && in_array($newStatus, ['confirmed', 'cancelled'], true)) {
            $notificationService->notifyCustomerStatusChanged($booking, $newStatus);
        }

        return back()->with('success', "Status reservasi {$booking->booking_code} diperbarui.");
    }

    public function verifyDp(
        Request $request,
        Booking $booking,
        BookingNotificationService $notificationService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $booking->business_id === $business->id && $user->hasBusinessPermission($business, 'verify_payments'), 403);

        $booking->update([
            'payment_status' => 'dp_verified',
            'reservation_status' => $booking->reservation_status === 'pending' ? 'confirmed' : $booking->reservation_status,
            'dp_expires_at' => null,
        ]);

        $notificationService->notifyCustomerStatusChanged($booking, 'dp_verified');

        return back()->with('success', "DP untuk {$booking->booking_code} berhasil diverifikasi & reservasi dikonfirmasi.");
    }

    public function proof(Request $request, Booking $booking): BinaryFileResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless(
            $business
            && $booking->business_id === $business->id
            && ($user->hasBusinessPermission($business, 'verify_payments') || $user->hasBusinessPermission($business, 'manage_bookings')),
            403
        );
        abort_unless($booking->dp_proof_path && Storage::disk('local')->exists($booking->dp_proof_path), 404);

        return response()->file(Storage::disk('local')->path($booking->dp_proof_path), [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    public function exportCsv(Request $request, PlanLimitService $planLimitService): StreamedResponse|RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        if (! $planLimitService->canExportCsv($business->owner)) {
            return back()->with('error', 'Export CSV hanya tersedia pada paket Professional dan Enterprise.');
        }

        $staffFilter = $request->integer('staff_id') ?: null;
        $serviceFilter = $request->integer('service_id') ?: null;

        $hasExplicitFilter = $request->has('status')
            || $request->filled('payment')
            || $request->filled('search')
            || $request->filled('date_from')
            || $request->filled('date_to')
            || $staffFilter !== null
            || $serviceFilter !== null;

        $statusFilter = $request->has('status')
            ? $request->string('status')->toString()
            : ($hasExplicitFilter ? 'all' : 'active');
        $paymentFilter = $request->string('payment')->toString();
        $dateFrom = $this->sanitizeDateString($request->string('date_from')->toString());
        $dateTo = $this->sanitizeDateString($request->string('date_to')->toString());

        $bookingsQuery = $business->bookings()
            ->with(['service', 'staff', 'customer'])
            ->when(
                $statusFilter === 'active',
                fn ($q) => $q->whereIn('reservation_status', ['pending', 'confirmed'])
            )
            ->when(
                $statusFilter !== '' && $statusFilter !== 'all' && $statusFilter !== 'active',
                fn ($q) => $q->where('reservation_status', $statusFilter)
            )
            ->when($paymentFilter, fn ($q) => $q->where('payment_status', $paymentFilter))
            ->when($staffFilter, fn ($q) => $q->where('staff_id', $staffFilter))
            ->when($serviceFilter, fn ($q) => $q->where('service_id', $serviceFilter))
            ->whereBookingDateBetween($dateFrom, $dateTo)
            ->orderByDesc('booking_date')
            ->orderByDesc('start_at')
            ->orderByDesc('id');

        $tz = $business->timezone ?: 'Asia/Jakarta';

        return response()->streamDownload(function () use ($bookingsQuery, $tz) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['No. Invoice', 'Booking Code', 'Tanggal', 'Jadwal / Jam', 'Jumlah', 'Pelanggan', 'Telepon', 'Layanan', 'Staff', 'Total', 'DP', 'Status Reservasi', 'Status Pembayaran']);
            foreach ($bookingsQuery->lazy(500) as $b) {
                fputcsv($handle, CsvHelper::sanitizeRow([
                    $b->invoice_number ?? '-',
                    $b->booking_code,
                    $b->booking_date->toDateString(),
                    $b->scheduleDisplayLabel($tz),
                    (int) ($b->quantity ?? 1),
                    $b->customer->name,
                    $b->customer->phone,
                    $b->service->name,
                    $b->staff?->name ?? '-',
                    $b->total_price,
                    $b->dp_amount,
                    $b->reservation_status,
                    $b->payment_status,
                ]));
            }
            fclose($handle);
        }, "janjiyan-bookings-{$business->slug}.csv");
    }

    private function sanitizeDateString(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        $parsed = CarbonImmutable::createFromFormat('!Y-m-d', $value);

        return ($parsed && $parsed->format('Y-m-d') === $value) ? $value : null;
    }
}
