<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Defensive deduplication before adding unique(user_id) on subscriptions
        $duplicateUserIds = DB::table('subscriptions')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('user_id');

        foreach ($duplicateUserIds as $userId) {
            $keepId = DB::table('subscriptions')
                ->where('user_id', $userId)
                ->orderByDesc('id')
                ->value('id');

            DB::table('subscriptions')
                ->where('user_id', $userId)
                ->where('id', '!=', $keepId)
                ->delete();
        }

        Schema::table('bookings', function (Blueprint $table) {
            $table->index(
                ['business_id', 'reservation_status', 'start_at', 'buffer_end_at'],
                'bookings_overlap_idx'
            );
            $table->index(['business_id', 'created_at'], 'bookings_business_created_idx');
            $table->index('customer_id', 'bookings_customer_idx');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->unique('user_id', 'subscriptions_user_unique');
            $table->index(['user_id', 'status'], 'subscriptions_user_status_idx');
        });

        Schema::table('subscription_invoices', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'sub_invoices_user_created_idx');
            $table->index(['status', 'expires_at'], 'sub_invoices_status_expires_idx');
            $table->index('mayar_transaction_id', 'sub_invoices_mayar_tx_idx');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index('active_business_id', 'users_active_business_idx');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_active_business_idx');
        });

        Schema::table('subscription_invoices', function (Blueprint $table) {
            $table->dropIndex('sub_invoices_user_created_idx');
            $table->dropIndex('sub_invoices_status_expires_idx');
            $table->dropIndex('sub_invoices_mayar_tx_idx');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex('subscriptions_user_status_idx');
            $table->dropUnique('subscriptions_user_unique');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_overlap_idx');
            $table->dropIndex('bookings_business_created_idx');
            $table->dropIndex('bookings_customer_idx');
        });
    }
};
