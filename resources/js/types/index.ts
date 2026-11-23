interface ZiggyRouterHelper {
    current(name?: string): boolean;
}

declare global {
    function route(): ZiggyRouterHelper;
    function route(name: string, params?: Record<string, unknown> | string | number, absolute?: boolean): string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    has_google_linked?: boolean;
    is_superadmin?: boolean;
}

export interface SubscriptionPlan {
    id: number;
    slug: 'basic' | 'professional' | 'enterprise';
    name: string;
    price_monthly: number;
    price_yearly: number;
    max_businesses: number | null;
    max_services_per_business: number | null;
    max_addons_per_business?: number | null;
    max_staff_per_business: number | null;
    max_bookings_per_month: number | null;
    max_customers_per_business: number | null;
    can_export_csv: boolean;
    can_use_google_review?: boolean;
}

export interface SubscriptionCapabilities {
    can_export_csv: boolean;
    can_use_google_review: boolean;
    can_use_multi_service_dropoff: boolean;
    can_use_daily_cashier: boolean;
}

export interface ActiveSubscription {
    id: number;
    plan: SubscriptionPlan;
    status: 'trialing' | 'active' | 'cancelled';
    effective_status?: 'trialing' | 'active' | 'expired' | 'cancelled';
    trial_ends_at: string | null;
    current_period_ends_at: string | null;
    is_trial: boolean;
    is_expired?: boolean;
    days_remaining: number;
    capabilities?: SubscriptionCapabilities;
}

export type BusinessType = 'staff_appointment' | 'space_booking' | 'dropoff';

export type ServiceUnitLabel = 'item' | 'pasang' | 'kg' | 'pcs' | 'unit';

export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'edc';

export type BookingPaymentType = 'dp' | 'settlement' | 'partial' | 'adjustment' | 'refund';

export type BookingItemType = 'service' | 'addon' | 'custom';

export interface ServiceAddon {
    id: number;
    name: string;
    description: string | null;
    price: number;
    unit_label: ServiceUnitLabel;
    duration_minutes: number;
    is_commissionable: boolean;
    applies_to_all_services: boolean;
    is_active: boolean;
    sort_order: number;
    service_ids: number[];
}

export interface BookingItemRecord {
    id: number;
    item_type: BookingItemType;
    service_id: number | null;
    service_addon_id: number | null;
    name_snapshot: string;
    unit_label_snapshot: string;
    unit_price: number;
    quantity: number;
    duration_minutes_snapshot: number;
    turnaround_days_snapshot: number;
    is_commissionable: boolean;
    subtotal: number;
}

export interface BookingPaymentRecord {
    id: number;
    payment_type: BookingPaymentType;
    payment_method: PaymentMethod;
    amount: number;
    received_amount: number | null;
    change_amount: number;
    recorded_by_name: string | null;
    paid_at: string;
    paid_at_local?: string;
    notes: string | null;
}

export interface DailyCashierSummary {
    date: string;
    total_collected: number;
    total_refunds: number;
    net_collected: number;
    transactions_count: number;
    by_method: Record<PaymentMethod, {
        amount: number;
        count: number;
    }>;
    can_view_breakdown: boolean;
    can_export_csv: boolean;
}

export interface BusinessReviewRecord {
    id: number;
    booking_id: number | null;
    booking_code: string | null;
    invoice_number: string | null;
    customer_id: number | null;
    reviewer_name: string | null;
    reviewer_phone: string | null;
    rating: number;
    comment: string | null;
    redirected_to_google: boolean;
    is_private_feedback: boolean;
    created_at: string;
    created_at_local: string;
}

export type BusinessPermission = 'manage_bookings' | 'verify_payments' | 'manage_services' | 'manage_staff' | 'manage_settings';

export interface BusinessSummary {
    id: number;
    name: string;
    slug: string;
    public_url?: string;
    public_review_url?: string;
    category: string;
    business_type: BusinessType;
    qr_poster_subtitle?: string | null;
    review_sticker_subtitle?: string | null;
    logo_url: string | null;
    role: 'owner' | 'admin' | 'staff';
    permissions: string[];
    /** Only on activeBusiness: what the current user may do, resolved server-side. */
    can?: Record<BusinessPermission | 'owner', boolean>;
    is_suspended?: boolean;
    suspension_reason?: string | null;
}

export type NotificationCategory =
    | 'booking_new'
    | 'dp_uploaded'
    | 'review_new'
    | 'billing_activated'
    | 'billing_trial_extended'
    | 'info';

export interface InAppNotificationItem {
    id: string;
    category: NotificationCategory;
    business_id: number | null;
    business_name: string | null;
    title: string;
    message: string;
    action_url: string | null;
    read_at: string | null;
    created_at: string | null;
}

export interface PageProps {
    [key: string]: unknown;
    auth: {
        user: User | null;
    };
    activeBusiness: BusinessSummary | null;
    businesses: BusinessSummary[];
    tenantBaseDomain?: string;
    subscription: ActiveSubscription | null;
    pendingBookingsCount?: number;
    unreadNotificationsCount?: number;
    flash: {
        success?: string;
        error?: string;
        warning?: string;
        info?: string;
    };
}
