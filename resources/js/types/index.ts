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
    max_staff_per_business: number | null;
    max_bookings_per_month: number | null;
    max_customers_per_business: number | null;
    can_export_csv: boolean;
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
}

export type BusinessType = 'staff_appointment' | 'space_booking' | 'dropoff';

export type ServiceUnitLabel = 'item' | 'pasang' | 'kg' | 'pcs' | 'unit';

export type BusinessPermission = 'manage_bookings' | 'verify_payments' | 'manage_services' | 'manage_staff' | 'manage_settings';

export interface BusinessSummary {
    id: number;
    name: string;
    slug: string;
    category: string;
    business_type: BusinessType;
    qr_poster_subtitle?: string | null;
    logo_url: string | null;
    role: 'owner' | 'admin' | 'staff';
    permissions: string[];
    /** Only on activeBusiness: what the current user may do, resolved server-side. */
    can?: Record<BusinessPermission | 'owner', boolean>;
    is_suspended?: boolean;
    suspension_reason?: string | null;
}

export interface PageProps {
    [key: string]: unknown;
    auth: {
        user: User | null;
    };
    activeBusiness: BusinessSummary | null;
    businesses: BusinessSummary[];
    subscription: ActiveSubscription | null;
    pendingBookingsCount?: number;
    flash: {
        success?: string;
        error?: string;
    };
}
