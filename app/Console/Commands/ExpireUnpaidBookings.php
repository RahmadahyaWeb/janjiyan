<?php

namespace App\Console\Commands;

use App\Models\Booking;
use Illuminate\Console\Command;

class ExpireUnpaidBookings extends Command
{
    protected $signature = 'bookings:expire-unpaid';

    protected $description = 'Cancel unpaid DP bookings that have passed their dp_expires_at deadline';

    public function handle(): int
    {
        $expiredCount = Booking::query()
            ->where('reservation_status', 'pending')
            ->where('payment_status', 'unpaid')
            ->whereNotNull('dp_expires_at')
            ->where('dp_expires_at', '<=', now())
            ->update([
                'reservation_status' => 'cancelled',
                'cancellation_reason' => 'dp_expired',
            ]);

        $this->info("Expired {$expiredCount} unpaid DP booking(s).");

        return self::SUCCESS;
    }
}
