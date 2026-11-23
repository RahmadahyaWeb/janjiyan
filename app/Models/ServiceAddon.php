<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceAddon extends Model
{
    protected $fillable = [
        'business_id',
        'name',
        'description',
        'price',
        'unit_label',
        'duration_minutes',
        'is_commissionable',
        'applies_to_all_services',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'duration_minutes' => 'integer',
            'is_commissionable' => 'boolean',
            'applies_to_all_services' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function resolvedUnitLabel(): string
    {
        $unit = is_string($this->unit_label) ? trim($this->unit_label) : '';

        return in_array($unit, Service::UNIT_LABELS, true) ? $unit : Service::DEFAULT_UNIT_LABEL;
    }

    public function appliesToService(int $serviceId): bool
    {
        $assignedIds = $this->relationLoaded('services')
            ? $this->services->pluck('id')->all()
            : $this->services()->pluck('services.id')->all();

        if ($assignedIds !== []) {
            return in_array($serviceId, array_map('intval', $assignedIds), true);
        }

        return (bool) $this->applies_to_all_services;
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'service_addon_assignments')
            ->withTimestamps();
    }

    public function bookingItems(): HasMany
    {
        return $this->hasMany(BookingItem::class, 'service_addon_id');
    }
}
