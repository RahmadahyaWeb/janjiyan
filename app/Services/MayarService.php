<?php

namespace App\Services;

use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class MayarService
{
    public function isConfigured(): bool
    {
        return filled(config('services.mayar.api_key'));
    }

    /**
     * Create a Mayar Headless API v2 invoice and return the response data payload.
     *
     * @return array<string, mixed>
     */
    public function createInvoice(
        User $user,
        SubscriptionPlan $plan,
        string $billingCycle,
        SubscriptionInvoice $invoice,
        string $redirectUrl
    ): array {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Konfigurasi API Key Mayar belum tersedia.');
        }

        $mobile = $user->ownedBusinesses()
            ->whereNotNull('phone')
            ->where('phone', '!=', '')
            ->value('phone') ?: '081200000000';

        $cycleLabel = $billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan';
        $expiresAt = now()->addHours(24);

        try {
            $response = $this->client()->post('/invoice/create', [
                'name' => $user->name,
                'email' => $user->email,
                'mobile' => preg_replace('/\D+/', '', (string) $mobile) ?: '081200000000',
                'redirectUrl' => $redirectUrl,
                'description' => "Langganan Janjiyan Paket {$plan->name} ({$cycleLabel}) - {$invoice->invoice_number}",
                'expiredAt' => $expiresAt->toIso8601String(),
                'items' => [
                    [
                        'quantity' => 1,
                        'rate' => $invoice->amount,
                        'description' => "Janjiyan {$plan->name} ({$cycleLabel})",
                    ],
                ],
                'extraData' => [
                    'noCustomer' => (string) $user->id,
                    'idProd' => $invoice->invoice_number,
                ],
            ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Gagal terhubung ke layanan pembayaran Mayar. Silakan coba lagi.', 0, $e);
        }

        if (! $response->successful()) {
            $message = $response->json('messages') ?? $response->json('message') ?? 'Gagal membuat invoice pembayaran di Mayar.';
            throw new RuntimeException((string) $message);
        }

        $data = $response->json('data');
        if (! is_array($data) || empty($data['link']) || empty($data['id'])) {
            throw new RuntimeException('Respons invoice Mayar tidak valid.');
        }

        return $data;
    }

    /**
     * Fetch invoice details directly from Mayar API v2 for server-to-server verification.
     *
     * @return array<string, mixed>
     */
    public function getInvoiceDetail(string $mayarInvoiceId): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Konfigurasi API Key Mayar belum tersedia.');
        }

        try {
            $response = $this->client()
                ->retry(2, 250, fn ($exception) => $exception instanceof ConnectionException, false)
                ->get("/invoices/{$mayarInvoiceId}");
        } catch (ConnectionException $e) {
            throw new RuntimeException('Gagal terhubung ke layanan pembayaran Mayar untuk verifikasi invoice.', 0, $e);
        }

        if (! $response->successful()) {
            $message = $response->json('messages') ?? $response->json('message') ?? 'Gagal memverifikasi status invoice ke Mayar.';
            throw new RuntimeException((string) $message);
        }

        $data = $response->json('data') ?? $response->json();
        if (! is_array($data)) {
            throw new RuntimeException('Respons detail invoice Mayar tidak valid.');
        }

        return $data;
    }

    public function verifyWebhookToken(?string $queryToken, ?string $headerToken): bool
    {
        $configured = (string) config('services.mayar.webhook_token', '');
        if ($configured === '') {
            return false;
        }

        $provided = $headerToken ?: $queryToken;
        if (! is_string($provided) || $provided === '') {
            return false;
        }

        return hash_equals($configured, $provided);
    }

    /**
     * @param  array<string, mixed>  $invoiceData
     */
    public function isPaidRemoteInvoice(array $invoiceData, int $expectedAmount): bool
    {
        $status = strtolower((string) ($invoiceData['status'] ?? ''));
        $isPaidStatus = in_array($status, ['paid', 'settled', 'success', 'completed'], true);

        $remoteAmount = $invoiceData['amount'] ?? $invoiceData['total'] ?? null;
        if ($remoteAmount === null || ! is_numeric($remoteAmount) || (int) $remoteAmount < $expectedAmount) {
            return false;
        }

        return $isPaidStatus;
    }

    private function client(): PendingRequest
    {
        $baseUrl = rtrim((string) config('services.mayar.base_url', 'https://api.mayar.id/hl/v2'), '/');

        return Http::baseUrl($baseUrl)
            ->withToken((string) config('services.mayar.api_key'))
            ->acceptJson()
            ->connectTimeout(5)
            ->timeout(15);
    }
}
