<?php

namespace App\Jobs;

use App\Models\BusinessReview;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SendTelegramReviewAlertJob implements ShouldQueue
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
        public readonly int $reviewId
    ) {}

    public function handle(): void
    {
        $review = BusinessReview::with(['business', 'booking', 'customer'])
            ->find($this->reviewId);

        if (! $review || ! $review->business) {
            return;
        }

        $business = $review->business;

        if (! $business->telegram_notifications_enabled) {
            return;
        }

        $token = trim((string) ($business->telegram_bot_token ?? ''));
        $chatId = trim((string) ($business->telegram_chat_id ?? ''));

        if ($token === '' || $chatId === '') {
            return;
        }

        $esc = static function (?string $val): string {
            $text = $val !== null && trim($val) !== '' ? $val : '-';

            return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        };

        $rating = max(1, min(5, (int) $review->rating));
        $stars = str_repeat('★', $rating).str_repeat('☆', 5 - $rating);
        $tz = $business->timezone ?: 'Asia/Jakarta';
        $timeLabel = $review->created_at
            ? $review->created_at->setTimezone($tz)->format('d M Y · H:i')
            : '-';

        $reviewerName = $review->reviewer_name ?: ($review->booking?->booked_customer_name ?: $review->customer?->name);
        $reviewerPhone = $review->reviewer_phone ?: $review->customer?->phone;

        $lines = [
            "⚠️ <b>Masukan Pelanggan (Rating {$rating}/5)</b>",
            '',
            '<b>Bisnis:</b> '.$esc($business->name),
            "<b>Rating:</b> {$stars} ({$rating}/5)",
            '<b>Pelanggan:</b> '.$esc($reviewerName),
            '<b>Telepon:</b> '.$esc($reviewerPhone),
        ];

        if ($review->booking) {
            $lines[] = '<b>Kode Pesanan:</b> <code>'.$esc($review->booking->booking_code).'</code>';
            if ($review->booking->invoice_number) {
                $lines[] = '<b>No. Invoice:</b> <code>'.$esc($review->booking->invoice_number).'</code>';
            }
        }

        $lines[] = '<b>Komentar:</b> '.$esc($review->comment);
        $lines[] = '<b>Waktu:</b> '.$esc($timeLabel);
        $lines[] = '';
        $lines[] = 'Segera tindak lanjuti melalui Inbox Ulasan di dashboard.';

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
            $error = new RuntimeException("Telegram API returned HTTP {$status} for review {$review->id}.");

            // Permanent client errors (invalid bot token, chat not found, bot blocked) should not retry.
            if ($status >= 400 && $status < 500 && $status !== 429) {
                report($error);

                return;
            }

            throw $error;
        }
    }
}
