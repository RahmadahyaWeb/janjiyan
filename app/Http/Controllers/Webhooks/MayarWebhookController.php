<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionInvoice;
use App\Services\MayarService;
use App\Services\SubscriptionActivationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class MayarWebhookController extends Controller
{
    public function handle(
        Request $request,
        MayarService $mayarService,
        SubscriptionActivationService $activationService
    ): JsonResponse {
        $headerToken = $request->header('X-Callback-Token') ?? $request->header('X-Mayar-Webhook-Token');
        $headerTokenString = is_string($headerToken) && $headerToken !== '' ? $headerToken : null;
        $queryToken = is_string($request->query('token')) && $request->query('token') !== '' ? $request->query('token') : null;

        if (! $mayarService->verifyWebhookToken($queryToken, $headerTokenString)) {
            return response()->json(['message' => 'Unauthorized webhook token.'], 401);
        }

        if ($headerTokenString === null && $queryToken !== null) {
            Log::warning('Mayar webhook authenticated via deprecated query-string token. Migrate to X-Callback-Token header.');
        }

        $payload = $request->all();
        $event = (string) ($payload['event'] ?? '');

        if ($event !== 'payment.received') {
            return response()->json(['status' => 'ignored', 'event' => $event]);
        }

        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $mayarInvoiceId = isset($data['id']) ? (string) $data['id'] : null;
        $externalInvoiceNumber = isset($data['extraData']['idProd']) ? (string) $data['extraData']['idProd'] : null;

        $invoice = SubscriptionInvoice::query()
            ->when($mayarInvoiceId, fn ($q) => $q->where('mayar_invoice_id', $mayarInvoiceId))
            ->when(! $mayarInvoiceId && $externalInvoiceNumber, fn ($q) => $q->where('invoice_number', $externalInvoiceNumber))
            ->first();

        if (! $invoice && $externalInvoiceNumber) {
            $invoice = SubscriptionInvoice::where('invoice_number', $externalInvoiceNumber)->first();
        }

        if (! $invoice) {
            Log::warning('Mayar webhook received for unknown subscription invoice.', [
                'mayar_invoice_id' => $mayarInvoiceId,
                'external_invoice_number' => $externalInvoiceNumber,
            ]);

            return response()->json(['status' => 'ignored', 'reason' => 'invoice_not_found']);
        }

        if ($invoice->status === 'paid') {
            return response()->json(['status' => 'already_paid']);
        }

        $remoteInvoiceId = $invoice->mayar_invoice_id ?: $mayarInvoiceId;
        if (! $remoteInvoiceId) {
            return response()->json(['message' => 'Missing Mayar invoice ID.'], 422);
        }

        try {
            $remoteDetail = $mayarService->getInvoiceDetail($remoteInvoiceId);
        } catch (RuntimeException $e) {
            Log::error('Mayar server-to-server invoice verification failed.', [
                'invoice_number' => $invoice->invoice_number,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Verification failed.'], 502);
        }

        if (! $mayarService->isPaidRemoteInvoice($remoteDetail, $invoice->amount)) {
            Log::warning('Mayar webhook rejected: remote invoice is not paid or amount mismatch.', [
                'invoice_number' => $invoice->invoice_number,
                'expected_amount' => $invoice->amount,
                'remote_status' => $remoteDetail['status'] ?? null,
                'remote_amount' => $remoteDetail['amount'] ?? $remoteDetail['total'] ?? null,
            ]);

            return response()->json(['message' => 'Remote invoice verification mismatch.'], 422);
        }

        $activationService->fulfillPaidInvoice($invoice, [
            'webhook' => $payload,
            'verified_invoice' => $remoteDetail,
        ]);

        return response()->json(['status' => 'ok']);
    }
}
