<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingItem extends Model
{
    public const TYPE_SERVICE = 'service';

    public const TYPE_ADDON = 'addon';

    public const TYPE_CUSTOM = 'custom';

    public const TYPES = [
        self::TYPE_SERVICE,
        self::TYPE_ADDON,
        self::TYPE_CUSTOM,
    ];

    protected $fillable = [
        'booking_id',
        'item_type',
        'service_id',
        'service_addon_id',
        'name_snapshot',
        'unit_label_snapshot',
        'unit_price',
        'quantity',
        'duration_minutes_snapshot',
        'turnaround_days_snapshot',
        'is_commissionable',
        'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'integer',
            'quantity' => 'integer',
            'duration_minutes_snapshot' => 'integer',
            'turnaround_days_snapshot' => 'integer',
            'is_commissionable' => 'boolean',
            'subtotal' => 'integer',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function serviceAddon(): BelongsTo
    {
        return $this->belongsTo(ServiceAddon::class);
    }
}
