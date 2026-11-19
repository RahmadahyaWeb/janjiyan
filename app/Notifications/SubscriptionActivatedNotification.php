<?php

namespace App\Notifications;

use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SubscriptionActivatedNotification extends Notification implements ShouldQueue
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
        private readonly SubscriptionInvoice $invoice,
        private readonly Subscription $subscription
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
        $planName = $this->invoice->plan?->name ?? 'Janjiyan';
        $cycleLabel = $this->invoice->billing_cycle === 'yearly' ? 'Tahunan' : 'Bulanan';
        $amountFormatted = 'Rp '.number_format($this->invoice->amount, 0, ',', '.');
        $tz = method_exists($notifiable, 'ownedBusinesses')
            ? ($notifiable->ownedBusinesses()->value('timezone') ?: 'Asia/Jakarta')
            : 'Asia/Jakarta';
        $validUntil = $this->subscription->current_period_ends_at?->timezone($tz)->format('d M Y H:i T') ?? '-';

        return (new MailMessage)
            ->subject("Langganan Janjiyan Aktif — Paket {$planName}")
            ->greeting("Halo {$notifiable->name},")
            ->line("Pembayaran langganan Anda telah berhasil diverifikasi dan paket {$planName} ({$cycleLabel}) sekarang aktif.")
            ->line("No. Invoice: {$this->invoice->invoice_number}")
            ->line("Total Pembayaran: {$amountFormatted}")
            ->line("Aktif Hingga: {$validUntil}")
            ->action('Lihat Paket & Billing', route('dashboard.billing'))
            ->line('Terima kasih telah menggunakan Janjiyan untuk mengelola jadwal bisnis Anda.');
    }
}
