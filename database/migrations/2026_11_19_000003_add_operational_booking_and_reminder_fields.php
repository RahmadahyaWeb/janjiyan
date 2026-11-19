<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->unsignedSmallInteger('min_booking_lead_minutes')->default(15)->after('dp_expiry_minutes');
            $table->unsignedSmallInteger('max_booking_advance_days')->default(60)->after('min_booking_lead_minutes');
            $table->boolean('reminder_h1_enabled')->default(true)->after('max_booking_advance_days');
            $table->boolean('reminder_h2_enabled')->default(true)->after('reminder_h1_enabled');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedTinyInteger('rescheduled_count')->default(0)->after('customer_notes');
            $table->timestamp('last_rescheduled_at')->nullable()->after('rescheduled_count');
            $table->timestamp('reminder_h1_sent_at')->nullable()->after('last_rescheduled_at');
            $table->timestamp('reminder_h2_sent_at')->nullable()->after('reminder_h1_sent_at');

            $table->index(['reservation_status', 'start_at', 'reminder_h1_sent_at'], 'bookings_reminder_h1_idx');
            $table->index(['reservation_status', 'start_at', 'reminder_h2_sent_at'], 'bookings_reminder_h2_idx');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_reminder_h1_idx');
            $table->dropIndex('bookings_reminder_h2_idx');
            $table->dropColumn([
                'rescheduled_count',
                'last_rescheduled_at',
                'reminder_h1_sent_at',
                'reminder_h2_sent_at',
            ]);
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn([
                'min_booking_lead_minutes',
                'max_booking_advance_days',
                'reminder_h1_enabled',
                'reminder_h2_enabled',
            ]);
        });
    }
};
