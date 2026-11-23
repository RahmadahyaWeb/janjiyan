<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\BookingPayment;
use App\Models\Business;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Services\BookingLedgerService;
use App\Services\BookingNotificationService;
use App\Services\PlanLimitService;
use App\Services\SlotAvailabilityService;
use App\Support\CsvHelper;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
        abort_if(
            $business
            && ! $user->hasBusinessPermission($business, 'manage_bookings')
            && ! $user->hasBusinessPermission($business, 'verify_payments'),
            403
        );
        $business?->loadMissing('owner');
        $tz = $business?->timezone ?: 'Asia/Jakarta';

        $filters = $this->listFilters($request);
        $search = $filters['search'];

        $mode = $business ? $business->serviceBookingMode() : 'time_slot';
        $isDropoff = $business ? $business->isDropoff() : false;
        $isStaffAppointment = $business ? $business->isStaffAppointment() : true;
        $statusFilter = $this->sanitizeStatus($filters['status'], $mode);

        $todayDate = CarbonImmutable::now($tz)->toDateString();
        $cashierDate = $this->sanitizeDateString($request->string('cashier_date')->toString()) ?? $todayDate;
        $viewMode = ($request->string('view')->toString() === 'calendar' && ! $isDropoff) ? 'calendar' : 'list';
        $calendarDateString = $this->sanitizeDateString($request->string('calendar_date')->toString())
            ?? $todayDate;
        $openCashierId = $request->integer('open_cashier') ?: null;
        $openReceiptId = $request->integer('open_receipt') ?: null;

        $canVerifyPayments = $business ? $user->hasBusinessPermission($business, 'verify_payments') : false;
        $canViewCashierSummary = $business ? ($canVerifyPayments || $user->hasBusinessPermission($business, 'manage_settings')) : false;
        $canUseGoogleReview = $business ? $planLimitService->canUseGoogleReview($business->owner) : false;
        $canUseMultiServiceDropoff = $business ? $planLimitService->canUseMultiServiceDropoff($business->owner) : false;

        $dropoffStageCounts = null;
        $dropoffSlaCounts = null;
        if ($business && $isDropoff) {
            $activeDropoffRows = $business->bookings()
                ->where('booking_mode', 'dropoff')
                ->whereIn('reservation_status', ['pending', 'confirmed'])
                ->get(['work_status', 'estimated_ready_date']);

            $dropoffStageCounts = [
                'active' => $activeDropoffRows->count(),
                'awaiting_dropoff' => $activeDropoffRows->filter(fn ($r) => $r->work_status === null || $r->work_status === 'awaiting_dropoff')->count(),
                'in_progress' => $activeDropoffRows->filter(fn ($r) => $r->work_status === 'in_progress')->count(),
                'ready_for_pickup' => $activeDropoffRows->filter(fn ($r) => $r->work_status === 'ready_for_pickup')->count(),
            ];

            $dropoffSlaCounts = [
                'overdue' => $activeDropoffRows->filter(function ($r) use ($todayDate): bool {
                    if (! $r->estimated_ready_date) {
                        return false;
                    }
                    if (in_array($r->work_status, ['ready_for_pickup', 'picked_up'], true)) {
                        return false;
                    }

                    return $r->estimated_ready_date->toDateString() < $todayDate;
                })->count(),
                'due_today' => $activeDropoffRows->filter(function ($r) use ($todayDate): bool {
                    if (! $r->estimated_ready_date) {
                        return false;
                    }
                    if (in_array($r->work_status, ['ready_for_pickup', 'picked_up'], true)) {
                        return false;
                    }

                    return $r->estimated_ready_date->toDateString() === $todayDate;
                })->count(),
            ];
        }

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
            'service_summary' => $b->resolvedServiceSummary(),
            'service_assignment_mode' => $b->service->assignment_mode,
            'booking_mode' => $b->booking_mode ?? 'time_slot',
            'quantity' => (int) ($b->quantity ?? 1),
            'unit_label' => $b->resolvedUnitLabel(),
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
            'total_price' => (int) $b->total_price,
            'dp_amount' => (int) $b->dp_amount,
            'paid_amount' => (int) ($b->paid_amount ?? 0),
            'remaining_balance' => $b->remainingBalance(),
            'settled_at_local' => $b->settled_at?->setTimezone($tz)->format('d M Y, H:i'),
            'reservation_status' => $b->reservation_status,
            'payment_status' => $b->payment_status,
            'has_dp_proof' => filled($b->dp_proof_path),
            'dp_proof_url' => $b->dp_proof_path ? route('dashboard.bookings.proof', $b->id) : null,
            'dp_expires_at' => $b->dp_expires_at?->toIso8601String(),
            'dp_expires_at_local' => $b->dp_expires_at?->setTimezone($tz)->format('d M, H:i'),
            'customer_notes' => $b->customer_notes,
            'cancellation_reason' => $b->cancellation_reason,
            'rescheduled_count' => (int) ($b->rescheduled_count ?? 0),
            'items' => $this->serializeBookingItems($b),
            'payments' => $this->serializeBookingPayments($b, $tz, true),
            'review_url' => ($business && (bool) ($business->review_enabled ?? true) && $canUseGoogleReview && ! in_array($b->reservation_status, ['cancelled', 'no_show'], true))
                ? $this->buildReviewUrl($business, $b)
                : null,
        ];

        $isDropoffActiveQueue = $isDropoff
            && in_array($statusFilter, ['active', 'awaiting_dropoff', 'in_progress', 'ready_for_pickup'], true);
        $sortOrder = $filters['sort'];

        $paginatedBookings = $business
            ? $business->bookings()
                ->with([
                    'service',
                    'staff',
                    'items',
                    'payments.recordedBy',
                    'review',
                    'customer' => fn ($cq) => $cq->withCount([
                        'bookings as no_show_count' => fn ($bq) => $bq->where('reservation_status', 'no_show'),
                    ]),
                ])
                ->tap(fn ($q) => $this->applyListFilters($q, ['status' => $statusFilter] + $filters, $mode, $todayDate))
                ->when(
                    $sortOrder === 'upcoming',
                    fn ($q) => $q
                        ->orderBy('booking_date', 'asc')
                        ->orderBy('start_at', 'asc')
                        ->orderBy('id', 'asc'),
                    fn ($q) => $q->when(
                        $isDropoffActiveQueue && $sortOrder !== 'newest',
                        fn ($dq) => $dq
                            ->orderByRaw('CASE WHEN estimated_ready_date IS NULL THEN 1 ELSE 0 END ASC')
                            ->orderBy('estimated_ready_date', 'asc')
                            ->orderBy('booking_date', 'asc')
                            ->orderBy('id', 'asc'),
                        fn ($dq) => $dq
                            ->orderByDesc('booking_date')
                            ->orderByDesc('start_at')
                            ->orderByDesc('id')
                    )
                )
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
                    'items',
                    'payments.recordedBy',
                    'review',
                    'customer' => fn ($cq) => $cq->withCount([
                        'bookings as no_show_count' => fn ($bq) => $bq->where('reservation_status', 'no_show'),
                    ]),
                ])
                ->whereBookingDateBetween($weekStart->toDateString(), $weekEnd->toDateString())
                ->whereNotIn('reservation_status', ['cancelled'])
                ->when($filters['staff_id'], fn ($q) => $q->where('staff_id', $filters['staff_id']))
                ->when(
                    $filters['service_id'],
                    fn ($q) => $q->where(function ($sq) use ($filters): void {
                        $sq->where('service_id', $filters['service_id'])
                            ->orWhereHas('items', function ($iq) use ($filters): void {
                                $iq->where('item_type', BookingItem::TYPE_SERVICE)
                                    ->where('service_id', $filters['service_id']);
                            });
                    })
                )
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

        $staffColumns = ($business && $isStaffAppointment)
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

        $services = $this->getActiveBookingServices($business);
        $addons = $this->getActiveBookingAddons($business);

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
            'addons' => $addons,
            'canUseMultiServiceDropoff' => $canUseMultiServiceDropoff,
            'canVerifyPayments' => $canVerifyPayments,
            'canUseGoogleReview' => $canUseGoogleReview,
            'staffOptions' => $staffColumns,
            'filters' => [
                'status' => $statusFilter,
                'payment' => $filters['payment'],
                'staff_id' => $filters['staff_id'] ? (string) $filters['staff_id'] : '',
                'service_id' => $filters['service_id'] ? (string) $filters['service_id'] : '',
                'search' => $search,
                'date_from' => $filters['date_from'] ?? '',
                'date_to' => $filters['date_to'] ?? '',
                'sla' => $filters['sla'],
                'sort' => $filters['sort'],
                'mode' => $mode,
                'view' => $viewMode,
                'calendar_date' => $calendarDateString,
            ],
            'openCashierId' => $openCashierId,
            'openReceiptId' => $openReceiptId,
            'dropoffStageCounts' => $dropoffStageCounts,
            'dropoffSlaCounts' => $dropoffSlaCounts,
            'todayDate' => $todayDate,
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
            'businessPhone' => $business?->phone,
            'businessEmail' => $business?->owner?->email,
            'cashierUserName' => $user->name,
            'dailyCashierSummary' => $canViewCashierSummary && $business
                ? $this->buildDailyCashierSummary($business, $cashierDate, $planLimitService)
                : null,
            'whatsappTemplates' => $business
                ? $business->resolvedWhatsappTemplates()
                : Business::defaultWhatsappTemplates(),
            'canExportCsv' => $business ? $planLimitService->canExportCsv($business->owner) : false,
        ]);
    }

    public function create(Request $request, PlanLimitService $planLimitService): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $todayDate = CarbonImmutable::now($tz)->toDateString();

        $prefillDate = $this->sanitizeDateString($request->string('date')->toString());
        if ($prefillDate !== null && $prefillDate < $todayDate) {
            $prefillDate = null;
        }

        $rawTime = $request->string('time')->toString();
        $prefillTime = preg_match('/^\d{2}:\d{2}$/', $rawTime) === 1 ? $rawTime : '';

        $rawStaffId = $request->integer('staff_id') ?: null;
        $prefillStaffId = null;
        if ($rawStaffId !== null && $business->isStaffAppointment()) {
            $prefillStaffId = $business->staff()
                ->where('id', $rawStaffId)
                ->where('is_active', true)
                ->value('id');
        }

        $rawCustomerId = $request->integer('customer_id') ?: null;
        $prefillCustomer = null;
        if ($rawCustomerId !== null) {
            $cust = $business->customers()
                ->withCount([
                    'bookings',
                    'bookings as no_show_count' => fn ($bq) => $bq->where('reservation_status', 'no_show'),
                ])
                ->where('id', $rawCustomerId)
                ->first();
            if ($cust) {
                $prefillCustomer = [
                    'id' => $cust->id,
                    'name' => $cust->name,
                    'name_aliases' => is_array($cust->name_aliases) ? array_values($cust->name_aliases) : [],
                    'phone' => $cust->phone,
                    'email' => $cust->email,
                    'tags' => is_array($cust->tags) ? array_values($cust->tags) : [],
                    'is_blocked' => (bool) $cust->is_blocked,
                    'bookings_count' => (int) $cust->bookings_count,
                    'no_show_count' => (int) $cust->no_show_count,
                ];
            }
        }

        return Inertia::render('Dashboard/Bookings/Create', [
            'services' => $this->getActiveBookingServices($business),
            'addons' => $this->getActiveBookingAddons($business),
            'canUseMultiServiceDropoff' => $planLimitService->canUseMultiServiceDropoff($business->owner),
            'todayDate' => $todayDate,
            'prefill' => [
                'date' => $prefillDate,
                'time' => $prefillTime,
                'staff_id' => $prefillStaffId ? (string) $prefillStaffId : '',
                'customer' => $prefillCustomer,
            ],
        ]);
    }

    public function editReschedule(Request $request, Booking $booking): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $booking->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $todayDate = CarbonImmutable::now($tz)->toDateString();
        $booking->loadMissing(['service.staff' => fn ($q) => $q->where('staff.is_active', true), 'customer', 'staff']);

        return Inertia::render('Dashboard/Bookings/Reschedule', [
            'todayDate' => $todayDate,
            'booking' => [
                'id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'service_id' => $booking->service_id,
                'service_name' => $booking->service?->name ?? 'Layanan',
                'service_assignment_mode' => $booking->service?->assignment_mode ?? 'staff',
                'booking_mode' => $booking->booking_mode ?? ($booking->service?->booking_mode ?? 'time_slot'),
                'quantity' => (int) ($booking->quantity ?? 1),
                'unit_label' => $booking->resolvedUnitLabel(),
                'customer_name' => $booking->customer?->name ?? 'Pelanggan',
                'staff_id' => $booking->staff_id,
                'booking_date' => $booking->booking_date->toDateString(),
                'start_time_local' => $booking->start_at?->setTimezone($tz)->format('H:i') ?? '09:00',
            ],
            'staffOptions' => $business->isStaffAppointment() && $booking->service
                ? $booking->service->staff->map(fn ($st) => [
                    'id' => $st->id,
                    'name' => $st->name,
                    'title' => $st->title,
                ])->values()
                : [],
        ]);
    }

    public function editCancel(Request $request, Booking $booking): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $booking->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $booking->loadMissing(['service', 'customer']);

        return Inertia::render('Dashboard/Bookings/Cancel', [
            'booking' => [
                'id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer?->name ?? 'Pelanggan',
                'service_name' => $booking->service?->name ?? 'Layanan',
                'booking_date' => $booking->booking_date->toDateString(),
                'booking_mode' => $booking->booking_mode ?? 'time_slot',
                'quantity' => (int) ($booking->quantity ?? 1),
                'unit_label' => $booking->resolvedUnitLabel(),
                'start_time_local' => $booking->start_at?->setTimezone($tz)->format('H:i') ?? '',
            ],
        ]);
    }

    /**
     * Load active services and assigned active staff for manual booking forms.
     */
    private function getActiveBookingServices(?Business $business)
    {
        if (! $business) {
            return collect();
        }

        $isStaffAppointment = $business->isStaffAppointment();

        return $business->services()
            ->where('is_active', true)
            ->when($isStaffAppointment, fn ($q) => $q->with(['staff' => fn ($sq) => $sq->where('staff.is_active', true)]))
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
                'unit_label' => $s->resolvedUnitLabel(),
                'turnaround_days' => (int) ($s->turnaround_days ?? 1),
                'supports_pickup' => (bool) ($s->supports_pickup ?? false),
                'dp_amount' => $s->calculateDpAmount(),
                'staff' => $isStaffAppointment
                    ? $s->staff->map(fn ($st) => [
                        'id' => $st->id,
                        'name' => $st->name,
                        'title' => $st->title,
                    ])->values()
                    : [],
            ])
            ->values();
    }

    public function slots(Request $request, SlotAvailabilityService $slotService): JsonResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $this->normalizeAddonQueryInputs($request);

        $validated = $request->validate([
            'service_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'staff_id' => ['nullable', 'integer'],
            'exclude_booking_id' => ['nullable', 'integer'],
            'addons' => ['nullable', 'array', 'max:50'],
            'addons.*.service_addon_id' => ['nullable', 'integer'],
            'addons.*.id' => ['nullable', 'integer'],
            'addons.*.quantity' => ['nullable', 'integer', 'min:1', 'max:50'],
            'addon_ids' => ['nullable', 'array', 'max:50'],
            'addon_ids.*' => ['integer'],
        ]);

        $service = $business->services()
            ->where('id', $validated['service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $excludeBookingId = null;
        $extraDurationMinutes = 0;
        if (! empty($validated['exclude_booking_id'])) {
            // Strictly scope excluded booking ID to the active business
            $ownedBooking = $business->bookings()->with('items')->where('id', (int) $validated['exclude_booking_id'])->first();
            if ($ownedBooking) {
                $excludeBookingId = $ownedBooking->id;
                if (! $service->isDropoff()) {
                    $extraDurationMinutes = max(0, $ownedBooking->resolveTotalDurationMinutes() - (int) $service->duration_minutes);
                }
            }
        }

        if ($service->isDropoff()) {
            return response()->json([
                'booking_mode' => 'dropoff',
                'dropoff' => $slotService->getDropoffAvailability($business, $service, $validated['date'], true, $excludeBookingId),
                'slots' => [],
            ]);
        }

        $addonRequests = ! empty($validated['addons'])
            ? $validated['addons']
            : ($validated['addon_ids'] ?? []);

        if ($addonRequests !== []) {
            try {
                $extraDurationMinutes += $slotService->calculateExtraDurationForAddons($business, $service, $addonRequests);
            } catch (RuntimeException $e) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'slots' => [],
                ], 422);
            }
        }

        $slots = $slotService->getAvailableSlots(
            $business,
            $service,
            $validated['date'],
            isset($validated['staff_id']) ? (int) $validated['staff_id'] : null,
            true,
            $excludeBookingId,
            $extraDurationMinutes
        );

        return response()->json([
            'slots' => $slots,
        ]);
    }

    public function store(
        Request $request,
        SlotAvailabilityService $slotService,
        PlanLimitService $planLimitService,
        BookingNotificationService $notificationService,
        BookingLedgerService $ledgerService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        if (! $planLimitService->canCreateMonthlyBooking($business)) {
            return back()->with('error', 'Kuota booking bulanan bisnis ini telah mencapai batas paket.');
        }

        $validated = $request->validate([
            'service_id' => ['nullable', 'required_without:services', 'integer'],
            'services' => ['nullable', 'required_without:service_id', 'array', 'min:1', 'max:50'],
            'services.*.service_id' => ['required', 'integer'],
            'services.*.quantity' => ['required', 'integer', 'min:1', 'max:50'],
            'addons' => ['nullable', 'array', 'max:50'],
            'addons.*.service_addon_id' => ['nullable', 'integer'],
            'addons.*.id' => ['nullable', 'integer'],
            'addons.*.quantity' => ['nullable', 'integer', 'min:1', 'max:50'],
            'addon_ids' => ['nullable', 'array', 'max:50'],
            'addon_ids.*' => ['integer'],
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
            'payment_method' => ['nullable', Rule::in(BookingPayment::METHODS)],
            'received_amount' => ['nullable', 'integer', 'min:0'],
            'start_in_progress' => ['nullable', 'boolean'],
        ]);

        if ($validated['initial_payment_status'] !== 'unpaid') {
            abort_unless($user->hasBusinessPermission($business, 'verify_payments'), 403);
        }

        $serviceItems = ! empty($validated['services'])
            ? array_map(
                static fn (array $row): array => [
                    'service_id' => (int) $row['service_id'],
                    'quantity' => (int) $row['quantity'],
                ],
                $validated['services']
            )
            : [[
                'service_id' => (int) $validated['service_id'],
                'quantity' => (int) ($validated['quantity'] ?? 1),
            ]];

        $distinctServiceIds = collect($serviceItems)
            ->pluck('service_id')
            ->unique()
            ->values();

        $selectedServices = $business->services()
            ->whereIn('id', $distinctServiceIds->all())
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        if ($selectedServices->count() !== $distinctServiceIds->count()) {
            abort(404);
        }

        /** @var Service $primaryService */
        $primaryService = $selectedServices->get($distinctServiceIds->first());
        $isDropoff = $primaryService->isDropoff();
        $addonRequests = ! empty($validated['addons'])
            ? $validated['addons']
            : ($validated['addon_ids'] ?? []);

        if ($isDropoff) {
            if (! $selectedServices->every(fn (Service $s): bool => $s->isDropoff())) {
                return back()->with('error', 'Semua layanan yang dipilih harus berjenis drop-off.');
            }

            if ($distinctServiceIds->count() > 1 && ! $planLimitService->canUseMultiServiceDropoff($business->owner)) {
                return back()->with('error', 'Keranjang multi-layanan tersedia pada paket Professional dan Enterprise.');
            }

            $supportsPickupAny = $selectedServices->contains(fn (Service $s): bool => (bool) $s->supports_pickup);
            $fulfillmentType = $validated['fulfillment_type'] ?? 'dropoff';
            if ($supportsPickupAny && $fulfillmentType === 'pickup' && trim((string) ($validated['pickup_address'] ?? '')) === '') {
                return back()
                    ->withErrors(['pickup_address' => 'Alamat penjemputan wajib diisi untuk layanan Jemput & Antar.'])
                    ->withInput();
            }

            try {
                $booking = $slotService->reserveDropoffOrder(
                    business: $business,
                    serviceItems: $serviceItems,
                    dateString: $validated['date'],
                    fulfillmentType: $fulfillmentType,
                    pickupSession: $validated['pickup_session'] ?? 'anytime',
                    pickupAddress: $validated['pickup_address'] ?? null,
                    customerName: $validated['customer_name'],
                    customerPhone: $validated['customer_phone'],
                    customerEmail: $validated['customer_email'] ?? null,
                    customerNotes: $validated['customer_notes'] ?? null,
                    dpProofFile: null,
                    allowImmediateToday: true,
                    addonRequests: $addonRequests
                );
            } catch (RuntimeException $e) {
                return back()->with('error', $e->getMessage());
            }
        } else {
            if ($distinctServiceIds->count() > 1) {
                return back()->with('error', 'Pemesanan multi-layanan hanya tersedia untuk layanan drop-off.');
            }

            if (empty($validated['time'])) {
                $timePrompt = $business->isSpaceBooking() ? 'Jam sesi wajib dipilih.' : 'Jam reservasi wajib dipilih.';

                return back()
                    ->withErrors(['time' => $timePrompt])
                    ->withInput();
            }

            try {
                $booking = $slotService->reserveSlot(
                    business: $business,
                    service: $primaryService,
                    dateString: $validated['date'],
                    timeString: $validated['time'],
                    requestedStaffId: isset($validated['staff_id']) ? (int) $validated['staff_id'] : null,
                    customerName: $validated['customer_name'],
                    customerPhone: $validated['customer_phone'],
                    customerEmail: $validated['customer_email'] ?? null,
                    customerNotes: $validated['customer_notes'] ?? null,
                    dpProofFile: null,
                    allowImmediateToday: true,
                    addonRequests: $addonRequests
                );
            } catch (RuntimeException $e) {
                return back()->with('error', $e->getMessage());
            }
        }

        if ($validated['initial_payment_status'] !== 'unpaid') {
            $booking = $ledgerService->syncWalkinInitialPayment(
                $booking,
                $validated['initial_payment_status'],
                (string) ($validated['payment_method'] ?? BookingPayment::METHOD_CASH),
                $user,
                isset($validated['received_amount']) ? (int) $validated['received_amount'] : null
            );
        }

        if (
            $isDropoff
            && $request->boolean('start_in_progress')
            && ($validated['fulfillment_type'] ?? 'dropoff') === 'dropoff'
        ) {
            $booking->update([
                'work_status' => 'in_progress',
                'reservation_status' => 'confirmed',
            ]);
        }

        $notificationService->notifyCustomerStatusChanged(
            $booking,
            $booking->reservation_status === 'confirmed' ? 'confirmed' : 'created'
        );

        $flashMessage = $business->isDropoff()
            ? "Pesanan manual {$booking->booking_code} berhasil dibuat."
            : ($business->isSpaceBooking()
                ? "Booking manual {$booking->booking_code} berhasil dibuat."
                : "Reservasi manual {$booking->booking_code} berhasil dibuat.");

        $postAction = $request->string('post_action')->toString();
        if ($postAction === 'receipt') {
            return to_route('dashboard.bookings', ['open_receipt' => $booking->id])->with('success', $flashMessage);
        }
        if ($postAction === 'cashier') {
            return to_route('dashboard.bookings', ['open_cashier' => $booking->id])->with('success', $flashMessage);
        }

        return to_route('dashboard.bookings')->with('success', $flashMessage);
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
            'stay_on_page' => ['nullable', 'boolean'],
        ]);

        if (! $booking->isDropoff() && empty($validated['time'])) {
            $timePrompt = $business->isSpaceBooking() ? 'Jam sesi wajib dipilih.' : 'Jam reservasi wajib dipilih.';

            return back()
                ->withErrors(['time' => $timePrompt])
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

        if ($request->boolean('stay_on_page')) {
            return back()->with('success', $message);
        }

        return to_route('dashboard.bookings')->with('success', $message);
    }

    public function updateStatus(
        Request $request,
        Booking $booking,
        BookingNotificationService $notificationService,
        BookingLedgerService $ledgerService
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

        if ($booking->isDropoff() && ($validated['reservation_status'] ?? null) === 'no_show') {
            throw ValidationException::withMessages([
                'reservation_status' => 'Status Tidak Hadir (No-Show) tidak berlaku untuk layanan Drop-off.',
            ]);
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
        $requestedPaymentStatus = $validated['payment_status'] ?? null;
        if (in_array($requestedPaymentStatus, ['dp_verified', 'settled'], true)) {
            unset($validated['payment_status']);
        }

        $booking = DB::transaction(function () use ($booking, $validated, $requestedPaymentStatus, $ledgerService, $user): Booking {
            if (! empty($validated)) {
                $booking->update($validated);
            }

            if ($requestedPaymentStatus === 'dp_verified') {
                return $ledgerService->verifyDpPayment($booking, BookingPayment::METHOD_TRANSFER, $user);
            }

            if ($requestedPaymentStatus === 'settled') {
                return $ledgerService->settleRemainingFromStatusAction($booking, $user);
            }

            return $booking;
        });

        $newStatus = $booking->reservation_status;
        if ($newStatus !== $previousStatus && in_array($newStatus, ['confirmed', 'cancelled'], true)) {
            $notificationService->notifyCustomerStatusChanged($booking, $newStatus);
        }

        $noun = $booking->isDropoff() ? 'pesanan' : ($business->isSpaceBooking() ? 'booking' : 'reservasi');

        if ($request->boolean('redirect_to_index')) {
            return to_route('dashboard.bookings')->with('success', "Status {$noun} {$booking->booking_code} diperbarui.");
        }

        return back()->with('success', "Status {$noun} {$booking->booking_code} diperbarui.");
    }

    public function verifyDp(
        Request $request,
        Booking $booking,
        BookingNotificationService $notificationService,
        BookingLedgerService $ledgerService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $booking->business_id === $business->id && $user->hasBusinessPermission($business, 'verify_payments'), 403);

        $validated = $request->validate([
            'payment_method' => ['nullable', 'in:cash,qris,transfer,edc'],
        ]);

        $booking = $ledgerService->verifyDpPayment(
            $booking,
            (string) ($validated['payment_method'] ?? BookingPayment::METHOD_TRANSFER),
            $user
        );

        $notificationService->notifyCustomerStatusChanged($booking, 'dp_verified');

        $noun = $booking->isDropoff() ? 'pesanan' : ($business->isSpaceBooking() ? 'booking' : 'reservasi');

        return back()->with('success', "Uang muka untuk {$booking->booking_code} berhasil diverifikasi & {$noun} dikonfirmasi.");
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

    public function adjustItems(
        Request $request,
        Booking $booking,
        BookingLedgerService $ledgerService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business
            && $booking->business_id === $business->id
            && $user->hasBusinessPermission($business, 'verify_payments'),
            403
        );

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.item_type' => ['required', Rule::in(BookingItem::TYPES)],
            'items.*.service_id' => ['nullable', 'integer', 'required_if:items.*.item_type,service'],
            'items.*.service_addon_id' => ['nullable', 'integer', 'required_if:items.*.item_type,addon'],
            'items.*.name' => ['nullable', 'string', 'max:160', 'required_if:items.*.item_type,custom'],
            'items.*.unit_label' => ['nullable', 'string', Rule::in(Service::UNIT_LABELS)],
            'items.*.unit_price' => ['nullable', 'integer', 'min:0', 'required_if:items.*.item_type,custom'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.is_commissionable' => ['nullable', 'boolean'],
        ]);

        try {
            $updated = $ledgerService->adjustItems($booking, $validated['items']);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', "Daftar item untuk {$updated->booking_code} berhasil diperbarui.");
    }

    public function recordPayment(
        Request $request,
        Booking $booking,
        BookingLedgerService $ledgerService
    ): RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business
            && $booking->business_id === $business->id
            && $user->hasBusinessPermission($business, 'verify_payments'),
            403
        );

        $validated = $request->validate([
            'payment_type' => ['required', Rule::in(BookingPayment::TYPES)],
            'payment_method' => ['required', Rule::in(BookingPayment::METHODS)],
            'amount' => ['required', 'integer', 'min:0'],
            'received_amount' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
            'mark_completed' => ['nullable', 'boolean'],
        ]);

        try {
            $updated = $ledgerService->recordPayment($booking, $validated, $user);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        if (
            $request->boolean('mark_completed')
            && $updated->payment_status === 'settled'
            && ! in_array($updated->reservation_status, ['cancelled', 'no_show', 'completed'], true)
            && $user->hasBusinessPermission($business, 'manage_bookings')
        ) {
            $updated->update([
                'reservation_status' => 'completed',
                ...($updated->isDropoff() ? ['work_status' => 'picked_up'] : []),
            ]);
        }

        $actionLabel = $validated['payment_type'] === BookingPayment::TYPE_REFUND
            ? 'Refund'
            : 'Pembayaran';

        return back()->with('success', "{$actionLabel} untuk {$updated->booking_code} berhasil dicatat.");
    }

    public function cashierSummary(Request $request, PlanLimitService $planLimitService): JsonResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business
            && ($user->hasBusinessPermission($business, 'verify_payments') || $user->hasBusinessPermission($business, 'manage_settings')),
            403
        );

        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $dateString = $validated['date'] ?? CarbonImmutable::now($tz)->toDateString();

        return response()->json(
            $this->buildDailyCashierSummary($business, $dateString, $planLimitService)
        );
    }

    public function exportCashierCsv(Request $request, PlanLimitService $planLimitService): StreamedResponse|RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'verify_payments'), 403);

        if (! $planLimitService->canExportCsv($business->owner)) {
            return back()->with('error', 'Export CSV hanya tersedia pada paket Professional dan Enterprise.');
        }

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $today = CarbonImmutable::now($tz)->toDateString();

        $singleDate = $this->sanitizeDateString($request->string('date')->toString());
        $dateFrom = $this->sanitizeDateString($request->string('date_from')->toString());
        $dateTo = $this->sanitizeDateString($request->string('date_to')->toString());

        if ($singleDate !== null && $dateFrom === null && $dateTo === null) {
            $dateFrom = $singleDate;
            $dateTo = $singleDate;
        } else {
            $dateFrom ??= $today;
            $dateTo ??= $dateFrom;
        }

        if ($dateFrom > $dateTo) {
            [$dateFrom, $dateTo] = [$dateTo, $dateFrom];
        }

        $startUtc = CarbonImmutable::createFromFormat('!Y-m-d', $dateFrom, $tz)->startOfDay()->utc();
        $endExclusiveUtc = CarbonImmutable::createFromFormat('!Y-m-d', $dateTo, $tz)->startOfDay()->addDay()->utc();

        $paymentsQuery = BookingPayment::query()
            ->where('business_id', $business->id)
            ->where('paid_at', '>=', $startUtc)
            ->where('paid_at', '<', $endExclusiveUtc)
            ->with(['booking.customer', 'booking.service', 'booking.items', 'recordedBy'])
            ->orderBy('paid_at')
            ->orderBy('id');

        $typeLabels = [
            BookingPayment::TYPE_DP => 'Uang Muka',
            BookingPayment::TYPE_SETTLEMENT => 'Pelunasan',
            BookingPayment::TYPE_PARTIAL => 'Pembayaran Sebagian',
            BookingPayment::TYPE_ADJUSTMENT => 'Penyesuaian',
            BookingPayment::TYPE_REFUND => 'Pengembalian Dana',
        ];

        $methodLabels = [
            BookingPayment::METHOD_CASH => 'Tunai',
            BookingPayment::METHOD_QRIS => 'QRIS',
            BookingPayment::METHOD_TRANSFER => 'Transfer Bank',
            BookingPayment::METHOD_EDC => 'Kartu / EDC',
        ];

        $filenameSuffix = $dateFrom === $dateTo ? $dateFrom : "{$dateFrom}-to-{$dateTo}";

        return response()->streamDownload(function () use ($paymentsQuery, $tz, $typeLabels, $methodLabels): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Waktu Bayar',
                'No. Invoice',
                'Kode Booking',
                'Pelanggan',
                'Telepon',
                'Layanan / Ringkasan',
                'Jenis Pembayaran',
                'Metode Pembayaran',
                'Nominal (Rp)',
                'Diterima (Rp)',
                'Kembalian (Rp)',
                'Kasir',
                'Catatan',
            ]);

            foreach ($paymentsQuery->lazy(500) as $payment) {
                $booking = $payment->booking;
                fputcsv($handle, CsvHelper::sanitizeRow([
                    $payment->paid_at->setTimezone($tz)->format('Y-m-d H:i'),
                    $booking?->invoice_number ?? '-',
                    $booking?->booking_code ?? '-',
                    $booking?->customer?->name ?? '-',
                    $booking?->customer?->phone ?? '-',
                    $booking ? $booking->resolvedServiceSummary() : '-',
                    $typeLabels[$payment->payment_type] ?? $payment->payment_type,
                    $methodLabels[$payment->payment_method] ?? $payment->payment_method,
                    (int) $payment->amount,
                    $payment->received_amount !== null ? (int) $payment->received_amount : '',
                    (int) $payment->change_amount,
                    $payment->recordedBy?->name ?? '-',
                    $payment->notes ?? '',
                ]));
            }

            fclose($handle);
        }, "janjiyan-cashier-{$business->slug}-{$filenameSuffix}.csv");
    }

    public function exportCsv(Request $request, PlanLimitService $planLimitService): StreamedResponse|RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        if (! $planLimitService->canExportCsv($business->owner)) {
            return back()->with('error', 'Export CSV hanya tersedia pada paket Professional dan Enterprise.');
        }

        $filters = $this->listFilters($request);
        $mode = $business->serviceBookingMode();
        $filters['status'] = $this->sanitizeStatus($filters['status'], $mode);
        $filters['search'] = '';
        $tz = $business->timezone ?: 'Asia/Jakarta';
        $todayDate = CarbonImmutable::now($tz)->toDateString();

        $bookingsQuery = $this->applyListFilters(
            $business->bookings()->with(['service', 'staff', 'customer', 'items']),
            $filters,
            $mode,
            $todayDate
        )
            ->orderByDesc('booking_date')
            ->orderByDesc('start_at')
            ->orderByDesc('id');

        return response()->streamDownload(function () use ($bookingsQuery, $tz) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['No. Invoice', 'Booking Code', 'Tanggal', 'Jadwal / Jam', 'Jumlah', 'Satuan', 'Pelanggan', 'Telepon', 'Layanan', 'Staff', 'Total', 'Uang Muka', 'Status', 'Status Pembayaran']);
            foreach ($bookingsQuery->lazy(500) as $b) {
                fputcsv($handle, CsvHelper::sanitizeRow([
                    $b->invoice_number ?? '-',
                    $b->booking_code,
                    $b->booking_date->toDateString(),
                    $b->scheduleDisplayLabel($tz),
                    (int) ($b->quantity ?? 1),
                    $b->resolvedUnitLabel(),
                    $b->customer->name,
                    $b->customer->phone,
                    $b->resolvedServiceSummary(),
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

    /** Status tabs each booking mode shows on the bookings page. */
    private const MODE_STATUS_TABS = [
        'time_slot' => ['active', 'pending', 'confirmed', 'completed', 'no_show', 'cancelled', 'all'],
        'dropoff' => ['active', 'awaiting_dropoff', 'in_progress', 'ready_for_pickup', 'completed', 'cancelled', 'all'],
    ];

    /**
     * @return array{status: string, payment: string, staff_id: ?int, service_id: ?int, search: string, date_from: ?string, date_to: ?string, sla: string, sort: string}
     */
    private function listFilters(Request $request): array
    {
        $staffFilter = $request->integer('staff_id') ?: null;
        $serviceFilter = $request->integer('service_id') ?: null;
        $sla = $request->string('sla')->toString();
        $sla = in_array($sla, ['overdue', 'due_today'], true) ? $sla : '';
        $sort = $request->string('sort')->toString();
        $sort = in_array($sort, ['upcoming', 'newest'], true) ? $sort : '';

        $hasExplicitFilter = $request->has('status')
            || $request->filled('payment')
            || $request->filled('search')
            || $request->filled('date_from')
            || $request->filled('date_to')
            || $staffFilter !== null
            || $serviceFilter !== null;

        return [
            'status' => $request->has('status')
                ? $request->string('status')->toString()
                : ($hasExplicitFilter ? 'all' : 'active'),
            'payment' => $request->string('payment')->toString(),
            'staff_id' => $staffFilter,
            'service_id' => $serviceFilter,
            'search' => $request->string('search')->toString(),
            'date_from' => $this->sanitizeDateString($request->string('date_from')->toString()),
            'date_to' => $this->sanitizeDateString($request->string('date_to')->toString()),
            'sla' => $sla,
            'sort' => $sort,
        ];
    }

    private function sanitizeStatus(string $status, string $mode): string
    {
        return in_array($status, self::MODE_STATUS_TABS[$mode], true) ? $status : 'active';
    }

    /** Expects an already-sanitized status (see sanitizeStatus). */
    private function applyListFilters($query, array $filters, string $mode, string $todayDate = '')
    {
        $status = $this->sanitizeStatus($filters['status'], $mode);
        $search = $filters['search'];
        $sla = $mode === 'dropoff' ? ($filters['sla'] ?? '') : '';

        return $query
            ->when(
                in_array($status, ['active', 'awaiting_dropoff', 'in_progress', 'ready_for_pickup'], true),
                fn ($q) => $q->whereIn('reservation_status', ['pending', 'confirmed'])
            )
            ->when(
                $status === 'awaiting_dropoff',
                fn ($q) => $q->where(fn ($w) => $w->whereNull('work_status')->orWhere('work_status', 'awaiting_dropoff'))
            )
            ->when(
                in_array($status, ['in_progress', 'ready_for_pickup'], true),
                fn ($q) => $q->where('work_status', $status)
            )
            ->when(
                in_array($status, ['pending', 'confirmed', 'completed', 'no_show', 'cancelled'], true),
                fn ($q) => $q->where('reservation_status', $status)
            )
            ->when($sla !== '' && $todayDate !== '', function ($q) use ($sla, $todayDate): void {
                $q->whereIn('reservation_status', ['pending', 'confirmed'])
                    ->whereNotNull('estimated_ready_date')
                    ->where(fn ($w) => $w->whereNull('work_status')->orWhereIn('work_status', ['awaiting_dropoff', 'in_progress']));

                if ($sla === 'overdue') {
                    $q->whereDate('estimated_ready_date', '<', $todayDate);
                } elseif ($sla === 'due_today') {
                    $q->whereDate('estimated_ready_date', '=', $todayDate);
                }
            })
            ->when($filters['payment'], fn ($q) => $q->where('payment_status', $filters['payment']))
            ->when($filters['staff_id'], fn ($q) => $q->where('staff_id', $filters['staff_id']))
            ->when(
                $filters['service_id'],
                fn ($q) => $q->where(function ($sq) use ($filters): void {
                    $sq->where('service_id', $filters['service_id'])
                        ->orWhereHas('items', function ($iq) use ($filters): void {
                            $iq->where('item_type', BookingItem::TYPE_SERVICE)
                                ->where('service_id', $filters['service_id']);
                        });
                })
            )
            ->whereBookingDateBetween($filters['date_from'], $filters['date_to'])
            ->when($search, function ($q) use ($search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('booking_code', 'like', "%{$search}%")
                        ->orWhere('invoice_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
                });
            });
    }

    private function sanitizeDateString(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        $parsed = CarbonImmutable::createFromFormat('!Y-m-d', $value);

        return ($parsed && $parsed->format('Y-m-d') === $value) ? $value : null;
    }

    /**
     * Load active service add-ons for checkout and cashier flows.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function getActiveBookingAddons(?Business $business)
    {
        if (! $business) {
            return collect();
        }

        return $business->serviceAddons()
            ->where('is_active', true)
            ->with('services:id')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (ServiceAddon $addon): array => ServiceAddonController::serializeAddon($addon))
            ->values();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function serializeBookingItems(Booking $booking): array
    {
        return $booking->items->map(fn (BookingItem $item): array => [
            'id' => $item->id,
            'item_type' => $item->item_type,
            'service_id' => $item->service_id,
            'service_addon_id' => $item->service_addon_id,
            'name_snapshot' => $item->name_snapshot,
            'unit_label_snapshot' => $item->unit_label_snapshot,
            'unit_price' => (int) $item->unit_price,
            'quantity' => (int) $item->quantity,
            'duration_minutes_snapshot' => (int) $item->duration_minutes_snapshot,
            'turnaround_days_snapshot' => (int) $item->turnaround_days_snapshot,
            'is_commissionable' => (bool) $item->is_commissionable,
            'subtotal' => (int) $item->subtotal,
        ])->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function serializeBookingPayments(Booking $booking, string $timezone, bool $includeCashierName = true): array
    {
        return $booking->payments->map(fn (BookingPayment $payment): array => [
            'id' => $payment->id,
            'payment_type' => $payment->payment_type,
            'payment_method' => $payment->payment_method,
            'amount' => (int) $payment->amount,
            'received_amount' => $payment->received_amount !== null ? (int) $payment->received_amount : null,
            'change_amount' => (int) $payment->change_amount,
            'recorded_by_name' => $includeCashierName ? $payment->recordedBy?->name : null,
            'paid_at' => $payment->paid_at->toIso8601String(),
            'paid_at_local' => $payment->paid_at->setTimezone($timezone)->format('d M Y, H:i'),
            'notes' => $payment->notes,
        ])->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDailyCashierSummary(
        Business $business,
        string $dateString,
        PlanLimitService $planLimitService
    ): array {
        $tz = $business->timezone ?: 'Asia/Jakarta';
        $dayStartUtc = CarbonImmutable::createFromFormat('!Y-m-d', $dateString, $tz)->startOfDay()->utc();
        $nextDayStartUtc = CarbonImmutable::createFromFormat('!Y-m-d', $dateString, $tz)->startOfDay()->addDay()->utc();

        $rows = BookingPayment::query()
            ->where('business_id', $business->id)
            ->where('paid_at', '>=', $dayStartUtc)
            ->where('paid_at', '<', $nextDayStartUtc)
            ->groupBy('payment_method')
            ->selectRaw('payment_method')
            ->selectRaw('COUNT(*) as tx_count')
            ->selectRaw('COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as collected_sum')
            ->selectRaw('COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) as refunds_sum')
            ->selectRaw('COALESCE(SUM(amount), 0) as net_sum')
            ->get()
            ->keyBy('payment_method');

        $totalCollected = 0;
        $totalRefunds = 0;
        $netCollected = 0;
        $transactionsCount = 0;

        foreach ($rows as $row) {
            $totalCollected += (int) $row->collected_sum;
            $totalRefunds += (int) $row->refunds_sum;
            $netCollected += (int) $row->net_sum;
            $transactionsCount += (int) $row->tx_count;
        }

        $canViewBreakdown = $planLimitService->canUseDailyCashierBreakdown($business->owner);
        $canExportCsv = $planLimitService->canExportCsv($business->owner);

        $byMethod = [];
        foreach (BookingPayment::METHODS as $method) {
            $row = $rows->get($method);
            $byMethod[$method] = [
                'amount' => $canViewBreakdown ? (int) ($row->net_sum ?? 0) : 0,
                'count' => $canViewBreakdown ? (int) ($row->tx_count ?? 0) : 0,
            ];
        }

        return [
            'date' => $dateString,
            'total_collected' => $totalCollected,
            'total_refunds' => $totalRefunds,
            'net_collected' => $netCollected,
            'transactions_count' => $transactionsCount,
            'by_method' => $byMethod,
            'can_view_breakdown' => $canViewBreakdown,
            'can_export_csv' => $canExportCsv,
        ];
    }

    private function buildReviewUrl(Business $business, Booking $booking): string
    {
        $params = ['slug' => $business->slug];
        if ($booking->invoice_token) {
            $params['token'] = $booking->invoice_token;
        }

        if (Route::has('public.review.show')) {
            return route('public.review.show', $params);
        }

        $query = $booking->invoice_token ? '?token='.urlencode($booking->invoice_token) : '';

        return url("/b/{$business->slug}/review{$query}");
    }

    private function normalizeAddonQueryInputs(Request $request): void
    {
        $rawAddons = $request->input('addons');
        if (is_string($rawAddons) && trim($rawAddons) !== '') {
            $decoded = json_decode($rawAddons, true);
            if (is_array($decoded)) {
                $request->merge(['addons' => $decoded]);
            }
        }

        $rawAddonIds = $request->input('addon_ids');
        if (is_string($rawAddonIds) && trim($rawAddonIds) !== '') {
            $ids = array_values(array_filter(
                array_map('trim', explode(',', $rawAddonIds)),
                static fn (string $v): bool => $v !== ''
            ));
            $request->merge(['addon_ids' => $ids]);
        }
    }
}
