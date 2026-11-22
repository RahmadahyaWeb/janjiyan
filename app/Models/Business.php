<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Business extends Model
{
    public const DEFAULT_QR_POSTER_SUBTITLE = 'Scan QR untuk Booking Online';

    public const TYPE_STAFF_APPOINTMENT = 'staff_appointment';

    public const TYPE_SPACE_BOOKING = 'space_booking';

    public const TYPE_DROPOFF = 'dropoff';

    public const TYPES = [
        self::TYPE_STAFF_APPOINTMENT,
        self::TYPE_SPACE_BOOKING,
        self::TYPE_DROPOFF,
    ];

    protected $hidden = [
        'telegram_bot_token',
    ];

    protected $fillable = [
        'owner_id',
        'name',
        'slug',
        'category',
        'business_type',
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
    public static function defaultWhatsappTemplates(?string $businessType = null): array
    {
        $type = in_array($businessType, self::TYPES, true)
            ? $businessType
            : self::TYPE_STAFF_APPOINTMENT;

        if ($type === self::TYPE_DROPOFF) {
            return [
                'reminder' => "Halo {customer_name}, kami dari {business_name} mengingatkan jadwal pengantaran/penjemputan pesanan Anda:\n\n• Layanan: {service_name}\n• Jumlah: {quantity} {unit_label}\n• Tanggal: {date}\n• Estimasi Selesai: {estimated_ready_date}\n• Kode Pesanan: {booking_code}\n\nTerima kasih!",
                'dp_verified' => "Halo {customer_name}, pembayaran uang muka sebesar {dp_amount} untuk pesanan {booking_code} ({service_name} · {quantity} {unit_label}, {date}) telah kami verifikasi.\n\nPesanan Anda di {business_name} segera kami proses. Terima kasih!",
                'confirmed' => "Halo {customer_name}, pesanan Anda di {business_name} telah dikonfirmasi:\n\n• Layanan: {service_name}\n• Jumlah: {quantity} {unit_label}\n• Tanggal Drop-off: {date}\n• Estimasi Selesai: {estimated_ready_date}\n• Detail Invoice: {invoice_url}\n\nTerima kasih!",
                'ready_for_pickup' => "Halo {customer_name}, pesanan {service_name} ({quantity} {unit_label}, kode {booking_code}) di {business_name} sudah selesai dan siap diambil/diantar.\n\n• Total Biaya: {total_price}\n• Detail Invoice: {invoice_url}\n\nTerima kasih sudah mempercayakan pesanan Anda kepada kami!",
                'follow_up' => 'Halo {customer_name}, terima kasih sudah mempercayakan pesanan {service_name} ({quantity} {unit_label}) kepada {business_name}. Semoga hasilnya memuaskan. Jika ingin order lagi, silakan balas pesan ini.',
            ];
        }

        if ($type === self::TYPE_SPACE_BOOKING) {
            return [
                'reminder' => "Halo {customer_name}, kami dari {business_name} mengingatkan jadwal sesi Anda:\n\n• Paket/Fasilitas: {service_name}\n• Tanggal: {date}\n• Jam Sesi: {time}\n• Kode Booking: {booking_code}\n\nMohon hadir tepat waktu sesuai jadwal sesi. Terima kasih!",
                'dp_verified' => "Halo {customer_name}, pembayaran uang muka sebesar {dp_amount} untuk booking {booking_code} ({service_name}, {date} · {time}) telah kami verifikasi.\n\nJadwal sesi Anda di {business_name} sudah dikonfirmasi. Terima kasih!",
                'confirmed' => "Halo {customer_name}, jadwal sesi Anda di {business_name} telah dikonfirmasi:\n\n• Paket/Fasilitas: {service_name}\n• Tanggal: {date} · {time}\n• Detail Invoice: {invoice_url}\n\nTerima kasih!",
                'follow_up' => 'Halo {customer_name}, terima kasih sudah booking {service_name} di {business_name}. Semoga sesi Anda berjalan lancar. Jika ingin memesan sesi berikutnya, silakan balas pesan ini.',
            ];
        }

        return [
            'reminder' => "Halo {customer_name}, kami dari {business_name} mengingatkan janji temu Anda:\n\n• Layanan: {service_name}\n• Tanggal: {date}\n• Jam: {time}\n• Staff: {staff_name}\n• Kode Booking: {booking_code}\n\nMohon hadir 10 menit sebelum jadwal. Terima kasih!",
            'dp_verified' => "Halo {customer_name}, pembayaran uang muka sebesar {dp_amount} untuk reservasi {booking_code} ({service_name}, {date} · {time}) telah kami verifikasi.\n\nJanji temu Anda di {business_name} sudah dikonfirmasi. Sampai jumpa!",
            'confirmed' => "Halo {customer_name}, janji temu Anda di {business_name} telah dikonfirmasi:\n\n• Layanan: {service_name}\n• Tanggal: {date} · {time}\n• Staff: {staff_name}\n• Detail Invoice: {invoice_url}\n\nTerima kasih!",
            'follow_up' => 'Halo {customer_name}, terima kasih sudah berkunjung ke {business_name} untuk layanan {service_name}. Semoga hasilnya sesuai harapan Anda. Jika ingin membuat janji temu berikutnya, silakan balas pesan ini.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function resolvedWhatsappTemplates(): array
    {
        $defaults = self::defaultWhatsappTemplates($this->resolvedBusinessType());
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

    public function resolvedBusinessType(): string
    {
        return in_array($this->business_type, self::TYPES, true)
            ? (string) $this->business_type
            : self::TYPE_STAFF_APPOINTMENT;
    }

    public function isStaffAppointment(): bool
    {
        return $this->resolvedBusinessType() === self::TYPE_STAFF_APPOINTMENT;
    }

    public function isSpaceBooking(): bool
    {
        return $this->resolvedBusinessType() === self::TYPE_SPACE_BOOKING;
    }

    public function isDropoff(): bool
    {
        return $this->resolvedBusinessType() === self::TYPE_DROPOFF;
    }

    public function serviceBookingMode(): string
    {
        return $this->isDropoff() ? 'dropoff' : 'time_slot';
    }

    public function serviceAssignmentMode(): string
    {
        return $this->isStaffAppointment() ? 'staff' : 'capacity';
    }

    public function supportsStaffScheduling(): bool
    {
        return $this->isStaffAppointment();
    }

    public function supportsCommissions(): bool
    {
        return $this->isStaffAppointment();
    }

    /**
     * @deprecated Use serviceBookingMode() or resolvedBusinessType() instead.
     */
    public function primaryBookingMode(): string
    {
        return $this->serviceBookingMode();
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
