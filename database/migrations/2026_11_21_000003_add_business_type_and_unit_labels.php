<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('business_type', 32)->default('staff_appointment')->after('category');
            $table->index('business_type');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->string('unit_label', 20)->default('item')->after('supports_pickup');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('unit_label', 20)->default('item')->after('quantity');
        });

        // Infer business_type from existing services: dropoff > capacity > staff_appointment.
        DB::table('businesses')
            ->select('id')
            ->orderBy('id')
            ->chunkById(100, function ($businesses): void {
                $businessIds = $businesses->pluck('id')->all();
                $servicesByBusiness = DB::table('services')
                    ->select(['business_id', 'booking_mode', 'assignment_mode'])
                    ->whereIn('business_id', $businessIds)
                    ->get()
                    ->groupBy('business_id');

                foreach ($businessIds as $businessId) {
                    $services = $servicesByBusiness->get($businessId, collect());
                    $inferredType = 'staff_appointment';

                    if ($services->contains(fn ($service) => $service->booking_mode === 'dropoff')) {
                        $inferredType = 'dropoff';
                    } elseif ($services->contains(fn ($service) => $service->assignment_mode === 'capacity')) {
                        $inferredType = 'space_booking';
                    }

                    DB::table('businesses')
                        ->where('id', $businessId)
                        ->update(['business_type' => $inferredType]);
                }
            });

        // Snapshot unit_label onto existing bookings from their related service.
        DB::table('bookings')
            ->select(['id', 'service_id'])
            ->orderBy('id')
            ->chunkById(200, function ($bookings): void {
                $serviceIds = $bookings->pluck('service_id')->filter()->unique()->values()->all();
                $unitMap = $serviceIds !== []
                    ? DB::table('services')->whereIn('id', $serviceIds)->pluck('unit_label', 'id')
                    : collect();

                foreach ($bookings as $booking) {
                    $unitLabel = $unitMap->get($booking->service_id);
                    $normalized = is_string($unitLabel) && trim($unitLabel) !== ''
                        ? trim($unitLabel)
                        : 'item';

                    DB::table('bookings')
                        ->where('id', $booking->id)
                        ->update(['unit_label' => $normalized]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('unit_label');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('unit_label');
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->dropIndex(['business_type']);
            $table->dropColumn('business_type');
        });
    }
};
