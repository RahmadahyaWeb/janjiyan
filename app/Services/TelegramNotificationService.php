<?php

namespace App\Services;

use App\Jobs\SendTelegramBookingAlertJob;
use App\Jobs\SendTelegramReviewAlertJob;
use App\Models\Booking;
use App\Models\Business;
use App\Models\BusinessReview;
use Illuminate\Support\Facades\Http;
use Throwable;

class TelegramNotificationService
{
    public function dispatchBookingAlert(Booking $booking, string $eventType): void
    {
        $booking->loadMissing('business');
        $business = $booking->business;

        if (! $business || ! $business->telegram_notifications_enabled) {
            return;
        }

        if (trim((string) ($business->telegram_bot_token ?? '')) === '' || trim((string) ($business->telegram_chat_id ?? '')) === '') {
            return;
        }

        try {
            SendTelegramBookingAlertJob::dispatch($booking->id, $eventType);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public function dispatchLowReviewAlert(BusinessReview $review): void
    {
        $review->loadMissing('business');
        $business = $review->business;

        if (! $business || ! $business->telegram_notifications_enabled) {
            return;
        }

        if (trim((string) ($business->telegram_bot_token ?? '')) === '' || trim((string) ($business->telegram_chat_id ?? '')) === '') {
            return;
        }

        try {
            SendTelegramReviewAlertJob::dispatch($review->id);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * @return array{ok: bool, message: string}
     */
    public function sendTestMessage(Business $business): array
    {
        $token = trim((string) ($business->telegram_bot_token ?? ''));
        $chatId = trim((string) ($business->telegram_chat_id ?? ''));

        if ($token === '' || $chatId === '') {
            return [
                'ok' => false,
                'message' => 'Bot Token dan Chat ID Telegram wajib disimpan terlebih dahulu sebelum mengirim pesan tes.',
            ];
        }

        $safeName = htmlspecialchars($business->name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        try {
            $response = Http::timeout(5)
                ->asJson()
                ->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $chatId,
                    'text' => "✅ <b>Koneksi Telegram Janjiyan Berhasil!</b>\n\nBisnis <b>{$safeName}</b> sekarang siap menerima notifikasi pesanan baru & bukti uang muka secara instan.",
                    'parse_mode' => 'HTML',
                ]);

            if ($response->successful() && (bool) $response->json('ok') === true) {
                return [
                    'ok' => true,
                    'message' => 'Pesan tes berhasil dikirim ke Telegram Anda!',
                ];
            }

            $description = (string) ($response->json('description') ?? 'Permintaan ditolak oleh Telegram.');

            return [
                'ok' => false,
                'message' => "Gagal mengirim ke Telegram: {$description}",
            ];
        } catch (Throwable $e) {
            report($e);

            return [
                'ok' => false,
                'message' => 'Tidak dapat terhubung ke server Telegram saat ini. Coba lagi beberapa saat.',
            ];
        }
    }
}
