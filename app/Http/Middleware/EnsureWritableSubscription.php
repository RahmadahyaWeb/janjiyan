<?php

namespace App\Http\Middleware;

use App\Services\PlanLimitService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureWritableSubscription
{
    public function __construct(
        private readonly PlanLimitService $planLimitService
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        if ($request->routeIs('dashboard.businesses.store')) {
            if (! $this->planLimitService->hasActiveSubscription($user)) {
                return $this->deny(
                    $request,
                    'Masa trial atau langganan Anda telah berakhir. Silakan perpanjang paket di menu Paket & Billing.'
                );
            }

            return $next($request);
        }

        $business = $user->resolveActiveBusiness();
        if (! $business) {
            return $next($request);
        }

        if ($business->isSuspended()) {
            $reason = $business->suspension_reason
                ? " Alasan: {$business->suspension_reason}"
                : '';

            return $this->deny(
                $request,
                "Bisnis ini sedang ditangguhkan oleh administrator sehingga operasi tulis dinonaktifkan.{$reason}"
            );
        }

        if (! $this->planLimitService->hasActiveSubscription($business->owner)) {
            return $this->deny(
                $request,
                'Masa trial atau langganan bisnis ini telah berakhir. Silakan perpanjang paket di menu Paket & Billing.'
            );
        }

        return $next($request);
    }

    private function deny(Request $request, string $message): Response
    {
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $message], 403);
        }

        return back()->with('error', $message);
    }
}
