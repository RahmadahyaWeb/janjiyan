export function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDateIndo(dateString: string): string {
    const date = new Date(`${dateString}T00:00:00`);
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
}

export function formatDateShortIndo(dateString: string): string {
    const date = new Date(`${dateString}T00:00:00`);
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
    const cleanPhone = (phone ?? '').replace(/\D+/g, '');
    const normalized = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;
    const encoded = encodeURIComponent(message);
    return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
    pending: 'Menunggu Konfirmasi',
    confirmed: 'Dikonfirmasi',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    no_show: 'Tidak Hadir (No-Show)',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
    unpaid: 'Belum Dibayar',
    waiting_verification: 'Menunggu Verifikasi',
    dp_verified: 'Uang Muka Terverifikasi',
    settled: 'Lunas',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
    pending: 'Menunggu Pembayaran',
    paid: 'Lunas',
    expired: 'Kedaluwarsa',
    failed: 'Gagal',
};

export const STAFF_ROLE_LABELS: Record<string, string> = {
    owner: 'Pemilik',
    admin: 'Admin',
    staff: 'Staff',
};

export const WORK_STATUS_LABELS: Record<string, string> = {
    awaiting_dropoff: 'Menunggu Drop-off',
    in_progress: 'Sedang Dikerjakan',
    ready_for_pickup: 'Siap Diambil',
    picked_up: 'Sudah Diambil',
};

export const FULFILLMENT_TYPE_LABELS: Record<string, string> = {
    dropoff: 'Antar ke Toko',
    pickup: 'Jemput & Antar',
};

export const PICKUP_SESSION_LABELS: Record<string, string> = {
    morning: 'Pagi (09:00–12:00)',
    afternoon: 'Siang (13:00–17:00)',
    evening: 'Sore (17:00–20:00)',
    anytime: 'Fleksibel (Jam Buka)',
};

export function formatTurnaroundLabel(days: number): string {
    if (days <= 0) return 'Selesai hari ini';
    if (days === 1) return 'Est. 1 hari';
    return `Est. ${days} hari`;
}

export function formatBookingScheduleShort(booking: {
    booking_mode?: 'time_slot' | 'dropoff';
    fulfillment_type?: 'dropoff' | 'pickup';
    pickup_session?: string | null;
    start_time_local: string;
    end_time_local?: string;
}): string {
    if (booking.booking_mode === 'dropoff') {
        if (booking.fulfillment_type === 'pickup') {
            return `Jemput · ${PICKUP_SESSION_LABELS[booking.pickup_session ?? 'anytime'] ?? 'Fleksibel'}`;
        }
        return 'Drop-off (Jam Buka)';
    }
    return booking.end_time_local
        ? `${booking.start_time_local}–${booking.end_time_local}`
        : booking.start_time_local;
}

/** "09:00:00" → "09:00". */
export function formatShortTime(time: string | null): string {
    return time ? time.slice(0, 5) : '';
}

/** Day of week (0 = Sunday) for a Y-m-d string, independent of the browser timezone. */
export function getLocalDayOfWeek(dateString: string): number {
    const [y, m, d] = dateString.split('-').map(Number);
    if (!y || !m || !d) return new Date().getDay();
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getDropoffDeadlineStatus(
    estimatedReadyDate: string | null | undefined,
    todayDate: string
): 'overdue' | 'due_today' | 'upcoming' | null {
    if (!estimatedReadyDate || !todayDate) return null;
    if (estimatedReadyDate < todayDate) return 'overdue';
    if (estimatedReadyDate === todayDate) return 'due_today';
    return 'upcoming';
}
