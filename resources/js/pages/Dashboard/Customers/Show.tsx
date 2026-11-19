import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, MessageCircle, Plus, Save, ShieldBan, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { PaginationBar, type PaginationMeta } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
    buildWhatsAppUrl,
    formatDateIndo,
    formatRupiah,
    PAYMENT_STATUS_LABELS,
    RESERVATION_STATUS_LABELS,
} from '@/lib/format';

interface CustomerDetail {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    notes: string;
    tags: string[];
    is_blocked: boolean;
    created_at: string | null;
}

const PRESET_TAGS = ['VIP', 'Langganan', 'Alergi / Sensitif', 'Perhatian Khusus'];

interface CustomerStats {
    total_bookings: number;
    completed_count: number;
    no_show_count: number;
    cancelled_count: number;
    total_spent: number;
}

interface CustomerBookingRow {
    id: number;
    booking_code: string;
    invoice_number: string | null;
    invoice_url: string | null;
    service_name: string;
    staff_name: string | null;
    booking_date: string;
    start_time_local: string;
    end_time_local: string;
    total_price: number;
    dp_amount: number;
    reservation_status: string;
    payment_status: string;
    customer_notes: string | null;
    cancellation_reason: string | null;
}

interface CustomerShowProps {
    customer: CustomerDetail;
    stats: CustomerStats;
    bookings: CustomerBookingRow[];
    pagination: PaginationMeta;
    canEdit: boolean;
}

function reservationBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'confirmed' || status === 'completed') return 'default';
    if (status === 'cancelled' || status === 'no_show') return 'destructive';
    return 'secondary';
}

export default function CustomerShow({
    customer,
    stats,
    bookings,
    pagination,
    canEdit,
}: CustomerShowProps) {
    const [customTag, setCustomTag] = useState('');
    const form = useForm({
        name: customer.name,
        email: customer.email ?? '',
        notes: customer.notes ?? '',
        tags: customer.tags ?? ([] as string[]),
        is_blocked: Boolean(customer.is_blocked),
    });

    const toggleTag = (tag: string) => {
        const exists = form.data.tags.includes(tag);
        if (exists) {
            form.setData('tags', form.data.tags.filter((t) => t !== tag));
        } else if (form.data.tags.length < 10) {
            form.setData('tags', [...form.data.tags, tag]);
        }
    };

    const addCustomTag = () => {
        const clean = customTag.trim();
        if (!clean || form.data.tags.includes(clean) || form.data.tags.length >= 10) return;
        form.setData('tags', [...form.data.tags, clean.slice(0, 30)]);
        setCustomTag('');
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.patch(route('dashboard.customers.update', customer.id), {
            preserveScroll: true,
        });
    };

    const waLink = buildWhatsAppUrl(
        customer.phone,
        `Halo ${customer.name}, kami menghubungi Anda terkait reservasi Anda.`
    );

    return (
        <DashboardLayout title={`Profil Pelanggan — ${customer.name}`}>
            <Head title={`${customer.name} — Pelanggan`} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button asChild variant="outline" size="sm">
                    <Link href={route('dashboard.customers')}>
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Kembali ke Pelanggan
                    </Link>
                </Button>

                <Button asChild variant="outline" size="sm">
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="size-4" aria-hidden="true" />
                        Chat WhatsApp (+{customer.phone})
                    </a>
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-[20px] border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Total Reservasi</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.total_bookings}</p>
                </div>
                <div className="rounded-[20px] border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Selesai</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.completed_count}</p>
                </div>
                <div className="rounded-[20px] border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Tidak Hadir (No-Show)</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.no_show_count}</p>
                </div>
                <div className="rounded-[20px] border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Dibatalkan</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.cancelled_count}</p>
                </div>
                <div className="rounded-[20px] border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Total Transaksi</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatRupiah(stats.total_spent)}</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <form
                    onSubmit={handleSubmit}
                    className="min-w-0 space-y-4 rounded-[24px] border border-hairline-soft bg-canvas p-6 lg:col-span-1"
                >
                    <div>
                        <h2 className="text-base font-semibold text-ink">Profil & Catatan Internal</h2>
                        <p className="mt-1 text-xs text-mute">
                            Catatan internal hanya terlihat oleh tim bisnis Anda (mis. preferensi layanan, alergi, status VIP).
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="cust-name">Nama Pelanggan</Label>
                        <Input
                            id="cust-name"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            disabled={!canEdit}
                            required
                        />
                        {form.errors.name && <p className="text-xs text-destructive">{form.errors.name}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="cust-phone">Nomor WhatsApp</Label>
                        <Input id="cust-phone" value={`+${customer.phone}`} disabled className="font-mono text-xs" />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="cust-email">Email (Opsional)</Label>
                        <Input
                            id="cust-email"
                            type="email"
                            value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            disabled={!canEdit}
                            placeholder="pelanggan@email.com"
                        />
                        {form.errors.email && <p className="text-xs text-destructive">{form.errors.email}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="cust-notes">Catatan Internal Merchant</Label>
                        <Textarea
                            id="cust-notes"
                            rows={4}
                            value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)}
                            disabled={!canEdit}
                            placeholder="Contoh: Biasa potong low fade 2mm, alergi produk beraroma kuat, pelanggan VIP…"
                        />
                        {form.errors.notes && <p className="text-xs text-destructive">{form.errors.notes}</p>}
                    </div>

                    <div className="space-y-2.5 border-t border-divider pt-4">
                        <Label>Tag Pelanggan (Maks. 10)</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {PRESET_TAGS.map((tag) => {
                                const active = form.data.tags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        disabled={!canEdit}
                                        aria-pressed={active}
                                        onClick={() => toggleTag(tag)}
                                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                                            active
                                                ? 'bg-ink text-canvas'
                                                : 'bg-bone text-ink hover:bg-hairline-soft'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>

                        {form.data.tags.filter((t) => !PRESET_TAGS.includes(t)).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {form.data.tags
                                    .filter((t) => !PRESET_TAGS.includes(t))
                                    .map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-canvas"
                                        >
                                            {tag}
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    aria-label={`Hapus tag ${tag}`}
                                                    onClick={() => toggleTag(tag)}
                                                    className="cursor-pointer rounded-full hover:opacity-80"
                                                >
                                                    <X className="size-3" aria-hidden="true" />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                            </div>
                        )}

                        {canEdit && (
                            <div className="flex gap-2">
                                <Input
                                    value={customTag}
                                    onChange={(e) => setCustomTag(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addCustomTag();
                                        }
                                    }}
                                    placeholder="Tambah tag khusus…"
                                    maxLength={30}
                                    className="h-9 text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={addCustomTag}
                                    disabled={!customTag.trim() || form.data.tags.length >= 10}
                                >
                                    <Plus className="size-3.5" aria-hidden="true" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-[16px] border border-hairline-soft bg-bone/60 p-3.5">
                        <div className="space-y-0.5">
                            <Label
                                htmlFor="cust-blocked"
                                className="flex items-center gap-1.5 text-xs font-semibold text-ink"
                            >
                                <ShieldBan className="size-3.5 text-destructive" aria-hidden="true" />
                                Batasi Booking Online
                            </Label>
                            <p className="text-[11px] leading-relaxed text-mute">
                                Jika aktif, nomor ini tidak bisa membuat reservasi baru lewat link publik, namun staff tetap bisa input manual.
                            </p>
                        </div>
                        <Switch
                            id="cust-blocked"
                            checked={form.data.is_blocked}
                            disabled={!canEdit}
                            onCheckedChange={(val) => form.setData('is_blocked', val)}
                        />
                    </div>

                    {customer.created_at && (
                        <p className="text-xs text-mute">Terdaftar sejak {customer.created_at}</p>
                    )}

                    {canEdit && (
                        <Button type="submit" disabled={form.processing} className="w-full">
                            <Save className="size-4" aria-hidden="true" />
                            {form.processing ? 'Menyimpan…' : 'Simpan Profil & Catatan'}
                        </Button>
                    )}
                </form>

                <div className="min-w-0 space-y-4 lg:col-span-2">
                    <div className="rounded-[24px] border border-hairline-soft bg-canvas">
                        <div className="border-b border-divider px-6 py-4">
                            <h2 className="text-base font-semibold text-ink">Riwayat Reservasi</h2>
                        </div>

                        {bookings.length === 0 ? (
                            <div className="p-10 text-center text-sm text-mute">
                                Belum ada riwayat reservasi untuk pelanggan ini.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] text-left text-sm">
                                    <thead className="border-b border-divider bg-bone text-xs font-semibold text-mute">
                                        <tr>
                                            <th scope="col" className="px-5 py-3">Kode & Jadwal</th>
                                            <th scope="col" className="px-5 py-3">Layanan</th>
                                            <th scope="col" className="px-5 py-3">Status</th>
                                            <th scope="col" className="px-5 py-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-divider">
                                        {bookings.map((b) => (
                                            <tr key={b.id}>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold text-ink">
                                                            {b.booking_code}
                                                        </span>
                                                        {b.invoice_url && (
                                                            <a
                                                                href={b.invoice_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-mute hover:text-ink"
                                                                aria-label={`Buka invoice ${b.booking_code}`}
                                                            >
                                                                <ExternalLink className="size-3.5" aria-hidden="true" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-mute">
                                                        {formatDateIndo(b.booking_date)} · {b.start_time_local}–{b.end_time_local}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <p className="font-medium text-ink">{b.service_name}</p>
                                                    {b.staff_name && <p className="text-xs text-mute">{b.staff_name}</p>}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={reservationBadgeVariant(b.reservation_status)}>
                                                            {RESERVATION_STATUS_LABELS[b.reservation_status] ?? b.reservation_status}
                                                        </Badge>
                                                        <span className="text-xs text-mute">
                                                            {PAYMENT_STATUS_LABELS[b.payment_status] ?? b.payment_status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-ink">
                                                    {formatRupiah(b.total_price)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <PaginationBar pagination={pagination} />
                </div>
            </div>
        </DashboardLayout>
    );
}
