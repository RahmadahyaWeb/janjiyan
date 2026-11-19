<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class MerchantBookingAlertNotification extends Notification implements ShouldQueue
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
        private readonly string $eventType // 'new_booking' | 'dp_uploaded'
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
        $tz = $booking->business?->timezone ?: 'Asia/Jakarta';
        $dateLabel = $booking->start_at->setTimezone($tz)->format('d M Y');
        $timeLabel = $booking->start_at->setTimezone($tz)->format('H:i');
        $dpFormatted = 'Rp '.number_format($booking->dp_amount, 0, ',', '.');
        $businessName = $booking->business?->name ?? 'Janjiyan';

        $isDpUploaded = $this->eventType === 'dp_uploaded';

        $subject = $isDpUploaded
            ? "[{$businessName}] Bukti DP Diunggah — {$booking->booking_code}"
            : "[{$businessName}] Reservasi Baru — {$booking->booking_code}";

        $intro = $isDpUploaded
            ? "Pelanggan {$booking->customer->name} baru saja mengunggah bukti transfer DP sebesar {$dpFormatted} dan menunggu verifikasi Anda."
            : "Ada reservasi baru dari {$booking->customer->name} untuk layanan {$booking->service->name}.";

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Halo {$notifiable->name},")
            ->line($intro)
            ->line("Kode Booking: {$booking->booking_code}")
            ->line("Layanan: {$booking->service->name}")
            ->line("Jadwal: {$dateLabel}, {$timeLabel}")
            ->line("Pelanggan: {$booking->customer->name} ({$booking->customer->phone})");

        if ($booking->staff) {
            $mail->line("Staff: {$booking->staff->name}");
        }

        return $mail
            ->action('Buka Dashboard Reservasi', route('dashboard.bookings', ['search' => $booking->booking_code]))
            ->line('Kelola verifikasi DP dan status reservasi langsung dari dashboard Janjiyan.');
    }
}
