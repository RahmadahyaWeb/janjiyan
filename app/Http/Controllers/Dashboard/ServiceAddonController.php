<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Services\PlanLimitService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceAddonController extends Controller
{
    public function store(Request $request, PlanLimitService $planLimitService): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_services'), 403);

        if (! $planLimitService->canCreateAddon($business)) {
            return back()->with('error', 'Jumlah add-on telah mencapai batas paket Anda.');
        }

        $validated = $this->validateAddon($request);
        $appliesToAll = (bool) ($validated['applies_to_all_services'] ?? true);

        $addon = $business->serviceAddons()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'price' => (int) $validated['price'],
            'unit_label' => (string) ($validated['unit_label'] ?? Service::DEFAULT_UNIT_LABEL),
            'duration_minutes' => $business->isDropoff() ? 0 : (int) ($validated['duration_minutes'] ?? 0),
            'is_commissionable' => $business->supportsCommissions() ? (bool) ($validated['is_commissionable'] ?? false) : false,
            'applies_to_all_services' => $appliesToAll,
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
        ]);

        $this->syncServiceAssignments($business, $addon, $appliesToAll, $validated['service_ids'] ?? []);

        return back()->with('success', "Add-on {$addon->name} berhasil ditambahkan.");
    }

    public function update(Request $request, ServiceAddon $addon): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business
            && $addon->business_id === $business->id
            && $user->hasBusinessPermission($business, 'manage_services'),
            403
        );

        $validated = $this->validateAddon($request, true);
        $appliesToAll = array_key_exists('applies_to_all_services', $validated)
            ? (bool) $validated['applies_to_all_services']
            : (bool) $addon->applies_to_all_services;

        $addon->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'price' => (int) $validated['price'],
            'unit_label' => (string) ($validated['unit_label'] ?? $addon->resolvedUnitLabel()),
            'duration_minutes' => $business->isDropoff() ? 0 : (int) ($validated['duration_minutes'] ?? 0),
            'is_commissionable' => $business->supportsCommissions() ? (bool) ($validated['is_commissionable'] ?? false) : false,
            'applies_to_all_services' => $appliesToAll,
            'is_active' => $validated['is_active'] ?? $addon->is_active,
            'sort_order' => (int) ($validated['sort_order'] ?? $addon->sort_order),
        ]);

        $this->syncServiceAssignments($business, $addon, $appliesToAll, $validated['service_ids'] ?? []);

        return back()->with('success', "Add-on {$addon->name} diperbarui.");
    }

    public function destroy(Request $request, ServiceAddon $addon): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business
            && $addon->business_id === $business->id
            && $user->hasBusinessPermission($business, 'manage_services'),
            403
        );

        if ($addon->bookingItems()->exists()) {
            $addon->update(['is_active' => false]);
            $noun = $business->isDropoff() ? 'pesanan' : ($business->isSpaceBooking() ? 'booking' : 'reservasi');

            return back()->with('success', "Add-on dinonaktifkan karena sudah memiliki riwayat {$noun}.");
        }

        $addon->services()->detach();
        $addon->delete();

        return back()->with('success', 'Add-on layanan berhasil dihapus.');
    }

    /**
     * Serialize a ServiceAddon model to match frontend ServiceAddon TypeScript contract.
     *
     * @return array<string, mixed>
     */
    public static function serializeAddon(ServiceAddon $addon): array
    {
        $serviceIds = $addon->relationLoaded('services')
            ? $addon->services->pluck('id')
            : $addon->services()->pluck('services.id');

        return [
            'id' => $addon->id,
            'name' => $addon->name,
            'description' => $addon->description,
            'price' => (int) $addon->price,
            'unit_label' => $addon->resolvedUnitLabel(),
            'duration_minutes' => (int) $addon->duration_minutes,
            'is_commissionable' => (bool) $addon->is_commissionable,
            'applies_to_all_services' => (bool) $addon->applies_to_all_services,
            'is_active' => (bool) $addon->is_active,
            'sort_order' => (int) $addon->sort_order,
            'service_ids' => $serviceIds->map(fn ($id): int => (int) $id)->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateAddon(Request $request, bool $isUpdate = false): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'price' => ['required', 'integer', 'min:0'],
            'unit_label' => ['nullable', 'string', Rule::in(Service::UNIT_LABELS)],
            'duration_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'is_commissionable' => ['nullable', 'boolean'],
            'applies_to_all_services' => ['nullable', 'boolean'],
            'is_active' => $isUpdate ? ['sometimes', 'boolean'] : ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer'],
        ]);
    }

    /**
     * @param  array<int, int|string>  $requestedServiceIds
     */
    private function syncServiceAssignments(
        Business $business,
        ServiceAddon $addon,
        bool $appliesToAll,
        array $requestedServiceIds
    ): void {
        if ($appliesToAll) {
            $addon->services()->detach();

            return;
        }

        $validIds = $business->services()
            ->whereIn('id', $requestedServiceIds)
            ->pluck('id');
        $addon->services()->sync($validIds);
    }
}
