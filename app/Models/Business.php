<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Business extends Model
{
    public const DEFAULT_QR_POSTER_SUBTITLE = 'Scan QR untuk Booking Online';

    protected $hidden = [
        'telegram_bot_token',
    ];

    protected $fillable = [
        'owner_id',
        'name',
        'slug',
        'category',
        'description',
        'qr_poster_subtitle',
        'phone',
        'address',
        'timezone',
        'logo_path',
        'brand_color',
        'cover_path',
        'qris_path',
        'bank_accounts',
        'dp_expiry_minutes',
        'min_booking_lead_minutes',
        'max_booking_advance_days',
        'reminder_h1_enabled',
        'reminder_h2_enabled',
        'whatsapp_templates',
        'telegram_notifications_enabled',
        'telegram_bot_token',
        'telegram_chat_id',
        'no_show_require_full_dp',
        'no_show_dp_threshold',
        'is_active',
        'suspended_at',
        'suspension_reason',
    ];

    protected function casts(): array
    {
        return [
            'bank_accounts' => 'array',
            'min_booking_lead_minutes' => 'integer',
            'max_booking_advance_days' => 'integer',
            'reminder_h1_enabled' => 'boolean',
            'reminder_h2_enabled' => 'boolean',
            'whatsapp_templates' => 'array',
            'telegram_notifications_enabled' => 'boolean',
            'telegram_bot_token' => 'encrypted',
            'no_show_require_full_dp' => 'boolean',
            'no_show_dp_threshold' => 'integer',
            'is_active' => 'boolean',
            'suspended_at' => 'datetime',
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function defaultWhatsappTemplates(): array
    {
        return [
            'reminder' => "Halo {customer_name}, kami dari {business_name} mengingatkan jadwal Anda:\n\n• Layanan: {service_name}\n• Tanggal: {date}\n• Jadwal/Jam: {time}\n• Staff: {staff_name}\n• Kode: {booking_code}\n\nTerima kasih!",
            'dp_verified' => "Halo {customer_name}, pembayaran DP sebesar {dp_amount} untuk pesanan {booking_code} ({service_name}, {date} · {time}) telah kami verifikasi.\n\nPesanan Anda sudah dikonfirmasi. Terima kasih telah memilih {business_name}!",
            'confirmed' => "Halo {customer_name}, pesanan Anda di {business_name} telah dikonfirmasi:\n\n• Layanan: {service_name}\n• Tanggal: {date} · {time}\n• Staff: {staff_name}\n• Detail Invoice: {invoice_url}\n\nTerima kasih!",
            'ready_for_pickup' => "Halo {customer_name}, pesanan {service_name} ({booking_code}) di {business_name} sudah selesai dan siap diambil/diantar!\n\n• Total: {total_price}\n• Detail Invoice: {invoice_url}\n\nTerima kasih sudah mempercayakan perawatan Anda kepada kami!",
            'follow_up' => 'Halo {customer_name}, terima kasih sudah mempercayakan layanan {service_name} kepada {business_name}! Semoga Anda puas dengan hasilnya. Jika ada masukan atau ingin order berikutnya, silakan balas pesan ini ya.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function resolvedWhatsappTemplates(): array
    {
        $defaults = self::defaultWhatsappTemplates();
        $saved = is_array($this->whatsapp_templates) ? $this->whatsapp_templates : [];

        $merged = [];
        foreach ($defaults as $key => $defaultText) {
            $value = isset($saved[$key]) && is_string($saved[$key]) && trim($saved[$key]) !== ''
                ? trim($saved[$key])
                : $defaultText;
            $merged[$key] = $value;
        }

        return $merged;
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'business_user')
            ->withPivot(['role', 'permissions'])
            ->withTimestamps();
    }

    public function operatingHours(): HasMany
    {
        return $this->hasMany(OperatingHour::class)->orderBy('day_of_week');
    }

    public function holidays(): HasMany
    {
        return $this->hasMany(BusinessHoliday::class)->orderBy('date');
    }

    public function galleries(): HasMany
    {
        return $this->hasMany(BusinessGallery::class)->orderBy('sort_order')->orderBy('id');
    }

    public function staff(): HasMany
    {
        return $this->hasMany(Staff::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function primaryBookingMode(): string
    {
        $services = $this->relationLoaded('services')
            ? $this->services
            : $this->services()->get(['booking_mode', 'is_active']);

        if ($services->isEmpty()) {
            return 'time_slot';
        }

        $pool = $services->where('is_active', true);
        if ($pool->isEmpty()) {
            $pool = $services;
        }

        $dropoffCount = $pool->where('booking_mode', 'dropoff')->count();
        $timeSlotCount = $pool->count() - $dropoffCount;

        return $dropoffCount > $timeSlotCount ? 'dropoff' : 'time_slot';
    }

    public function seedDefaultOperatingHours(): void
    {
        for ($day = 0; $day <= 6; $day++) {
            $this->operatingHours()->firstOrCreate(
                ['day_of_week' => $day],
                [
                    'is_open' => $day !== 0,
                    'open_time' => '09:00',
                    'close_time' => '18:00',
                    'break_start' => '12:00',
                    'break_end' => '13:00',
                ]
            );
        }
    }
}
