<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Service;
use App\Services\BookingNotificationService;
use App\Services\IcsCalendarService;
use App\Services\PlanLimitService;
use App\Services\SlotAvailabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class PublicBookingController extends Controller
{
    public function show(Request $request, string $slug, PlanLimitService $planLimitService): Response|SymfonyResponse
    {
        $business = Business::where('slug', $slug)
            ->where('is_active', true)
            ->with([
                'owner',
                'services' => fn ($q) => $q->where('is_active', true)->with(['staff' => fn ($sq) => $sq->where('is_active', true)]),
                'galleries',
                'operatingHours',
            ])
            ->firstOrFail();

        $businessToday = now($business->timezone ?: 'Asia/Jakarta')->toDateString();
        $business->setRelation(
            'holidays',
            $business->holidays()->whereDate('date', '>=', $businessToday)->get()
        );

        if ($business->isSuspended()) {
            return Inertia::render('Public/BusinessUnavailable', [
                'businessName' => $business->name,
                'reason' => $business->suspension_reason,
            ])->toResponse($request)->setStatusCode(403);
        }

        $bookingDisabledReason = ! $planLimitService->hasActiveSubscription($business->owner)
            ? 'Reservasi online untuk bisnis ini sementara ditutup karena masa langganan merchant telah berakhir.'
            : null;

        return Inertia::render('Public/BookingPortal', [
            'business' => [
                'id' => $business->id,
                'name' => $business->name,
                'slug' => $business->slug,
                'category' => $business->category,
                'description' => $business->description,
                'phone' => $business->phone,
                'address' => $business->address,
                'timezone' => $business->timezone,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
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
                'dp_type' => $service->dp_type,
                'dp_value' => $service->dp_value,
                'dp_amount' => $service->calculateDpAmount(),
                'staff' => $service->staff->map(fn ($s) => [
                    'id' => $s->id,
                    'name' => $s->name,
                    'title' => $s->title,
                ])->values(),
            ])->values(),
            'galleries' => $business->galleries->map(fn ($g) => [
                'id' => $g->id,
                'image_url' => Storage::url($g->image_path),
                'caption' => $g->caption,
            ])->values(),
            'operatingHours' => $business->operatingHours,
            'holidays' => $business->holidays->pluck('date')->map(fn ($d) => $d->toDateString())->values(),
            'bookingDisabledReason' => $bookingDisabledReason,
        ])->withViewData('seo', [
            'title' => "{$business->name} — Reservasi Online | Janjiyan",
            'description' => $business->description ?: "Pesan layanan {$business->name} ({$business->category}) secara online dengan jadwal real-time di Janjiyan.",
            'image' => $business->logo_path ? url(Storage::url($business->logo_path)) : url('/og-default.png'),
            'url' => route('public.booking', $business->slug),
        ]);
    }

    public function slots(Request $request, string $slug, SlotAvailabilityService $slotService): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'staff_id' => ['nullable', 'integer'],
        ]);

        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return response()->json(['message' => 'Bisnis ini sedang tidak tersedia.'], 403);
        }

        $service = $business->services()->where('id', $validated['service_id'])->where('is_active', true)->firstOrFail();

        $slots = $slotService->getAvailableSlots(
            $business,
            $service,
            $validated['date'],
            isset($validated['staff_id']) ? (int) $validated['staff_id'] : null
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
            return back()->with('error', 'Portal reservasi bisnis ini sedang ditangguhkan.');
        }

        if (! $planLimitService->hasActiveSubscription($business->owner)) {
            return back()->with('error', 'Reservasi online bisnis ini sementara tidak tersedia karena masa berlangganan telah berakhir.');
        }

        if (! $planLimitService->canCreateMonthlyBooking($business)) {
            return back()->with('error', 'Kuota booking bulanan bisnis ini telah mencapai batas paket.');
        }

        $validated = $request->validate([
            'service_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i'],
            'staff_id' => ['nullable', 'integer'],
            'customer_name' => ['required', 'string', 'max:120'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_notes' => ['nullable', 'string', 'max:500'],
            'dp_proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $service = $business->services()->where('id', $validated['service_id'])->where('is_active', true)->firstOrFail();

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
                $request->file('dp_proof')
            );
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $notificationService->notifyNewPublicBooking($booking);

        return redirect()->route('public.booking.invoice', [
            'slug' => $business->slug,
            'token' => $booking->invoice_token,
        ])->with('success', 'Reservasi berhasil dibuat!');
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
            return back()->with('error', 'Portal reservasi bisnis ini sedang ditangguhkan.');
        }

        $booking = Booking::where('business_id', $business->id)
            ->where('invoice_token', $token)
            ->firstOrFail();

        return $this->handleProofUpload($request, $booking);
    }

    public function uploadProof(Request $request, string $slug, string $code): RedirectResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return back()->with('error', 'Portal reservasi bisnis ini sedang ditangguhkan.');
        }

        $booking = Booking::where('business_id', $business->id)
            ->where('booking_code', $code)
            ->firstOrFail();

        return $this->handleProofUpload($request, $booking);
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

        return Inertia::render('Public/InvoiceLookup', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
            ],
            'history' => null,
            'matchedInvoiceToken' => null,
        ])->withViewData('seo', [
            'title' => "Cek Riwayat & Invoice — {$business->name}",
            'noindex' => true,
        ]);
    }

    public function lookupInvoices(Request $request, string $slug): Response|RedirectResponse|SymfonyResponse
    {
        $business = Business::where('slug', $slug)->where('is_active', true)->firstOrFail();
        if ($business->isSuspended()) {
            return back()->with('error', 'Portal reservasi bisnis ini sedang ditangguhkan.');
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
        $history = Booking::where('business_id', $business->id)
            ->where('customer_id', $matched->customer_id)
            ->with(['service', 'staff'])
            ->latest('start_at')
            ->limit(25)
            ->get()
            ->map(fn (Booking $b) => [
                'invoice_number' => $b->invoice_number,
                'invoice_token' => $b->invoice_token,
                'booking_code' => $b->booking_code,
                'service_name' => $b->service?->name ?? '-',
                'staff_name' => $b->staff?->name,
                'booking_date' => $b->booking_date->toDateString(),
                'start_time_local' => $b->start_at->setTimezone($tz)->format('H:i'),
                'total_price' => $b->total_price,
                'dp_amount' => $b->dp_amount,
                'reservation_status' => $b->reservation_status,
                'payment_status' => $b->payment_status,
            ])
            ->values();

        return Inertia::render('Public/InvoiceLookup', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
            ],
            'customerName' => $matched->customer?->name,
            'matchedInvoiceToken' => $matched->invoice_token,
            'history' => $history,
        ]);
    }

    private function renderInvoicePage(Business $business, Booking $booking): Response
    {
        $tz = $business->timezone ?: 'Asia/Jakarta';
        $invoiceUrl = $booking->invoice_token
            ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $booking->invoice_token])
            : route('public.booking.status', ['slug' => $business->slug, 'code' => $booking->booking_code]);

        return Inertia::render('Public/BookingStatus', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'phone' => $business->phone,
                'address' => $business->address,
                'timezone' => $business->timezone,
                'qris_url' => $business->qris_path ? Storage::url($business->qris_path) : null,
                'bank_accounts' => $business->bank_accounts ?? [],
            ],
            'booking' => [
                'booking_code' => $booking->booking_code,
                'invoice_number' => $booking->invoice_number,
                'invoice_token' => $booking->invoice_token,
                'service_name' => $booking->service->name,
                'staff_name' => $booking->staff?->name,
                'customer_name' => $booking->customer->name,
                'customer_phone' => $this->maskPhone($booking->customer->phone),
                'booking_date' => $booking->booking_date->toDateString(),
                'start_time_local' => $booking->start_at->setTimezone($tz)->format('H:i'),
                'end_time_local' => $booking->end_at->setTimezone($tz)->format('H:i'),
                'start_at_utc' => $booking->start_at->utc()->format('Ymd\THis\Z'),
                'end_at_utc' => $booking->end_at->utc()->format('Ymd\THis\Z'),
                'calendar_ics_url' => $booking->invoice_token
                    ? route('public.booking.invoice.ics', ['slug' => $business->slug, 'token' => $booking->invoice_token])
                    : route('public.booking.ics', ['slug' => $business->slug, 'code' => $booking->booking_code]),
                'created_at_local' => $booking->created_at?->setTimezone($tz)->format('d M Y, H:i'),
                'total_price' => $booking->total_price,
                'dp_amount' => $booking->dp_amount,
                'reservation_status' => $booking->reservation_status,
                'payment_status' => $booking->payment_status,
                'has_dp_proof' => filled($booking->dp_proof_path),
                'dp_expires_at' => $booking->dp_expires_at?->toIso8601String(),
                'cancellation_reason' => $booking->cancellation_reason,
                'customer_notes' => $booking->customer_notes,
            ],
        ])->withViewData('seo', [
            'title' => 'Invoice '.($booking->invoice_number ?: $booking->booking_code)." — {$business->name}",
            'description' => 'Invoice dan status reservasi '.($booking->invoice_number ?: $booking->booking_code)." di {$business->name}.",
            'image' => $business->logo_path ? url(Storage::url($business->logo_path)) : url('/og-default.png'),
            'url' => $invoiceUrl,
            'noindex' => true,
        ]);
    }

    private function handleProofUpload(Request $request, Booking $booking): RedirectResponse
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

        if ($result['status'] !== 'ok') {
            Storage::disk('local')->delete($path);

            $errorMessage = $result['status'] === 'expired'
                ? 'Batas waktu pembayaran DP telah berakhir dan reservasi dibatalkan.'
                : 'Reservasi ini tidak lagi menerima unggahan bukti DP.';

            return back()->with('error', $errorMessage);
        }

        if ($result['previous_path'] && $result['previous_path'] !== $path) {
            Storage::disk('local')->delete($result['previous_path']);
        }

        app(BookingNotificationService::class)->notifyDpProofUploaded($result['booking']);

        return back()->with('success', 'Bukti pembayaran DP berhasil diunggah dan menunggu verifikasi staff.');
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
