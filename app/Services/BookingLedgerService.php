<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\BookingPayment;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class BookingLedgerService
{
    public function __construct(
        private readonly StaffCommissionService $commissionService
    ) {}

    /**
     * Record a payment, adjustment, or refund in booking_payments and atomically recompute booking ledger state.
     *
     * @param  array{
     *     payment_type: string,
     *     payment_method: string,
     *     amount: int,
     *     received_amount?: int|null,
     *     notes?: string|null
     * }  $payload
     */
    public function recordPayment(Booking $booking, array $payload, ?User $actor = null): Booking
    {
        return DB::transaction(function () use ($booking, $payload, $actor): Booking {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            $paymentType = (string) ($payload['payment_type'] ?? BookingPayment::TYPE_PARTIAL);
            if (! in_array($paymentType, BookingPayment::TYPES, true)) {
                throw new RuntimeException('Jenis pembayaran tidak valid.');
            }

            $paymentMethod = (string) ($payload['payment_method'] ?? BookingPayment::METHOD_CASH);
            if (! in_array($paymentMethod, BookingPayment::METHODS, true)) {
                throw new RuntimeException('Metode pembayaran tidak valid.');
            }

            if (
                in_array($locked->reservation_status, ['cancelled', 'no_show'], true)
                && $paymentType !== BookingPayment::TYPE_REFUND
            ) {
                throw new RuntimeException('Tidak dapat mencatat pembayaran pada pesanan yang dibatalkan atau tidak hadir.');
            }

            $rawAmount = (int) ($payload['amount'] ?? 0);

            if ($paymentType === BookingPayment::TYPE_REFUND) {
                $refundAmount = abs($rawAmount);
                if ($refundAmount <= 0) {
                    throw new RuntimeException('Nominal refund harus lebih dari 0.');
                }
                if ($refundAmount > (int) $locked->paid_amount) {
                    throw new RuntimeException('Nominal refund tidak boleh melebihi total yang sudah dibayar.');
                }

                BookingPayment::create([
                    'booking_id' => $locked->id,
                    'business_id' => $locked->business_id,
                    'payment_type' => BookingPayment::TYPE_REFUND,
                    'payment_method' => $paymentMethod,
                    'amount' => -$refundAmount,
                    'received_amount' => null,
                    'change_amount' => 0,
                    'recorded_by_user_id' => $actor?->id,
                    'paid_at' => now(),
                    'notes' => isset($payload['notes']) ? trim((string) $payload['notes']) : null,
                ]);

                return $this->recomputeBookingTotalsAndPaymentState($locked, false);
            }

            if ($rawAmount <= 0) {
                if ((int) $locked->total_price === 0 && $paymentType === BookingPayment::TYPE_SETTLEMENT) {
                    $locked->update([
                        'payment_status' => 'settled',
                        'settled_at' => $locked->settled_at ?? now(),
                        'dp_expires_at' => null,
                        'reservation_status' => $locked->reservation_status === 'pending' ? 'confirmed' : $locked->reservation_status,
                    ]);

                    return $locked->fresh(['business', 'service', 'staff', 'customer', 'items', 'payments.recordedBy']);
                }

                throw new RuntimeException('Nominal pembayaran harus lebih dari 0.');
            }

            $receivedAmount = $rawAmount;
            $changeAmount = 0;

            if ($paymentMethod === BookingPayment::METHOD_CASH && isset($payload['received_amount'])) {
                $receivedAmount = (int) $payload['received_amount'];
                if ($receivedAmount < $rawAmount) {
                    throw new RuntimeException('Nominal uang tunai diterima tidak boleh kurang dari nominal pembayaran.');
                }
                $changeAmount = max(0, $receivedAmount - $rawAmount);
            }

            BookingPayment::create([
                'booking_id' => $locked->id,
                'business_id' => $locked->business_id,
                'payment_type' => $paymentType,
                'payment_method' => $paymentMethod,
                'amount' => $rawAmount,
                'received_amount' => $receivedAmount,
                'change_amount' => $changeAmount,
                'recorded_by_user_id' => $actor?->id,
                'paid_at' => now(),
                'notes' => isset($payload['notes']) && trim((string) $payload['notes']) !== ''
                    ? trim((string) $payload['notes'])
                    : null,
            ]);

            return $this->recomputeBookingTotalsAndPaymentState($locked, true);
        });
    }

    /**
     * Sync DP verification into booking_payments and recompute paid_amount + status invariants.
     */
    public function verifyDpPayment(
        Booking $booking,
        string $paymentMethod = BookingPayment::METHOD_TRANSFER,
        ?User $actor = null
    ): Booking {
        return DB::transaction(function () use ($booking, $paymentMethod, $actor): Booking {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            $method = in_array($paymentMethod, BookingPayment::METHODS, true)
                ? $paymentMethod
                : BookingPayment::METHOD_TRANSFER;

            $dpAmount = max(0, (int) $locked->dp_amount);
            $currentPaid = max(0, (int) $locked->paid_amount);

            if ($dpAmount > 0 && $currentPaid < $dpAmount) {
                $delta = $dpAmount - $currentPaid;
                $type = ($currentPaid + $delta) >= (int) $locked->total_price
                    ? BookingPayment::TYPE_SETTLEMENT
                    : BookingPayment::TYPE_DP;

                BookingPayment::create([
                    'booking_id' => $locked->id,
                    'business_id' => $locked->business_id,
                    'payment_type' => $type,
                    'payment_method' => $method,
                    'amount' => $delta,
                    'received_amount' => $delta,
                    'change_amount' => 0,
                    'recorded_by_user_id' => $actor?->id,
                    'paid_at' => now(),
                    'notes' => 'Verifikasi uang muka',
                ]);

                return $this->recomputeBookingTotalsAndPaymentState($locked, true);
            }

            $locked->update([
                'payment_status' => $locked->payment_status === 'settled' ? 'settled' : 'dp_verified',
                'reservation_status' => $locked->reservation_status === 'pending' ? 'confirmed' : $locked->reservation_status,
                'dp_expires_at' => null,
            ]);

            return $locked->fresh(['business', 'service', 'staff', 'customer', 'items', 'payments.recordedBy']);
        });
    }

    /**
     * Sync walk-in initial payment choice into booking_payments and recompute paid_amount + status invariants.
     */
    public function syncWalkinInitialPayment(
        Booking $booking,
        string $initialPaymentStatus,
        string $paymentMethod = BookingPayment::METHOD_CASH,
        ?User $actor = null,
        ?int $receivedAmount = null
    ): Booking {
        return DB::transaction(function () use ($booking, $initialPaymentStatus, $paymentMethod, $actor, $receivedAmount): Booking {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

            if ($initialPaymentStatus === 'unpaid') {
                return $locked->fresh(['business', 'service', 'staff', 'customer', 'items', 'payments.recordedBy']);
            }

            $method = in_array($paymentMethod, BookingPayment::METHODS, true)
                ? $paymentMethod
                : BookingPayment::METHOD_CASH;

            if ($initialPaymentStatus === 'settled') {
                $remaining = max(0, (int) $locked->total_price - (int) $locked->paid_amount);
                if ($remaining > 0) {
                    $rec = $method === BookingPayment::METHOD_CASH && $receivedAmount !== null
                        ? max($remaining, $receivedAmount)
                        : $remaining;

                    BookingPayment::create([
                        'booking_id' => $locked->id,
                        'business_id' => $locked->business_id,
                        'payment_type' => BookingPayment::TYPE_SETTLEMENT,
                        'payment_method' => $method,
                        'amount' => $remaining,
                        'received_amount' => $rec,
                        'change_amount' => max(0, $rec - $remaining),
                        'recorded_by_user_id' => $actor?->id,
                        'paid_at' => now(),
                        'notes' => 'Pembayaran lunas saat walk-in',
                    ]);

                    return $this->recomputeBookingTotalsAndPaymentState($locked, true);
                }

                $locked->update([
                    'payment_status' => 'settled',
                    'settled_at' => $locked->settled_at ?? now(),
                    'reservation_status' => 'confirmed',
                    'dp_expires_at' => null,
                ]);

                return $locked->fresh(['business', 'service', 'staff', 'customer', 'items', 'payments.recordedBy']);
            }

            // initial_payment_status === 'dp_verified'
            $dpAmount = max(0, (int) $locked->dp_amount);
            if ($dpAmount > 0 && (int) $locked->paid_amount < $dpAmount) {
                $delta = $dpAmount - (int) $locked->paid_amount;
                $rec = $method === BookingPayment::METHOD_CASH && $receivedAmount !== null
                    ? max($delta, $receivedAmount)
                    : $delta;

                BookingPayment::create([
                    'booking_id' => $locked->id,
                    'business_id' => $locked->business_id,
                    'payment_type' => ($locked->paid_amount + $delta) >= (int) $locked->total_price
                        ? BookingPayment::TYPE_SETTLEMENT
                        : BookingPayment::TYPE_DP,
                    'payment_method' => $method,
                    'amount' => $delta,
                    'received_amount' => $rec,
                    'change_amount' => max(0, $rec - $delta),
                    'recorded_by_user_id' => $actor?->id,
                    'paid_at' => now(),
                    'notes' => 'Uang muka saat walk-in',
                ]);

                return $this->recomputeBookingTotalsAndPaymentState($locked, true);
            }

            $locked->update([
                'payment_status' => 'dp_verified',
                'reservation_status' => 'confirmed',
                'dp_expires_at' => null,
            ]);

            return $locked->fresh(['business', 'service', 'staff', 'customer', 'items', 'payments.recordedBy']);
        });
    }

    /**
     * Quick settle helper for legacy PATCH status = settled action so ledger remains balanced.
     */
    public function settleRemainingFromStatusAction(Booking $booking, ?User $actor = null): Booking
    {
        return DB::transaction(function () use ($booking, $actor): Booking {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            $remaining = max(0, (int) $locked->total_price - (int) $locked->paid_amount);

            if ($remaining > 0) {
                BookingPayment::create([
                    'booking_id' => $locked->id,
                    'business_id' => $locked->business_id,
                    'payment_type' => BookingPayment::TYPE_SETTLEMENT,
                    'payment_method' => BookingPayment::METHOD_CASH,
                    'amount' => $remaining,
                    'received_amount' => $remaining,
                    'change_amount' => 0,
                    'recorded_by_user_id' => $actor?->id,
                    'paid_at' => now(),
                    'notes' => 'Pelunasan di kasir',
                ]);

                return $this->recomputeBookingTotalsAndPaymentState($locked, true);
            }

            $locked->update([
                'payment_status' => 'settled',
                'settled_at' => $locked->settled_at ?? now(),
                'dp_expires_at' => null,
            ]);

            return $locked->fresh(['business', 'service', 'staff', 'customer', 'items', 'payments.recordedBy']);
        });
    }

    /**
     * Replace counter booking items (preserving at least one service/line item) and recompute totals, commission, and payment invariants.
     *
     * @param  array<int, array{
     *     item_type: string,
     *     service_id?: int|null,
     *     service_addon_id?: int|null,
     *     name?: string|null,
     *     unit_label?: string|null,
     *     unit_price?: int|null,
     *     quantity: int,
     *     is_commissionable?: bool|null
     * }>  $itemsPayload
     */
    public function adjustItems(Booking $booking, array $itemsPayload): Booking
    {
        return DB::transaction(function () use ($booking, $itemsPayload): Booking {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            $business = $locked->business()->firstOrFail();

            if (in_array($locked->reservation_status, ['cancelled', 'no_show'], true)) {
                throw new RuntimeException('Tidak dapat mengubah item pada pesanan yang dibatalkan atau tidak hadir.');
            }

            if ($itemsPayload === []) {
                throw new RuntimeException('Minimal harus ada 1 item layanan dalam pesanan.');
            }

            $serviceIds = collect($itemsPayload)
                ->where('item_type', BookingItem::TYPE_SERVICE)
                ->pluck('service_id')
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();

            $addonIds = collect($itemsPayload)
                ->where('item_type', BookingItem::TYPE_ADDON)
                ->pluck('service_addon_id')
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();

            $servicesById = $serviceIds !== []
                ? Service::where('business_id', $business->id)
                    ->whereIn('id', $serviceIds)
                    ->get()
                    ->keyBy('id')
                : collect();

            $addonsById = $addonIds !== []
                ? ServiceAddon::where('business_id', $business->id)
                    ->whereIn('id', $addonIds)
                    ->get()
                    ->keyBy('id')
                : collect();

            $preparedRows = [];
            $primaryServiceId = $locked->service_id;
            $totalServiceQty = 0;

            foreach ($itemsPayload as $row) {
                $type = (string) ($row['item_type'] ?? BookingItem::TYPE_CUSTOM);
                $qty = max(1, min(100, (int) ($row['quantity'] ?? 1)));

                if ($type === BookingItem::TYPE_SERVICE) {
                    $service = $servicesById->get((int) ($row['service_id'] ?? 0));
                    if (! $service) {
                        throw new RuntimeException('Layanan tidak ditemukan untuk bisnis ini.');
                    }

                    if ($totalServiceQty === 0) {
                        $primaryServiceId = $service->id;
                    }
                    $totalServiceQty += $qty;
                    $unitPrice = (int) $service->price;

                    $preparedRows[] = [
                        'item_type' => BookingItem::TYPE_SERVICE,
                        'service_id' => $service->id,
                        'service_addon_id' => null,
                        'name_snapshot' => $service->name,
                        'unit_label_snapshot' => $service->resolvedUnitLabel(),
                        'unit_price' => $unitPrice,
                        'quantity' => $qty,
                        'duration_minutes_snapshot' => $locked->isDropoff() ? 0 : (int) $service->duration_minutes,
                        'turnaround_days_snapshot' => $locked->isDropoff() ? (int) ($service->turnaround_days ?? 1) : 0,
                        'is_commissionable' => true,
                        'subtotal' => $unitPrice * $qty,
                    ];
                } elseif ($type === BookingItem::TYPE_ADDON) {
                    $addon = $addonsById->get((int) ($row['service_addon_id'] ?? 0));
                    if (! $addon) {
                        throw new RuntimeException('Add-on layanan tidak ditemukan untuk bisnis ini.');
                    }

                    $unitPrice = (int) $addon->price;

                    $preparedRows[] = [
                        'item_type' => BookingItem::TYPE_ADDON,
                        'service_id' => null,
                        'service_addon_id' => $addon->id,
                        'name_snapshot' => $addon->name,
                        'unit_label_snapshot' => $addon->resolvedUnitLabel(),
                        'unit_price' => $unitPrice,
                        'quantity' => $qty,
                        'duration_minutes_snapshot' => $locked->isDropoff() ? 0 : (int) $addon->duration_minutes,
                        'turnaround_days_snapshot' => 0,
                        'is_commissionable' => (bool) $addon->is_commissionable,
                        'subtotal' => $unitPrice * $qty,
                    ];
                } else {
                    $name = trim((string) ($row['name'] ?? ''));
                    if ($name === '') {
                        throw new RuntimeException('Nama item tambahan wajib diisi.');
                    }

                    $unitPrice = max(0, (int) ($row['unit_price'] ?? 0));
                    $unitLabel = is_string($row['unit_label'] ?? null) && in_array(trim($row['unit_label']), Service::UNIT_LABELS, true)
                        ? trim((string) $row['unit_label'])
                        : Service::DEFAULT_UNIT_LABEL;

                    $preparedRows[] = [
                        'item_type' => BookingItem::TYPE_CUSTOM,
                        'service_id' => null,
                        'service_addon_id' => null,
                        'name_snapshot' => mb_substr($name, 0, 160),
                        'unit_label_snapshot' => $unitLabel,
                        'unit_price' => $unitPrice,
                        'quantity' => $qty,
                        'duration_minutes_snapshot' => 0,
                        'turnaround_days_snapshot' => 0,
                        'is_commissionable' => (bool) ($row['is_commissionable'] ?? false),
                        'subtotal' => $unitPrice * $qty,
                    ];
                }
            }

            $locked->items()->delete();
            foreach ($preparedRows as $prepared) {
                $locked->items()->create($prepared);
            }

            $locked->update([
                'service_id' => $primaryServiceId,
                'quantity' => max(1, $totalServiceQty > 0 ? $totalServiceQty : (int) $locked->quantity),
            ]);

            return $this->recomputeBookingTotalsAndPaymentState($locked, false);
        });
    }

    /**
     * Atomically recompute bookings.total_price, paid_amount, commission_amount, and payment_status invariants.
     */
    public function recomputeBookingTotalsAndPaymentState(Booking $lockedBooking, bool $confirmPendingIfPaid = true): Booking
    {
        $items = $lockedBooking->items()->orderBy('id')->get();
        $totalPrice = $items->isNotEmpty()
            ? max(0, (int) $items->sum('subtotal'))
            : max(0, (int) $lockedBooking->total_price);

        $paidAmount = max(0, (int) $lockedBooking->payments()->sum('amount'));

        $paymentStatus = $lockedBooking->payment_status;
        $settledAt = $lockedBooking->settled_at;

        if ($totalPrice === 0) {
            if ($paidAmount > 0 || $lockedBooking->payment_status === 'settled') {
                $paymentStatus = 'settled';
                $settledAt = $settledAt ?? now();
            }
        } elseif ($paidAmount >= $totalPrice) {
            $paymentStatus = 'settled';
            $settledAt = $settledAt ?? now();
        } elseif ($paidAmount > 0) {
            $paymentStatus = 'dp_verified';
            $settledAt = null;
        } else {
            $settledAt = null;
            if (in_array($paymentStatus, ['dp_verified', 'settled'], true)) {
                $paymentStatus = 'unpaid';
            }
        }

        $reservationStatus = $lockedBooking->reservation_status;
        if ($confirmPendingIfPaid && $reservationStatus === 'pending' && in_array($paymentStatus, ['dp_verified', 'settled'], true)) {
            $reservationStatus = 'confirmed';
        }

        $dpExpiresAt = in_array($paymentStatus, ['dp_verified', 'settled'], true)
            ? null
            : $lockedBooking->dp_expires_at;

        $lockedBooking->setRelation('items', $items);
        $lockedBooking->total_price = $totalPrice;
        $commissionAmount = $this->commissionService->calculateForBooking($lockedBooking);

        $lockedBooking->update([
            'total_price' => $totalPrice,
            'paid_amount' => $paidAmount,
            'payment_status' => $paymentStatus,
            'settled_at' => $settledAt,
            'dp_expires_at' => $dpExpiresAt,
            'reservation_status' => $reservationStatus,
            'commission_amount' => $commissionAmount,
        ]);

        return $lockedBooking->fresh(['business', 'service', 'staff', 'customer', 'items', 'payments.recordedBy']);
    }
}
