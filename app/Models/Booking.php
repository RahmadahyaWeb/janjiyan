<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    public const PICKUP_SESSIONS = [
        'morning' => 'Pagi (09:00–12:00)',
        'afternoon' => 'Siang (13:00–17:00)',
        'evening' => 'Sore (17:00–20:00)',
        'anytime' => 'Fleksibel (Jam Buka)',
    ];

    public const WORK_STATUSES = [
        'awaiting_dropoff',
        'in_progress',
        'ready_for_pickup',
        'picked_up',
    ];

    protected $fillable = [
        'business_id',
        'service_id',
        'staff_id',
        'customer_id',
        'booked_customer_name',
        'booked_customer_email',
        'booking_mode',
        'quantity',
        'unit_label',
        'fulfillment_type',
        'pickup_session',
        'pickup_address',
        'booking_code',
        'invoice_number',
        'invoice_token',
        'booking_date',
        'start_at',
        'end_at',
        'buffer_end_at',
        'estimated_ready_date',
        'total_price',
        'dp_amount',
        'commission_amount',
        'reservation_status',
        'work_status',
        'payment_status',
        'dp_proof_path',
        'dp_expires_at',
        'cancellation_reason',
        'customer_notes',
        'rescheduled_count',
        'last_rescheduled_at',
        'reminder_h1_sent_at',
        'reminder_h2_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'booking_date' => 'date',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'buffer_end_at' => 'datetime',
            'estimated_ready_date' => 'date',
            'dp_expires_at' => 'datetime',
            'commission_amount' => 'integer',
            'rescheduled_count' => 'integer',
            'last_rescheduled_at' => 'datetime',
            'reminder_h1_sent_at' => 'datetime',
            'reminder_h2_sent_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Booking $booking): void {
            $unit = is_string($booking->unit_label) ? trim($booking->unit_label) : '';
            if (in_array($unit, Service::UNIT_LABELS, true)) {
                $booking->unit_label = $unit;

                return;
            }

            $serviceUnit = $booking->relationLoaded('service')
                ? $booking->service?->resolvedUnitLabel()
                : Service::whereKey($booking->service_id)->value('unit_label');

            $booking->unit_label = is_string($serviceUnit) && in_array(trim($serviceUnit), Service::UNIT_LABELS, true)
                ? trim($serviceUnit)
                : Service::DEFAULT_UNIT_LABEL;
        });
    }

    public function isDropoff(): bool
    {
        return $this->booking_mode === 'dropoff';
    }

    public function resolvedUnitLabel(): string
    {
        $unit = is_string($this->unit_label) ? trim($this->unit_label) : '';
        if (in_array($unit, Service::UNIT_LABELS, true)) {
            return $unit;
        }

        return $this->service?->resolvedUnitLabel() ?? Service::DEFAULT_UNIT_LABEL;
    }

    public function scheduleDisplayLabel(string $timezone = 'Asia/Jakarta'): string
    {
        if (! $this->isDropoff()) {
            return $this->start_at->setTimezone($timezone)->format('H:i');
        }

        if ($this->fulfillment_type === 'pickup') {
            $sessionLabel = self::PICKUP_SESSIONS[$this->pickup_session ?? 'anytime'] ?? 'Fleksibel';

            return "Jemput · {$sessionLabel}";
        }

        return 'Drop-off (Jam Buka)';
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * Filter by exact booking_date using B-tree index on MySQL/MariaDB while remaining SQLite-safe.
     *
     * @param  Builder<Booking>  $query
     * @return Builder<Booking>
     */
    public function scopeWhereBookingDate(Builder $query, string $date): Builder
    {
        if ($query->getConnection()->getDriverName() === 'sqlite') {
            return $query->whereDate('booking_date', $date);
        }

        return $query->where('booking_date', $date);
    }

    /**
     * Filter by inclusive booking_date range using B-tree index on MySQL/MariaDB while remaining SQLite-safe.
     *
     * @param  Builder<Booking>  $query
     * @return Builder<Booking>
     */
    public function scopeWhereBookingDateBetween(Builder $query, ?string $from, ?string $to): Builder
    {
        $isSqlite = $query->getConnection()->getDriverName() === 'sqlite';

        if ($from !== null && $from !== '') {
            $isSqlite ? $query->whereDate('booking_date', '>=', $from) : $query->where('booking_date', '>=', $from);
        }

        if ($to !== null && $to !== '') {
            $isSqlite ? $query->whereDate('booking_date', '<=', $to) : $query->where('booking_date', '<=', $to);
        }

        return $query;
    }
}
