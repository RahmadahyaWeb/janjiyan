<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\Staff;
use App\Models\User;
use App\Services\IcsCalendarService;
use App\Services\PlanLimitService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StaffController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(! $business || $user->hasBusinessPermission($business, 'manage_staff'), 403);

        $staff = $business
            ? $business->staff()
                ->with('user:id,email')
                ->withCount('operatingHours')
                ->withCount(['timeOffs as upcoming_time_offs_count' => fn ($q) => $q->whereDate('end_date', '>=', now()->toDateString())])
                ->latest()
                ->get()
                ->map(fn (Staff $s) => $this->serializeStaff($s, $business))
            : collect();

        return Inertia::render('Dashboard/Staff/Index', [
            'staffMembers' => $staff,
        ]);
    }

    public function create(Request $request): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        return Inertia::render('Dashboard/Staff/Form', [
            'staffMember' => null,
        ]);
    }

    public function edit(Request $request, Staff $staff): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $staff->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        $staff->loadMissing('user:id,email');

        return Inertia::render('Dashboard/Staff/Form', [
            'staffMember' => $this->serializeStaff($staff, $business),
        ]);
    }

    public function store(Request $request, PlanLimitService $planLimitService): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        if (! $planLimitService->canCreateStaff($business)) {
            return back()->with('error', 'Jumlah staff telah mencapai batas paket Anda.');
        }

        $grantLogin = $request->boolean('grant_login');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'title' => ['nullable', 'string', 'max:80'],
            'email' => [Rule::requiredIf($grantLogin), 'nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'grant_login' => ['boolean'],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['nullable', Rule::in(['admin', 'staff'])],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::in(User::BUSINESS_PERMISSIONS)],
            'commission_type' => ['sometimes', Rule::in(['none', 'percentage', 'fixed'])],
            'commission_value' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
        ]);

        $commissionType = $validated['commission_type'] ?? 'none';
        $commissionValue = $this->normalizeCommissionValue($commissionType, (int) ($validated['commission_value'] ?? 0));

        $normalizedEmail = ! empty($validated['email']) ? strtolower(trim($validated['email'])) : null;

        DB::transaction(function () use ($user, $business, $grantLogin, $validated, $normalizedEmail, $commissionType, $commissionValue): void {
            $linkedUserId = null;

            if ($grantLogin && $normalizedEmail !== null) {
                $existingUser = User::where('email', $normalizedEmail)->first();

                if ($existingUser) {
                    if ((int) $existingUser->id !== (int) $user->id) {
                        throw ValidationException::withMessages([
                            'email' => 'Email ini sudah terdaftar pada akun Janjiyan lain. Gunakan email khusus untuk akun staff baru.',
                        ]);
                    }

                    // Owner adding themselves as a bookable staff member keeps their existing credentials and owner role.
                    $linkedUserId = $existingUser->id;
                } else {
                    if (empty($validated['password'])) {
                        throw ValidationException::withMessages([
                            'password' => 'Kata sandi wajib diisi minimal 8 karakter untuk akun login staff baru.',
                        ]);
                    }

                    $staffUser = User::create([
                        'name' => $validated['name'],
                        'email' => $normalizedEmail,
                        'password' => Hash::make($validated['password']),
                        'email_verified_at' => now(),
                    ]);

                    $canAssignAdmin = $user->hasBusinessPermission($business, '*');
                    $role = ($validated['role'] ?? 'staff') === 'admin' && $canAssignAdmin
                        ? 'admin'
                        : 'staff';
                    $permissions = $role === 'admin'
                        ? ['*']
                        : array_values(array_unique($validated['permissions'] ?? ['manage_bookings', 'verify_payments']));

                    $business->users()->syncWithoutDetaching([
                        $staffUser->id => [
                            'role' => $role,
                            'permissions' => json_encode($permissions),
                        ],
                    ]);

                    $linkedUserId = $staffUser->id;
                }
            }

            $business->staff()->create([
                'user_id' => $linkedUserId,
                'name' => $validated['name'],
                'title' => $validated['title'] ?? null,
                'email' => $normalizedEmail,
                'phone' => $validated['phone'] ?? null,
                'is_active' => true,
                'commission_type' => $commissionType,
                'commission_value' => $commissionValue,
            ]);
        });

        return to_route('dashboard.staff')->with('success', "Staff {$validated['name']} berhasil ditambahkan.");
    }

    public function update(Request $request, Staff $staff): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $staff->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'title' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['required', 'boolean'],
            'role' => ['nullable', Rule::in(['admin', 'staff'])],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::in(User::BUSINESS_PERMISSIONS)],
            'commission_type' => ['sometimes', Rule::in(['none', 'percentage', 'fixed'])],
            'commission_value' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
        ]);

        $commissionType = array_key_exists('commission_type', $validated)
            ? $validated['commission_type']
            : ($staff->commission_type ?: 'none');
        $commissionValue = array_key_exists('commission_type', $validated) || array_key_exists('commission_value', $validated)
            ? $this->normalizeCommissionValue($commissionType, (int) ($validated['commission_value'] ?? 0))
            : (int) ($staff->commission_value ?? 0);

        DB::transaction(function () use ($user, $business, $staff, $validated, $commissionType, $commissionValue): void {
            $staff->update([
                'name' => $validated['name'],
                'title' => $validated['title'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'is_active' => (bool) $validated['is_active'],
                'commission_type' => $commissionType,
                'commission_value' => $commissionValue,
            ]);

            if ($staff->user_id && (int) $staff->user_id !== (int) $business->owner_id) {
                $canAssignAdmin = $user->hasBusinessPermission($business, '*');
                $role = ($validated['role'] ?? 'staff') === 'admin' && $canAssignAdmin
                    ? 'admin'
                    : 'staff';
                $permissions = $role === 'admin'
                    ? ['*']
                    : array_values(array_unique($validated['permissions'] ?? ['manage_bookings', 'verify_payments']));

                $business->users()->updateExistingPivot($staff->user_id, [
                    'role' => $role,
                    'permissions' => json_encode($permissions),
                ]);
            }
        });

        return to_route('dashboard.staff')->with('success', "Data staff {$validated['name']} berhasil diperbarui.");
    }

    public function destroy(Request $request, Staff $staff): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $staff->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        if ($staff->user_id && $staff->user_id !== $business->owner_id) {
            $business->users()->detach($staff->user_id);
        }

        $staff->delete();

        return back()->with('success', 'Data staff dihapus.');
    }

    public function calendarIcs(Request $request, Staff $staff, IcsCalendarService $icsService): HttpResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business
            && $staff->business_id === $business->id
            && ($user->hasBusinessPermission($business, 'manage_staff') || (int) $staff->user_id === (int) $user->id),
            403
        );

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $fromDate = CarbonImmutable::now($tz)->startOfDay()->toDateString();
        $toDate = CarbonImmutable::now($tz)->addDays(60)->toDateString();

        $bookings = $staff->bookings()
            ->where('business_id', $business->id)
            ->whereIn('reservation_status', ['pending', 'confirmed'])
            ->whereBookingDateBetween($fromDate, $toDate)
            ->with(['service', 'customer'])
            ->orderBy('start_at')
            ->limit(250)
            ->get();

        $icsContent = $icsService->generateStaffScheduleIcs($business, $staff, $bookings);
        $safeSlug = preg_replace('/[^a-z0-9\-]+/i', '-', strtolower($staff->name)) ?: 'staff';

        return response($icsContent, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"jadwal-{$safeSlug}.ics\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    private function normalizeCommissionValue(string $type, int $value): int
    {
        if ($type === 'percentage') {
            return max(0, min(100, $value));
        }

        if ($type === 'fixed') {
            return max(0, min(100000000, $value));
        }

        return 0;
    }

    /**
     * Format a staff member model with dashboard membership role & permissions.
     */
    private function serializeStaff(Staff $s, Business $business): array
    {
        $membership = $s->user_id
            ? $business->users()->where('users.id', $s->user_id)->first()
            : null;

        return [
            'id' => $s->id,
            'name' => $s->name,
            'title' => $s->title,
            'email' => $s->email,
            'phone' => $s->phone,
            'is_active' => $s->is_active,
            'commission_type' => $s->commission_type ?: 'none',
            'commission_value' => (int) ($s->commission_value ?? 0),
            'has_login' => $s->user_id !== null,
            'has_custom_schedule' => (int) ($s->operating_hours_count ?? 0) > 0,
            'upcoming_time_offs_count' => (int) ($s->upcoming_time_offs_count ?? 0),
            'role' => $membership?->pivot->role ?? null,
            'permissions' => $membership ? (json_decode((string) $membership->pivot->permissions, true) ?? []) : [],
        ];
    }
}
