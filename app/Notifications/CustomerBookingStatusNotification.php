<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Business;
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
        $booking = $this->booking->loadMissing(['business', 'service', 'staff', 'customer', 'items']);
        $business = $booking->business;
        $businessType = $business?->resolvedBusinessType() ?? Business::TYPE_STAFF_APPOINTMENT;
        $tz = $business?->timezone ?: 'Asia/Jakarta';
        $dateLabel = $booking->start_at->setTimezone($tz)->format('d M Y');
        $timeLabel = $booking->start_at->setTimezone($tz)->format('H:i');
        $businessName = $business?->name ?? 'Janjiyan';

        $invoiceUrl = $booking->invoice_token && $business
            ? route('public.booking.invoice', ['slug' => $business->slug, 'token' => $booking->invoice_token])
            : ($business ? route('public.booking.status', ['slug' => $business->slug, 'code' => $booking->booking_code]) : url('/'));

        $hasDp = (int) $booking->dp_amount > 0;

        [$nounTitle, $nounLower, $servicePrefix, $actionLabel, $closingLine] = match ($businessType) {
            Business::TYPE_DROPOFF => [
                'Pesanan',
                'pesanan',
                'Layanan',
                'Lihat Status & Invoice Pesanan',
                $hasDp
                    ? 'Simpan tautan di atas untuk memantau progres pesanan atau mengunggah bukti uang muka Anda.'
                    : 'Simpan tautan di atas untuk memantau progres dan detail invoice pesanan Anda.',
            ],
            Business::TYPE_SPACE_BOOKING => [
                'Booking',
                'booking',
                'Fasilitas / Paket',
                'Lihat Status & Invoice Booking',
                $hasDp
                    ? 'Simpan tautan di atas untuk memantau status booking atau mengunggah bukti uang muka Anda.'
                    : 'Simpan tautan di atas untuk memantau status dan detail invoice booking Anda.',
            ],
            default => [
                'Reservasi',
                'reservasi',
                'Layanan',
                'Lihat Status & Invoice Reservasi',
                $hasDp
                    ? 'Simpan tautan di atas untuk memantau status reservasi atau mengunggah bukti uang muka Anda.'
                    : 'Simpan tautan di atas untuk memantau status dan detail invoice reservasi Anda.',
            ],
        };

        [$subject, $headline] = match ($this->eventType) {
            'dp_verified' => [
                "[{$businessName}] Uang Muka Terverifikasi & {$nounTitle} Dikonfirmasi — {$booking->booking_code}",
                "Pembayaran uang muka Anda telah diverifikasi dan {$nounLower} Anda sudah dikonfirmasi.",
            ],
            'confirmed' => [
                "[{$businessName}] {$nounTitle} Dikonfirmasi — {$booking->booking_code}",
                "{$nounTitle} Anda telah dikonfirmasi oleh merchant.",
            ],
            'cancelled' => [
                "[{$businessName}] {$nounTitle} Dibatalkan — {$booking->booking_code}",
                "{$nounTitle} Anda telah dibatalkan.".($booking->cancellation_reason ? " Alasan: {$booking->cancellation_reason}" : ''),
            ],
            'rescheduled' => [
                "[{$businessName}] Jadwal {$nounTitle} Diperbarui — {$booking->booking_code}",
                "Jadwal {$nounLower} Anda telah diperbarui ke waktu baru di bawah ini.",
            ],
            default => [
                "[{$businessName}] Konfirmasi {$nounTitle} — {$booking->booking_code}",
                "Terima kasih! {$nounTitle} Anda telah kami terima.",
            ],
        };

        $isDropoff = $businessType === Business::TYPE_DROPOFF || $booking->isDropoff();
        $unitLabel = $booking->resolvedUnitLabel();
        $serviceSummary = $booking->resolvedServiceSummary();
        $serviceItemsCount = $booking->items->where('item_type', BookingItem::TYPE_SERVICE)->count();
        $addonItemsCount = $booking->items->where('item_type', '!=', BookingItem::TYPE_SERVICE)->count();

        $scheduleLine = $isDropoff
            ? "Jadwal: {$dateLabel} · {$booking->scheduleDisplayLabel($tz)}"
            : "Jadwal: {$dateLabel}, {$timeLabel}";

        $serviceLine = ($isDropoff && $serviceItemsCount <= 1 && $addonItemsCount === 0)
            ? "{$servicePrefix}: {$serviceSummary} ({$booking->quantity} {$unitLabel})"
            : "{$servicePrefix}: {$serviceSummary}";

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Halo {$booking->customer->name},")
            ->line($headline)
            ->line("Kode Booking: {$booking->booking_code}")
            ->line("Bisnis: {$businessName}")
            ->line($serviceLine)
            ->line($scheduleLine);

        if ($isDropoff && $booking->estimated_ready_date) {
            $mail->line('Estimasi Selesai: '.$booking->estimated_ready_date->format('d M Y'));
        }

        if ($isDropoff && $booking->fulfillment_type === 'pickup' && $booking->pickup_address) {
            $mail->line("Alamat Jemput: {$booking->pickup_address}");
        }

        if ($businessType === Business::TYPE_STAFF_APPOINTMENT && $booking->staff) {
            $mail->line("Staff: {$booking->staff->name}");
        }

        if ($booking->dp_amount > 0 && $booking->payment_status === 'unpaid' && $booking->dp_expires_at) {
            $deadline = $booking->dp_expires_at->setTimezone($tz)->format('d M Y H:i');
            $dpFormatted = 'Rp '.number_format($booking->dp_amount, 0, ',', '.');
            $mail->line("Batas pembayaran uang muka ({$dpFormatted}): {$deadline}.");
        }

        return $mail
            ->action($actionLabel, $invoiceUrl)
            ->line($closingLine);
    }
}
