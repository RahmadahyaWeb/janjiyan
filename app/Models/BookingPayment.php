<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingPayment extends Model
{
    public const METHOD_CASH = 'cash';

    public const METHOD_QRIS = 'qris';

    public const METHOD_TRANSFER = 'transfer';

    public const METHOD_EDC = 'edc';

    public const METHODS = [
        self::METHOD_CASH,
        self::METHOD_QRIS,
        self::METHOD_TRANSFER,
        self::METHOD_EDC,
    ];

    public const TYPE_DP = 'dp';

    public const TYPE_SETTLEMENT = 'settlement';

    public const TYPE_PARTIAL = 'partial';

    public const TYPE_ADJUSTMENT = 'adjustment';

    public const TYPE_REFUND = 'refund';

    public const TYPES = [
        self::TYPE_DP,
        self::TYPE_SETTLEMENT,
        self::TYPE_PARTIAL,
        self::TYPE_ADJUSTMENT,
        self::TYPE_REFUND,
    ];

    protected $fillable = [
        'booking_id',
        'business_id',
        'payment_type',
        'payment_method',
        'amount',
        'received_amount',
        'change_amount',
        'recorded_by_user_id',
        'paid_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'received_amount' => 'integer',
            'change_amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by_user_id');
    }
}
