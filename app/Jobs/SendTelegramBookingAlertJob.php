<?php

namespace App\Jobs;

use App\Models\Booking;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SendTelegramBookingAlertJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 15;

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function __construct(
        public readonly int $bookingId,
        public readonly string $eventType
    ) {}

    public function handle(): void
    {
        $booking = Booking::with(['business', 'service', 'staff', 'customer'])
            ->find($this->bookingId);

        if (! $booking || ! $booking->business) {
            return;
        }

        $business = $booking->business;

        if (! $business->telegram_notifications_enabled) {
            return;
        }

        $token = trim((string) ($business->telegram_bot_token ?? ''));
        $chatId = trim((string) ($business->telegram_chat_id ?? ''));

        if ($token === '' || $chatId === '') {
            return;
        }

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $dateLabel = $booking->start_at->setTimezone($tz)->format('d M Y');
        $timeLabel = $booking->isDropoff()
            ? $booking->scheduleDisplayLabel($tz)
            : $booking->start_at->setTimezone($tz)->format('H:i')
                .'–'
                .$booking->end_at->setTimezone($tz)->format('H:i');

        $header = $this->eventType === 'dp_uploaded'
            ? '🧾 <b>Bukti DP Baru Diunggah</b>'
            : ($booking->isDropoff() ? '👟 <b>Order Drop-off Baru Masuk</b>' : '📅 <b>Reservasi Baru Masuk</b>');

        $esc = static fn (?string $val): string => htmlspecialchars((string) ($val ?? '-'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        $serviceLabel = $booking->isDropoff()
            ? $esc($booking->service?->name).' ('.$booking->quantity.' item)'
            : $esc($booking->service?->name);

        $lines = [
            $header,
            '',
            '<b>Bisnis:</b> '.$esc($business->name),
            '<b>Kode:</b> <code>'.$esc($booking->booking_code).'</code>',
            '<b>Pelanggan:</b> '.$esc($booking->customer?->name).' (+'.$esc($booking->customer?->phone).')',
            '<b>Layanan:</b> '.$serviceLabel,
            '<b>Staff:</b> '.$esc($booking->staff?->name ?? ($booking->isDropoff() ? 'Tim Operasional' : 'Siapa saja')),
            '<b>Jadwal:</b> '.$esc($dateLabel).' · '.$esc($timeLabel),
        ];

        if ($booking->isDropoff() && $booking->estimated_ready_date) {
            $lines[] = '<b>Est. Selesai:</b> '.$esc($booking->estimated_ready_date->format('d M Y'));
        }

        if ($booking->isDropoff() && $booking->fulfillment_type === 'pickup' && $booking->pickup_address) {
            $lines[] = '<b>Alamat Jemput:</b> '.$esc($booking->pickup_address);
        }

        $lines[] = '<b>Total:</b> Rp '.number_format((int) $booking->total_price, 0, ',', '.');

        if ((int) $booking->dp_amount > 0) {
            $lines[] = '<b>DP:</b> Rp '.number_format((int) $booking->dp_amount, 0, ',', '.');
        }

        $lines[] = '';
        $lines[] = 'Buka dashboard untuk verifikasi & konfirmasi.';

        $response = Http::connectTimeout(5)
            ->timeout(10)
            ->asJson()
            ->post("https://api.telegram.org/bot{$token}/sendMessage", [
                'chat_id' => $chatId,
                'text' => implode("\n", $lines),
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ]);

        if (! $response->successful()) {
            $status = $response->status();
            $error = new RuntimeException("Telegram API returned HTTP {$status} for booking {$booking->booking_code}.");

            // Permanent client errors (invalid bot token, chat not found, bot blocked) should not retry.
            if ($status >= 400 && $status < 500 && $status !== 429) {
                report($error);

                return;
            }

            throw $error;
        }
    }
}
