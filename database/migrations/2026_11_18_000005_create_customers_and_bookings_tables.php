<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'phone']);
        });

        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->restrictOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('staff')->nullOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('booking_code')->unique();
            $table->date('booking_date');
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->dateTime('buffer_end_at');
            $table->unsignedInteger('total_price');
            $table->unsignedInteger('dp_amount')->default(0);
            $table->string('reservation_status')->default('pending');
            $table->string('payment_status')->default('unpaid');
            $table->string('dp_proof_path')->nullable();
            $table->dateTime('dp_expires_at')->nullable();
            $table->string('cancellation_reason')->nullable();
            $table->text('customer_notes')->nullable();
            $table->timestamps();

            $table->index(['business_id', 'booking_date', 'reservation_status']);
            $table->index(['payment_status', 'dp_expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('customers');
    }
};
