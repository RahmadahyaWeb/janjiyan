<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\BusinessReview;
use App\Services\PlanLimitService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReviewController extends Controller
{
    public function index(Request $request, PlanLimitService $planLimitService): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business && ($user->hasBusinessPermission($business, 'manage_settings') || $user->hasBusinessPermission($business, 'manage_bookings')),
            403
        );

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $minRating = max(2, min(5, (int) ($business->review_redirect_min_rating ?? 4)));

        $rawType = $request->string('type')->toString();
        $type = in_array($rawType, ['all', 'low', 'high'], true) ? $rawType : 'all';

        $rawRating = $request->string('rating')->toString();
        $rating = ctype_digit($rawRating) && (int) $rawRating >= 1 && (int) $rawRating <= 5
            ? (string) ((int) $rawRating)
            : '';

        $search = mb_substr(trim($request->string('search')->toString()), 0, 100);

        $statsRow = $business->reviews()
            ->selectRaw(
                'COUNT(*) as total_count, AVG(rating) as avg_rating, COALESCE(SUM(CASE WHEN rating < ? THEN 1 ELSE 0 END), 0) as private_feedback_count, COALESCE(SUM(CASE WHEN redirected_to_google = ? THEN 1 ELSE 0 END), 0) as google_redirected_count',
                [$minRating, true]
            )
            ->first();

        $totalCount = (int) ($statsRow?->total_count ?? 0);
        $stats = [
            'total_count' => $totalCount,
            'average_rating' => $totalCount > 0 ? round((float) $statsRow->avg_rating, 1) : 0.0,
            'private_feedback_count' => (int) ($statsRow?->private_feedback_count ?? 0),
            'google_redirected_count' => (int) ($statsRow?->google_redirected_count ?? 0),
        ];

        $paginatedReviews = $business->reviews()
            ->with(['booking:id,booking_code,invoice_number'])
            ->when($type === 'low', fn ($q) => $q->where('rating', '<', $minRating))
            ->when($type === 'high', fn ($q) => $q->where('rating', '>=', $minRating))
            ->when($rating !== '', fn ($q) => $q->where('rating', (int) $rating))
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('reviewer_name', 'like', "%{$search}%")
                        ->orWhere('reviewer_phone', 'like', "%{$search}%")
                        ->orWhere('comment', 'like', "%{$search}%")
                        ->orWhereHas('booking', function ($bq) use ($search) {
                            $bq->where('booking_code', 'like', "%{$search}%")
                                ->orWhere('invoice_number', 'like', "%{$search}%");
                        });
                });
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString()
            ->through(static fn (BusinessReview $review): array => [
                'id' => $review->id,
                'booking_id' => $review->booking_id,
                'booking_code' => $review->booking?->booking_code,
                'invoice_number' => $review->booking?->invoice_number,
                'customer_id' => $review->customer_id,
                'reviewer_name' => $review->reviewer_name,
                'reviewer_phone' => $review->reviewer_phone,
                'rating' => (int) $review->rating,
                'comment' => $review->comment,
                'redirected_to_google' => (bool) $review->redirected_to_google,
                'is_private_feedback' => (int) $review->rating < $minRating,
                'created_at' => $review->created_at?->toIso8601String() ?? '',
                'created_at_local' => $review->created_at?->setTimezone($tz)->format('d M Y · H:i') ?? '',
            ]);

        return Inertia::render('Dashboard/Reviews/Index', [
            'reviews' => $paginatedReviews->items(),
            'pagination' => [
                'current_page' => $paginatedReviews->currentPage(),
                'last_page' => $paginatedReviews->lastPage(),
                'per_page' => $paginatedReviews->perPage(),
                'total' => $paginatedReviews->total(),
                'from' => $paginatedReviews->firstItem(),
                'to' => $paginatedReviews->lastItem(),
                'prev_page_url' => $paginatedReviews->previousPageUrl(),
                'next_page_url' => $paginatedReviews->nextPageUrl(),
            ],
            'stats' => $stats,
            'filters' => [
                'type' => $type,
                'rating' => $rating,
                'search' => $search,
            ],
            'canUseGoogleReview' => $planLimitService->canUseGoogleReview($business->owner),
            'googleReviewUrl' => $business->google_review_url,
            'reviewRedirectMinRating' => $minRating,
            'reviewEnabled' => (bool) ($business->review_enabled ?? true),
            'reviewStickerSubtitle' => $business->review_sticker_subtitle,
            'publicReviewUrl' => route('public.review.show', ['slug' => $business->slug]),
            'business' => [
                'name' => $business->name,
                'slug' => $business->slug,
                'category' => $business->category,
                'business_type' => $business->resolvedBusinessType(),
                'address' => $business->address,
                'review_sticker_subtitle' => $business->review_sticker_subtitle,
            ],
        ]);
    }
}
