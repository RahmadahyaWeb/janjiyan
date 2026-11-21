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

class BusinessController extends Controller
{
    public function create(Request $request, PlanLimitService $planLimitService): Response
    {
        return Inertia::render('Dashboard/Businesses/Create', [
            'canCreateBusiness' => $planLimitService->canCreateBusiness($request->user()),
        ]);
    }

    public function store(Request $request, PlanLimitService $planLimitService): RedirectResponse
    {
        $user = $request->user();
        if (! $planLimitService->canCreateBusiness($user)) {
            return back()->with('error', 'Jumlah bisnis sudah mencapai batas paket Anda. Silakan upgrade paket.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'business_type' => ['required', 'string', Rule::in(Business::TYPES)],
            'category' => ['required', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $business = DB::transaction(function () use ($user, $validated): Business {
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

        return to_route('dashboard')->with('success', "Bisnis {$business->name} berhasil dibuat!");
    }
}
