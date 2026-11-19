<?php

use App\Models\SubscriptionInvoice;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('bookings:expire-unpaid')->everyMinute()->withoutOverlapping()->onOneServer();
Schedule::command('bookings:send-reminders')->everyFiveMinutes()->withoutOverlapping()->onOneServer();
Schedule::call(function (): void {
    SubscriptionInvoice::where('status', 'pending')
        ->whereNotNull('expires_at')
        ->where('expires_at', '<', now())
        ->update(['status' => 'expired']);
})->name('subscriptions:expire-pending-invoices')->hourly()->withoutOverlapping()->onOneServer();
