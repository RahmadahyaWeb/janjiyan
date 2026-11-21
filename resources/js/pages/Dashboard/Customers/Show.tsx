import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ExternalLink, GitMerge, MessageCircle, Plus, Save, Search, ShieldBan, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { PaginationBar, type PaginationMeta } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import {
    buildWhatsAppUrl,
    formatDateIndo,
    formatRupiah,
    PAYMENT_STATUS_LABELS,
    RESERVATION_STATUS_LABELS,
} from '@/lib/format';
import type { PageProps } from '@/types';

interface CustomerDetail {
    id: number;
    name: string;
    name_aliases?: string[];
    phone: string;
    email: string | null;
    notes: string;
    tags: string[];
    is_blocked: boolean;
    created_at: string | null;
}

interface PotentialDuplicateCustomer {
    id: number;
    name: string;
    name_aliases?: string[];
    phone: string;
    email: string | null;
    bookings_count: number;
    total_spent: number | null;
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
    booked_customer_name?: string | null;
    invoice_number: string | null;
    invoice_url: string | null;
    service_name: string;
    staff_name: string | null;
    booking_mode?: 'time_slot' | 'dropoff';
    quantity?: number;
    unit_label?: string;
    fulfillment_type?: 'dropoff' | 'pickup';
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
    potentialDuplicates?: PotentialDuplicateCustomer[];
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
    potentialDuplicates = [],
}: CustomerShowProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const itemSingular = config.bookings.itemSingular;
    const itemLower = itemSingular.toLowerCase();
    const [customTag, setCustomTag] = useState('');
    const [mergeQuery, setMergeQuery] = useState('');
    const [mergeSearchResults, setMergeSearchResults] = useState<PotentialDuplicateCustomer[]>([]);
    const [isSearchingMerge, setIsSearchingMerge] = useState(false);
    const [selectedMergeSource, setSelectedMergeSource] = useState<PotentialDuplicateCustomer | null>(null);
    const [isMerging, setIsMerging] = useState(false);

    const form = useForm({
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? '',
        notes: customer.notes ?? '',
        tags: customer.tags ?? ([] as string[]),
        name_aliases: customer.name_aliases ?? ([] as string[]),
        is_blocked: Boolean(customer.is_blocked),
    });

    useEffect(() => {
        form.setData({
            name: customer.name,
            phone: customer.phone,
            email: customer.email ?? '',
            notes: customer.notes ?? '',
            tags: customer.tags ?? [],
            name_aliases: customer.name_aliases ?? [],
            is_blocked: Boolean(customer.is_blocked),
        });
    }, [customer.id, customer.name, customer.phone, customer.email, customer.notes, customer.is_blocked]);

    useEffect(() => {
        const q = mergeQuery.trim();
        if (q.length < 2) {
            setMergeSearchResults([]);
            setIsSearchingMerge(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setIsSearchingMerge(true);
            try {
                const url = `${route('dashboard.customers.lookup')}?q=${encodeURIComponent(q)}&exclude_id=${customer.id}`;
                const res = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                });
                if (!res.ok) {
                    setMergeSearchResults([]);
                    return;
                }
                const data = (await res.json()) as { customers?: PotentialDuplicateCustomer[] };
                setMergeSearchResults(Array.isArray(data.customers) ? data.customers : []);
            } catch {
                if (!controller.signal.aborted) {
                    setMergeSearchResults([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsSearchingMerge(false);
                }
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [mergeQuery, customer.id]);

    const promoteAliasToPrimaryName = (alias: string) => {
        const previousPrimary = form.data.name.trim();
        const remainingAliases = form.data.name_aliases.filter(
            (a) => a.trim().toLowerCase() !== alias.trim().toLowerCase()
        );
        const nextAliases =
            previousPrimary && previousPrimary.toLowerCase() !== alias.trim().toLowerCase()
                ? [
                      previousPrimary,
                      ...remainingAliases.filter(
                          (a) => a.trim().toLowerCase() !== previousPrimary.toLowerCase()
                      ),
                  ].slice(0, 10)
                : remainingAliases;

        form.setData((prev) => ({
            ...prev,
            name: alias,
            name_aliases: nextAliases,
        }));
    };

    const removeAlias = (alias: string) => {
        form.setData(
            'name_aliases',
            form.data.name_aliases.filter((a) => a !== alias)
        );
    };

    const handleMergeConfirm = () => {
        if (!selectedMergeSource || isMerging) return;
        setIsMerging(true);
        router.post(
            route('dashboard.customers.merge', customer.id),
            { source_customer_id: selectedMergeSource.id },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedMergeSource(null);
                    setMergeQuery('');
                    setMergeSearchResults([]);
                },
                onFinish: () => setIsMerging(false),
            }
        );
    };

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
        `Halo ${customer.name}, kami menghubungi Anda terkait ${itemLower} Anda.`
    );

    return (
        <DashboardLayout
            title={`Profil Pelanggan — ${customer.name}`}
            back={{ href: route('dashboard.customers'), label: 'Kembali ke Pelanggan' }}
            actions={
                <Button asChild variant="outline" size="sm">
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="size-4" aria-hidden="true" />
                        Chat WhatsApp
                    </a>
                </Button>
            }
        >
            <Head title={`${customer.name} — Pelanggan`} />

            <div
                className={`grid grid-cols-2 gap-3 sm:gap-4 ${
                    config.bookings.supportsNoShow ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                }`}
            >
                <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Total {itemSingular}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.total_bookings}</p>
                </div>
                <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Selesai</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.completed_count}</p>
                </div>
                {config.bookings.supportsNoShow && (
                    <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                        <p className="text-xs font-medium text-mute">Tidak Hadir (No-Show)</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.no_show_count}</p>
                    </div>
                )}
                <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-medium text-mute">Dibatalkan</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{stats.cancelled_count}</p>
                </div>
                <div className="col-span-2 rounded-md border border-hairline-soft bg-canvas p-4 lg:col-span-1">
                    <p className="text-xs font-medium text-mute">Total Transaksi</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatRupiah(stats.total_spent)}</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-1">
                    <form
                        onSubmit={handleSubmit}
                        className="min-w-0 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
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

                        {form.data.name_aliases.length > 0 && (
                            <div className="space-y-2 rounded-sm border border-hairline-soft bg-bone/50 p-3">
                                <div>
                                    <p className="text-xs font-semibold text-ink">Alias Nama Pemesan</p>
                                    <p className="text-xs text-mute">
                                        Nama lain yang pernah digunakan saat {itemLower} dengan nomor WhatsApp ini.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {form.data.name_aliases.map((alias) => (
                                        <div
                                            key={alias}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-hairline-soft bg-canvas px-2.5 py-1 text-xs text-ink"
                                        >
                                            <span className="font-medium">{alias}</span>
                                            {canEdit && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => promoteAliasToPrimaryName(alias)}
                                                        className="cursor-pointer rounded-sm px-1 text-[11px] font-medium text-mute underline hover:text-ink"
                                                    >
                                                        Jadikan Nama Utama
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Hapus alias ${alias}`}
                                                        onClick={() => removeAlias(alias)}
                                                        className="cursor-pointer rounded-full p-0.5 text-mute hover:bg-bone hover:text-ink"
                                                    >
                                                        <X className="size-3" aria-hidden="true" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="cust-phone">Nomor WhatsApp</Label>
                            <Input
                                id="cust-phone"
                                value={form.data.phone}
                                onChange={(e) => form.setData('phone', e.target.value)}
                                disabled={!canEdit}
                                className="font-mono text-xs"
                                placeholder="62812xxxx atau 0812xxxx"
                                required
                            />
                            <p className="text-xs text-mute">
                                Format 08xx atau 628xx. Jika nomor baru sudah terdaftar di profil lain, gunakan fitur Gabungkan Pelanggan di bawah.
                            </p>
                            {form.errors.phone && <p className="text-xs text-destructive">{form.errors.phone}</p>}
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
                                        className="h-9 text-base md:text-sm"
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

                        <div className="flex items-start justify-between gap-3 rounded-sm border border-hairline-soft bg-bone/60 p-3.5">
                            <div className="space-y-0.5">
                                <Label
                                    htmlFor="cust-blocked"
                                    className="flex items-center gap-1.5 text-xs font-semibold text-ink"
                                >
                                    <ShieldBan className="size-3.5 text-destructive" aria-hidden="true" />
                                    Batasi Booking Online
                                </Label>
                                <p className="text-xs leading-relaxed text-mute">
                                    Jika aktif, nomor ini tidak bisa membuat {itemLower} baru lewat link publik, namun tim tetap bisa input manual.
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

                    {canEdit && (
                        <div className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                            <div>
                                <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                                    <GitMerge className="size-4 text-mute" aria-hidden="true" />
                                    Gabungkan Profil Ganda (Merge)
                                </h2>
                                <p className="mt-1 text-xs leading-relaxed text-mute">
                                    Jika pelanggan ini tercatat dua kali karena pernah berganti nomor atau salah ketik nomor WhatsApp, gabungkan profil duplikatnya ke profil utama ini.
                                </p>
                            </div>

                            {potentialDuplicates.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-ink">Saran Profil dengan Nama Serupa</p>
                                    <div className="divide-y divide-divider rounded-sm border border-hairline-soft bg-bone/40">
                                        {potentialDuplicates.map((dup) => (
                                            <div
                                                key={dup.id}
                                                className="flex items-center justify-between gap-2 p-2.5 text-xs"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-ink">{dup.name}</p>
                                                    <p className="font-mono text-[11px] tabular-nums text-mute">
                                                        +{dup.phone} · {dup.bookings_count}x {itemLower}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant={selectedMergeSource?.id === dup.id ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setSelectedMergeSource(dup)}
                                                >
                                                    Pilih
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="merge-customer-search" className="text-xs">
                                    Cari Profil Pelanggan Lain untuk Digabungkan
                                </Label>
                                <div className="relative flex items-center">
                                    <Search
                                        className="pointer-events-none absolute left-3 size-3.5 text-ash"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="merge-customer-search"
                                        value={mergeQuery}
                                        onChange={(e) => setMergeQuery(e.target.value)}
                                        placeholder="Ketik nama atau nomor WA duplikat…"
                                        className="h-9 pl-9 text-xs"
                                    />
                                </div>

                                {isSearchingMerge && (
                                    <p className="text-xs text-mute">Mencari profil pelanggan…</p>
                                )}

                                {!isSearchingMerge && mergeQuery.trim().length >= 2 && mergeSearchResults.length === 0 && (
                                    <p className="text-xs text-mute">Tidak ditemukan pelanggan lain yang cocok.</p>
                                )}

                                {mergeSearchResults.length > 0 && (
                                    <div className="divide-y divide-divider rounded-sm border border-hairline-soft bg-bone/30">
                                        {mergeSearchResults.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between gap-2 p-2.5 text-xs"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-ink">{item.name}</p>
                                                    <p className="font-mono text-[11px] tabular-nums text-mute">
                                                        +{item.phone} · {item.bookings_count}x {itemLower}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant={selectedMergeSource?.id === item.id ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setSelectedMergeSource(item)}
                                                >
                                                    Pilih
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedMergeSource && (
                                <div className="space-y-3 rounded-sm border border-hairline-soft bg-bone p-3.5 text-xs">
                                    <p className="font-semibold text-ink">Konfirmasi Penggabungan Profil</p>
                                    <ul className="list-disc space-y-1 pl-4 text-mute">
                                        <li>
                                            Semua riwayat {itemLower} ({selectedMergeSource.bookings_count}x) dari{' '}
                                            <strong className="text-ink">
                                                {selectedMergeSource.name} (+{selectedMergeSource.phone})
                                            </strong>{' '}
                                            akan dipindahkan ke{' '}
                                            <strong className="text-ink">
                                                {customer.name} (+{customer.phone})
                                            </strong>
                                            .
                                        </li>
                                        <li>Tag, catatan internal, dan alias nama akan digabungkan.</li>
                                        <li>
                                            Profil duplikat (+{selectedMergeSource.phone}) akan dihapus permanen.
                                        </li>
                                    </ul>
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={isMerging}
                                            onClick={() => setSelectedMergeSource(null)}
                                        >
                                            Batal
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="default"
                                            size="sm"
                                            disabled={isMerging}
                                            onClick={handleMergeConfirm}
                                        >
                                            {isMerging ? 'Menggabungkan…' : 'Gabungkan Sekarang'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="min-w-0 space-y-4 lg:col-span-2">
                    <div className="rounded-md border border-hairline-soft bg-canvas">
                        <div className="border-b border-divider px-6 py-4">
                            <h2 className="text-base font-semibold text-ink">Riwayat {config.bookings.pageTitle}</h2>
                        </div>

                        {bookings.length === 0 ? (
                            <div className="p-10 text-center text-sm text-mute">
                                Belum ada riwayat {itemLower} untuk pelanggan ini.
                            </div>
                        ) : (
                            <>
                                {/* Mobile Booking History Cards */}
                                <div className="divide-y divide-divider md:hidden">
                                    {bookings.map((b) => (
                                        <div key={b.id} className="space-y-2 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold text-ink">
                                                            {b.booking_code}
                                                        </span>
                                                        {b.invoice_url && (
                                                            <a
                                                                href={b.invoice_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-sm text-mute hover:text-ink"
                                                                aria-label={`Buka invoice ${b.booking_code}`}
                                                            >
                                                                <ExternalLink className="size-3.5" aria-hidden="true" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium text-ink">{b.service_name}</p>
                                                    {b.staff_name && <p className="text-xs text-mute">{b.staff_name}</p>}
                                                    {b.booked_customer_name &&
                                                        b.booked_customer_name.trim() !== '' &&
                                                        b.booked_customer_name.trim().toLowerCase() !==
                                                            customer.name.trim().toLowerCase() && (
                                                            <p className="text-xs text-mute">
                                                                Dipesan a.n. {b.booked_customer_name}
                                                            </p>
                                                        )}
                                                </div>
                                                <span className="shrink-0 font-semibold tabular-nums text-ink">
                                                    {formatRupiah(b.total_price)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-mute">
                                                {formatDateIndo(b.booking_date)} ·{' '}
                                                {b.booking_mode === 'dropoff'
                                                    ? `${b.fulfillment_type === 'pickup' ? 'Jemput-Antar' : 'Drop-off'}${
                                                          (b.quantity ?? 1) > 1 ? ` (${b.quantity} ${b.unit_label ?? 'item'})` : ''
                                                      }`
                                                    : `${b.start_time_local}–${b.end_time_local}`}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={reservationBadgeVariant(b.reservation_status)}>
                                                    {RESERVATION_STATUS_LABELS[b.reservation_status] ?? b.reservation_status}
                                                </Badge>
                                                <span className="text-xs text-mute">
                                                    {PAYMENT_STATUS_LABELS[b.payment_status] ?? b.payment_status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Booking History Table */}
                                <div className="hidden overflow-x-auto md:block">
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
                                                            {formatDateIndo(b.booking_date)} ·{' '}
                                                            {b.booking_mode === 'dropoff'
                                                                ? `${b.fulfillment_type === 'pickup' ? 'Jemput-Antar' : 'Drop-off'}${
                                                                      (b.quantity ?? 1) > 1 ? ` (${b.quantity} ${b.unit_label ?? 'item'})` : ''
                                                                  }`
                                                                : `${b.start_time_local}–${b.end_time_local}`}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <p className="font-medium text-ink">{b.service_name}</p>
                                                        {b.staff_name && <p className="text-xs text-mute">{b.staff_name}</p>}
                                                        {b.booked_customer_name &&
                                                            b.booked_customer_name.trim() !== '' &&
                                                            b.booked_customer_name.trim().toLowerCase() !==
                                                                customer.name.trim().toLowerCase() && (
                                                                <p className="mt-0.5 text-xs text-mute">
                                                                    Dipesan a.n. {b.booked_customer_name}
                                                                </p>
                                                            )}
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
                            </>
                        )}
                    </div>

                    <PaginationBar pagination={pagination} />
                </div>
            </div>
        </DashboardLayout>
    );
}
