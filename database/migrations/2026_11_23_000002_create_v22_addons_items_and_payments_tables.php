<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->unsignedInteger('price');
            $table->string('unit_label', 20)->default('item');
            $table->unsignedInteger('duration_minutes')->default(0);
            $table->boolean('is_commissionable')->default(false);
            $table->boolean('applies_to_all_services')->default(true);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['business_id', 'is_active', 'sort_order'], 'service_addons_biz_active_sort_idx');
        });

        Schema::create('service_addon_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_addon_id')->constrained('service_addons')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['service_id', 'service_addon_id'], 'service_addon_assign_unique');
        });

        Schema::create('booking_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('item_type', 20)->default('service');
            $table->foreignId('service_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('service_addon_id')->nullable()->constrained('service_addons')->nullOnDelete();
            $table->string('name_snapshot', 160);
            $table->string('unit_label_snapshot', 20)->default('item');
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedInteger('duration_minutes_snapshot')->default(0);
            $table->unsignedInteger('turnaround_days_snapshot')->default(0);
            $table->boolean('is_commissionable')->default(true);
            $table->unsignedInteger('subtotal');
            $table->timestamps();

            $table->index(['booking_id', 'item_type'], 'booking_items_booking_type_idx');
            $table->index(['service_id', 'booking_id'], 'booking_items_service_booking_idx');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedInteger('paid_amount')->default(0)->after('dp_amount');
            $table->timestamp('settled_at')->nullable()->after('dp_expires_at');
        });

        Schema::create('booking_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('payment_type', 32);
            $table->string('payment_method', 20);
            $table->integer('amount');
            $table->unsignedInteger('received_amount')->nullable();
            $table->unsignedInteger('change_amount')->default(0);
            $table->foreignId('recorded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at');
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'paid_at'], 'booking_payments_booking_paid_idx');
            $table->index(['business_id', 'paid_at', 'payment_method'], 'booking_payments_biz_paid_method_idx');
        });

        // Backfill booking_items, booking_payments, bookings.paid_amount, and bookings.settled_at.
        DB::table('bookings')
            ->orderBy('id')
            ->chunkById(200, function ($bookings): void {
                $serviceIds = $bookings->pluck('service_id')->filter()->unique()->values()->all();
                $servicesById = $serviceIds !== []
                    ? DB::table('services')
                        ->whereIn('id', $serviceIds)
                        ->get(['id', 'name', 'price', 'duration_minutes', 'turnaround_days', 'unit_label'])
                        ->keyBy('id')
                    : collect();

                $now = now();

                foreach ($bookings as $booking) {
                    $service = $servicesById->get($booking->service_id);
                    $qty = max(1, (int) ($booking->quantity ?? 1));
                    $totalPrice = max(0, (int) $booking->total_price);
                    $dpAmount = max(0, (int) ($booking->dp_amount ?? 0));
                    $isDropoff = ($booking->booking_mode ?? 'time_slot') === 'dropoff';

                    $unitLabel = is_string($booking->unit_label ?? null) && trim($booking->unit_label) !== ''
                        ? trim($booking->unit_label)
                        : (is_string($service?->unit_label ?? null) && trim((string) $service->unit_label) !== ''
                            ? trim((string) $service->unit_label)
                            : 'item');

                    $unitPrice = $qty === 1
                        ? $totalPrice
                        : ($service && ((int) $service->price * $qty) === $totalPrice
                            ? (int) $service->price
                            : (int) floor($totalPrice / $qty));

                    $hasItem = DB::table('booking_items')->where('booking_id', $booking->id)->exists();
                    if (! $hasItem) {
                        DB::table('booking_items')->insert([
                            'booking_id' => $booking->id,
                            'item_type' => 'service',
                            'service_id' => $booking->service_id,
                            'service_addon_id' => null,
                            'name_snapshot' => $service?->name ?? 'Layanan',
                            'unit_label_snapshot' => $unitLabel,
                            'unit_price' => $unitPrice,
                            'quantity' => $qty,
                            'duration_minutes_snapshot' => $isDropoff ? 0 : (int) ($service?->duration_minutes ?? 60),
                            'turnaround_days_snapshot' => $isDropoff ? (int) ($service?->turnaround_days ?? 1) : 0,
                            'is_commissionable' => true,
                            'subtotal' => $totalPrice,
                            'created_at' => $booking->created_at ?? $now,
                            'updated_at' => $booking->updated_at ?? $now,
                        ]);
                    }

                    $paidAmount = 0;
                    $settledAt = null;
                    $paidTimestamp = $booking->updated_at ?? $booking->created_at ?? $now;

                    if ($booking->payment_status === 'settled') {
                        if ($totalPrice > 0) {
                            DB::table('booking_payments')->insert([
                                'booking_id' => $booking->id,
                                'business_id' => $booking->business_id,
                                'payment_type' => 'settlement',
                                'payment_method' => 'transfer',
                                'amount' => $totalPrice,
                                'received_amount' => $totalPrice,
                                'change_amount' => 0,
                                'recorded_by_user_id' => null,
                                'paid_at' => $paidTimestamp,
                                'notes' => 'Backfill pelunasan eksisting',
                                'created_at' => $paidTimestamp,
                                'updated_at' => $paidTimestamp,
                            ]);
                        }
                        $paidAmount = $totalPrice;
                        $settledAt = $paidTimestamp;
                    } elseif ($booking->payment_status === 'dp_verified' && $dpAmount > 0) {
                        DB::table('booking_payments')->insert([
                            'booking_id' => $booking->id,
                            'business_id' => $booking->business_id,
                            'payment_type' => 'dp',
                            'payment_method' => 'transfer',
                            'amount' => $dpAmount,
                            'received_amount' => $dpAmount,
                            'change_amount' => 0,
                            'recorded_by_user_id' => null,
                            'paid_at' => $paidTimestamp,
                            'notes' => 'Backfill uang muka terverifikasi eksisting',
                            'created_at' => $paidTimestamp,
                            'updated_at' => $paidTimestamp,
                        ]);
                        $paidAmount = $dpAmount;
                    }

                    DB::table('bookings')
                        ->where('id', $booking->id)
                        ->update([
                            'paid_amount' => $paidAmount,
                            'settled_at' => $settledAt,
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_payments');

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['paid_amount', 'settled_at']);
        });

        Schema::dropIfExists('booking_items');
        Schema::dropIfExists('service_addon_assignments');
        Schema::dropIfExists('service_addons');
    }
};
