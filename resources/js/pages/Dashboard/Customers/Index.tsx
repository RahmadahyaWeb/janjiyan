import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, Download, MessageCircle, Search, StickyNote, Users, X } from 'lucide-react';
import { useState } from 'react';
import { PaginationBar, type PaginationMeta } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { buildWhatsAppUrl, formatRupiah } from '@/lib/format';
import type { PageProps } from '@/types';

interface CustomerRow {
    id: number;
    name: string;
    name_aliases?: string[];
    has_duplicate_name?: boolean;
    phone: string;
    email: string | null;
    notes: string | null;
    tags?: string[];
    is_blocked?: boolean;
    bookings_count: number;
    no_show_count: number;
    total_spent: number | null;
}

interface CustomersIndexProps {
    customers: CustomerRow[];
    pagination?: PaginationMeta | null;
    search: string;
    filters?: {
        search: string;
        segment: string;
        sort: string;
    };
    canExportCsv: boolean;
    duplicateCustomersCount?: number;
}

export default function CustomersIndex({
    customers,
    pagination,
    search: initialSearch,
    filters,
    canExportCsv,
    duplicateCustomersCount,
}: CustomersIndexProps) {
    const activeBusiness = usePage<PageProps>().props.activeBusiness;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const itemLower = config.bookings.itemSingular.toLowerCase();
    // Billing is only open to owner/managers; staff get a plain hint instead of a link that 403s.
    const canOpenBilling = activeBusiness?.can?.manage_settings ?? true;
    const activeFilters = {
        search: filters?.search ?? initialSearch,
        segment: filters?.segment ?? 'all',
        sort: filters?.sort ?? 'latest',
    };
    const [search, setSearch] = useState(activeFilters.search);

    const hasActiveFilter = Boolean(
        activeFilters.search || activeFilters.segment !== 'all' || activeFilters.sort !== 'latest'
    );

    const applyFilters = (next: Partial<typeof activeFilters>) => {
        router.get(
            route('dashboard.customers'),
            { ...activeFilters, search, ...next },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const resetFilters = () => {
        setSearch('');
        router.get(
            route('dashboard.customers'),
            {},
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    return (
        <DashboardLayout title="Direktori Pelanggan (CRM)">
            <Head title="Pelanggan" />

            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 lg:w-auto lg:max-w-3xl lg:flex-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="relative flex min-w-0 items-center sm:col-span-2 lg:col-span-1">
                            <label htmlFor="customer-search" className="sr-only">
                                Cari pelanggan berdasarkan nama, email, atau nomor WhatsApp
                            </label>
                            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ash" aria-hidden="true" />
                            <Input
                                id="customer-search"
                                className="pl-10 pr-11"
                                placeholder="Cari nama, email, atau WA…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters({ search })}
                            />
                            {search && (
                                <button
                                    type="button"
                                    aria-label="Hapus pencarian pelanggan"
                                    onClick={() => {
                                        setSearch('');
                                        applyFilters({ search: '' });
                                    }}
                                    className="absolute right-1.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-mute hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>

                        <NativeSelect
                            aria-label="Filter segmen pelanggan"
                            value={activeFilters.segment}
                            onChange={(e) => applyFilters({ segment: e.target.value })}
                        >
                            <option value="all">Semua Pelanggan</option>
                            <option value="vip">Pelanggan VIP</option>
                            <option value="repeat">Pelanggan Berulang (≥2x)</option>
                            {config.bookings.supportsNoShow && (
                                <option value="has_no_show">Pernah Tidak Hadir</option>
                            )}
                            <option value="blocked">Booking Online Diblokir</option>
                            <option value="duplicates">
                                Potensi Nama Ganda{duplicateCustomersCount ? ` (${duplicateCustomersCount})` : ''}
                            </option>
                        </NativeSelect>

                        <NativeSelect
                            aria-label="Urutkan pelanggan"
                            value={activeFilters.sort}
                            onChange={(e) => applyFilters({ sort: e.target.value })}
                        >
                            <option value="latest">Terbaru Terdaftar</option>
                            <option value="top_spent">Transaksi Tertinggi</option>
                            <option value="most_bookings">{config.bookings.itemSingular} Terbanyak</option>
                        </NativeSelect>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        {hasActiveFilter && (
                            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                                Reset Filter
                            </Button>
                        )}
                        {canExportCsv ? (
                            <Button asChild variant="outline" size="sm">
                                <a href={route('dashboard.customers.export')}>
                                    <Download className="size-4" aria-hidden="true" />
                                    Export CSV
                                </a>
                            </Button>
                        ) : (
                            canOpenBilling ? (
                                <Button asChild variant="outline" size="sm" className="text-mute">
                                    <Link
                                        href={route('dashboard.billing')}
                                        aria-label="Export CSV tersedia pada paket Professional, buka Paket & Billing"
                                        title="Export CSV tersedia pada paket Professional & Enterprise"
                                    >
                                        <Download className="size-4" aria-hidden="true" />
                                        Export CSV (Pro)
                                    </Link>
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-mute"
                                    disabled
                                    title="Export CSV tersedia pada paket Professional & Enterprise"
                                >
                                    <Download className="size-4" aria-hidden="true" />
                                    Export CSV (Pro)
                                </Button>
                            )
                        )}
                    </div>
                </div>

                {(duplicateCustomersCount ?? 0) > 0 && activeFilters.segment !== 'duplicates' && (
                    <div className="flex flex-col gap-3 rounded-md border border-hairline-soft bg-bone/70 px-4 py-3 text-xs text-ink sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2 sm:items-center">
                            <Users className="mt-0.5 size-4 shrink-0 text-mute sm:mt-0" aria-hidden="true" />
                            <span className="min-w-0 leading-relaxed">
                                Terdeteksi {duplicateCustomersCount} profil pelanggan dengan nama yang sama tapi nomor WhatsApp berbeda.
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full shrink-0 sm:w-auto"
                            onClick={() => applyFilters({ segment: 'duplicates' })}
                        >
                            Lihat Potensi Duplikat
                        </Button>
                    </div>
                )}
            </div>

            {customers.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-6 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        {hasActiveFilter
                            ? 'Tidak ada pelanggan yang cocok dengan filter saat ini.'
                            : 'Belum ada data pelanggan.'}
                    </p>
                    <p className="text-sm text-mute">
                        {hasActiveFilter
                            ? 'Coba ubah kata kunci pencarian atau reset filter untuk melihat seluruh pelanggan.'
                            : 'Data pelanggan otomatis tersimpan setiap kali seseorang melakukan booking.'}
                    </p>
                    {hasActiveFilter && (
                        <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                            Reset Filter
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Mobile Cards (< md) */}
                    <div className="space-y-3 md:hidden">
                        {customers.map((c) => (
                            <div
                                key={c.id}
                                className="space-y-3 rounded-md border border-hairline-soft bg-canvas p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={route('dashboard.customers.show', c.id)}
                                            className="block line-clamp-2 text-base font-semibold break-words text-ink hover:underline"
                                        >
                                            {c.name}
                                        </Link>
                                        <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-mute">+{c.phone}</p>
                                        {c.email && <p className="truncate text-xs text-mute">{c.email}</p>}
                                        {c.name_aliases && c.name_aliases.length > 0 && (
                                            <p className="mt-0.5 truncate text-xs text-mute">
                                                Alias booking: {c.name_aliases.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                    <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                                        {formatRupiah(Number(c.total_spent ?? 0))}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary" className="tabular-nums">
                                        {c.bookings_count}x {itemLower}
                                    </Badge>
                                    {c.has_duplicate_name && <Badge variant="outline">Nama Serupa</Badge>}
                                    {c.no_show_count > 0 && (
                                        <Badge variant="destructive" className="tabular-nums">
                                            {c.no_show_count}x no-show
                                        </Badge>
                                    )}
                                    {c.is_blocked && <Badge variant="destructive">Diblokir</Badge>}
                                    {(c.tags ?? []).map((tag) => (
                                        <Badge key={tag} variant={tag === 'VIP' ? 'popular' : 'secondary'}>
                                            {tag}
                                        </Badge>
                                    ))}
                                    {c.notes && (
                                        <Link
                                            href={route('dashboard.customers.show', c.id)}
                                            className="inline-flex min-h-7 items-center gap-1 rounded-full bg-bone px-2.5 py-0.5 text-xs font-medium text-mute transition-colors hover:bg-hairline-soft hover:text-ink"
                                        >
                                            <StickyNote className="size-3" aria-hidden="true" />
                                            Catatan
                                        </Link>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-2 border-t border-divider pt-3">
                                    <Button asChild variant="outline" size="sm" className="flex-1">
                                        <a
                                            href={buildWhatsAppUrl(c.phone, `Halo ${c.name},`)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <MessageCircle className="size-3.5" aria-hidden="true" />
                                            WhatsApp
                                        </a>
                                    </Button>
                                    <Button asChild variant="secondary" size="sm" className="flex-1">
                                        <Link href={route('dashboard.customers.show', c.id)}>
                                            Profil
                                            <ChevronRight className="size-4" aria-hidden="true" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table (md+) */}
                    <div className="hidden overflow-x-auto rounded-md border border-hairline-soft bg-canvas md:block">
                        <table className="w-full min-w-[680px] text-left text-sm">
                            <thead className="border-b border-divider bg-bone text-xs font-semibold whitespace-nowrap text-mute">
                                <tr>
                                    <th scope="col" className="px-5 py-3.5">Pelanggan</th>
                                    <th scope="col" className="px-5 py-3.5">WhatsApp</th>
                                    <th scope="col" className="px-5 py-3.5">Riwayat</th>
                                    <th scope="col" className="px-5 py-3.5">Total Transaksi</th>
                                    <th scope="col" className="px-5 py-3.5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-divider">
                                {customers.map((c) => (
                                    <tr key={c.id} className="transition-colors hover:bg-bone/50">
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                    href={route('dashboard.customers.show', c.id)}
                                                    className="inline-flex min-h-7 items-center font-semibold text-ink hover:underline"
                                                >
                                                    {c.name}
                                                </Link>
                                                {c.has_duplicate_name && (
                                                    <Badge variant="outline">
                                                        Nama Serupa
                                                    </Badge>
                                                )}
                                                {c.is_blocked && (
                                                    <Badge variant="destructive">
                                                        Diblokir
                                                    </Badge>
                                                )}
                                                {(c.tags ?? []).map((tag) => (
                                                    <Badge
                                                        key={tag}
                                                        variant={tag === 'VIP' ? 'popular' : 'secondary'}
                                                    >
                                                        {tag}
                                                    </Badge>
                                                ))}
                                                {c.notes && (
                                                    <Link
                                                        href={route('dashboard.customers.show', c.id)}
                                                        className="inline-flex min-h-7 items-center gap-1 rounded-full bg-bone px-2.5 py-0.5 text-xs font-medium text-mute transition-colors hover:bg-hairline-soft hover:text-ink"
                                                    >
                                                        <StickyNote className="size-3" aria-hidden="true" />
                                                        Catatan
                                                    </Link>
                                                )}
                                            </div>
                                            {c.email && <p className="text-xs font-normal text-mute">{c.email}</p>}
                                            {c.name_aliases && c.name_aliases.length > 0 && (
                                                <p className="mt-0.5 text-xs font-normal text-mute">
                                                    Alias booking: {c.name_aliases.join(', ')}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 font-mono text-xs tabular-nums text-ink">+{c.phone}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <Badge variant="secondary" className="tabular-nums">
                                                    {c.bookings_count}x {itemLower}
                                                </Badge>
                                                {c.no_show_count > 0 && (
                                                    <Badge variant="destructive" className="tabular-nums">
                                                        {c.no_show_count}x no-show
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 font-semibold tabular-nums text-ink">
                                            {formatRupiah(Number(c.total_spent ?? 0))}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="inline-flex items-center justify-end gap-1">
                                                <Button asChild variant="ghost" size="icon-sm">
                                                    <a
                                                        href={buildWhatsAppUrl(c.phone, `Halo ${c.name},`)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label={`Chat WhatsApp ${c.name}`}
                                                    >
                                                        <MessageCircle className="size-4" aria-hidden="true" />
                                                    </a>
                                                </Button>
                                                <Button asChild variant="ghost" size="sm">
                                                    <Link href={route('dashboard.customers.show', c.id)}>
                                                        Profil
                                                        <ChevronRight className="size-4" aria-hidden="true" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <PaginationBar pagination={pagination} />
                </div>
            )}
        </DashboardLayout>
    );
}
