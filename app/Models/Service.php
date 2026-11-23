<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{
    public const DEFAULT_UNIT_LABEL = 'item';

    public const UNIT_LABELS = [
        'item',
        'pasang',
        'kg',
        'pcs',
        'unit',
    ];

    protected $fillable = [
        'business_id',
        'name',
        'description',
        'image_path',
        'price',
        'duration_minutes',
        'buffer_minutes',
        'capacity',
        'assignment_mode',
        'booking_mode',
        'turnaround_days',
        'supports_pickup',
        'unit_label',
        'dp_type',
        'dp_value',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'turnaround_days' => 'integer',
            'supports_pickup' => 'boolean',
        ];
    }

    public function isDropoff(): bool
    {
        return $this->booking_mode === 'dropoff';
    }

    public function resolvedUnitLabel(): string
    {
        $unit = is_string($this->unit_label) ? trim($this->unit_label) : '';

        return in_array($unit, self::UNIT_LABELS, true) ? $unit : self::DEFAULT_UNIT_LABEL;
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(Staff::class, 'service_staff');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function addons(): BelongsToMany
    {
        return $this->belongsToMany(ServiceAddon::class, 'service_addon_assignments')
            ->withTimestamps();
    }

    public function bookingItems(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }

    public function calculateDpAmount(): int
    {
        if ($this->dp_type === 'fixed') {
            return min($this->price, (int) $this->dp_value);
        }

        if ($this->dp_type === 'percentage') {
            return (int) round($this->price * ($this->dp_value / 100));
        }

        return 0;
    }
}
