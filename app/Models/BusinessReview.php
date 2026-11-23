<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessReview extends Model
{
    protected $fillable = [
        'business_id',
        'booking_id',
        'customer_id',
        'reviewer_name',
        'reviewer_phone',
        'rating',
        'comment',
        'redirected_to_google',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'redirected_to_google' => 'boolean',
        ];
    }

    public static function isValidGoogleReviewUrl(?string $url): bool
    {
        if ($url === null || trim($url) === '') {
            return true;
        }

        $trimmed = trim($url);
        if (filter_var($trimmed, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($trimmed);
        if (! is_array($parts)) {
            return false;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        if ($scheme !== 'https') {
            return false;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        if (isset($parts['port']) && (int) $parts['port'] !== 443) {
            return false;
        }

        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        if ($host === '') {
            return false;
        }

        if ($host === 'google.com' || str_ends_with($host, '.google.com')) {
            return true;
        }

        if ($host === 'g.page' || str_ends_with($host, '.g.page')) {
            return true;
        }

        return $host === 'maps.app.goo.gl';
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
