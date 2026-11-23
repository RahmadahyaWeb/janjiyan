<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Business;
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
        $booking = $this->booking->loadMissing(['business', 'service', 'staff', 'customer', 'items']);
        $business = $booking->business;
        $businessType = $business?->resolvedBusinessType() ?? Business::TYPE_STAFF_APPOINTMENT;
        $tz = $business?->timezone ?: 'Asia/Jakarta';
        $dateLabel = $booking->start_at->setTimezone($tz)->format('d M Y');
        $timeLabel = $booking->start_at->setTimezone($tz)->format('H:i');
        $dpFormatted = 'Rp '.number_format($booking->dp_amount, 0, ',', '.');
        $businessName = $business?->name ?? 'Janjiyan';

        $isDpUploaded = $this->eventType === 'dp_uploaded';
        $isDropoff = $businessType === Business::TYPE_DROPOFF || $booking->isDropoff();
        $unitLabel = $booking->resolvedUnitLabel();
        $serviceSummary = $booking->resolvedServiceSummary();
        $serviceItemsCount = $booking->items->where('item_type', BookingItem::TYPE_SERVICE)->count();
        $addonItemsCount = $booking->items->where('item_type', '!=', BookingItem::TYPE_SERVICE)->count();

        [$nounTitle, $nounLower, $servicePrefix, $actionLabel] = match ($businessType) {
            Business::TYPE_DROPOFF => ['Pesanan', 'pesanan', 'Layanan', 'Buka Dashboard Pesanan'],
            Business::TYPE_SPACE_BOOKING => ['Booking', 'booking', 'Fasilitas / Paket', 'Buka Jadwal Booking'],
            default => ['Reservasi', 'reservasi', 'Layanan', 'Buka Dashboard Reservasi'],
        };

        $subject = $isDpUploaded
            ? "[{$businessName}] Bukti Uang Muka Diunggah — {$booking->booking_code}"
            : "[{$businessName}] {$nounTitle} Baru — {$booking->booking_code}";

        $intro = $isDpUploaded
            ? "Pelanggan {$booking->customer->name} baru saja mengunggah bukti transfer uang muka sebesar {$dpFormatted} untuk {$nounLower} {$booking->booking_code} dan menunggu verifikasi Anda."
            : "Ada {$nounLower} baru dari {$booking->customer->name} untuk {$serviceSummary}.";

        $serviceLine = ($isDropoff && $serviceItemsCount <= 1 && $addonItemsCount === 0)
            ? "{$servicePrefix}: {$serviceSummary} ({$booking->quantity} {$unitLabel})"
            : "{$servicePrefix}: {$serviceSummary}";

        $scheduleLine = $isDropoff
            ? "Jadwal: {$dateLabel} · {$booking->scheduleDisplayLabel($tz)}"
            : "Jadwal: {$dateLabel}, {$timeLabel}";

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Halo {$notifiable->name},")
            ->line($intro)
            ->line("Kode Booking: {$booking->booking_code}")
            ->line($serviceLine)
            ->line($scheduleLine)
            ->line("Pelanggan: {$booking->customer->name} ({$booking->customer->phone})");

        if ($isDropoff && $booking->estimated_ready_date) {
            $mail->line('Estimasi Selesai: '.$booking->estimated_ready_date->format('d M Y'));
        }

        if ($isDropoff && $booking->fulfillment_type === 'pickup' && $booking->pickup_address) {
            $mail->line("Alamat Jemput: {$booking->pickup_address}");
        }

        if ($businessType === Business::TYPE_STAFF_APPOINTMENT && $booking->staff) {
            $mail->line("Staff: {$booking->staff->name}");
        }

        return $mail
            ->action($actionLabel, route('dashboard.bookings', ['search' => $booking->booking_code]))
            ->line("Kelola verifikasi pembayaran dan status {$nounLower} langsung dari dashboard Janjiyan.");
    }
}
