<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'business_id',
        'name',
        'name_aliases',
        'phone',
        'email',
        'notes',
        'tags',
        'is_blocked',
    ];

    protected function casts(): array
    {
        return [
            'name_aliases' => 'array',
            'tags' => 'array',
            'is_blocked' => 'boolean',
        ];
    }

    /**
     * Merge candidate alias lists while excluding the primary name and deduplicating case-insensitively.
     *
     * @param  array<int, mixed>  ...$aliasLists
     * @return array<int, string>
     */
    public static function mergeAliases(string $primaryName, array ...$aliasLists): array
    {
        $normalizedPrimary = mb_strtolower(trim($primaryName));
        $seen = [];

        foreach ($aliasLists as $list) {
            foreach ($list as $candidate) {
                if (! is_string($candidate) && ! is_numeric($candidate)) {
                    continue;
                }

                $trimmed = trim(mb_substr(trim((string) $candidate), 0, 120));
                if ($trimmed === '') {
                    continue;
                }

                $lower = mb_strtolower($trimmed);
                if ($lower === $normalizedPrimary || isset($seen[$lower])) {
                    continue;
                }

                $seen[$lower] = $trimmed;

                if (count($seen) >= 10) {
                    break 2;
                }
            }
        }

        return array_values($seen);
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}
