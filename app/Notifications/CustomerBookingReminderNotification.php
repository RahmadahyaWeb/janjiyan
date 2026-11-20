<?php

namespace App\Notifications;

use App\Models\Booking;
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
        $tz = $business?->timezone ?: 'Asia/Jakarta';
        $dateLabel = $booking->start_at->setTimezone($tz)->format('d M Y');
        $timeLabel = $booking->start_at->setTimezone($tz)->format('H:i');
        $businessName = $business?->name ?? 'Janjiyan';

        $windowLabel = $this->reminderType === 'h2' ? '2 jam lagi' : 'besok (H-1)';
        $invoiceUrl = $booking->invoice_token && $business
            ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $booking->invoice_token])
            : ($business ? route('public.booking.status', ['slug' => $business->slug, 'code' => $booking->booking_code]) : url('/'));

        $mail = (new MailMessage)
            ->subject("[{$businessName}] Pengingat ".($booking->isDropoff() ? 'Drop-off / Jemput' : 'Reservasi')." ({$windowLabel}) — {$booking->booking_code}")
            ->greeting("Halo {$booking->customer->name},")
            ->line(
                $booking->isDropoff()
                    ? "Ini adalah pengingat bahwa jadwal drop-off / penjemputan pesanan Anda di {$businessName} berlangsung {$windowLabel}."
                    : "Ini adalah pengingat bahwa jadwal reservasi Anda di {$businessName} akan berlangsung {$windowLabel}."
            )
            ->line("Kode Booking: {$booking->booking_code}")
            ->line('Layanan: '.$booking->service->name.($booking->isDropoff() ? " ({$booking->quantity} item)" : ''))
            ->line(
                $booking->isDropoff()
                    ? "Jadwal: {$dateLabel} · {$booking->scheduleDisplayLabel($tz)}"
                    : "Jadwal: {$dateLabel}, {$timeLabel}"
            );

        if ($booking->isDropoff() && $booking->estimated_ready_date) {
            $mail->line('Estimasi Selesai: '.$booking->estimated_ready_date->format('d M Y'));
        }

        if ($booking->staff) {
            $mail->line("Staff: {$booking->staff->name}");
        }

        if ($business?->address) {
            $mail->line("Lokasi: {$business->address}");
        }

        return $mail
            ->action('Lihat Detail Pesanan', $invoiceUrl)
            ->line(
                $booking->isDropoff()
                    ? 'Silakan antar barang Anda sesuai jam operasional toko atau siapkan barang untuk penjemputan. Terima kasih!'
                    : 'Mohon hadir 10 menit sebelum jadwal dimulai. Terima kasih!'
            );
    }
}
