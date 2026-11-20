<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Services\PlanLimitService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    public function index(Request $request): Response
    {
        $business = $request->user()->resolveActiveBusiness();

        $services = $business
            ? $business->services()->with('staff:id,name')->latest()->get()->map(fn (Service $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'description' => $s->description,
                'image_url' => $s->image_path ? Storage::url($s->image_path) : null,
                'price' => $s->price,
                'duration_minutes' => $s->duration_minutes,
                'buffer_minutes' => $s->buffer_minutes,
                'capacity' => $s->capacity,
                'assignment_mode' => $s->assignment_mode,
                'booking_mode' => $s->booking_mode ?? 'time_slot',
                'turnaround_days' => (int) ($s->turnaround_days ?? 1),
                'supports_pickup' => (bool) ($s->supports_pickup ?? false),
                'dp_type' => $s->dp_type,
                'dp_value' => $s->dp_value,
                'is_active' => $s->is_active,
                'staff_ids' => $s->staff->pluck('id')->values(),
            ])
            : collect();

        $staffList = $business
            ? $business->staff()->where('is_active', true)->get(['id', 'name', 'title'])
            : collect();

        return Inertia::render('Dashboard/Services/Index', [
            'services' => $services,
            'staffList' => $staffList,
        ]);
    }

    public function store(Request $request, PlanLimitService $planLimitService): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_services'), 403);

        if (! $planLimitService->canCreateService($business)) {
            return back()->with('error', 'Jumlah layanan telah mencapai batas paket Anda.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'price' => ['required', 'integer', 'min:0'],
            'booking_mode' => ['sometimes', 'in:time_slot,dropoff'],
            'turnaround_days' => ['nullable', 'integer', 'min:0', 'max:90'],
            'supports_pickup' => ['nullable', 'boolean'],
            'duration_minutes' => ['required_unless:booking_mode,dropoff', 'nullable', 'integer', 'min:15', 'max:480'],
            'buffer_minutes' => ['required_unless:booking_mode,dropoff', 'nullable', 'integer', 'min:0', 'max:120'],
            'capacity' => ['required', 'integer', 'min:1', 'max:500'],
            'assignment_mode' => ['required_unless:booking_mode,dropoff', 'nullable', 'in:staff,capacity'],
            'dp_type' => ['required', 'in:none,fixed,percentage'],
            'dp_value' => ['required', 'integer', 'min:0'],
            'staff_ids' => ['array'],
            'staff_ids.*' => ['integer'],
        ]);

        $bookingMode = $validated['booking_mode'] ?? 'time_slot';
        $isDropoff = $bookingMode === 'dropoff';

        $imagePath = $request->hasFile('image')
            ? $request->file('image')->store('services', 'public')
            : null;

        $service = $business->services()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'image_path' => $imagePath,
            'price' => $validated['price'],
            'duration_minutes' => $isDropoff ? 60 : (int) $validated['duration_minutes'],
            'buffer_minutes' => $isDropoff ? 0 : (int) $validated['buffer_minutes'],
            'capacity' => $validated['capacity'],
            'assignment_mode' => $isDropoff ? 'capacity' : ($validated['assignment_mode'] ?? 'staff'),
            'booking_mode' => $bookingMode,
            'turnaround_days' => $isDropoff ? (int) ($validated['turnaround_days'] ?? 1) : 1,
            'supports_pickup' => $isDropoff ? (bool) ($validated['supports_pickup'] ?? false) : false,
            'dp_type' => $validated['dp_type'],
            'dp_value' => $validated['dp_type'] === 'none' ? 0 : $validated['dp_value'],
            'is_active' => true,
        ]);

        if (! $isDropoff && $service->assignment_mode === 'staff' && ! empty($validated['staff_ids'])) {
            $validIds = $business->staff()->whereIn('id', $validated['staff_ids'])->pluck('id');
            $service->staff()->sync($validIds);
        }

        return back()->with('success', "Layanan {$service->name} berhasil ditambahkan.");
    }

    public function update(Request $request, Service $service): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $service->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_services'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'remove_image' => ['nullable', 'boolean'],
            'price' => ['required', 'integer', 'min:0'],
            'booking_mode' => ['sometimes', 'in:time_slot,dropoff'],
            'turnaround_days' => ['nullable', 'integer', 'min:0', 'max:90'],
            'supports_pickup' => ['nullable', 'boolean'],
            'duration_minutes' => ['required_unless:booking_mode,dropoff', 'nullable', 'integer', 'min:15', 'max:480'],
            'buffer_minutes' => ['required_unless:booking_mode,dropoff', 'nullable', 'integer', 'min:0', 'max:120'],
            'capacity' => ['required', 'integer', 'min:1', 'max:500'],
            'assignment_mode' => ['required_unless:booking_mode,dropoff', 'nullable', 'in:staff,capacity'],
            'dp_type' => ['required', 'in:none,fixed,percentage'],
            'dp_value' => ['required', 'integer', 'min:0'],
            'is_active' => ['boolean'],
            'staff_ids' => ['array'],
            'staff_ids.*' => ['integer'],
        ]);

        $bookingMode = $validated['booking_mode'] ?? ($service->booking_mode ?? 'time_slot');
        $isDropoff = $bookingMode === 'dropoff';

        $imagePath = $service->image_path;
        if ($request->boolean('remove_image') && $imagePath) {
            Storage::disk('public')->delete($imagePath);
            $imagePath = null;
        }
        if ($request->hasFile('image')) {
            if ($imagePath) {
                Storage::disk('public')->delete($imagePath);
            }
            $imagePath = $request->file('image')->store('services', 'public');
        }

        $service->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'image_path' => $imagePath,
            'price' => $validated['price'],
            'duration_minutes' => $isDropoff ? ($service->duration_minutes ?: 60) : (int) $validated['duration_minutes'],
            'buffer_minutes' => $isDropoff ? 0 : (int) $validated['buffer_minutes'],
            'capacity' => $validated['capacity'],
            'assignment_mode' => $isDropoff ? 'capacity' : ($validated['assignment_mode'] ?? 'staff'),
            'booking_mode' => $bookingMode,
            'turnaround_days' => $isDropoff ? (int) ($validated['turnaround_days'] ?? 1) : 1,
            'supports_pickup' => $isDropoff ? (bool) ($validated['supports_pickup'] ?? false) : false,
            'dp_type' => $validated['dp_type'],
            'dp_value' => $validated['dp_type'] === 'none' ? 0 : $validated['dp_value'],
            'is_active' => $validated['is_active'] ?? $service->is_active,
        ]);

        if (! $isDropoff && $service->assignment_mode === 'staff') {
            $validIds = $business->staff()->whereIn('id', $validated['staff_ids'] ?? [])->pluck('id');
            $service->staff()->sync($validIds);
        } else {
            $service->staff()->detach();
        }

        return back()->with('success', "Layanan {$service->name} diperbarui.");
    }

    public function destroy(Request $request, Service $service): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $service->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_services'), 403);

        if ($service->bookings()->exists()) {
            $service->update(['is_active' => false]);

            return back()->with('success', 'Layanan dinonaktifkan karena sudah memiliki riwayat reservasi.');
        }

        if ($service->image_path) {
            Storage::disk('public')->delete($service->image_path);
        }

        $service->delete();

        return back()->with('success', 'Layanan berhasil dihapus.');
    }
}
