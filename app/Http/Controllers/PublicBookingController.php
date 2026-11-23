<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Dashboard\ServiceAddonController;
use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\BookingPayment;
use App\Models\Business;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Services\BookingNotificationService;
use App\Services\IcsCalendarService;
use App\Services\PlanLimitService;
use App\Services\SlotAvailabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class PublicBookingController extends Controller
{
    /**
     * Loads an active business for the public pages, or returns the 403 "unavailable" page if it is suspended.
     */
    private function loadPublicBusiness(Request $request, string $slug, array $with): Business|SymfonyResponse
    {
        $business = Business::where('slug', $slug)
            ->where('is_active', true)
            ->with(['owner', ...$with])
            ->firstOrFail();

        if ($business->isSuspended()) {
            return Inertia::render('Public/BusinessUnavailable', [
                'businessName' => $business->name,
                'reason' => $business->suspension_reason,
            ])->toResponse($request)->setStatusCode(403);
        }

        $businessToday = now($business->timezone ?: 'Asia/Jakarta')->toDateString();
        $business->setRelation(
            'holidays',
            $business->holidays()->whereDate('date', '>=', $businessToday)->get()
        );

        return $business;
    }

    private function bookingNoun(Business $business): string
    {
        return match ($business->resolvedBusinessType()) {
            Business::TYPE_DROPOFF => 'pesanan',
            Business::TYPE_SPACE_BOOKING => 'booking',
            default => 'reservasi',
        };
    }

    private function bookingDisabledReason(Business $business, PlanLimitService $planLimitService): ?string
    {
        if ($planLimitService->hasActiveSubscription($business->owner)) {
            return null;
        }

        return match ($business->resolvedBusinessType()) {
            Business::TYPE_DROPOFF => 'Pemesanan online untuk bisnis ini sementara ditutup karena masa langganan merchant telah berakhir.',
            Business::TYPE_SPACE_BOOKING => 'Booking online untuk bisnis ini sementara ditutup karena masa langganan merchant telah berakhir.',
            default => 'Reservasi online untuk bisnis ini sementara ditutup karena masa langganan merchant telah berakhir.',
        };
    }

    public function show(Request $request, string $slug, PlanLimitService $planLimitService): Response|SymfonyResponse
    {
        $business = $this->loadPublicBusiness($request, $slug, [
            'services' => fn ($q) => $q->where('is_active', true),
            'galleries',
            'operatingHours',
        ]);
        if ($business instanceof SymfonyResponse) {
            return $business;
        }

        $firstGallery = $business->galleries->first()?->image_path;
        $firstServiceImage = $business->services->firstWhere('image_path', '!=', null)?->image_path;
        $coverPath = $business->cover_path ?: ($firstGallery ?: $firstServiceImage);
        $businessType = $business->resolvedBusinessType();

        $seoTitle = match ($businessType) {
            Business::TYPE_DROPOFF => "{$business->name} — Pesan Layanan Online | Janjiyan",
            Business::TYPE_SPACE_BOOKING => "{$business->name} — Booking Online | Janjiyan",
            default => "{$business->name} — Reservasi Online | Janjiyan",
        };

        $seoDescriptionFallback = match ($businessType) {
            Business::TYPE_DROPOFF => "Pesan layanan drop-off {$business->name} ({$business->category}) secara online dengan kuota harian dan estimasi selesai real-time di Janjiyan.",
            Business::TYPE_SPACE_BOOKING => "Booking tempat atau sesi di {$business->name} ({$business->category}) secara online dengan ketersediaan real-time di Janjiyan.",
            default => "Buat janji temu di {$business->name} ({$business->category}) secara online dengan jadwal real-time di Janjiyan.",
        };

        return Inertia::render('Public/BusinessHome', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'category' => $business->category,
                'business_type' => $businessType,
                'description' => $business->description,
                'phone' => $business->phone,
                'address' => $business->address,
                'timezone' => $business->timezone,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
                'brand_color' => $business->brand_color,
                'cover_url' => $coverPath ? Storage::url($coverPath) : null,
            ],
            'services' => $business->services->map(fn (Service $service) => [
                'id' => $service->id,
                'name' => $service->name,
                'image_url' => $service->image_path ? Storage::url($service->image_path) : null,
                'price' => $service->price,
                'duration_minutes' => $service->duration_minutes,
                'capacity' => (int) $service->capacity,
                'booking_mode' => $service->booking_mode ?? 'time_slot',
                'turnaround_days' => (int) ($service->turnaround_days ?? 1),
                'supports_pickup' => (bool) ($service->supports_pickup ?? false),
                'unit_label' => $service->resolvedUnitLabel(),
                'dp_amount' => $service->calculateDpAmount(),
            ])->values(),
            // The photo already used as the cover band is not repeated in the strip.
            'galleries' => $business->galleries
                ->reject(fn ($g) => $g->image_path === $coverPath)
                ->map(fn ($g) => [
                    'id' => $g->id,
                    'image_url' => Storage::url($g->image_path),
                    'caption' => $g->caption,
                ])->values(),
            'operatingHours' => $business->operatingHours,
            'holidays' => $business->holidays->pluck('date')->map(fn ($d) => $d->toDateString())->values(),
            'bookingDisabledReason' => $this->bookingDisabledReason($business, $planLimitService),
        ])->withViewData('seo', [
            'title' => $seoTitle,
            'description' => $business->description ?: $seoDescriptionFallback,
            'image' => $business->logo_path ? url(Storage::url($business->logo_path)) : url('/og-default.png'),
            'url' => route('public.booking', $business->slug),
        ]);
    }

    public function booking(Request $request, string $slug, PlanLimitService $planLimitService): Response|SymfonyResponse
    {
        $business = $this->loadPublicBusiness($request, $slug, [
            'services' => fn ($q) => $q->where('is_active', true),
            'serviceAddons' => fn ($q) => $q
                ->where('is_active', true)
                ->with('services:id')
                ->orderBy('sort_order')
                ->orderBy('id'),
            'operatingHours',
        ]);
        if ($business instanceof SymfonyResponse) {
            return $business;
        }

        $isStaffAppointment = $business->isStaffAppointment();
        if ($isStaffAppointment) {
            $business->services->load(['staff' => fn ($sq) => $sq->where('is_active', true)]);
        }

        $businessType = $business->resolvedBusinessType();
        $seoTitle = match ($businessType) {
            Business::TYPE_DROPOFF => "Titip / Pesan Layanan — {$business->name} | Janjiyan",
            Business::TYPE_SPACE_BOOKING => "Booking Tempat / Sesi — {$business->name} | Janjiyan",
            default => "Buat Janji Temu — {$business->name} | Janjiyan",
        };
        $seoDescription = match ($businessType) {
            Business::TYPE_DROPOFF => "Pilih layanan, tanggal drop-off, dan jumlah di {$business->name}.",
            Business::TYPE_SPACE_BOOKING => "Pilih fasilitas atau paket dan jadwal sesi di {$business->name}.",
            default => "Pilih layanan, staff, dan jadwal di {$business->name}.",
        };

        return Inertia::render('Public/BookingPortal', [
            'business' => [
                'id' => $business->id,
                'name' => $business->name,
                'slug' => $business->slug,
                'category' => $business->category,
                'business_type' => $businessType,
                'phone' => $business->phone,
                'timezone' => $business->timezone,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
                'brand_color' => $business->brand_color,
                'qris_url' => $business->qris_path ? Storage::url($business->qris_path) : null,
                'bank_accounts' => $business->bank_accounts ?? [],
                'dp_expiry_minutes' => $business->dp_expiry_minutes,
                'min_booking_lead_minutes' => (int) ($business->min_booking_lead_minutes ?? 15),
                'max_booking_advance_days' => (int) ($business->max_booking_advance_days ?? 60),
            ],
            'services' => $business->services->map(fn (Service $service) => [
                'id' => $service->id,
                'name' => $service->name,
                'description' => $service->description,
                'image_url' => $service->image_path ? Storage::url($service->image_path) : null,
                'price' => $service->price,
                'duration_minutes' => $service->duration_minutes,
                'buffer_minutes' => $service->buffer_minutes,
                'capacity' => $service->capacity,
                'assignment_mode' => $service->assignment_mode,
                'booking_mode' => $service->booking_mode ?? 'time_slot',
                'turnaround_days' => (int) ($service->turnaround_days ?? 1),
                'supports_pickup' => (bool) ($service->supports_pickup ?? false),
                'unit_label' => $service->resolvedUnitLabel(),
                'dp_type' => $service->dp_type,
                'dp_value' => $service->dp_value,
                'dp_amount' => $service->calculateDpAmount(),
                'staff' => $isStaffAppointment
                    ? $service->staff->map(fn ($s) => [
                        'id' => $s->id,
                        'name' => $s->name,
                        'title' => $s->title,
                    ])->values()
                    : [],
            ])->values(),
            'addons' => $business->serviceAddons
                ->map(fn (ServiceAddon $addon): array => ServiceAddonController::serializeAddon($addon))
                ->values(),
            'canUseMultiServiceDropoff' => $planLimitService->canUseMultiServiceDropoff($business->owner),
            'operatingHours' => $business->operatingHours,
            'holidays' => $business->holidays->pluck('date')->map(fn ($d) => $d->toDateString())->values(),
            // Tapped from the hub's service list; ignored unless it is one of this shop's active services.
            'selectedServiceId' => $business->services->firstWhere('id', $request->integer('layanan'))?->id,
            'bookingDisabledReason' => $this->bookingDisabledReason($business, $planLimitService),
        ])->withViewData('seo', [
            'title' => $seoTitle,
            'description' => $seoDescription,
            'url' => route('public.booking.form', $business->slug),
        ]);
    }

    public function slots(Request $request, string $slug, SlotAvailabilityService $slotService): JsonResponse
    {
        $this->normalizeAddonQueryInputs($request);

        $validated = $request->validate([
            'service_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'staff_id' => ['nullable', 'integer'],
            'addons' => ['nullable', 'array', 'max:50'],
            'addons.*.service_addon_id' => ['nullable', 'integer'],
            'addons.*.id' => ['nullable', 'integer'],
            'addons.*.quantity' => ['nullable', 'integer', 'min:1', 'max:50'],
            'addon_ids' => ['nullable', 'array', 'max:50'],
            'addon_ids.*' => ['integer'],
        ]);

        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return response()->json(['message' => 'Bisnis ini sedang tidak tersedia.'], 403);
        }

        $service = $business->services()->where('id', $validated['service_id'])->where('is_active', true)->firstOrFail();

        if ($service->isDropoff()) {
            return response()->json([
                'booking_mode' => 'dropoff',
                'unit_label' => $service->resolvedUnitLabel(),
                'dropoff' => $slotService->getDropoffAvailability($business, $service, $validated['date']),
                'slots' => [],
            ]);
        }

        $addonRequests = ! empty($validated['addons'])
            ? $validated['addons']
            : ($validated['addon_ids'] ?? []);
        $extraDurationMinutes = 0;

        if ($addonRequests !== []) {
            try {
                $extraDurationMinutes = $slotService->calculateExtraDurationForAddons($business, $service, $addonRequests);
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
            false,
            null,
            $extraDurationMinutes
        );

        return response()->json([
            'slots' => $slots,
        ]);
    }

    public function store(
        Request $request,
        string $slug,
        SlotAvailabilityService $slotService,
        PlanLimitService $planLimitService,
        BookingNotificationService $notificationService
    ): RedirectResponse {
        $business = Business::where('slug', $slug)->where('is_active', true)->with('owner')->firstOrFail();

        if ($business->isSuspended()) {
            return back()->with('error', 'Portal booking bisnis ini sedang ditangguhkan.');
        }

        if (! $planLimitService->hasActiveSubscription($business->owner)) {
            return back()->with('error', $this->bookingDisabledReason($business, $planLimitService));
        }

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
            'dp_proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

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
                    dpProofFile: $request->file('dp_proof'),
                    allowImmediateToday: false,
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
                    requestedStaffId: $business->isStaffAppointment() && isset($validated['staff_id']) ? (int) $validated['staff_id'] : null,
                    customerName: $validated['customer_name'],
                    customerPhone: $validated['customer_phone'],
                    customerEmail: $validated['customer_email'] ?? null,
                    customerNotes: $validated['customer_notes'] ?? null,
                    dpProofFile: $request->file('dp_proof'),
                    allowImmediateToday: false,
                    addonRequests: $addonRequests
                );
            } catch (RuntimeException $e) {
                return back()->with('error', $e->getMessage());
            }
        }

        $notificationService->notifyNewPublicBooking($booking);

        $successMessage = match ($business->resolvedBusinessType()) {
            Business::TYPE_DROPOFF => 'Pesanan berhasil dibuat!',
            Business::TYPE_SPACE_BOOKING => 'Booking berhasil dibuat!',
            default => 'Reservasi berhasil dibuat!',
        };

        return redirect()->route('public.booking.invoice', [
            'slug' => $business->slug,
            'token' => $booking->invoice_token,
        ])->with('success', $successMessage);
    }

    public function invoice(Request $request, string $slug, string $token): Response|SymfonyResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return Inertia::render('Public/BusinessUnavailable', [
                'businessName' => $business->name,
                'reason' => $business->suspension_reason,
            ])->toResponse($request)->setStatusCode(403);
        }

        $booking = Booking::where('business_id', $business->id)
            ->where('invoice_token', $token)
            ->with(['service', 'staff', 'customer'])
            ->firstOrFail();

        return $this->renderInvoicePage($business, $booking);
    }

    public function status(Request $request, string $slug, string $code): RedirectResponse|Response|SymfonyResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return Inertia::render('Public/BusinessUnavailable', [
                'businessName' => $business->name,
                'reason' => $business->suspension_reason,
            ])->toResponse($request)->setStatusCode(403);
        }

        $booking = Booking::where('business_id', $business->id)
            ->where('booking_code', $code)
            ->with(['service', 'staff', 'customer'])
            ->firstOrFail();

        if ($booking->invoice_token) {
            return redirect()->route('public.booking.invoice', [
                'slug' => $business->slug,
                'token' => $booking->invoice_token,
            ]);
        }

        return $this->renderInvoicePage($business, $booking);
    }

    public function calendarIcsByToken(string $slug, string $token, IcsCalendarService $icsService): HttpResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        abort_if($business->isSuspended(), 403);

        $booking = Booking::where('business_id', $business->id)
            ->where('invoice_token', $token)
            ->with(['business', 'service', 'staff', 'customer'])
            ->firstOrFail();

        return $this->streamIcsResponse($booking, $icsService);
    }

    public function calendarIcsByCode(string $slug, string $code, IcsCalendarService $icsService): HttpResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        abort_if($business->isSuspended(), 403);

        $booking = Booking::where('business_id', $business->id)
            ->where('booking_code', $code)
            ->with(['business', 'service', 'staff', 'customer'])
            ->firstOrFail();

        return $this->streamIcsResponse($booking, $icsService);
    }

    private function streamIcsResponse(Booking $booking, IcsCalendarService $icsService): HttpResponse
    {
        $ics = $icsService->generateBookingIcs($booking);
        $safeCode = preg_replace('/[^A-Z0-9\-]+/i', '', $booking->booking_code) ?: 'booking';

        return response($ics, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"janjiyan-{$safeCode}.ics\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function uploadProofByToken(Request $request, string $slug, string $token): RedirectResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return back()->with('error', 'Portal booking bisnis ini sedang ditangguhkan.');
        }

        $booking = Booking::where('business_id', $business->id)
            ->where('invoice_token', $token)
            ->firstOrFail();

        return $this->handleProofUpload($request, $business, $booking);
    }

    public function uploadProof(Request $request, string $slug, string $code): RedirectResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return back()->with('error', 'Portal booking bisnis ini sedang ditangguhkan.');
        }

        $booking = Booking::where('business_id', $business->id)
            ->where('booking_code', $code)
            ->firstOrFail();

        return $this->handleProofUpload($request, $business, $booking);
    }

    public function invoices(Request $request, string $slug): Response|SymfonyResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return Inertia::render('Public/BusinessUnavailable', [
                'businessName' => $business->name,
                'reason' => $business->suspension_reason,
            ])->toResponse($request)->setStatusCode(403);
        }

        $businessType = $business->resolvedBusinessType();
        $lookupTitle = match ($businessType) {
            Business::TYPE_DROPOFF => 'Cek pesanan',
            Business::TYPE_SPACE_BOOKING => 'Cek booking',
            default => 'Cek reservasi',
        };

        return Inertia::render('Public/InvoiceLookup', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'business_type' => $businessType,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
                'brand_color' => $business->brand_color,
            ],
            'history' => null,
            'matchedInvoiceToken' => null,
        ])->withViewData('seo', [
            'title' => "{$lookupTitle} — {$business->name}",
            'noindex' => true,
        ]);
    }

    public function lookupInvoices(Request $request, string $slug): Response|RedirectResponse|SymfonyResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return back()->with('error', 'Portal booking bisnis ini sedang ditangguhkan.');
        }

        $validated = $request->validate([
            'invoice_number' => ['required', 'string', 'max:50'],
            'phone_last4' => ['required', 'digits:4'],
        ]);

        $needle = strtoupper(trim($validated['invoice_number']));
        $phoneLast4 = $validated['phone_last4'];

        $matched = Booking::where('business_id', $business->id)
            ->where(function ($q) use ($needle) {
                $q->where('invoice_number', $needle)
                    ->orWhere('booking_code', $needle);
            })
            ->with(['customer'])
            ->first();

        if (! $matched || substr((string) ($matched->customer?->phone ?? ''), -4) !== $phoneLast4) {
            return back()
                ->withErrors(['invoice_number' => 'Nomor invoice tidak ditemukan atau 4 digit terakhir nomor HP tidak sesuai.'])
                ->withInput();
        }

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $isStaffAppointment = $business->isStaffAppointment();
        // Only the booking the visitor proved knowledge of. A phone number is never verified, so anyone can
        // book under someone else's number; widening to the customer's history would hand out their tokens.
        $history = collect([$matched->load(['service', 'staff', 'items'])])
            ->map(fn (Booking $b) => [
                'invoice_number' => $b->invoice_number,
                'invoice_token' => $b->invoice_token,
                'booking_code' => $b->booking_code,
                'service_name' => $b->service?->name ?? '-',
                'service_summary' => $b->resolvedServiceSummary(),
                'staff_name' => $isStaffAppointment ? $b->staff?->name : null,
                'booking_date' => $b->booking_date->toDateString(),
                'start_time_local' => $b->start_at->setTimezone($tz)->format('H:i'),
                'booking_mode' => $b->booking_mode ?? 'time_slot',
                'quantity' => (int) ($b->quantity ?? 1),
                'unit_label' => $b->resolvedUnitLabel(),
                'fulfillment_type' => $b->fulfillment_type ?? 'dropoff',
                'estimated_ready_date' => $b->estimated_ready_date?->toDateString(),
                'work_status' => $b->work_status,
                'schedule_label' => $b->scheduleDisplayLabel($tz),
                'total_price' => (int) $b->total_price,
                'dp_amount' => (int) $b->dp_amount,
                'paid_amount' => (int) ($b->paid_amount ?? 0),
                'remaining_balance' => $b->remainingBalance(),
                'reservation_status' => $b->reservation_status,
                'payment_status' => $b->payment_status,
            ])
            ->values();

        return Inertia::render('Public/InvoiceLookup', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'business_type' => $business->resolvedBusinessType(),
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
                'brand_color' => $business->brand_color,
            ],
            'customerName' => $matched->booked_customer_name ?: $matched->customer?->name,
            'matchedInvoiceToken' => $matched->invoice_token,
            'history' => $history,
        ]);
    }

    private function renderInvoicePage(Business $business, Booking $booking): Response
    {
        $business->loadMissing('owner');
        $booking->loadMissing(['service', 'staff', 'customer', 'items', 'payments', 'review']);

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $businessType = $business->resolvedBusinessType();
        $isStaffAppointment = $business->isStaffAppointment();
        $noun = $this->bookingNoun($business);
        $invoiceUrl = $booking->invoice_token
            ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $booking->invoice_token])
            : route('public.booking.status', ['slug' => $business->slug, 'code' => $booking->booking_code]);

        $canUseGoogleReview = app(PlanLimitService::class)->canUseGoogleReview($business->owner);
        $reviewEnabled = (bool) ($business->review_enabled ?? true);
        $hasReview = $booking->review !== null;
        $isCompletedForReview = $booking->reservation_status === 'completed'
            || ($booking->isDropoff() && $booking->work_status === 'picked_up');
        $canReview = $canUseGoogleReview
            && $reviewEnabled
            && $isCompletedForReview
            && ! $hasReview
            && filled($booking->invoice_token);

        $reviewUrl = $canReview ? $this->buildReviewUrl($business, $booking) : null;

        return Inertia::render('Public/BookingStatus', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'business_type' => $businessType,
                'phone' => $business->phone,
                'address' => $business->address,
                'timezone' => $business->timezone,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
                'brand_color' => $business->brand_color,
                'qris_url' => $business->qris_path ? Storage::url($business->qris_path) : null,
                'bank_accounts' => $business->bank_accounts ?? [],
                'review_enabled' => $reviewEnabled,
                'can_use_google_review' => $canUseGoogleReview,
            ],
            'booking' => [
                'booking_code' => $booking->booking_code,
                'invoice_number' => $booking->invoice_number,
                'invoice_token' => $booking->invoice_token,
                'service_name' => $booking->service?->name ?? 'Layanan',
                'service_summary' => $booking->resolvedServiceSummary(),
                'staff_name' => $isStaffAppointment ? $booking->staff?->name : null,
                'customer_name' => $booking->customer->name,
                'customer_phone' => $this->maskPhone($booking->customer->phone),
                'booking_date' => $booking->booking_date->toDateString(),
                'start_time_local' => $booking->start_at->setTimezone($tz)->format('H:i'),
                'end_time_local' => $booking->end_at->setTimezone($tz)->format('H:i'),
                'booking_mode' => $booking->booking_mode ?? 'time_slot',
                'quantity' => (int) ($booking->quantity ?? 1),
                'unit_label' => $booking->resolvedUnitLabel(),
                'fulfillment_type' => $booking->fulfillment_type ?? 'dropoff',
                'pickup_session' => $booking->pickup_session,
                'pickup_address' => $booking->pickup_address,
                'estimated_ready_date' => $booking->estimated_ready_date?->toDateString(),
                'work_status' => $booking->work_status,
                'schedule_label' => $booking->scheduleDisplayLabel($tz),
                'start_at_utc' => $booking->start_at->utc()->format('Ymd\THis\Z'),
                'end_at_utc' => $booking->end_at->utc()->format('Ymd\THis\Z'),
                'calendar_ics_url' => $booking->invoice_token
                    ? route('public.booking.invoice.ics', ['slug' => $business->slug, 'token' => $booking->invoice_token])
                    : route('public.booking.ics', ['slug' => $business->slug, 'code' => $booking->booking_code]),
                'created_at_local' => $booking->created_at?->setTimezone($tz)->format('d M Y, H:i'),
                'total_price' => (int) $booking->total_price,
                'dp_amount' => (int) $booking->dp_amount,
                'paid_amount' => (int) ($booking->paid_amount ?? 0),
                'remaining_balance' => $booking->remainingBalance(),
                'settled_at_local' => $booking->settled_at?->setTimezone($tz)->format('d M Y, H:i'),
                'reservation_status' => $booking->reservation_status,
                'payment_status' => $booking->payment_status,
                'has_dp_proof' => filled($booking->dp_proof_path),
                'dp_expires_at' => $booking->dp_expires_at?->toIso8601String(),
                'cancellation_reason' => $booking->cancellation_reason,
                'customer_notes' => $booking->customer_notes,
                'has_review' => $hasReview,
                'can_review' => $canReview,
                'review_url' => $reviewUrl,
                'items' => $booking->items->map(fn (BookingItem $item): array => [
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
                ])->values()->all(),
                'payments' => $booking->payments->map(fn (BookingPayment $payment): array => [
                    'id' => $payment->id,
                    'payment_type' => $payment->payment_type,
                    'payment_method' => $payment->payment_method,
                    'amount' => (int) $payment->amount,
                    'received_amount' => $payment->received_amount !== null ? (int) $payment->received_amount : null,
                    'change_amount' => (int) $payment->change_amount,
                    'recorded_by_name' => null,
                    'paid_at' => $payment->paid_at->toIso8601String(),
                    'paid_at_local' => $payment->paid_at->setTimezone($tz)->format('d M Y, H:i'),
                    'notes' => $payment->notes,
                ])->values()->all(),
            ],
        ])->withViewData('seo', [
            'title' => 'Invoice '.($booking->invoice_number ?: $booking->booking_code)." — {$business->name}",
            'description' => "Invoice dan status {$noun} ".($booking->invoice_number ?: $booking->booking_code)." di {$business->name}.",
            'image' => $business->logo_path ? url(Storage::url($business->logo_path)) : url('/og-default.png'),
            'url' => $invoiceUrl,
            'noindex' => true,
        ]);
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

    private function handleProofUpload(Request $request, Business $business, Booking $booking): RedirectResponse
    {
        $request->validate([
            'dp_proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $path = $request->file('dp_proof')->store('dp-proofs', 'local');

        $result = DB::transaction(function () use ($booking, $path): array {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            if (in_array($locked->reservation_status, ['cancelled', 'completed', 'no_show'], true)) {
                return ['status' => 'closed', 'booking' => $locked, 'previous_path' => null];
            }

            if ($locked->dp_expires_at !== null && $locked->dp_expires_at->isPast()) {
                if ($locked->reservation_status === 'pending' && $locked->payment_status === 'unpaid') {
                    $locked->update([
                        'reservation_status' => 'cancelled',
                        'cancellation_reason' => 'dp_expired',
                    ]);
                }

                return ['status' => 'expired', 'booking' => $locked, 'previous_path' => null];
            }

            $previousProofPath = $locked->dp_proof_path;

            $locked->update([
                'dp_proof_path' => $path,
                'payment_status' => 'waiting_verification',
                'dp_expires_at' => null,
            ]);

            return ['status' => 'ok', 'booking' => $locked, 'previous_path' => $previousProofPath];
        });

        $noun = $this->bookingNoun($business);
        $nounTitle = ucfirst($noun);

        if ($result['status'] !== 'ok') {
            Storage::disk('local')->delete($path);

            $errorMessage = $result['status'] === 'expired'
                ? "Batas waktu pembayaran uang muka telah berakhir dan {$noun} dibatalkan."
                : "{$nounTitle} ini tidak lagi menerima unggahan bukti uang muka.";

            return back()->with('error', $errorMessage);
        }

        if ($result['previous_path'] && $result['previous_path'] !== $path) {
            Storage::disk('local')->delete($result['previous_path']);
        }

        app(BookingNotificationService::class)->notifyDpProofUploaded($result['booking']);

        $verifierLabel = $business->isStaffAppointment() ? 'staff' : 'admin';

        return back()->with('success', "Bukti pembayaran uang muka berhasil diunggah dan menunggu verifikasi {$verifierLabel}.");
    }

    private function maskPhone(?string $phone): string
    {
        $digits = (string) ($phone ?? '');
        $length = strlen($digits);

        if ($length <= 4) {
            return str_repeat('*', $length);
        }

        if ($length <= 8) {
            return substr($digits, 0, 2).str_repeat('*', $length - 4).substr($digits, -2);
        }

        return substr($digits, 0, 5).str_repeat('*', $length - 8).substr($digits, -3);
    }
}
