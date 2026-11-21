<?php

namespace App\Http\Middleware;

use App\Models\Business;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureBusinessOnboarded
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        if ($user->is_superadmin) {
            return redirect()->route('admin.index');
        }

        if ($request->routeIs('onboarding.*', 'logout', 'verification.*')) {
            return $next($request);
        }

        $business = $user->resolveActiveBusiness();

        if (! $business || ! in_array($business->business_type, Business::TYPES, true)) {
            return redirect()->route('onboarding.business');
        }

        return $next($request);
    }
}
