<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerBookingStatusNotification extends Notification implements ShouldQueue
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
        private readonly string $eventType // 'created' | 'dp_verified' | 'confirmed' | 'cancelled' | 'rescheduled'
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

        $invoiceUrl = $booking->invoice_token && $business
            ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $booking->invoice_token])
            : ($business ? route('public.booking.status', ['slug' => $business->slug, 'code' => $booking->booking_code]) : url('/'));

        [$subject, $headline] = match ($this->eventType) {
            'dp_verified' => [
                "[{$businessName}] DP Terverifikasi & Reservasi Dikonfirmasi — {$booking->booking_code}",
                'Pembayaran DP Anda telah diverifikasi dan reservasi Anda sudah dikonfirmasi.',
            ],
            'confirmed' => [
                "[{$businessName}] Reservasi Dikonfirmasi — {$booking->booking_code}",
                'Reservasi Anda telah dikonfirmasi oleh merchant.',
            ],
            'cancelled' => [
                "[{$businessName}] Reservasi Dibatalkan — {$booking->booking_code}",
                'Reservasi Anda telah dibatalkan.'.($booking->cancellation_reason ? " Alasan: {$booking->cancellation_reason}" : ''),
            ],
            'rescheduled' => [
                "[{$businessName}] Jadwal Reservasi Diperbarui — {$booking->booking_code}",
                'Jadwal reservasi Anda telah diperbarui ke waktu baru di bawah ini.',
            ],
            default => [
                "[{$businessName}] Konfirmasi Reservasi — {$booking->booking_code}",
                'Terima kasih! Reservasi Anda telah kami terima.',
            ],
        };

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Halo {$booking->customer->name},")
            ->line($headline)
            ->line("Kode Booking: {$booking->booking_code}")
            ->line("Bisnis: {$businessName}")
            ->line("Layanan: {$booking->service->name}")
            ->line("Jadwal: {$dateLabel}, {$timeLabel}");

        if ($booking->staff) {
            $mail->line("Staff: {$booking->staff->name}");
        }

        if ($booking->dp_amount > 0 && $booking->payment_status === 'unpaid' && $booking->dp_expires_at) {
            $deadline = $booking->dp_expires_at->setTimezone($tz)->format('d M Y H:i');
            $dpFormatted = 'Rp '.number_format($booking->dp_amount, 0, ',', '.');
            $mail->line("Batas pembayaran DP ({$dpFormatted}): {$deadline}.");
        }

        return $mail
            ->action('Lihat Status & Invoice Reservasi', $invoiceUrl)
            ->line('Simpan tautan di atas untuk memantau status reservasi atau mengunggah bukti DP Anda.');
    }
}
