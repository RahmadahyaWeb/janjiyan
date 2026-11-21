<?php

namespace App\Services;

use App\Models\Booking;
use App\Notifications\CustomerBookingReminderNotification;
use App\Notifications\CustomerBookingStatusNotification;
use App\Notifications\MerchantBookingAlertNotification;
use Illuminate\Support\Facades\Notification;
use Throwable;

class BookingNotificationService
{
    public function __construct(
        private readonly TelegramNotificationService $telegramService
    ) {}

    public function notifyNewPublicBooking(Booking $booking): void
    {
        $booking->loadMissing(['business.owner', 'staff.user', 'service', 'customer']);

        $this->notifyMerchantRecipients($booking, 'new_booking');
        $this->telegramService->dispatchBookingAlert($booking, 'new_booking');
        $this->notifyCustomerEmail($booking, 'created');
    }

    public function notifyDpProofUploaded(Booking $booking): void
    {
        $booking->loadMissing(['business.owner', 'staff.user', 'service', 'customer']);

        $this->notifyMerchantRecipients($booking, 'dp_uploaded');
        $this->telegramService->dispatchBookingAlert($booking, 'dp_uploaded');
    }

    public function notifyCustomerStatusChanged(Booking $booking, string $eventType): void
    {
        $booking->loadMissing(['business', 'service', 'staff', 'customer']);

        $this->notifyCustomerEmail($booking, $eventType);
    }

    public function sendCustomerReminder(Booking $booking, string $reminderType): bool
    {
        $booking->loadMissing(['business', 'service', 'staff', 'customer']);
        $email = $this->customerEmailFor($booking);

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        try {
            Notification::route('mail', $email)
                ->notify(new CustomerBookingReminderNotification($booking, $reminderType));

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    private function notifyMerchantRecipients(Booking $booking, string $eventType): void
    {
        $recipients = collect([$booking->business?->owner, $booking->staff?->user])
            ->filter()
            ->unique('id');

        foreach ($recipients as $user) {
            if (! $user->email) {
                continue;
            }

            try {
                $user->notify(new MerchantBookingAlertNotification($booking, $eventType));
            } catch (Throwable $e) {
                report($e);
            }
        }
    }

    /** Booking-level email first (what this booker typed); customer record only for older bookings without one. */
    private function customerEmailFor(Booking $booking): string
    {
        return trim((string) ($booking->booked_customer_email ?: ($booking->customer?->email ?? '')));
    }

    private function notifyCustomerEmail(Booking $booking, string $eventType): void
    {
        $email = $this->customerEmailFor($booking);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        try {
            Notification::route('mail', $email)
                ->notify(new CustomerBookingStatusNotification($booking, $eventType));
        } catch (Throwable $e) {
            report($e);
        }
    }
}
