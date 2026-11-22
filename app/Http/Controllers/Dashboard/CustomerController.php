<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Customer;
use App\Services\PlanLimitService;
use App\Services\SlotAvailabilityService;
use App\Support\CsvHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        if (! in_array($segment, ['all', 'vip', 'has_no_show', 'repeat', 'blocked', 'duplicates'], true)) {
            $segment = 'all';
        }
        if ($business && $business->isDropoff() && $segment === 'has_no_show') {
            $segment = 'all';
        }
        if (! in_array($sort, ['latest', 'top_spent', 'most_bookings'], true)) {
            $sort = 'latest';
        }

        $duplicateNameCounts = $business
            ? $business->customers()
                ->selectRaw('LOWER(TRIM(name)) as normalized_name, COUNT(*) as aggregate_count')
                ->whereRaw("TRIM(name) != ''")
                ->groupByRaw('LOWER(TRIM(name))')
                ->havingRaw('COUNT(*) > 1')
                ->pluck('aggregate_count', 'normalized_name')
            : collect();

        $duplicateNames = $duplicateNameCounts->keys()->map(fn ($n) => (string) $n)->values()->all();
        $duplicateCustomersCount = (int) $duplicateNameCounts->sum();

        $paginated = $business
            ? $business->customers()
                ->withCount('bookings')
                ->withCount(['bookings as no_show_count' => fn ($q) => $q->where('reservation_status', 'no_show')])
                ->withSum(['bookings as total_spent' => fn ($q) => $q->whereIn('payment_status', ['dp_verified', 'settled'])], 'total_price')
                ->when($search, fn ($q) => $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('name_aliases', 'like', "%{$search}%");
                }))
                ->when($segment === 'vip', fn ($q) => $q->whereJsonContains('tags', 'VIP'))
                ->when($segment === 'has_no_show', fn ($q) => $q->whereHas('bookings', fn ($bq) => $bq->where('reservation_status', 'no_show')))
                ->when($segment === 'repeat', fn ($q) => $q->has('bookings', '>=', 2))
                ->when($segment === 'blocked', fn ($q) => $q->where('is_blocked', true))
                ->when($segment === 'duplicates', function ($q) use ($duplicateNames) {
                    if (count($duplicateNames) === 0) {
                        $q->whereRaw('1 = 0');

                        return;
                    }
                    $placeholders = implode(', ', array_fill(0, count($duplicateNames), '?'));
                    $q->whereRaw("LOWER(TRIM(name)) IN ({$placeholders})", $duplicateNames)
                        ->orderByRaw('LOWER(TRIM(name)) asc');
                })
                ->when($sort === 'top_spent', fn ($q) => $q->orderByDesc('total_spent')->latest())
                ->when($sort === 'most_bookings', fn ($q) => $q->orderByDesc('bookings_count')->latest())
                ->when($sort === 'latest', fn ($q) => $q->latest())
                ->paginate(20)
                ->withQueryString()
                ->through(fn (Customer $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'name_aliases' => is_array($c->name_aliases) ? array_values($c->name_aliases) : [],
                    'has_duplicate_name' => in_array(mb_strtolower(trim($c->name)), $duplicateNames, true),
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
            'duplicateCustomersCount' => $duplicateCustomersCount,
            'canExportCsv' => $business ? $planLimitService->canExportCsv($business->owner) : false,
        ]);
    }

    public function lookup(Request $request, SlotAvailabilityService $slotService): JsonResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $q = trim($request->string('q')->toString());
        $excludeId = $request->integer('exclude_id') ?: null;

        if (mb_strlen($q) < 2) {
            return response()->json(['customers' => []]);
        }

        $normalizedDigits = preg_replace('/\D+/', '', $q) ?? '';
        $normalizedPhone = $normalizedDigits !== '' ? $slotService->normalizePhone($q) : '';

        $customers = $business->customers()
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->withCount('bookings')
            ->withCount(['bookings as no_show_count' => fn ($bq) => $bq->where('reservation_status', 'no_show')])
            ->withSum(['bookings as total_spent' => fn ($bq) => $bq->whereIn('payment_status', ['dp_verified', 'settled'])], 'total_price')
            ->where(function ($sub) use ($q, $normalizedPhone, $normalizedDigits) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('name_aliases', 'like', "%{$q}%");

                if ($normalizedPhone !== '') {
                    $sub->orWhere('phone', 'like', "%{$normalizedPhone}%");
                }
                if ($normalizedDigits !== '' && $normalizedDigits !== $normalizedPhone) {
                    $sub->orWhere('phone', 'like', "%{$normalizedDigits}%");
                }
            })
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (Customer $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'name_aliases' => is_array($c->name_aliases) ? array_values($c->name_aliases) : [],
                'phone' => $c->phone,
                'email' => $c->email,
                'tags' => is_array($c->tags) ? array_values($c->tags) : [],
                'is_blocked' => (bool) $c->is_blocked,
                'bookings_count' => (int) $c->bookings_count,
                'no_show_count' => (int) ($c->no_show_count ?? 0),
                'total_spent' => (int) ($c->total_spent ?? 0),
            ])
            ->values()
            ->all();

        return response()->json(['customers' => $customers]);
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
                'booked_customer_name' => $b->booked_customer_name,
                'invoice_number' => $b->invoice_number,
                'invoice_url' => $b->invoice_token
                    ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $b->invoice_token])
                    : null,
                'service_name' => $b->service?->name ?? '-',
                'staff_name' => $b->staff?->name,
                'booking_mode' => $b->booking_mode ?? 'time_slot',
                'quantity' => (int) ($b->quantity ?? 1),
                'unit_label' => $b->resolvedUnitLabel(),
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

        $candidateNames = collect(array_merge([$customer->name], is_array($customer->name_aliases) ? $customer->name_aliases : []))
            ->map(fn ($n) => mb_strtolower(trim((string) $n)))
            ->filter(fn ($n) => $n !== '')
            ->unique()
            ->values()
            ->all();

        $potentialDuplicates = count($candidateNames) > 0
            ? $business->customers()
                ->where('id', '!=', $customer->id)
                ->where(function ($q) use ($candidateNames, $customer) {
                    $placeholders = implode(', ', array_fill(0, count($candidateNames), '?'));
                    $q->whereRaw("LOWER(TRIM(name)) IN ({$placeholders})", $candidateNames);
                    $trimmedName = trim($customer->name);
                    if ($trimmedName !== '') {
                        $q->orWhere('name_aliases', 'like', "%{$trimmedName}%");
                    }
                })
                ->withCount('bookings')
                ->withSum(['bookings as total_spent' => fn ($q) => $q->whereIn('payment_status', ['dp_verified', 'settled'])], 'total_price')
                ->limit(10)
                ->get()
                ->map(fn (Customer $dup) => [
                    'id' => $dup->id,
                    'name' => $dup->name,
                    'name_aliases' => is_array($dup->name_aliases) ? array_values($dup->name_aliases) : [],
                    'phone' => $dup->phone,
                    'email' => $dup->email,
                    'bookings_count' => (int) $dup->bookings_count,
                    'total_spent' => (int) ($dup->total_spent ?? 0),
                ])
                ->values()
                ->all()
            : [];

        return Inertia::render('Dashboard/Customers/Show', [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'name_aliases' => is_array($customer->name_aliases) ? array_values($customer->name_aliases) : [],
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
            'potentialDuplicates' => $potentialDuplicates,
            'canEdit' => $user->hasBusinessPermission($business, 'manage_bookings'),
        ]);
    }

    public function update(Request $request, Customer $customer, SlotAvailabilityService $slotService): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $customer->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['sometimes', 'required', 'string', 'max:30', 'regex:/^[0-9+\-\s()]{9,20}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'tags' => ['sometimes', 'nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:30'],
            'name_aliases' => ['sometimes', 'nullable', 'array', 'max:10'],
            'name_aliases.*' => ['string', 'max:120'],
            'is_blocked' => ['sometimes', 'boolean'],
        ]);

        $primaryName = trim($validated['name']);
        $normalizedPhone = $customer->phone;

        if (array_key_exists('phone', $validated)) {
            $normalizedPhone = $slotService->normalizePhone($validated['phone']);

            $duplicate = $business->customers()
                ->where('id', '!=', $customer->id)
                ->where('phone', $normalizedPhone)
                ->first();

            if ($duplicate) {
                return back()
                    ->withErrors([
                        'phone' => "Nomor WhatsApp +{$normalizedPhone} sudah terdaftar atas nama {$duplicate->name}. Gunakan fitur Gabungkan Pelanggan (Merge) di bawah jika keduanya adalah orang yang sama.",
                    ])
                    ->withInput();
            }
        }

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

        $rawAliases = array_key_exists('name_aliases', $validated)
            ? ($validated['name_aliases'] ?? [])
            : ($customer->name_aliases ?? []);

        $sanitizedAliases = $this->sanitizeAliases($primaryName, is_array($rawAliases) ? $rawAliases : []);

        $customer->update([
            'name' => $primaryName,
            'phone' => $normalizedPhone,
            'name_aliases' => $sanitizedAliases,
            'email' => array_key_exists('email', $validated) ? ($validated['email'] ?: null) : $customer->email,
            'notes' => array_key_exists('notes', $validated)
                ? ($validated['notes'] !== null && trim($validated['notes']) !== '' ? trim($validated['notes']) : null)
                : $customer->notes,
            'tags' => $sanitizedTags,
            'is_blocked' => array_key_exists('is_blocked', $validated)
                ? (bool) $validated['is_blocked']
                : (bool) $customer->is_blocked,
        ]);

        return back()->with('success', 'Profil & catatan internal pelanggan berhasil disimpan.');
    }

    public function merge(Request $request, Customer $customer): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $customer->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_bookings'), 403);

        $validated = $request->validate([
            'source_customer_id' => ['required', 'integer'],
        ]);

        $sourceId = (int) $validated['source_customer_id'];

        if ($sourceId === (int) $customer->id) {
            return back()->withErrors([
                'source_customer_id' => 'Tidak dapat menggabungkan profil pelanggan dengan dirinya sendiri.',
            ]);
        }

        [$sourceName, $sourcePhone] = DB::transaction(function () use ($business, $customer, $sourceId) {
            $target = Customer::where('business_id', $business->id)
                ->lockForUpdate()
                ->findOrFail($customer->id);

            $source = Customer::where('business_id', $business->id)
                ->lockForUpdate()
                ->findOrFail($sourceId);

            Booking::where('customer_id', $source->id)
                ->whereNull('booked_customer_name')
                ->update(['booked_customer_name' => $source->name]);

            Booking::where('customer_id', $source->id)
                ->update(['customer_id' => $target->id]);

            $mergedAliases = $this->sanitizeAliases(
                $target->name,
                is_array($target->name_aliases) ? $target->name_aliases : [],
                [$source->name],
                is_array($source->name_aliases) ? $source->name_aliases : []
            );

            $mergedTags = collect(array_merge(
                is_array($target->tags) ? $target->tags : [],
                is_array($source->tags) ? $source->tags : []
            ))
                ->map(fn ($tag) => trim((string) $tag))
                ->filter(fn ($tag) => $tag !== '')
                ->unique()
                ->take(10)
                ->values()
                ->all();

            $mergedNotes = $target->notes !== null && trim($target->notes) !== '' ? trim($target->notes) : null;
            $sourceNotes = $source->notes !== null && trim($source->notes) !== '' ? trim($source->notes) : null;

            if ($sourceNotes !== null && $sourceNotes !== $mergedNotes) {
                $appendedNote = "[Digabung dari {$source->name} (+{$source->phone})]: {$sourceNotes}";
                $mergedNotes = $mergedNotes !== null
                    ? mb_substr("{$mergedNotes}\n\n{$appendedNote}", 0, 2000)
                    : mb_substr($appendedNote, 0, 2000);
            }

            $target->update([
                'name_aliases' => $mergedAliases,
                'tags' => $mergedTags,
                'notes' => $mergedNotes,
                'email' => $target->email ?: $source->email,
            ]);

            $srcName = $source->name;
            $srcPhone = $source->phone;

            $source->delete();

            return [$srcName, $srcPhone];
        });

        return to_route('dashboard.customers.show', $customer->id)
            ->with('success', "Data pelanggan {$sourceName} (+{$sourcePhone}) berhasil digabungkan ke profil ini.");
    }

    /**
     * @param  array<int, mixed>  ...$aliasLists
     * @return array<int, string>
     */
    private function sanitizeAliases(string $primaryName, array ...$aliasLists): array
    {
        if (method_exists(Customer::class, 'mergeAliases')) {
            return Customer::mergeAliases($primaryName, ...$aliasLists);
        }

        $primaryLower = mb_strtolower(trim($primaryName));
        $seen = [];
        $result = [];

        foreach ($aliasLists as $list) {
            foreach ($list as $item) {
                $trimmed = mb_substr(trim((string) $item), 0, 120);
                if ($trimmed === '') {
                    continue;
                }
                $lower = mb_strtolower($trimmed);
                if ($lower === $primaryLower || isset($seen[$lower])) {
                    continue;
                }
                $seen[$lower] = true;
                $result[] = $trimmed;
                if (count($result) >= 10) {
                    break 2;
                }
            }
        }

        return array_values($result);
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

        $bookingNoun = $business->isDropoff() ? 'Pesanan' : ($business->isSpaceBooking() ? 'Booking' : 'Reservasi');
        $includeNoShow = ! $business->isDropoff();

        return response()->streamDownload(function () use ($customersQuery, $bookingNoun, $includeNoShow) {
            $handle = fopen('php://output', 'w');
            $headers = ['Nama', 'Telepon', 'Email', 'Tag', 'Status Booking Online', "Total {$bookingNoun}"];
            if ($includeNoShow) {
                $headers[] = 'No-Show';
            }
            $headers[] = 'Catatan Internal';
            $headers[] = 'Terdaftar';
            fputcsv($handle, $headers);
            foreach ($customersQuery->lazy(500) as $c) {
                $tagsText = is_array($c->tags) && count($c->tags) > 0 ? implode(', ', $c->tags) : '-';
                $row = [
                    $c->name,
                    $c->phone,
                    $c->email ?? '-',
                    $tagsText,
                    $c->is_blocked ? 'Diblokir' : 'Aktif',
                    $c->bookings_count,
                ];
                if ($includeNoShow) {
                    $row[] = $c->no_show_count ?? 0;
                }
                $row[] = $c->notes ?? '-';
                $row[] = $c->created_at?->toDateString();
                fputcsv($handle, CsvHelper::sanitizeRow($row));
            }
            fclose($handle);
        }, "janjiyan-customers-{$business->slug}.csv");
    }
}
