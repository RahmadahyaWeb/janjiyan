<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Staff extends Model
{
    protected $table = 'staff';

    protected $fillable = [
        'business_id',
        'user_id',
        'name',
        'title',
        'email',
        'phone',
        'avatar_path',
        'is_active',
        'commission_type',
        'commission_value',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'commission_value' => 'integer',
        ];
    }

    public function calculateCommission(int $totalPrice): int
    {
        if ($totalPrice <= 0) {
            return 0;
        }

        if ($this->commission_type === 'percentage') {
            $pct = max(0, min(100, (int) $this->commission_value));

            return (int) round($totalPrice * ($pct / 100));
        }

        if ($this->commission_type === 'fixed') {
            return min($totalPrice, max(0, (int) $this->commission_value));
        }

        return 0;
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'service_staff');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function operatingHours(): HasMany
    {
        return $this->hasMany(StaffOperatingHour::class)->orderBy('day_of_week');
    }

    public function timeOffs(): HasMany
    {
        return $this->hasMany(StaffTimeOff::class)->orderBy('start_date');
    }
}
