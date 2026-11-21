<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Services\PlanLimitService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        if ($business && in_array($business->business_type, Business::TYPES, true)) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Dashboard/Onboarding');
    }

    public function store(Request $request, PlanLimitService $planLimitService): RedirectResponse
    {
        $user = $request->user();
        $existingBusiness = $user->resolveActiveBusiness();

        if ($existingBusiness && in_array($existingBusiness->business_type, Business::TYPES, true)) {
            return redirect()->route('dashboard');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'business_type' => ['required', 'string', Rule::in(Business::TYPES)],
            'category' => ['required', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $business = DB::transaction(function () use ($user, $validated, $planLimitService): Business {
            $planLimitService->ensureTrialSubscription($user);

            $baseSlug = Str::slug($validated['name']) ?: 'bisnis';
            $slug = $baseSlug;
            $counter = 1;
            while (Business::where('slug', $slug)->exists()) {
                $slug = "{$baseSlug}-{$counter}";
                $counter++;
            }

            $business = Business::create([
                'owner_id' => $user->id,
                'name' => $validated['name'],
                'slug' => $slug,
                'category' => $validated['category'],
                'business_type' => $validated['business_type'],
                'phone' => $validated['phone'] ?? null,
                'address' => $validated['address'] ?? null,
                'timezone' => 'Asia/Jakarta',
                'dp_expiry_minutes' => 120,
            ]);

            $business->users()->attach($user->id, [
                'role' => 'owner',
                'permissions' => json_encode(['*']),
            ]);
            $business->seedDefaultOperatingHours();

            $user->update(['active_business_id' => $business->id]);

            return $business;
        });

        return to_route('dashboard')
            ->with('success', "Bisnis {$business->name} berhasil disiapkan! Tambahkan layanan pertama Anda.");
    }
}
