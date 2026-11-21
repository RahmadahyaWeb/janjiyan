<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'email_verified_at',
        'google_id',
        'avatar_url',
        'active_business_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_superadmin' => 'boolean',
        ];
    }

    public function subscriptionInvoices(): HasMany
    {
        return $this->hasMany(SubscriptionInvoice::class);
    }

    public function ownedBusinesses(): HasMany
    {
        return $this->hasMany(Business::class, 'owner_id');
    }

    public function businesses(): BelongsToMany
    {
        return $this->belongsToMany(Business::class, 'business_user')
            ->withPivot(['role', 'permissions'])
            ->withTimestamps();
    }

    public function activeBusiness(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'active_business_id');
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function resolveActiveBusiness(): ?Business
    {
        if ($this->active_business_id) {
            $business = $this->businesses()->where('businesses.id', $this->active_business_id)->first();
            if ($business) {
                return $business;
            }
        }

        $first = $this->businesses()->first();
        if ($first) {
            $this->update(['active_business_id' => $first->id]);
        }

        return $first;
    }

    /** Panel permissions a team member can be granted (owner and admin have all of them). */
    public const BUSINESS_PERMISSIONS = [
        'manage_bookings',
        'verify_payments',
        'manage_services',
        'manage_staff',
        'manage_settings',
    ];

    /** @var array<int, Business|null> Per-request membership cache, keyed by business id. */
    private array $membershipCache = [];

    public function hasBusinessPermission(Business $business, string $permission): bool
    {
        if ((int) $business->owner_id === (int) $this->id) {
            return true;
        }

        $membership = $this->membershipCache[$business->id]
            ??= $this->businesses()->where('businesses.id', $business->id)->first();
        if (! $membership) {
            return false;
        }

        if ($membership->pivot->role === 'owner' || $membership->pivot->role === 'admin') {
            return true;
        }

        $permissions = json_decode((string) $membership->pivot->permissions, true) ?? [];

        return in_array($permission, $permissions, true);
    }

    /**
     * Kill every way someone else may still be signed in as this user: remember-me token and
     * database sessions. Call when ownership of the account changes hands or is elevated.
     */
    public function revokeOtherCredentials(): void
    {
        $this->forceFill(['remember_token' => Str::random(60)])->save();

        if (config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $this->id)
                ->delete();
        }
    }
}
