<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_operating_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week'); // 0 = Sunday .. 6 = Saturday
            $table->boolean('is_working')->default(true);
            $table->string('start_time', 5)->default('09:00');
            $table->string('end_time', 5)->default('18:00');
            $table->string('break_start', 5)->nullable();
            $table->string('break_end', 5)->nullable();
            $table->timestamps();

            $table->unique(['staff_id', 'day_of_week']);
        });

        Schema::create('staff_time_offs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('reason', 120)->nullable();
            $table->timestamps();

            $table->index(['staff_id', 'start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_time_offs');
        Schema::dropIfExists('staff_operating_hours');
    }
};
