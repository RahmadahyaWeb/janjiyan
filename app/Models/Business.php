<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Business extends Model
{
    protected $hidden = [
        'telegram_bot_token',
    ];

    protected $fillable = [
        'owner_id',
        'name',
        'slug',
        'category',
        'description',
        'phone',
        'address',
        'timezone',
        'logo_path',
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
            'reminder' => "Halo {customer_name}, kami dari {business_name} mengingatkan jadwal reservasi Anda:\n\n• Layanan: {service_name}\n• Tanggal: {date}\n• Jam: {time}\n• Staff: {staff_name}\n• Kode: {booking_code}\n\nMohon hadir 10 menit sebelum jadwal. Terima kasih!",
            'dp_verified' => "Halo {customer_name}, pembayaran DP sebesar {dp_amount} untuk reservasi {booking_code} ({service_name}, {date} pukul {time}) telah kami verifikasi.\n\nJadwal Anda sudah dikonfirmasi. Sampai jumpa di {business_name}!",
            'confirmed' => "Halo {customer_name}, reservasi Anda di {business_name} telah dikonfirmasi:\n\n• Layanan: {service_name}\n• Tanggal: {date} pukul {time}\n• Staff: {staff_name}\n• Detail Invoice: {invoice_url}\n\nTerima kasih!",
            'follow_up' => 'Halo {customer_name}, terima kasih sudah berkunjung ke {business_name} untuk layanan {service_name}! Semoga Anda puas dengan pelayanan kami. Jika ada masukan atau ingin jadwalkan kunjungan berikutnya, silakan balas pesan ini ya.',
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
