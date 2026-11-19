<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->json('whatsapp_templates')->nullable()->after('reminder_h2_enabled');
            $table->boolean('telegram_notifications_enabled')->default(false)->after('whatsapp_templates');
            $table->text('telegram_bot_token')->nullable()->after('telegram_notifications_enabled');
            $table->string('telegram_chat_id', 64)->nullable()->after('telegram_bot_token');
            $table->boolean('no_show_require_full_dp')->default(false)->after('telegram_chat_id');
            $table->unsignedTinyInteger('no_show_dp_threshold')->default(2)->after('no_show_require_full_dp');
        });

        Schema::table('staff', function (Blueprint $table) {
            $table->string('commission_type', 20)->default('none')->after('is_active');
            $table->unsignedBigInteger('commission_value')->default(0)->after('commission_type');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedBigInteger('commission_amount')->default(0)->after('dp_amount');
            $table->index(
                ['business_id', 'staff_id', 'reservation_status', 'booking_date'],
                'bookings_commission_report_idx'
            );
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->json('tags')->nullable()->after('notes');
            $table->boolean('is_blocked')->default(false)->after('tags');
            $table->index(['business_id', 'is_blocked'], 'customers_business_blocked_idx');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex('customers_business_blocked_idx');
            $table->dropColumn(['tags', 'is_blocked']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_commission_report_idx');
            $table->dropColumn(['commission_amount']);
        });

        Schema::table('staff', function (Blueprint $table) {
            $table->dropColumn(['commission_type', 'commission_value']);
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn([
                'whatsapp_templates',
                'telegram_notifications_enabled',
                'telegram_bot_token',
                'telegram_chat_id',
                'no_show_require_full_dp',
                'no_show_dp_threshold',
            ]);
        });
    }
};
