<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('booking_mode')->default('time_slot')->after('assignment_mode');
            $table->unsignedInteger('turnaround_days')->default(1)->after('booking_mode');
            $table->boolean('supports_pickup')->default(false)->after('turnaround_days');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('booking_mode')->default('time_slot')->after('customer_id');
            $table->unsignedInteger('quantity')->default(1)->after('booking_mode');
            $table->string('fulfillment_type')->default('dropoff')->after('quantity');
            $table->string('pickup_session')->nullable()->after('fulfillment_type');
            $table->text('pickup_address')->nullable()->after('pickup_session');
            $table->date('estimated_ready_date')->nullable()->after('buffer_end_at');
            $table->string('work_status')->nullable()->after('reservation_status');

            $table->index(
                ['business_id', 'service_id', 'booking_date', 'reservation_status'],
                'bookings_biz_svc_date_status_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_biz_svc_date_status_idx');
            $table->dropColumn([
                'booking_mode',
                'quantity',
                'fulfillment_type',
                'pickup_session',
                'pickup_address',
                'estimated_ready_date',
                'work_status',
            ]);
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn([
                'booking_mode',
                'turnaround_days',
                'supports_pickup',
            ]);
        });
    }
};
