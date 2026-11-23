<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Business;
use App\Models\BusinessReview;
use App\Services\InAppNotificationService;
use App\Services\PlanLimitService;
use App\Services\TelegramNotificationService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class PublicReviewController extends Controller
{
    private function resolveReviewDisabledReason(Business $business, PlanLimitService $planLimitService): ?string
    {
        if (! $planLimitService->hasActiveSubscription($business->owner)) {
            return 'Halaman ulasan untuk bisnis ini sementara ditutup karena masa langganan merchant telah berakhir.';
        }

        if (! $planLimitService->canUseGoogleReview($business->owner)) {
            return 'Fitur halaman ulasan saat ini tidak tersedia untuk bisnis ini.';
        }

        if (! (bool) ($business->review_enabled ?? true)) {
            return 'Merchant sedang menonaktifkan penerimaan ulasan sementara waktu.';
        }

        return null;
    }

    public function show(Request $request, string $slug, PlanLimitService $planLimitService): Response|SymfonyResponse
    {
        $business = Business::where('slug', $slug)
            ->where('is_active', true)
            ->with('owner')
            ->firstOrFail();

        if ($business->isSuspended()) {
            return Inertia::render('Public/BusinessUnavailable', [
                'businessName' => $business->name,
                'reason' => $business->suspension_reason,
            ])->toResponse($request)->setStatusCode(403);
        }

        $reviewDisabledReason = $this->resolveReviewDisabledReason($business, $planLimitService);
        $minRating = max(2, min(5, (int) ($business->review_redirect_min_rating ?? 4)));

        $bookingContext = null;
        $token = trim((string) $request->query('token', ''));
        if ($token !== '' && mb_strlen($token) <= 64) {
            $booking = Booking::where('business_id', $business->id)
                ->where('invoice_token', $token)
                ->with(['service', 'items', 'customer', 'review'])
                ->first();

            if ($booking && ! in_array($booking->reservation_status, ['cancelled', 'no_show'], true)) {
                $bookingContext = [
                    'token' => $booking->invoice_token,
                    'booking_code' => $booking->booking_code,
                    'invoice_number' => $booking->invoice_number,
                    'service_name' => $booking->resolvedServiceSummary(),
                    'customer_name' => $booking->booked_customer_name ?: $booking->customer?->name,
                    'already_reviewed' => $booking->review !== null,
                ];
            }
        }

        $submittedReview = null;
        $submittedReviewId = $request->session()->get('submitted_review_id');
        if ($submittedReviewId) {
            $review = BusinessReview::where('business_id', $business->id)
                ->find($submittedReviewId);

            if ($review) {
                $googleReviewUrl = trim((string) ($business->google_review_url ?? ''));
                $shouldRedirectGoogle = $reviewDisabledReason === null
                    && (int) $review->rating >= $minRating
                    && $googleReviewUrl !== ''
                    && BusinessReview::isValidGoogleReviewUrl($googleReviewUrl);

                $submittedReview = [
                    'id' => $review->id,
                    'rating' => (int) $review->rating,
                    'comment' => $review->comment,
                    'should_redirect_google' => $shouldRedirectGoogle,
                    'google_review_url' => $shouldRedirectGoogle ? $googleReviewUrl : null,
                ];
            }
        }

        return Inertia::render('Public/ReviewSubmit', [
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'category' => $business->category,
                'business_type' => $business->resolvedBusinessType(),
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
                'brand_color' => $business->brand_color,
                'review_sticker_subtitle' => $business->review_sticker_subtitle,
                'review_redirect_min_rating' => $minRating,
            ],
            'bookingContext' => $bookingContext,
            'submittedReview' => $submittedReview,
            'reviewDisabledReason' => $reviewDisabledReason,
        ])->withViewData('seo', [
            'title' => "Beri Ulasan — {$business->name}",
            'noindex' => true,
        ]);
    }

    public function store(
        Request $request,
        string $slug,
        PlanLimitService $planLimitService,
        TelegramNotificationService $telegramService,
        InAppNotificationService $inAppNotificationService
    ): RedirectResponse {
        $business = Business::where('slug', $slug)
            ->where('is_active', true)
            ->with('owner')
            ->firstOrFail();

        if ($business->isSuspended()) {
            return back()->with('error', 'Portal bisnis ini sedang ditangguhkan.');
        }

        $reviewDisabledReason = $this->resolveReviewDisabledReason($business, $planLimitService);
        if ($reviewDisabledReason !== null) {
            return back()->with('error', $reviewDisabledReason);
        }

        // Silent honeypot drop for bots filling the hidden website field.
        if ($request->filled('website')) {
            return back();
        }

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'reviewer_name' => ['nullable', 'string', 'max:120'],
            'reviewer_phone' => ['nullable', 'string', 'max:30'],
            'token' => ['nullable', 'string', 'max:64'],
        ]);

        $comment = isset($validated['comment']) ? (trim($validated['comment']) ?: null) : null;
        $reviewerName = isset($validated['reviewer_name']) ? (trim($validated['reviewer_name']) ?: null) : null;
        $reviewerPhone = isset($validated['reviewer_phone']) ? (trim($validated['reviewer_phone']) ?: null) : null;
        $token = isset($validated['token']) ? (trim($validated['token']) ?: null) : null;

        try {
            $review = DB::transaction(function () use ($business, $token, $validated, $comment, $reviewerName, $reviewerPhone): BusinessReview {
                $bookingId = null;
                $customerId = null;
                $resolvedName = $reviewerName;

                if ($token !== null) {
                    $booking = Booking::where('business_id', $business->id)
                        ->where('invoice_token', $token)
                        ->with('customer')
                        ->lockForUpdate()
                        ->first();

                    if (! $booking || in_array($booking->reservation_status, ['cancelled', 'no_show'], true)) {
                        throw ValidationException::withMessages([
                            'token' => 'Token pesanan tidak valid atau pesanan sudah dibatalkan.',
                        ]);
                    }

                    if (BusinessReview::where('booking_id', $booking->id)->exists()) {
                        throw ValidationException::withMessages([
                            'token' => 'Ulasan untuk pesanan ini sudah pernah dikirim.',
                        ]);
                    }

                    $bookingId = $booking->id;
                    $customerId = $booking->customer_id;

                    if ($resolvedName === null) {
                        $resolvedName = $booking->booked_customer_name ?: $booking->customer?->name;
                    }
                }

                return BusinessReview::create([
                    'business_id' => $business->id,
                    'booking_id' => $bookingId,
                    'customer_id' => $customerId,
                    'reviewer_name' => $resolvedName,
                    'reviewer_phone' => $reviewerPhone,
                    'rating' => (int) $validated['rating'],
                    'comment' => $comment,
                    'redirected_to_google' => false,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'token' => 'Ulasan untuk pesanan ini sudah pernah dikirim.',
            ]);
        }

        $minRating = max(2, min(5, (int) ($business->review_redirect_min_rating ?? 4)));
        if ((int) $review->rating < $minRating) {
            $telegramService->dispatchLowReviewAlert($review);
        } elseif (
            filled($business->google_review_url)
            && BusinessReview::isValidGoogleReviewUrl((string) $business->google_review_url)
        ) {
            $allowedIds = array_map('intval', (array) $request->session()->get('review_redirect_allow_ids', []));
            $allowedIds[] = (int) $review->id;
            $request->session()->put('review_redirect_allow_ids', array_slice(array_values(array_unique($allowedIds)), -20));
        }

        $inAppNotificationService->notifyNewReview($review);

        $redirectParams = ['slug' => $business->slug];
        if ($token !== null) {
            $redirectParams['token'] = $token;
        }

        return redirect()
            ->route('public.review.show', $redirectParams)
            ->with('submitted_review_id', $review->id)
            ->with('success', 'Terima kasih atas ulasan Anda!');
    }

    public function markRedirected(Request $request, string $slug, BusinessReview $review): JsonResponse|RedirectResponse
    {
        $business = Business::where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        abort_unless((int) $review->business_id === (int) $business->id, 404);

        if ($business->isSuspended()) {
            return $request->expectsJson()
                ? response()->json(['message' => 'Portal bisnis ini sedang ditangguhkan.'], 403)
                : back()->with('error', 'Portal bisnis ini sedang ditangguhkan.');
        }

        $minRating = max(2, min(5, (int) ($business->review_redirect_min_rating ?? 4)));
        $googleReviewUrl = trim((string) ($business->google_review_url ?? ''));
        $isEligible = (int) $review->rating >= $minRating
            && $googleReviewUrl !== ''
            && BusinessReview::isValidGoogleReviewUrl($googleReviewUrl);

        $allowedIds = array_map('intval', (array) $request->session()->get('review_redirect_allow_ids', []));
        $hasOwnership = in_array((int) $review->id, $allowedIds, true) || $request->hasValidSignature();

        abort_unless($isEligible && $hasOwnership, 403);

        if (! $review->redirected_to_google) {
            $review->update(['redirected_to_google' => true]);
        }

        if ($request->expectsJson()) {
            return response()->json(['ok' => true]);
        }

        return back();
    }
}
