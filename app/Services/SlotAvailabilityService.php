<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Staff;
use App\Models\StaffOperatingHour;
use App\Models\StaffTimeOff;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
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

        // Fetch active bookings on that date
        $existingBookings = $business->bookings()
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
     * Atomically reserve a slot inside a DB transaction with pessimistic locking.
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

            // Lock overlapping bookings to prevent race conditions
            $overlapping = Booking::where('business_id', $business->id)
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
                        'email' => $customerEmail,
                    ]);
                } catch (UniqueConstraintViolationException) {
                    $customer = Customer::where('business_id', $business->id)
                        ->where('phone', $normalizedPhone)
                        ->firstOrFail();
                }
            } elseif ($customer->name !== $customerName || ($customerEmail && $customer->email !== $customerEmail)) {
                $customer->update([
                    'name' => $customerName,
                    'email' => $customerEmail ?: $customer->email,
                ]);
            }

            $dpAmount = $service->calculateDpAmount();

            // Automatic No-Show Protection: require 100% DP for customers meeting the business threshold
            if (
                ! $allowImmediateToday
                && $business->no_show_require_full_dp
                && (int) ($business->no_show_dp_threshold ?? 0) > 0
                && $service->price > 0
            ) {
                $priorNoShows = $customer->bookings()
                    ->where('reservation_status', 'no_show')
                    ->count();

                if ($priorNoShows >= (int) $business->no_show_dp_threshold) {
                    $dpAmount = (int) $service->price;
                }
            }

            $requiresDp = $dpAmount > 0;

            $assignedStaff = $assignedStaffId
                ? Staff::where('business_id', $business->id)->find($assignedStaffId)
                : null;
            $commissionAmount = $assignedStaff
                ? $assignedStaff->calculateCommission((int) $service->price)
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

            return Booking::create([
                'business_id' => $business->id,
                'service_id' => $service->id,
                'staff_id' => $assignedStaffId,
                'customer_id' => $customer->id,
                'booking_code' => $this->generateBookingCode(),
                'invoice_number' => $this->generateInvoiceNumber(),
                'invoice_token' => $this->generateInvoiceToken(),
                'booking_date' => $startLocal->toDateString(),
                'start_at' => $startUtc,
                'end_at' => $endUtc,
                'buffer_end_at' => $bufferEndUtc,
                'total_price' => $service->price,
                'dp_amount' => $dpAmount,
                'commission_amount' => $commissionAmount,
                'reservation_status' => 'pending',
                'payment_status' => $paymentStatus,
                'dp_proof_path' => $proofPath,
                'dp_expires_at' => $dpExpiresAt,
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
        string $timeString,
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
            $startLocal = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$dateString} {$timeString}", $timezone);
            $endLocal = $startLocal->addMinutes($service->duration_minutes);
            $bufferEndLocal = $endLocal->addMinutes($service->buffer_minutes);

            $this->assertBusinessWindowAndOperatingHours($business, $startLocal, $endLocal, $allowImmediateToday);

            $startUtc = $startLocal->utc();
            $endUtc = $endLocal->utc();
            $bufferEndUtc = $bufferEndLocal->utc();

            $overlapping = Booking::where('business_id', $business->id)
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
