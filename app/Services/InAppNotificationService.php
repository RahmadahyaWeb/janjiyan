<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Business;
use App\Models\BusinessReview;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\User;
use App\Notifications\MerchantInAppNotification;
use Carbon\CarbonInterface;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Throwable;

class InAppNotificationService
{
    public function notifyNewBooking(Booking $booking): void
    {
        $booking->loadMissing(['business.owner', 'business.users', 'staff.user', 'service', 'customer', 'items']);
        $business = $booking->business;
        if (! $business) {
            return;
        }

        $recipients = $this->resolveBusinessRecipients(
            $business,
            ['manage_bookings'],
            $booking->staff?->user
        );

        $nounTitle = match ($business->resolvedBusinessType()) {
            Business::TYPE_DROPOFF => 'Pesanan Baru',
            Business::TYPE_SPACE_BOOKING => 'Booking Baru',
            default => 'Reservasi Baru',
        };

        $customerName = $booking->booked_customer_name ?: ($booking->customer?->name ?? 'Pelanggan');
        $serviceSummary = $booking->resolvedServiceSummary();
        $tz = $business->timezone ?: 'Asia/Jakarta';
        $scheduleLabel = $booking->isDropoff()
            ? $booking->start_at->setTimezone($tz)->format('d M Y')
            : $booking->start_at->setTimezone($tz)->format('d M Y, H:i');

        $notification = new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_BOOKING_NEW,
            businessId: (int) $business->id,
            businessName: $business->name,
            title: "{$nounTitle} · {$booking->booking_code}",
            message: "{$customerName} memesan {$serviceSummary} ({$scheduleLabel}).",
            actionUrl: route('dashboard.bookings', ['search' => $booking->booking_code], false),
            meta: [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
            ],
        );

        $this->sendToRecipients($recipients, $notification);
    }

    public function notifyDpProofUploaded(Booking $booking): void
    {
        $booking->loadMissing(['business.owner', 'business.users', 'staff.user', 'customer']);
        $business = $booking->business;
        if (! $business) {
            return;
        }

        $recipients = $this->resolveBusinessRecipients(
            $business,
            ['verify_payments', 'manage_bookings'],
            $booking->staff?->user
        );

        $customerName = $booking->booked_customer_name ?: ($booking->customer?->name ?? 'Pelanggan');
        $dpFormatted = 'Rp '.number_format((int) $booking->dp_amount, 0, ',', '.');

        $notification = new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_DP_UPLOADED,
            businessId: (int) $business->id,
            businessName: $business->name,
            title: "Bukti Uang Muka · {$booking->booking_code}",
            message: "{$customerName} mengunggah bukti DP {$dpFormatted} dan menunggu verifikasi.",
            actionUrl: route('dashboard.bookings', ['search' => $booking->booking_code], false),
            meta: [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
            ],
        );

        $this->sendToRecipients($recipients, $notification);
    }

    public function notifyNewReview(BusinessReview $review): void
    {
        $review->loadMissing(['business.owner', 'business.users', 'booking', 'customer']);
        $business = $review->business;
        if (! $business) {
            return;
        }

        $recipients = $this->resolveBusinessRecipients(
            $business,
            ['manage_settings', 'manage_bookings']
        );

        $minRating = max(2, min(5, (int) ($business->review_redirect_min_rating ?? 4)));
        $rating = max(1, min(5, (int) $review->rating));
        $isLow = $rating < $minRating;

        $reviewerName = $review->reviewer_name
            ?: ($review->booking?->booked_customer_name ?: ($review->customer?->name ?? 'Pelanggan'));

        $title = $isLow
            ? "Masukan Rating {$rating}/5 Masuk"
            : "Ulasan Baru {$rating}/5";

        $commentPreview = $review->comment ? mb_strimwidth(trim($review->comment), 0, 90, '…') : null;
        $message = $commentPreview
            ? "{$reviewerName}: \"{$commentPreview}\""
            : "{$reviewerName} memberikan rating {$rating}/5 untuk {$business->name}.";

        $notification = new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_REVIEW_NEW,
            businessId: (int) $business->id,
            businessName: $business->name,
            title: $title,
            message: $message,
            actionUrl: route('dashboard.reviews', $isLow ? ['type' => 'low'] : [], false),
            meta: [
                'review_id' => $review->id,
                'rating' => $rating,
                'is_low' => $isLow,
            ],
        );

        $this->sendToRecipients($recipients, $notification);
    }

    public function notifySubscriptionActivated(
        User $owner,
        SubscriptionInvoice $invoice,
        Subscription $subscription
    ): void {
        $invoice->loadMissing('plan');
        $planName = $invoice->plan?->name ?? $subscription->plan?->name ?? 'Janjiyan';
        $cycleLabel = $invoice->billing_cycle === 'yearly' ? 'Tahunan' : 'Bulanan';
        $tz = $owner->ownedBusinesses()->value('timezone') ?: 'Asia/Jakarta';
        $validUntil = $subscription->current_period_ends_at?->timezone($tz)->format('d M Y') ?? '-';

        $notification = new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_BILLING_ACTIVATED,
            businessId: null,
            businessName: null,
            title: "Paket {$planName} Aktif",
            message: "Langganan {$planName} ({$cycleLabel}) aktif hingga {$validUntil} · Invoice {$invoice->invoice_number}.",
            actionUrl: route('dashboard.billing', [], false),
            meta: [
                'invoice_number' => $invoice->invoice_number,
                'plan_name' => $planName,
            ],
        );

        $this->sendToRecipients(collect([$owner]), $notification);
    }

    public function notifyTrialExtended(User $owner, int $days, CarbonInterface $trialEndsAt): void
    {
        $tz = $owner->ownedBusinesses()->value('timezone') ?: 'Asia/Jakarta';
        $validUntil = $trialEndsAt->timezone($tz)->format('d M Y');

        $notification = new MerchantInAppNotification(
            category: MerchantInAppNotification::CATEGORY_TRIAL_EXTENDED,
            businessId: null,
            businessName: null,
            title: "Masa Trial Diperpanjang {$days} Hari",
            message: "Akses trial bisnis Anda telah diperpanjang hingga {$validUntil}.",
            actionUrl: route('dashboard.billing', [], false),
            meta: [
                'days' => $days,
            ],
        );

        $this->sendToRecipients(collect([$owner]), $notification);
    }

    /**
     * @return Collection<int, DatabaseNotification>
     */
    public function recentForUser(User $user, ?Business $activeBusiness, int $limit = 20): Collection
    {
        return $user->notifications()
            ->latest()
            ->limit(100)
            ->get()
            ->filter(fn (DatabaseNotification $item) => $this->matchesBusinessScope($item, $activeBusiness))
            ->take($limit)
            ->values();
    }

    public function unreadCountForUser(User $user, ?Business $activeBusiness): int
    {
        return $user->unreadNotifications()
            ->latest()
            ->limit(200)
            ->get()
            ->filter(fn (DatabaseNotification $item) => $this->matchesBusinessScope($item, $activeBusiness))
            ->count();
    }

    public function markAllReadForUser(User $user, ?Business $activeBusiness): int
    {
        $now = now();
        $ids = $user->unreadNotifications()
            ->latest()
            ->limit(200)
            ->get()
            ->filter(fn (DatabaseNotification $item) => $this->matchesBusinessScope($item, $activeBusiness))
            ->pluck('id');

        if ($ids->isEmpty()) {
            return 0;
        }

        return $user->unreadNotifications()
            ->whereIn('id', $ids->all())
            ->update(['read_at' => $now]);
    }

    public function matchesBusinessScope(DatabaseNotification $item, ?Business $activeBusiness): bool
    {
        $businessId = $item->data['business_id'] ?? null;
        if ($businessId === null) {
            return true;
        }

        return $activeBusiness !== null && (int) $businessId === (int) $activeBusiness->id;
    }

    /**
     * @param  array<int, string>  $requiredPermissions
     * @return Collection<int, User>
     */
    private function resolveBusinessRecipients(
        Business $business,
        array $requiredPermissions,
        ?User $extraUser = null
    ): Collection {
        $business->loadMissing(['owner', 'users']);

        $recipients = collect();
        if ($business->owner) {
            $recipients->push($business->owner);
        }

        foreach ($business->users as $member) {
            $role = (string) ($member->pivot->role ?? '');
            if (in_array($role, ['owner', 'admin'], true)) {
                $recipients->push($member);

                continue;
            }

            $permissions = json_decode((string) ($member->pivot->permissions ?? '[]'), true);
            $permissions = is_array($permissions) ? $permissions : [];
            if (array_intersect($requiredPermissions, $permissions) !== []) {
                $recipients->push($member);
            }
        }

        if ($extraUser) {
            $recipients->push($extraUser);
        }

        return $recipients->filter()->unique('id')->values();
    }

    /**
     * @param  Collection<int, User>  $recipients
     */
    private function sendToRecipients(Collection $recipients, MerchantInAppNotification $notification): void
    {
        foreach ($recipients as $recipient) {
            try {
                $recipient->notify($notification);
            } catch (Throwable $e) {
                report($e);
            }
        }
    }
}
