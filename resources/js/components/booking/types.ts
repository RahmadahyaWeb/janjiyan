import type { BusinessType, ServiceUnitLabel } from '@/types';

export interface StaffOption {
    id: number;
    name: string;
    title: string | null;
}

export interface ServiceItem {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    duration_minutes: number;
    buffer_minutes: number;
    capacity: number;
    assignment_mode: 'staff' | 'capacity';
    booking_mode?: 'time_slot' | 'dropoff';
    turnaround_days?: number;
    supports_pickup?: boolean;
    unit_label?: ServiceUnitLabel;
    dp_type: 'none' | 'fixed' | 'percentage';
    dp_value: number;
    dp_amount: number;
    staff: StaffOption[];
}

export interface BankAccount {
    bank_name: string;
    account_number: string;
    account_holder: string;
}

export interface OperatingHourItem {
    day_of_week: number;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
    break_start: string | null;
    break_end: string | null;
}

export interface BusinessData {
    id: number;
    name: string;
    slug: string;
    category: string;
    business_type?: BusinessType;
    phone: string | null;
    timezone: string;
    logo_url: string | null;
    brand_color: string | null;
    qris_url: string | null;
    bank_accounts: BankAccount[];
    dp_expiry_minutes: number;
    min_booking_lead_minutes?: number;
    max_booking_advance_days?: number;
}

export interface ActiveServiceLine {
    service: ServiceItem;
    quantity: number;
}

export interface SelectedAddonLine {
    addon: {
        id: number;
        name: string;
        price: number;
        duration_minutes: number;
        unit_label: string;
    };
    quantity: number;
}

export interface QuickDateItem {
    date: string;
    closed: boolean;
}
