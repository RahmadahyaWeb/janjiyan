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
    waiting_verification: 'Menunggu Verifikasi DP',
    dp_verified: 'DP Terverifikasi',
    settled: 'Lunas',
};

export const STAFF_ROLE_LABELS: Record<string, string> = {
    owner: 'Pemilik',
    admin: 'Admin',
    staff: 'Staff',
};
