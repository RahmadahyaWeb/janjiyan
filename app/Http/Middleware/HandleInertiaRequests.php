<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\PlanLimitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();
        $activeBusiness = null;
        $businesses = [];
        $subscriptionData = null;
        $pendingBookingsCount = 0;

        $shouldLoadTenantContext = $user !== null
            && $request->routeIs('dashboard', 'dashboard.*', 'admin.*');

        if ($shouldLoadTenantContext) {
            $active = $user->resolveActiveBusiness();
            $businesses = $user->businesses()
                ->with(['services:id,business_id,booking_mode,is_active'])
                ->get()
                ->map(fn ($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'slug' => $b->slug,
                    'category' => $b->category,
                    'qr_poster_subtitle' => $b->qr_poster_subtitle,
                    'logo_url' => $b->logo_path ? Storage::url($b->logo_path) : null,
                    'role' => $b->pivot->role,
                    'permissions' => json_decode((string) $b->pivot->permissions, true) ?? [],
                    'is_suspended' => $b->isSuspended(),
                    'suspension_reason' => $b->suspension_reason,
                    'primary_booking_mode' => $b->primaryBookingMode(),
                ])
                ->values()
                ->all();

            if ($active) {
                $activeBusiness = collect($businesses)->firstWhere('id', $active->id);
                $activeBusiness['primary_booking_mode'] = $activeBusiness['primary_booking_mode'] ?? $active->primaryBookingMode();
                // Resolved server-side so the UI hides exactly what the controllers would refuse.
                $activeBusiness['can'] = collect(User::BUSINESS_PERMISSIONS)
                    ->mapWithKeys(fn (string $p) => [$p => $user->hasBusinessPermission($active, $p)])
                    ->put('owner', (int) $active->owner_id === (int) $user->id)
                    ->all();
                $pendingBookingsCount = $active->bookings()
                    ->where(function ($q) {
                        $q->where('reservation_status', 'pending')
                            ->orWhere('payment_status', 'waiting_verification');
                    })
                    ->count();
            }

            $owner = $active?->owner ?? $user;
            $sub = app(PlanLimitService::class)->ensureTrialSubscription($owner);
            $subscriptionData = [
                'id' => $sub->id,
                'plan' => $sub->plan,
                'status' => $sub->status,
                'effective_status' => $sub->effectiveStatus(),
                'trial_ends_at' => $sub->trial_ends_at?->toIso8601String(),
                'current_period_ends_at' => $sub->current_period_ends_at?->toIso8601String(),
                'is_trial' => $sub->isTrial(),
                'is_expired' => $sub->isExpired(),
                'days_remaining' => $sub->daysRemaining(),
            ];
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => $user->avatar_url,
                    'has_google_linked' => filled($user->google_id),
                    'is_superadmin' => (bool) $user->is_superadmin,
                ] : null,
            ],
            'activeBusiness' => $activeBusiness,
            'businesses' => $businesses,
            'subscription' => $subscriptionData,
            'pendingBookingsCount' => $pendingBookingsCount,
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
