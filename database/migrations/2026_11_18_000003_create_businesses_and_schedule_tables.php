<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('category')->default('Jasa & Layanan');
            $table->text('description')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('timezone')->default('Asia/Jakarta');
            $table->string('logo_path')->nullable();
            $table->string('qris_path')->nullable();
            $table->json('bank_accounts')->nullable();
            $table->unsignedInteger('dp_expiry_minutes')->default(120);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('business_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('staff');
            $table->json('permissions')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'user_id']);
        });

        Schema::create('operating_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->boolean('is_open')->default(true);
            $table->string('open_time', 5)->default('09:00');
            $table->string('close_time', 5)->default('18:00');
            $table->string('break_start', 5)->nullable();
            $table->string('break_end', 5)->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'day_of_week']);
        });

        Schema::create('business_holidays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_holidays');
        Schema::dropIfExists('operating_hours');
        Schema::dropIfExists('business_user');
        Schema::dropIfExists('businesses');
    }
};
