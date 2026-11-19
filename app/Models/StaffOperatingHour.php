<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffOperatingHour extends Model
{
    protected $fillable = [
        'staff_id',
        'day_of_week',
        'is_working',
        'start_time',
        'end_time',
        'break_start',
        'break_end',
    ];

    protected function casts(): array
    {
        return [
            'is_working' => 'boolean',
        ];
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }
}
