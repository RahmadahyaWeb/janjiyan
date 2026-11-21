<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\Business;
use App\Services\BookingNotificationService;
use App\Services\PlanLimitService;
use Illuminate\Console\Command;

class SendBookingReminders extends Command
{
    protected $signature = 'bookings:send-reminders';

    protected $description = 'Send automated H-1 day and H-2 hour email reminders for upcoming confirmed bookings';

    public function handle(
        BookingNotificationService $notificationService,
        PlanLimitService $planLimitService
    ): int {
        $now = now();
        $h1Sent = 0;
        $h2Sent = 0;

        /** @var array<int, bool> $ownerActiveCache */
        $ownerActiveCache = [];
        $hasActiveOwnerSubscription = function (Booking $booking) use (&$ownerActiveCache, $planLimitService): bool {
            $owner = $booking->business?->owner;
            if (! $owner) {
                return false;
            }

            if (! array_key_exists($owner->id, $ownerActiveCache)) {
                $subscription = $owner->relationLoaded('subscription') ? $owner->subscription : null;
                $ownerActiveCache[$owner->id] = $subscription
                    ? $subscription->hasActiveAccess()
                    : $planLimitService->hasActiveSubscription($owner);
            }

            return $ownerActiveCache[$owner->id];
        };

        // H-1 Day Reminders (23h to 25h before start_at)
        Booking::query()
            ->with(['business.owner.subscription.plan', 'service', 'staff', 'customer'])
            ->where('reservation_status', 'confirmed')
            ->whereNull('reminder_h1_sent_at')
            ->whereBetween('start_at', [$now->copy()->addHours(23), $now->copy()->addHours(25)])
            ->whereHas('business', fn ($q) => $q->where('is_active', true)->whereNull('suspended_at')->where('reminder_h1_enabled', true))
            ->whereHas('customer', fn ($q) => $q->whereNotNull('email')->where('email', '!=', ''))
            ->chunkById(100, function ($candidates) use (&$h1Sent, $hasActiveOwnerSubscription, $notificationService): void {
                foreach ($candidates as $booking) {
                    if (! $hasActiveOwnerSubscription($booking)) {
                        continue;
                    }

                    // Atomic claim prevents duplicate sends across concurrent scheduler runs
                    $claimed = Booking::where('id', $booking->id)
                        ->whereNull('reminder_h1_sent_at')
                        ->update(['reminder_h1_sent_at' => now()]);

                    if ($claimed === 0) {
                        continue;
                    }

                    if ($notificationService->sendCustomerReminder($booking, 'h1')) {
                        $h1Sent++;
                    } else {
                        Booking::where('id', $booking->id)->update(['reminder_h1_sent_at' => null]);
                    }
                }
            });

        // H-2 Hour Reminders (105m to 135m before start_at, time-slot bookings only)
        Booking::query()
            ->with(['business.owner.subscription.plan', 'service', 'staff', 'customer'])
            ->where('booking_mode', 'time_slot')
            ->where('reservation_status', 'confirmed')
            ->whereNull('reminder_h2_sent_at')
            ->whereBetween('start_at', [$now->copy()->addMinutes(105), $now->copy()->addMinutes(135)])
            ->whereHas('business', fn ($q) => $q->where('is_active', true)->whereNull('suspended_at')->where('reminder_h2_enabled', true)->where('business_type', '!=', Business::TYPE_DROPOFF))
            ->whereHas('customer', fn ($q) => $q->whereNotNull('email')->where('email', '!=', ''))
            ->chunkById(100, function ($candidates) use (&$h2Sent, $hasActiveOwnerSubscription, $notificationService): void {
                foreach ($candidates as $booking) {
                    if (! $hasActiveOwnerSubscription($booking)) {
                        continue;
                    }

                    $claimed = Booking::where('id', $booking->id)
                        ->whereNull('reminder_h2_sent_at')
                        ->update(['reminder_h2_sent_at' => now()]);

                    if ($claimed === 0) {
                        continue;
                    }

                    if ($notificationService->sendCustomerReminder($booking, 'h2')) {
                        $h2Sent++;
                    } else {
                        Booking::where('id', $booking->id)->update(['reminder_h2_sent_at' => null]);
                    }
                }
            });

        $this->info("Sent {$h1Sent} H-1 reminder(s) and {$h2Sent} H-2 reminder(s).");

        return self::SUCCESS;
    }
}
