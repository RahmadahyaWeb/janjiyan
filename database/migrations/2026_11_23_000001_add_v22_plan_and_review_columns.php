<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->unsignedInteger('max_addons_per_business')->nullable()->after('max_services_per_business');
            $table->boolean('can_use_google_review')->default(false)->after('can_export_csv');
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->string('google_review_url', 500)->nullable()->after('qr_poster_subtitle');
            $table->unsignedTinyInteger('review_redirect_min_rating')->default(4)->after('google_review_url');
            $table->boolean('review_enabled')->default(true)->after('review_redirect_min_rating');
            $table->string('review_sticker_subtitle', 120)->nullable()->after('review_enabled');
        });

        Schema::create('business_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reviewer_name', 120)->nullable();
            $table->string('reviewer_phone', 30)->nullable();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->boolean('redirected_to_google')->default(false);
            $table->timestamps();

            $table->unique('booking_id', 'business_reviews_booking_unique');
            $table->index(['business_id', 'rating', 'created_at'], 'business_reviews_biz_rating_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_reviews');

        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn([
                'google_review_url',
                'review_redirect_min_rating',
                'review_enabled',
                'review_sticker_subtitle',
            ]);
        });

        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn([
                'max_addons_per_business',
                'can_use_google_review',
            ]);
        });
    }
};
