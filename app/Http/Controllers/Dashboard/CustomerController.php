<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Customer;
use App\Services\PlanLimitService;
use App\Support\CsvHelper;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerController extends Controller
{
    public function index(Request $request, PlanLimitService $planLimitService): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(! $business || $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $search = $request->string('search')->toString();
        $segment = $request->string('segment')->toString() ?: 'all';
        $sort = $request->string('sort')->toString() ?: 'latest';

        if (! in_array($segment, ['all', 'vip', 'has_no_show', 'repeat', 'blocked'], true)) {
            $segment = 'all';
        }
        if (! in_array($sort, ['latest', 'top_spent', 'most_bookings'], true)) {
            $sort = 'latest';
        }

        $paginated = $business
            ? $business->customers()
                ->withCount('bookings')
                ->withCount(['bookings as no_show_count' => fn ($q) => $q->where('reservation_status', 'no_show')])
                ->withSum(['bookings as total_spent' => fn ($q) => $q->whereIn('payment_status', ['dp_verified', 'settled'])], 'total_price')
                ->when($search, fn ($q) => $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                }))
                ->when($segment === 'vip', fn ($q) => $q->whereJsonContains('tags', 'VIP'))
                ->when($segment === 'has_no_show', fn ($q) => $q->whereHas('bookings', fn ($bq) => $bq->where('reservation_status', 'no_show')))
                ->when($segment === 'repeat', fn ($q) => $q->has('bookings', '>=', 2))
                ->when($segment === 'blocked', fn ($q) => $q->where('is_blocked', true))
                ->when($sort === 'top_spent', fn ($q) => $q->orderByDesc('total_spent')->latest())
                ->when($sort === 'most_bookings', fn ($q) => $q->orderByDesc('bookings_count')->latest())
                ->when($sort === 'latest', fn ($q) => $q->latest())
                ->paginate(20)
                ->withQueryString()
                ->through(fn (Customer $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'phone' => $c->phone,
                    'email' => $c->email,
                    'notes' => $c->notes,
                    'tags' => is_array($c->tags) ? array_values($c->tags) : [],
                    'is_blocked' => (bool) $c->is_blocked,
                    'bookings_count' => (int) $c->bookings_count,
                    'no_show_count' => (int) ($c->no_show_count ?? 0),
                    'total_spent' => (int) ($c->total_spent ?? 0),
                    'created_at' => $c->created_at?->toIso8601String(),
                ])
            : null;

        return Inertia::render('Dashboard/Customers/Index', [
            'customers' => $paginated ? $paginated->items() : [],
            'pagination' => $paginated ? [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
                'prev_page_url' => $paginated->previousPageUrl(),
                'next_page_url' => $paginated->nextPageUrl(),
            ] : null,
            'search' => $search,
            'filters' => [
                'search' => $search,
                'segment' => $segment,
                'sort' => $sort,
            ],
            'canExportCsv' => $business ? $planLimitService->canExportCsv($business->owner) : false,
        ]);
    }

    public function show(Request $request, Customer $customer): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $customer->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $tz = $business->timezone ?: 'Asia/Jakarta';

        $agg = $customer->bookings()
            ->selectRaw("
                COUNT(*) as total_bookings,
                SUM(CASE WHEN reservation_status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN reservation_status = 'no_show' THEN 1 ELSE 0 END) as no_show_count,
                SUM(CASE WHEN reservation_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                COALESCE(SUM(CASE WHEN payment_status IN ('dp_verified', 'settled') THEN total_price ELSE 0 END), 0) as total_spent
            ")
            ->first();

        $stats = [
            'total_bookings' => (int) ($agg->total_bookings ?? 0),
            'completed_count' => (int) ($agg->completed_count ?? 0),
            'no_show_count' => (int) ($agg->no_show_count ?? 0),
            'cancelled_count' => (int) ($agg->cancelled_count ?? 0),
            'total_spent' => (int) ($agg->total_spent ?? 0),
        ];

        $bookings = $customer->bookings()
            ->with(['service', 'staff'])
            ->latest('start_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Booking $b) => [
                'id' => $b->id,
                'booking_code' => $b->booking_code,
                'invoice_number' => $b->invoice_number,
                'invoice_url' => $b->invoice_token
                    ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $b->invoice_token])
                    : null,
                'service_name' => $b->service?->name ?? '-',
                'staff_name' => $b->staff?->name,
                'booking_mode' => $b->booking_mode ?? 'time_slot',
                'quantity' => (int) ($b->quantity ?? 1),
                'fulfillment_type' => $b->fulfillment_type ?? 'dropoff',
                'work_status' => $b->work_status,
                'estimated_ready_date' => $b->estimated_ready_date?->toDateString(),
                'booking_date' => $b->booking_date->toDateString(),
                'start_time_local' => $b->start_at->setTimezone($tz)->format('H:i'),
                'end_time_local' => $b->end_at->setTimezone($tz)->format('H:i'),
                'total_price' => $b->total_price,
                'dp_amount' => $b->dp_amount,
                'reservation_status' => $b->reservation_status,
                'payment_status' => $b->payment_status,
                'customer_notes' => $b->customer_notes,
                'cancellation_reason' => $b->cancellation_reason,
            ]);

        return Inertia::render('Dashboard/Customers/Show', [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'notes' => $customer->notes ?? '',
                'tags' => is_array($customer->tags) ? array_values($customer->tags) : [],
                'is_blocked' => (bool) $customer->is_blocked,
                'created_at' => $customer->created_at?->setTimezone($tz)->format('d M Y'),
            ],
            'stats' => $stats,
            'bookings' => $bookings->items(),
            'pagination' => [
                'current_page' => $bookings->currentPage(),
                'last_page' => $bookings->lastPage(),
                'per_page' => $bookings->perPage(),
                'total' => $bookings->total(),
                'from' => $bookings->firstItem(),
                'to' => $bookings->lastItem(),
                'prev_page_url' => $bookings->previousPageUrl(),
                'next_page_url' => $bookings->nextPageUrl(),
            ],
            'canEdit' => $user->hasBusinessPermission($business, 'manage_bookings'),
        ]);
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $customer->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'tags' => ['sometimes', 'nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:30'],
            'is_blocked' => ['sometimes', 'boolean'],
        ]);

        $sanitizedTags = $customer->tags ?? [];
        if (array_key_exists('tags', $validated)) {
            $sanitizedTags = collect($validated['tags'] ?? [])
                ->map(fn ($tag) => trim((string) $tag))
                ->filter(fn ($tag) => $tag !== '')
                ->unique()
                ->take(10)
                ->values()
                ->all();
        }

        $customer->update([
            'name' => $validated['name'],
            'email' => $validated['email'] ?: null,
            'notes' => $validated['notes'] !== null && trim($validated['notes']) !== '' ? trim($validated['notes']) : null,
            'tags' => $sanitizedTags,
            'is_blocked' => array_key_exists('is_blocked', $validated)
                ? (bool) $validated['is_blocked']
                : (bool) $customer->is_blocked,
        ]);

        return back()->with('success', 'Profil & catatan internal pelanggan berhasil disimpan.');
    }

    public function exportCsv(Request $request, PlanLimitService $planLimitService): StreamedResponse|RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        if (! $planLimitService->canExportCsv($business->owner)) {
            return back()->with('error', 'Export CSV hanya tersedia pada paket Professional dan Enterprise.');
        }

        $customersQuery = $business->customers()
            ->withCount('bookings')
            ->withCount(['bookings as no_show_count' => fn ($q) => $q->where('reservation_status', 'no_show')])
            ->latest();

        return response()->streamDownload(function () use ($customersQuery) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Nama', 'Telepon', 'Email', 'Tag', 'Status Booking Online', 'Total Reservasi', 'No-Show', 'Catatan Internal', 'Terdaftar']);
            foreach ($customersQuery->lazy(500) as $c) {
                $tagsText = is_array($c->tags) && count($c->tags) > 0 ? implode(', ', $c->tags) : '-';
                fputcsv($handle, CsvHelper::sanitizeRow([
                    $c->name,
                    $c->phone,
                    $c->email ?? '-',
                    $tagsText,
                    $c->is_blocked ? 'Diblokir' : 'Aktif',
                    $c->bookings_count,
                    $c->no_show_count ?? 0,
                    $c->notes ?? '-',
                    $c->created_at?->toDateString(),
                ]));
            }
            fclose($handle);
        }, "janjiyan-customers-{$business->slug}.csv");
    }
}
