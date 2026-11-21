<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\OperatingHour;
use App\Models\Service;
use App\Models\Staff;
use App\Models\StaffOperatingHour;
use App\Models\StaffTimeOff;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class SlotAvailabilityService
{
    /**
     * Generate available time slots for a service on a given date in the business timezone.
     *
     * @return array<int, array{time: string, available_capacity: int, available_staff_ids: array<int, int>}>
     */
    public function getAvailableSlots(
        Business $business,
        Service $service,
        string $dateString,
        ?int $staffId = null,
        bool $allowImmediateToday = false,
        ?int $excludeBookingId = null
    ): array {
        $timezone = $business->timezone ?: 'Asia/Jakarta';
        $targetDate = CarbonImmutable::createFromFormat('Y-m-d', $dateString, $timezone)->startOfDay();
        $now = CarbonImmutable::now($timezone);

        if ($targetDate->isBefore($now->startOfDay())) {
            return [];
        }

        if (! $allowImmediateToday) {
            $maxAdvanceDays = max(1, (int) ($business->max_booking_advance_days ?: 60));
            if ($targetDate->gt($now->startOfDay()->addDays($maxAdvanceDays))) {
                return [];
            }
        }

        // Check business holidays
        $isHoliday = $business->holidays()
            ->whereDate('date', $targetDate->toDateString())
            ->exists();

        if ($isHoliday) {
            return [];
        }

        $operatingHour = $business->operatingHours()
            ->where('day_of_week', $targetDate->dayOfWeek)
            ->first();

        if (! $operatingHour || ! $operatingHour->is_open) {
            return [];
        }

        $openAt = $targetDate->setTimeFromTimeString($operatingHour->open_time);
        $closeAt = $targetDate->setTimeFromTimeString($operatingHour->close_time);

        $breakStart = $operatingHour->break_start
            ? $targetDate->setTimeFromTimeString($operatingHour->break_start)
            : null;
        $breakEnd = $operatingHour->break_end
            ? $targetDate->setTimeFromTimeString($operatingHour->break_end)
            : null;

        // Eligible staff if staff-assigned mode
        $eligibleStaffIds = [];
        $staffHoursByStaff = collect();

        if ($service->assignment_mode === 'staff') {
            $eligibleStaffIds = $this->resolveEligibleStaffIdsOnDate($service, $targetDate, $staffId);

            if (empty($eligibleStaffIds)) {
                return [];
            }

            $staffHoursByStaff = StaffOperatingHour::query()
                ->whereIn('staff_id', $eligibleStaffIds)
                ->get()
                ->groupBy('staff_id');
        }

        // Fetch active time-slot bookings on that date
        $existingBookings = $business->bookings()
            ->where('booking_mode', 'time_slot')
            ->whereBookingDate($targetDate->toDateString())
            ->whereIn('reservation_status', ['pending', 'confirmed'])
            ->when($excludeBookingId !== null, fn ($q) => $q->where('id', '!=', $excludeBookingId))
            ->get(['id', 'service_id', 'staff_id', 'start_at', 'buffer_end_at']);

        $stepMinutes = max(15, min(60, (int) $service->duration_minutes));
        $duration = (int) $service->duration_minutes;
        $buffer = (int) $service->buffer_minutes;

        $leadMinutes = max(0, (int) ($business->min_booking_lead_minutes ?? 15));
        $cutoffTime = $allowImmediateToday ? $now->subMinutes(15) : $now->addMinutes($leadMinutes);

        $slots = [];
        $cursor = $openAt;

        while ($cursor->addMinutes($duration)->lte($closeAt)) {
            $slotEnd = $cursor->addMinutes($duration);
            $slotBufferEnd = $slotEnd->addMinutes($buffer);

            if ($cursor->lte($cutoffTime)) {
                $cursor = $cursor->addMinutes($stepMinutes);

                continue;
            }

            // Skip business break overlaps
            if ($breakStart && $breakEnd && $cursor->lt($breakEnd) && $slotEnd->gt($breakStart)) {
                $cursor = $cursor->addMinutes($stepMinutes);

                continue;
            }

            $slotStartUtc = $cursor->utc();
            $slotBufferEndUtc = $slotBufferEnd->utc();

            if ($service->assignment_mode === 'capacity') {
                $overlappingCount = $existingBookings
                    ->where('service_id', $service->id)
                    ->filter(fn (Booking $b) => $b->start_at->lt($slotBufferEndUtc) && $b->buffer_end_at->gt($slotStartUtc))
                    ->count();

                $remaining = max(0, (int) $service->capacity - $overlappingCount);
                if ($remaining > 0) {
                    $slots[] = [
                        'time' => $cursor->format('H:i'),
                        'available_capacity' => $remaining,
                        'available_staff_ids' => [],
                    ];
                }
            } else {
                $freeStaffIds = [];
                foreach ($eligibleStaffIds as $candidateStaffId) {
                    if (! $this->isStaffWorkingDuringSlot($candidateStaffId, $cursor, $slotEnd, $targetDate, $staffHoursByStaff)) {
                        continue;
                    }

                    $hasConflict = $existingBookings
                        ->where('staff_id', $candidateStaffId)
                        ->contains(fn (Booking $b) => $b->start_at->lt($slotBufferEndUtc) && $b->buffer_end_at->gt($slotStartUtc));

                    if (! $hasConflict) {
                        $freeStaffIds[] = $candidateStaffId;
                    }
                }

                if (! empty($freeStaffIds)) {
                    $slots[] = [
                        'time' => $cursor->format('H:i'),
                        'available_capacity' => count($freeStaffIds),
                        'available_staff_ids' => $freeStaffIds,
                    ];
                }
            }

            $cursor = $cursor->addMinutes($stepMinutes);
        }

        return $slots;
    }

    /**
     * Check daily drop-off quota and estimated ready date for a drop-off/turnaround service.
     *
     * @return array{
     *     available: bool,
     *     reason: string|null,
     *     remaining_capacity: int,
     *     total_capacity: int,
     *     open_time: string|null,
     *     close_time: string|null,
     *     estimated_ready_date: string|null,
     *     turnaround_days: int,
     *     supports_pickup: bool
     * }
     */
    public function getDropoffAvailability(
        Business $business,
        Service $service,
        string $dateString,
        bool $allowImmediateToday = false,
        ?int $excludeBookingId = null
    ): array {
        $timezone = $business->timezone ?: 'Asia/Jakarta';
        $targetDate = CarbonImmutable::createFromFormat('Y-m-d', $dateString, $timezone)->startOfDay();
        $now = CarbonImmutable::now($timezone);
        $totalCapacity = max(1, (int) $service->capacity);
        $turnaroundDays = max(0, (int) ($service->turnaround_days ?? 1));

        $unavailable = fn (string $reason): array => [
            'available' => false,
            'reason' => $reason,
            'remaining_capacity' => 0,
            'total_capacity' => $totalCapacity,
            'open_time' => null,
            'close_time' => null,
            'estimated_ready_date' => null,
            'turnaround_days' => $turnaroundDays,
            'supports_pickup' => (bool) $service->supports_pickup,
        ];

        if ($targetDate->isBefore($now->startOfDay())) {
            return $unavailable('Tanggal yang dipilih sudah berlalu.');
        }

        if (! $allowImmediateToday) {
            $maxAdvanceDays = max(1, (int) ($business->max_booking_advance_days ?: 60));
            if ($targetDate->gt($now->startOfDay()->addDays($maxAdvanceDays))) {
                return $unavailable("Pemesanan tersedia maksimal {$maxAdvanceDays} hari ke depan.");
            }
        }

        $isHoliday = $business->holidays()
            ->whereDate('date', $targetDate->toDateString())
            ->exists();

        if ($isHoliday) {
            return $unavailable('Bisnis sedang libur pada tanggal yang dipilih.');
        }

        $operatingHour = $business->operatingHours()
            ->where('day_of_week', $targetDate->dayOfWeek)
            ->first();

        if (! $operatingHour || ! $operatingHour->is_open) {
            return $unavailable('Bisnis tutup pada hari ini sesuai jadwal operasional.');
        }

        $closeAt = $targetDate->setTimeFromTimeString($operatingHour->close_time);
        if (! $allowImmediateToday && $targetDate->isSameDay($now) && $now->gte($closeAt)) {
            return $unavailable('Jam operasional hari ini sudah berakhir. Silakan pilih tanggal berikutnya.');
        }

        $usedCapacity = (int) $business->bookings()
            ->where('service_id', $service->id)
            ->whereBookingDate($targetDate->toDateString())
            ->whereIn('reservation_status', ['pending', 'confirmed'])
            ->when($excludeBookingId !== null, fn ($q) => $q->where('id', '!=', $excludeBookingId))
            ->sum('quantity');

        $remainingCapacity = max(0, $totalCapacity - $usedCapacity);
        $estimatedReadyDate = $this->calculateEstimatedReadyDate($business, $targetDate, $turnaroundDays);

        return [
            'available' => $remainingCapacity > 0,
            'reason' => $remainingCapacity > 0 ? null : 'Kuota harian untuk layanan ini sudah penuh pada tanggal tersebut.',
            'remaining_capacity' => $remainingCapacity,
            'total_capacity' => $totalCapacity,
            'open_time' => substr((string) $operatingHour->open_time, 0, 5),
            'close_time' => substr((string) $operatingHour->close_time, 0, 5),
            'estimated_ready_date' => $estimatedReadyDate->toDateString(),
            'turnaround_days' => $turnaroundDays,
            'supports_pickup' => (bool) $service->supports_pickup,
        ];
    }

    /**
     * Atomically reserve a time slot inside a DB transaction with pessimistic locking.
     */
    public function reserveSlot(
        Business $business,
        Service $service,
        string $dateString,
        string $timeString,
        ?int $requestedStaffId,
        string $customerName,
        string $customerPhone,
        ?string $customerEmail,
        ?string $customerNotes,
        ?UploadedFile $dpProofFile = null,
        bool $allowImmediateToday = false
    ): Booking {
        return DB::transaction(function () use (
            $business,
            $service,
            $dateString,
            $timeString,
            $requestedStaffId,
            $customerName,
            $customerPhone,
            $customerEmail,
            $customerNotes,
            $dpProofFile,
            $allowImmediateToday
        ): Booking {
            $timezone = $business->timezone ?: 'Asia/Jakarta';
            $startLocal = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$dateString} {$timeString}", $timezone);
            $endLocal = $startLocal->addMinutes($service->duration_minutes);
            $bufferEndLocal = $endLocal->addMinutes($service->buffer_minutes);

            $this->assertBusinessWindowAndOperatingHours($business, $startLocal, $endLocal, $allowImmediateToday);

            $startUtc = $startLocal->utc();
            $endUtc = $endLocal->utc();
            $bufferEndUtc = $bufferEndLocal->utc();

            // Lock parent business row first to prevent phantom-read double-bookings on empty slots
            Business::whereKey($business->id)->lockForUpdate()->firstOrFail();

            // Lock overlapping time-slot bookings to prevent race conditions
            $overlapping = Booking::where('business_id', $business->id)
                ->where('booking_mode', 'time_slot')
                ->whereIn('reservation_status', ['pending', 'confirmed'])
                ->where('start_at', '<', $bufferEndUtc)
                ->where('buffer_end_at', '>', $startUtc)
                ->lockForUpdate()
                ->get();

            $assignedStaffId = $this->resolveAvailableStaffOrCheckCapacity(
                $service,
                $startLocal,
                $endLocal,
                $requestedStaffId,
                $overlapping
            );

            $prepared = $this->upsertCustomerAndComputePricing(
                business: $business,
                service: $service,
                quantity: 1,
                assignedStaffId: $assignedStaffId,
                customerName: $customerName,
                customerPhone: $customerPhone,
                customerEmail: $customerEmail,
                dpProofFile: $dpProofFile,
                allowImmediateToday: $allowImmediateToday
            );

            return Booking::create([
                'business_id' => $business->id,
                'service_id' => $service->id,
                'staff_id' => $assignedStaffId,
                'customer_id' => $prepared['customer']->id,
                'booked_customer_name' => $prepared['booked_customer_name'],
                'booked_customer_email' => $prepared['booked_customer_email'],
                'booking_mode' => 'time_slot',
                'quantity' => 1,
                'fulfillment_type' => 'dropoff',
                'booking_code' => $this->generateBookingCode(),
                'invoice_number' => $this->generateInvoiceNumber(),
                'invoice_token' => $this->generateInvoiceToken(),
                'booking_date' => $startLocal->toDateString(),
                'start_at' => $startUtc,
                'end_at' => $endUtc,
                'buffer_end_at' => $bufferEndUtc,
                'total_price' => $prepared['total_price'],
                'dp_amount' => $prepared['dp_amount'],
                'commission_amount' => $prepared['commission_amount'],
                'reservation_status' => 'pending',
                'payment_status' => $prepared['payment_status'],
                'dp_proof_path' => $prepared['proof_path'],
                'dp_expires_at' => $prepared['dp_expires_at'],
                'customer_notes' => $customerNotes,
            ]);
        });
    }

    /**
     * Atomically reserve a drop-off / turnaround order inside a DB transaction using daily capacity.
     */
    public function reserveDropoff(
        Business $business,
        Service $service,
        string $dateString,
        int $quantity,
        string $fulfillmentType,
        ?string $pickupSession,
        ?string $pickupAddress,
        string $customerName,
        string $customerPhone,
        ?string $customerEmail,
        ?string $customerNotes,
        ?UploadedFile $dpProofFile = null,
        bool $allowImmediateToday = false
    ): Booking {
        if ($quantity < 1 || $quantity > 50) {
            throw new RuntimeException('Jumlah item harus antara 1 sampai 50.');
        }

        return DB::transaction(function () use (
            $business,
            $service,
            $dateString,
            $quantity,
            $fulfillmentType,
            $pickupSession,
            $pickupAddress,
            $customerName,
            $customerPhone,
            $customerEmail,
            $customerNotes,
            $dpProofFile,
            $allowImmediateToday
        ): Booking {
            $timezone = $business->timezone ?: 'Asia/Jakarta';
            $targetDate = CarbonImmutable::createFromFormat('Y-m-d', $dateString, $timezone)->startOfDay();

            Business::whereKey($business->id)->lockForUpdate()->firstOrFail();

            $operatingHour = $this->assertDropoffDateOpen($business, $targetDate, $allowImmediateToday);

            $activeBookings = Booking::where('business_id', $business->id)
                ->where('service_id', $service->id)
                ->whereBookingDate($targetDate->toDateString())
                ->whereIn('reservation_status', ['pending', 'confirmed'])
                ->lockForUpdate()
                ->get(['id', 'quantity']);

            $usedCapacity = (int) $activeBookings->sum('quantity');
            $totalCapacity = max(1, (int) $service->capacity);
            $remaining = max(0, $totalCapacity - $usedCapacity);

            if ($quantity > $remaining) {
                if ($remaining <= 0) {
                    throw new RuntimeException('Kuota harian untuk layanan ini sudah penuh pada tanggal yang dipilih.');
                }

                throw new RuntimeException("Sisa kuota pada tanggal tersebut hanya {$remaining} item.");
            }

            $resolvedFulfillment = ($service->supports_pickup && $fulfillmentType === 'pickup') ? 'pickup' : 'dropoff';
            $resolvedSession = $resolvedFulfillment === 'pickup'
                ? (array_key_exists((string) $pickupSession, Booking::PICKUP_SESSIONS) ? (string) $pickupSession : 'anytime')
                : null;
            $resolvedAddress = $resolvedFulfillment === 'pickup' ? trim((string) ($pickupAddress ?? '')) : null;

            [$startLocal, $endLocal] = $this->resolveDropoffWindow($targetDate, $operatingHour->open_time, $operatingHour->close_time, $resolvedFulfillment, $resolvedSession);
            $estimatedReadyDate = $this->calculateEstimatedReadyDate($business, $targetDate, max(0, (int) ($service->turnaround_days ?? 1)));

            $prepared = $this->upsertCustomerAndComputePricing(
                business: $business,
                service: $service,
                quantity: $quantity,
                assignedStaffId: null,
                customerName: $customerName,
                customerPhone: $customerPhone,
                customerEmail: $customerEmail,
                dpProofFile: $dpProofFile,
                allowImmediateToday: $allowImmediateToday
            );

            $startUtc = $startLocal->utc();
            $endUtc = $endLocal->utc();

            return Booking::create([
                'business_id' => $business->id,
                'service_id' => $service->id,
                'staff_id' => null,
                'customer_id' => $prepared['customer']->id,
                'booked_customer_name' => $prepared['booked_customer_name'],
                'booked_customer_email' => $prepared['booked_customer_email'],
                'booking_mode' => 'dropoff',
                'quantity' => $quantity,
                'fulfillment_type' => $resolvedFulfillment,
                'pickup_session' => $resolvedSession,
                'pickup_address' => $resolvedAddress !== '' ? $resolvedAddress : null,
                'booking_code' => $this->generateBookingCode(),
                'invoice_number' => $this->generateInvoiceNumber(),
                'invoice_token' => $this->generateInvoiceToken(),
                'booking_date' => $targetDate->toDateString(),
                'start_at' => $startUtc,
                'end_at' => $endUtc,
                'buffer_end_at' => $endUtc,
                'estimated_ready_date' => $estimatedReadyDate->toDateString(),
                'total_price' => $prepared['total_price'],
                'dp_amount' => $prepared['dp_amount'],
                'commission_amount' => 0,
                'reservation_status' => 'pending',
                'work_status' => 'awaiting_dropoff',
                'payment_status' => $prepared['payment_status'],
                'dp_proof_path' => $prepared['proof_path'],
                'dp_expires_at' => $prepared['dp_expires_at'],
                'customer_notes' => $customerNotes,
            ]);
        });
    }

    /**
     * Atomically reschedule an existing active booking with pessimistic locking.
     */
    public function rescheduleBooking(
        Booking $booking,
        string $dateString,
        ?string $timeString = null,
        ?int $requestedStaffId = null,
        bool $allowImmediateToday = true
    ): Booking {
        return DB::transaction(function () use (
            $booking,
            $dateString,
            $timeString,
            $requestedStaffId,
            $allowImmediateToday
        ): Booking {
            $lockedBooking = Booking::where('id', $booking->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($lockedBooking->reservation_status, ['pending', 'confirmed'], true)) {
                throw new RuntimeException('Hanya reservasi berstatus Menunggu atau Dikonfirmasi yang dapat dijadwalkan ulang.');
            }

            $business = Business::whereKey($lockedBooking->business_id)->lockForUpdate()->firstOrFail();
            $service = $lockedBooking->service()->firstOrFail();
            $timezone = $business->timezone ?: 'Asia/Jakarta';

            if ($lockedBooking->isDropoff()) {
                $targetDate = CarbonImmutable::createFromFormat('Y-m-d', $dateString, $timezone)->startOfDay();
                $operatingHour = $this->assertDropoffDateOpen($business, $targetDate, $allowImmediateToday);

                $usedCapacity = (int) Booking::where('business_id', $business->id)
                    ->where('service_id', $service->id)
                    ->where('id', '!=', $lockedBooking->id)
                    ->whereBookingDate($targetDate->toDateString())
                    ->whereIn('reservation_status', ['pending', 'confirmed'])
                    ->lockForUpdate()
                    ->sum('quantity');

                $totalCapacity = max(1, (int) $service->capacity);
                $remaining = max(0, $totalCapacity - $usedCapacity);
                $qty = max(1, (int) $lockedBooking->quantity);

                if ($qty > $remaining) {
                    throw new RuntimeException("Sisa kuota harian pada tanggal tersebut ({$remaining}) tidak mencukupi untuk {$qty} item.");
                }

                [$startLocal, $endLocal] = $this->resolveDropoffWindow(
                    $targetDate,
                    $operatingHour->open_time,
                    $operatingHour->close_time,
                    $lockedBooking->fulfillment_type ?? 'dropoff',
                    $lockedBooking->pickup_session
                );
                $estimatedReadyDate = $this->calculateEstimatedReadyDate($business, $targetDate, max(0, (int) ($service->turnaround_days ?? 1)));

                $startUtc = $startLocal->utc();
                $endUtc = $endLocal->utc();

                $lockedBooking->update([
                    'booking_date' => $targetDate->toDateString(),
                    'start_at' => $startUtc,
                    'end_at' => $endUtc,
                    'buffer_end_at' => $endUtc,
                    'estimated_ready_date' => $estimatedReadyDate->toDateString(),
                    'rescheduled_count' => (int) $lockedBooking->rescheduled_count + 1,
                    'last_rescheduled_at' => now(),
                    'reminder_h1_sent_at' => null,
                    'reminder_h2_sent_at' => null,
                ]);

                return $lockedBooking->fresh(['business', 'service', 'staff', 'customer']);
            }

            if (! $timeString) {
                throw new RuntimeException('Jam reservasi wajib dipilih.');
            }

            $startLocal = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$dateString} {$timeString}", $timezone);
            $endLocal = $startLocal->addMinutes($service->duration_minutes);
            $bufferEndLocal = $endLocal->addMinutes($service->buffer_minutes);

            $this->assertBusinessWindowAndOperatingHours($business, $startLocal, $endLocal, $allowImmediateToday);

            $startUtc = $startLocal->utc();
            $endUtc = $endLocal->utc();
            $bufferEndUtc = $bufferEndLocal->utc();

            $overlapping = Booking::where('business_id', $business->id)
                ->where('booking_mode', 'time_slot')
                ->where('id', '!=', $lockedBooking->id)
                ->whereIn('reservation_status', ['pending', 'confirmed'])
                ->where('start_at', '<', $bufferEndUtc)
                ->where('buffer_end_at', '>', $startUtc)
                ->lockForUpdate()
                ->get();

            $assignedStaffId = $this->resolveAvailableStaffOrCheckCapacity(
                $service,
                $startLocal,
                $endLocal,
                $requestedStaffId,
                $overlapping
            );

            $newCommissionAmount = $lockedBooking->commission_amount;
            if ((int) $lockedBooking->staff_id !== (int) $assignedStaffId) {
                $newStaff = $assignedStaffId
                    ? Staff::where('business_id', $business->id)->find($assignedStaffId)
                    : null;
                $newCommissionAmount = $newStaff
                    ? $newStaff->calculateCommission((int) $lockedBooking->total_price)
                    : 0;
            }

            $lockedBooking->update([
                'staff_id' => $assignedStaffId,
                'commission_amount' => $newCommissionAmount,
                'booking_date' => $startLocal->toDateString(),
                'start_at' => $startUtc,
                'end_at' => $endUtc,
                'buffer_end_at' => $bufferEndUtc,
                'rescheduled_count' => (int) $lockedBooking->rescheduled_count + 1,
                'last_rescheduled_at' => now(),
                'reminder_h1_sent_at' => null,
                'reminder_h2_sent_at' => null,
            ]);

            return $lockedBooking->fresh(['business', 'service', 'staff', 'customer']);
        });
    }

    /**
     * Validate business booking window, holidays, operating hours, and break times.
     */
    private function assertBusinessWindowAndOperatingHours(
        Business $business,
        CarbonImmutable $startLocal,
        CarbonImmutable $endLocal,
        bool $allowImmediateToday
    ): void {
        $timezone = $business->timezone ?: 'Asia/Jakarta';
        $now = CarbonImmutable::now($timezone);
        $targetDate = $startLocal->startOfDay();

        if ($targetDate->isBefore($now->startOfDay())) {
            throw new RuntimeException('Tidak dapat memesan tanggal yang sudah berlalu.');
        }

        $leadMinutes = max(0, (int) ($business->min_booking_lead_minutes ?? 15));
        $cutoffTime = $allowImmediateToday ? $now->subMinutes(15) : $now->addMinutes($leadMinutes);
        if ($startLocal->lte($cutoffTime)) {
            throw new RuntimeException('Jam yang dipilih sudah melewati batas waktu pemesanan.');
        }

        if (! $allowImmediateToday) {
            $maxAdvanceDays = max(1, (int) ($business->max_booking_advance_days ?: 60));
            if ($targetDate->gt($now->startOfDay()->addDays($maxAdvanceDays))) {
                throw new RuntimeException("Pemesanan hanya tersedia maksimal {$maxAdvanceDays} hari ke depan.");
            }
        }

        $isHoliday = $business->holidays()
            ->whereDate('date', $targetDate->toDateString())
            ->exists();

        if ($isHoliday) {
            throw new RuntimeException('Bisnis sedang libur pada tanggal yang dipilih.');
        }

        $operatingHour = $business->operatingHours()
            ->where('day_of_week', $targetDate->dayOfWeek)
            ->first();

        if (! $operatingHour || ! $operatingHour->is_open) {
            throw new RuntimeException('Bisnis tutup pada hari yang dipilih.');
        }

        $openAt = $targetDate->setTimeFromTimeString($operatingHour->open_time);
        $closeAt = $targetDate->setTimeFromTimeString($operatingHour->close_time);

        if ($startLocal->lt($openAt) || $endLocal->gt($closeAt)) {
            throw new RuntimeException('Jam yang dipilih berada di luar jam operasional bisnis.');
        }

        if ($operatingHour->break_start && $operatingHour->break_end) {
            $breakStart = $targetDate->setTimeFromTimeString($operatingHour->break_start);
            $breakEnd = $targetDate->setTimeFromTimeString($operatingHour->break_end);
            if ($startLocal->lt($breakEnd) && $endLocal->gt($breakStart)) {
                throw new RuntimeException('Jam yang dipilih berbenturan dengan jam istirahat bisnis.');
            }
        }
    }

    /**
     * Resolve an available staff ID or verify capacity for a given slot.
     *
     * @param  Collection<int, Booking>  $overlapping
     */
    private function resolveAvailableStaffOrCheckCapacity(
        Service $service,
        CarbonImmutable $startLocal,
        CarbonImmutable $endLocal,
        ?int $requestedStaffId,
        Collection $overlapping
    ): ?int {
        if ($service->assignment_mode === 'capacity') {
            $serviceOverlaps = $overlapping->where('service_id', $service->id)->count();
            if ($serviceOverlaps >= $service->capacity) {
                throw new RuntimeException('Slot waktu yang dipilih sudah penuh. Silakan pilih jam lain.');
            }

            return null;
        }

        $targetDate = $startLocal->startOfDay();
        $eligibleStaffIds = $this->resolveEligibleStaffIdsOnDate($service, $targetDate, $requestedStaffId);

        if (empty($eligibleStaffIds)) {
            throw new RuntimeException('Staff tidak tersedia atau sedang cuti pada tanggal yang dipilih.');
        }

        $staffHoursByStaff = StaffOperatingHour::query()
            ->whereIn('staff_id', $eligibleStaffIds)
            ->get()
            ->groupBy('staff_id');

        foreach ($eligibleStaffIds as $candidateId) {
            if (! $this->isStaffWorkingDuringSlot($candidateId, $startLocal, $endLocal, $targetDate, $staffHoursByStaff)) {
                continue;
            }

            $busy = $overlapping->where('staff_id', $candidateId)->isNotEmpty();
            if (! $busy) {
                return $candidateId;
            }
        }

        throw new RuntimeException('Staff tidak tersedia pada jam yang dipilih. Silakan pilih jam atau staff lain.');
    }

    /**
     * Return active staff IDs assigned to a service who are NOT on time-off on the target date.
     *
     * @return array<int, int>
     */
    private function resolveEligibleStaffIdsOnDate(
        Service $service,
        CarbonImmutable $targetDate,
        ?int $requestedStaffId
    ): array {
        $query = $service->staff()->where('staff.is_active', true);
        if ($requestedStaffId !== null) {
            $query->where('staff.id', $requestedStaffId);
        }

        $candidateIds = $query->pluck('staff.id')->map(fn ($id) => (int) $id)->all();
        if (empty($candidateIds)) {
            return [];
        }

        $dateString = $targetDate->toDateString();
        $onTimeOffIds = StaffTimeOff::query()
            ->whereIn('staff_id', $candidateIds)
            ->whereDate('start_date', '<=', $dateString)
            ->whereDate('end_date', '>=', $dateString)
            ->pluck('staff_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return array_values(array_diff($candidateIds, $onTimeOffIds));
    }

    /**
     * Check whether a staff member's personal schedule allows working during the slot.
     * Staff without custom operating hours inherit business operating hours.
     *
     * @param  Collection<int, Collection<int, StaffOperatingHour>>  $staffHoursByStaff
     */
    private function isStaffWorkingDuringSlot(
        int $staffId,
        CarbonImmutable $slotStart,
        CarbonImmutable $slotEnd,
        CarbonImmutable $targetDate,
        Collection $staffHoursByStaff
    ): bool {
        $hours = $staffHoursByStaff->get($staffId);
        if (! $hours || $hours->isEmpty()) {
            return true;
        }

        /** @var StaffOperatingHour|null $daySchedule */
        $daySchedule = $hours->firstWhere('day_of_week', $targetDate->dayOfWeek);
        if (! $daySchedule || ! $daySchedule->is_working) {
            return false;
        }

        $staffStart = $targetDate->setTimeFromTimeString($daySchedule->start_time);
        $staffEnd = $targetDate->setTimeFromTimeString($daySchedule->end_time);

        if ($slotStart->lt($staffStart) || $slotEnd->gt($staffEnd)) {
            return false;
        }

        if ($daySchedule->break_start && $daySchedule->break_end) {
            $breakStart = $targetDate->setTimeFromTimeString($daySchedule->break_start);
            $breakEnd = $targetDate->setTimeFromTimeString($daySchedule->break_end);
            if ($slotStart->lt($breakEnd) && $slotEnd->gt($breakStart)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Upsert customer, apply no-show DP protection, compute totals, and store optional DP proof.
     *
     * @return array{
     *     customer: Customer,
     *     booked_customer_name: string,
     *     booked_customer_email: string|null,
     *     total_price: int,
     *     dp_amount: int,
     *     commission_amount: int,
     *     proof_path: string|null,
     *     payment_status: string,
     *     dp_expires_at: Carbon|null
     * }
     */
    private function upsertCustomerAndComputePricing(
        Business $business,
        Service $service,
        int $quantity,
        ?int $assignedStaffId,
        string $customerName,
        string $customerPhone,
        ?string $customerEmail,
        ?UploadedFile $dpProofFile,
        bool $allowImmediateToday
    ): array {
        $customerName = trim($customerName);
        $normalizedPhone = $this->normalizePhone($customerPhone);

        $customer = Customer::where('business_id', $business->id)
            ->where('phone', $normalizedPhone)
            ->first();

        if ($customer && ! $allowImmediateToday && $customer->is_blocked) {
            throw new RuntimeException('Maaf, reservasi online untuk nomor ini sedang dibatasi. Silakan hubungi kami langsung melalui WhatsApp.');
        }

        if (! $customer) {
            if (! app(PlanLimitService::class)->canCreateCustomer($business)) {
                throw new RuntimeException('Kuota pelanggan bisnis ini telah mencapai batas paket.');
            }

            try {
                $customer = Customer::create([
                    'business_id' => $business->id,
                    'phone' => $normalizedPhone,
                    'name' => $customerName,
                    'name_aliases' => [],
                    'email' => $customerEmail,
                ]);
            } catch (UniqueConstraintViolationException) {
                $customer = Customer::where('business_id', $business->id)
                    ->where('phone', $normalizedPhone)
                    ->firstOrFail();

                $mergedAliases = Customer::mergeAliases(
                    $customer->name,
                    $customer->name_aliases ?? [],
                    [$customerName]
                );

                $updates = [];
                if ($mergedAliases !== ($customer->name_aliases ?? [])) {
                    $updates['name_aliases'] = $mergedAliases;
                }
                if (! empty($updates)) {
                    $customer->update($updates);
                }
            }
        } else {
            $mergedAliases = Customer::mergeAliases(
                $customer->name,
                $customer->name_aliases ?? [],
                [$customerName]
            );

            $updates = [];
            if ($mergedAliases !== ($customer->name_aliases ?? [])) {
                $updates['name_aliases'] = $mergedAliases;
            }
            if (! empty($updates)) {
                $customer->update($updates);
            }
        }

        $totalPrice = (int) $service->price * $quantity;
        $dpAmount = min($totalPrice, $service->calculateDpAmount() * $quantity);

        if (
            ! $allowImmediateToday
            && $business->no_show_require_full_dp
            && (int) ($business->no_show_dp_threshold ?? 0) > 0
            && $totalPrice > 0
        ) {
            $priorNoShows = $customer->bookings()
                ->where('reservation_status', 'no_show')
                ->count();

            if ($priorNoShows >= (int) $business->no_show_dp_threshold) {
                $dpAmount = $totalPrice;
            }
        }

        $requiresDp = $dpAmount > 0;

        $assignedStaff = $assignedStaffId
            ? Staff::where('business_id', $business->id)->find($assignedStaffId)
            : null;
        $commissionAmount = $assignedStaff
            ? $assignedStaff->calculateCommission($totalPrice)
            : 0;

        $proofPath = null;
        if ($dpProofFile !== null) {
            $proofPath = $dpProofFile->store('dp-proofs', 'local');
        }

        $paymentStatus = 'unpaid';
        $dpExpiresAt = null;
        if ($requiresDp) {
            if ($proofPath) {
                $paymentStatus = 'waiting_verification';
            } else {
                $paymentStatus = 'unpaid';
                $dpExpiresAt = now()->addMinutes($business->dp_expiry_minutes ?: 120);
            }
        }

        return [
            'customer' => $customer,
            'booked_customer_name' => $customerName,
            // Unverified input only labels this booking; it must never rewrite the shared customer contact.
            'booked_customer_email' => $customerEmail ?: null,
            'total_price' => $totalPrice,
            'dp_amount' => $dpAmount,
            'commission_amount' => $commissionAmount,
            'proof_path' => $proofPath,
            'payment_status' => $paymentStatus,
            'dp_expires_at' => $dpExpiresAt,
        ];
    }

    /**
     * Validate that a target date is valid, non-holiday, and open for drop-off/pickup.
     */
    private function assertDropoffDateOpen(
        Business $business,
        CarbonImmutable $targetDate,
        bool $allowImmediateToday
    ): OperatingHour {
        $timezone = $business->timezone ?: 'Asia/Jakarta';
        $now = CarbonImmutable::now($timezone);

        if ($targetDate->isBefore($now->startOfDay())) {
            throw new RuntimeException('Tidak dapat memesan tanggal yang sudah berlalu.');
        }

        if (! $allowImmediateToday) {
            $maxAdvanceDays = max(1, (int) ($business->max_booking_advance_days ?: 60));
            if ($targetDate->gt($now->startOfDay()->addDays($maxAdvanceDays))) {
                throw new RuntimeException("Pemesanan hanya tersedia maksimal {$maxAdvanceDays} hari ke depan.");
            }
        }

        $isHoliday = $business->holidays()
            ->whereDate('date', $targetDate->toDateString())
            ->exists();

        if ($isHoliday) {
            throw new RuntimeException('Bisnis sedang libur pada tanggal yang dipilih.');
        }

        $operatingHour = $business->operatingHours()
            ->where('day_of_week', $targetDate->dayOfWeek)
            ->first();

        if (! $operatingHour || ! $operatingHour->is_open) {
            throw new RuntimeException('Bisnis tutup pada hari yang dipilih.');
        }

        $closeAt = $targetDate->setTimeFromTimeString($operatingHour->close_time);
        if (! $allowImmediateToday && $targetDate->isSameDay($now) && $now->gte($closeAt)) {
            throw new RuntimeException('Jam operasional hari ini sudah berakhir. Silakan pilih tanggal berikutnya.');
        }

        return $operatingHour;
    }

    /**
     * Resolve local start/end window for a drop-off or pickup booking based on business hours and optional session.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function resolveDropoffWindow(
        CarbonImmutable $targetDate,
        string $openTime,
        string $closeTime,
        string $fulfillmentType,
        ?string $pickupSession
    ): array {
        $openAt = $targetDate->setTimeFromTimeString($openTime);
        $closeAt = $targetDate->setTimeFromTimeString($closeTime);

        if ($fulfillmentType !== 'pickup' || $pickupSession === null || $pickupSession === 'anytime') {
            return [$openAt, $closeAt];
        }

        $sessionBounds = match ($pickupSession) {
            'morning' => ['09:00', '12:00'],
            'afternoon' => ['13:00', '17:00'],
            'evening' => ['17:00', '20:00'],
            default => null,
        };

        if ($sessionBounds === null) {
            return [$openAt, $closeAt];
        }

        $sessionStart = $targetDate->setTimeFromTimeString($sessionBounds[0]);
        $sessionEnd = $targetDate->setTimeFromTimeString($sessionBounds[1]);

        $clampedStart = $sessionStart->lt($openAt) ? $openAt : $sessionStart;
        $clampedEnd = $sessionEnd->gt($closeAt) ? $closeAt : $sessionEnd;

        if ($clampedStart->gte($clampedEnd)) {
            return [$openAt, $closeAt];
        }

        return [$clampedStart, $clampedEnd];
    }

    /**
     * Estimate ready date by advancing turnaroundDays and skipping closed/holiday dates if necessary.
     */
    private function calculateEstimatedReadyDate(
        Business $business,
        CarbonImmutable $dropoffDate,
        int $turnaroundDays
    ): CarbonImmutable {
        $candidate = $dropoffDate->addDays(max(0, $turnaroundDays));

        $operatingHoursByDay = $business->operatingHours()
            ->get()
            ->keyBy('day_of_week');

        if ($operatingHoursByDay->isEmpty()) {
            return $candidate;
        }

        $holidayDates = $business->holidays()
            ->whereDate('date', '>=', $candidate->toDateString())
            ->whereDate('date', '<=', $candidate->addDays(14)->toDateString())
            ->pluck('date')
            ->map(fn ($d) => $d->toDateString())
            ->all();

        for ($i = 0; $i < 14; $i++) {
            $check = $candidate->addDays($i);
            $hour = $operatingHoursByDay->get($check->dayOfWeek);
            $isOpen = $hour ? (bool) $hour->is_open : true;
            $isHoliday = in_array($check->toDateString(), $holidayDates, true);

            if ($isOpen && ! $isHoliday) {
                return $check;
            }
        }

        return $candidate;
    }

    public function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }
        if (str_starts_with($digits, '8')) {
            return '62'.$digits;
        }

        return $digits;
    }

    private function generateBookingCode(): string
    {
        do {
            $code = 'JNY-'.strtoupper(Str::random(6));
        } while (Booking::where('booking_code', $code)->exists());

        return $code;
    }

    private function generateInvoiceNumber(): string
    {
        $date = now()->format('Ymd');
        do {
            $number = 'INV-'.$date.'-'.strtoupper(Str::random(6));
        } while (Booking::where('invoice_number', $number)->exists());

        return $number;
    }

    private function generateInvoiceToken(): string
    {
        do {
            $token = bin2hex(random_bytes(16));
        } while (Booking::where('invoice_token', $token)->exists());

        return $token;
    }
}
