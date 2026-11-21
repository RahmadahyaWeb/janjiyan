<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\Business;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerBookingReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [15, 60, 180];
    }

    public function __construct(
        private readonly Booking $booking,
        private readonly string $reminderType // 'h1' | 'h2'
    ) {
        $this->afterCommit();
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $booking = $this->booking->loadMissing(['business', 'service', 'staff', 'customer']);
        $business = $booking->business;
        $businessType = $business?->resolvedBusinessType() ?? Business::TYPE_STAFF_APPOINTMENT;
        $tz = $business?->timezone ?: 'Asia/Jakarta';
        $dateLabel = $booking->start_at->setTimezone($tz)->format('d M Y');
        $timeLabel = $booking->start_at->setTimezone($tz)->format('H:i');
        $businessName = $business?->name ?? 'Janjiyan';

        $windowLabel = $this->reminderType === 'h2' ? '2 jam lagi' : 'besok (H-1)';
        $invoiceUrl = $booking->invoice_token && $business
            ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $booking->invoice_token])
            : ($business ? route('public.booking.status', ['slug' => $business->slug, 'code' => $booking->booking_code]) : url('/'));

        $unitLabel = $booking->resolvedUnitLabel();
        $isDropoff = $businessType === Business::TYPE_DROPOFF || $booking->isDropoff();

        [$subjectNoun, $introLine, $servicePrefix, $actionLabel, $closingLine] = match ($businessType) {
            Business::TYPE_DROPOFF => [
                'Drop-off / Jemput',
                "Ini adalah pengingat bahwa jadwal drop-off / penjemputan pesanan Anda di {$businessName} berlangsung {$windowLabel}.",
                'Layanan',
                'Lihat Detail Pesanan',
                'Silakan antar barang Anda sesuai jam operasional toko atau siapkan barang untuk penjemputan. Terima kasih!',
            ],
            Business::TYPE_SPACE_BOOKING => [
                'Jadwal Sesi',
                "Ini adalah pengingat bahwa jadwal booking sesi Anda di {$businessName} akan berlangsung {$windowLabel}.",
                'Fasilitas / Paket',
                'Lihat Detail Booking',
                'Mohon hadir tepat waktu sesuai jadwal sesi Anda. Terima kasih!',
            ],
            default => [
                'Reservasi',
                "Ini adalah pengingat bahwa jadwal reservasi Anda di {$businessName} akan berlangsung {$windowLabel}.",
                'Layanan',
                'Lihat Detail Reservasi',
                'Mohon hadir 10 menit sebelum jadwal dimulai. Terima kasih!',
            ],
        };

        $serviceValue = $isDropoff
            ? "{$booking->service->name} ({$booking->quantity} {$unitLabel})"
            : $booking->service->name;

        $mail = (new MailMessage)
            ->subject("[{$businessName}] Pengingat {$subjectNoun} ({$windowLabel}) — {$booking->booking_code}")
            ->greeting("Halo {$booking->customer->name},")
            ->line($introLine)
            ->line("Kode Booking: {$booking->booking_code}")
            ->line("{$servicePrefix}: {$serviceValue}")
            ->line(
                $isDropoff
                    ? "Jadwal: {$dateLabel} · {$booking->scheduleDisplayLabel($tz)}"
                    : "Jadwal: {$dateLabel}, {$timeLabel}"
            );

        if ($isDropoff && $booking->estimated_ready_date) {
            $mail->line('Estimasi Selesai: '.$booking->estimated_ready_date->format('d M Y'));
        }

        if ($businessType === Business::TYPE_STAFF_APPOINTMENT && $booking->staff) {
            $mail->line("Staff: {$booking->staff->name}");
        }

        if ($business?->address) {
            $mail->line("Lokasi: {$business->address}");
        }

        return $mail
            ->action($actionLabel, $invoiceUrl)
            ->line($closingLine);
    }
}
