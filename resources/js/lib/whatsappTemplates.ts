export type WhatsappTemplateKey = 'reminder' | 'dp_verified' | 'confirmed' | 'follow_up';

export type WhatsappTemplatesMap = Record<WhatsappTemplateKey, string>;

export interface WhatsappTemplateContext {
    customer_name: string;
    business_name: string;
    service_name: string;
    staff_name?: string | null;
    date: string;
    time: string;
    booking_code: string;
    dp_amount?: number;
    total_price?: number;
    invoice_url?: string | null;
    business_address?: string | null;
}

export const WHATSAPP_TEMPLATE_META: Array<{
    key: WhatsappTemplateKey;
    label: string;
    shortLabel: string;
    description: string;
}> = [
    {
        key: 'reminder',
        label: 'Reminder Jadwal (H-1)',
        shortLabel: 'Reminder H-1',
        description: 'Mengingatkan pelanggan sebelum waktu kedatangan.',
    },
    {
        key: 'dp_verified',
        label: 'Konfirmasi DP Diterima',
        shortLabel: 'DP Diverifikasi',
        description: 'Dikirim setelah bukti transfer/QRIS DP diverifikasi.',
    },
    {
        key: 'confirmed',
        label: 'Konfirmasi Reservasi',
        shortLabel: 'Konfirmasi Jadwal',
        description: 'Mengirim ringkasan jadwal dan link invoice resmi.',
    },
    {
        key: 'follow_up',
        label: 'Follow-up Pasca Kunjungan',
        shortLabel: 'Follow-up',
        description: 'Ucapan terima kasih dan ajakan kunjungan berikutnya.',
    },
];

export const WHATSAPP_PLACEHOLDERS: Array<{ token: string; label: string }> = [
    { token: '{customer_name}', label: 'Nama Pelanggan' },
    { token: '{business_name}', label: 'Nama Bisnis' },
    { token: '{service_name}', label: 'Layanan' },
    { token: '{staff_name}', label: 'Staff' },
    { token: '{date}', label: 'Tanggal' },
    { token: '{time}', label: 'Jam' },
    { token: '{booking_code}', label: 'Kode Booking' },
    { token: '{dp_amount}', label: 'Nominal DP' },
    { token: '{total_price}', label: 'Total Harga' },
    { token: '{invoice_url}', label: 'Link Invoice' },
    { token: '{business_address}', label: 'Alamat Bisnis' },
];

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
}

export function interpolateWhatsappTemplate(template: string, ctx: WhatsappTemplateContext): string {
    const replacements: Record<string, string> = {
        '{customer_name}': ctx.customer_name || 'Pelanggan',
        '{business_name}': ctx.business_name || 'Janjiyan',
        '{service_name}': ctx.service_name || '-',
        '{staff_name}': ctx.staff_name || 'Tim kami',
        '{date}': ctx.date || '-',
        '{time}': ctx.time || '-',
        '{booking_code}': ctx.booking_code || '-',
        '{dp_amount}': formatRupiah(ctx.dp_amount ?? 0),
        '{total_price}': formatRupiah(ctx.total_price ?? 0),
        '{invoice_url}': ctx.invoice_url || '-',
        '{business_address}': ctx.business_address || '-',
    };

    let output = template;
    for (const [token, value] of Object.entries(replacements)) {
        output = output.split(token).join(value);
    }

    return output;
}

export function buildWhatsappTemplateUrl(
    phone: string,
    template: string,
    ctx: WhatsappTemplateContext
): string {
    const digits = phone.replace(/\D+/g, '');
    const text = interpolateWhatsappTemplate(template, ctx);
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
