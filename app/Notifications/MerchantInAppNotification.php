<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * Synchronous database notification for the merchant dashboard Notification Center.
 * Intentionally does not implement ShouldQueue so in-app alerts appear immediately
 * regardless of background queue worker state.
 */
class MerchantInAppNotification extends Notification
{
    public const CATEGORY_BOOKING_NEW = 'booking_new';

    public const CATEGORY_DP_UPLOADED = 'dp_uploaded';

    public const CATEGORY_REVIEW_NEW = 'review_new';

    public const CATEGORY_BILLING_ACTIVATED = 'billing_activated';

    public const CATEGORY_TRIAL_EXTENDED = 'billing_trial_extended';

    /**
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        private readonly string $category,
        private readonly ?int $businessId,
        private readonly ?string $businessName,
        private readonly string $title,
        private readonly string $message,
        private readonly string $actionUrl,
        private readonly array $meta = [],
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'category' => $this->category,
            'business_id' => $this->businessId,
            'business_name' => $this->businessName,
            'title' => $this->title,
            'message' => $this->message,
            'action_url' => $this->actionUrl,
            'meta' => $this->meta,
        ];
    }
}
