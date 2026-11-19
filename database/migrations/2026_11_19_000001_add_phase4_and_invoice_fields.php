<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_superadmin')->default(false)->after('active_business_id');
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->timestamp('suspended_at')->nullable()->after('is_active');
            $table->string('suspension_reason')->nullable()->after('suspended_at');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('invoice_number')->nullable()->after('booking_code');
            $table->string('invoice_token', 64)->nullable()->after('invoice_number');
        });

        DB::table('bookings')->orderBy('id')->chunkById(100, function ($bookings) {
            foreach ($bookings as $booking) {
                $datePart = now()->format('Ymd');
                if (! empty($booking->created_at)) {
                    $datePart = date('Ymd', strtotime((string) $booking->created_at));
                }

                DB::table('bookings')
                    ->where('id', $booking->id)
                    ->update([
                        'invoice_number' => 'INV-'.$datePart.'-'.strtoupper(Str::random(6)),
                        'invoice_token' => bin2hex(random_bytes(16)),
                    ]);
            }
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->unique('invoice_number');
            $table->unique('invoice_token');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropUnique(['invoice_number']);
            $table->dropUnique(['invoice_token']);
            $table->dropColumn(['invoice_number', 'invoice_token']);
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn(['suspended_at', 'suspension_reason']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_superadmin');
        });
    }
};
