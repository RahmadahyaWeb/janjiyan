<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->json('name_aliases')->nullable()->after('name');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('booked_customer_name', 120)->nullable()->after('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('booked_customer_name');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('name_aliases');
        });
    }
};
