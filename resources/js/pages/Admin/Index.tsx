import { Head, Link, router } from '@inertiajs/react';
import { Ban, CheckCircle2, Clock, CreditCard, LogOut, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { formatRupiah, INVOICE_STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';

interface AdminMerchantRow {
    id: number;
    name: string;
    email: string;
    is_superadmin: boolean;
    owned_businesses_count: number;
    created_at: string | null;
    subscription: {
        id: number;
        plan_name: string;
        plan_slug: string;
        effective_status: 'trialing' | 'active' | 'expired' | 'cancelled';
        trial_ends_at: string | null;
        current_period_ends_at: string | null;
        days_remaining: number;
    } | null;
}

interface AdminBusinessRow {
    id: number;
    name: string;
    slug: string;
    category: string;
    owner_name: string;
    owner_email: string;
    is_active: boolean;
    is_suspended: boolean;
    suspended_at: string | null;
    suspension_reason: string | null;
    bookings_count: number;
    services_count: number;
    staff_count: number;
}

interface AdminInvoiceRow {
    id: number;
    invoice_number: string;
    user_name: string;
    user_email: string;
    plan_name: string;
    billing_cycle: 'monthly' | 'yearly';
    amount: number;
    provider: string;
    status: string;
    notes: string | null;
    paid_at: string | null;
    created_at: string | null;
}

interface AdminPlanOption {
    id: number;
    slug: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
}

interface AdminIndexProps {
    stats: {
        total_merchants: number;
        active_paid: number;
        trialing: number;
        expired: number;
        suspended_businesses: number;
        total_revenue: number;
    };
    merchants: AdminMerchantRow[];
    businesses: AdminBusinessRow[];
    invoices: AdminInvoiceRow[];
    plans: AdminPlanOption[];
    filters: {
        search: string;
        status: string;
    };
}

const STATUS_BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'popular' | 'destructive' }> = {
    active: { label: 'Aktif', variant: 'secondary' },
    trialing: { label: 'Trial', variant: 'popular' },
    expired: { label: 'Expired', variant: 'destructive' },
    cancelled: { label: 'Dibatalkan', variant: 'destructive' },
};

export default function AdminIndex({
    stats,
    merchants,
    businesses,
    invoices,
    plans,
    filters,
}: AdminIndexProps) {
    const [activeTab, setActiveTab] = useState<'merchants' | 'businesses' | 'invoices'>('merchants');
    const [search, setSearch] = useState(filters.search);
    const [statusFilter, setStatusFilter] = useState(filters.status);

    const applyFilter = (e?: FormEvent) => {
        e?.preventDefault();
        router.get(
            route('admin.index'),
            { search: search || undefined, status: statusFilter || undefined },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const handleUnsuspend = (business: AdminBusinessRow) => {
        router.post(route('admin.businesses.unsuspend', business.id), {}, { preserveScroll: true });
    };

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <Head title="Panel Superadmin" />

            <header className="sticky top-0 z-40 border-b border-divider bg-canvas pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <JanjiyanLogo size="sm" />
                        <Badge variant="popular" className="shrink-0">
                            Superadmin
                        </Badge>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => router.post(route('logout'))}
                    >
                        <LogOut className="size-4" aria-hidden="true" />
                        <span>Keluar</span>
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-6 px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
                <div>
                    <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Operasional Platform Janjiyan</h1>
                    <p className="mt-1 text-sm text-mute">
                        Pantau merchant terdaftar, perpanjang trial, aktivasi paket manual, dan moderasi bisnis.
                    </p>
                </div>

                {/* KPI Stats */}
                <section aria-label="Ringkasan platform" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-6">
                    <div className="min-w-0 rounded-md bg-bone p-3.5 sm:p-4">
                        <p className="text-xs text-mute">Total Merchant</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{stats.total_merchants}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-bone p-3.5 sm:p-4">
                        <p className="text-xs text-mute">Paket Aktif</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{stats.active_paid}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-bone p-3.5 sm:p-4">
                        <p className="text-xs text-mute">Dalam Trial</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-electric">{stats.trialing}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-bone p-3.5 sm:p-4">
                        <p className="text-xs text-mute">Expired</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-destructive">{stats.expired}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-bone p-3.5 sm:p-4">
                        <p className="text-xs text-mute">Bisnis Ditangguhkan</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{stats.suspended_businesses}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-bone p-3.5 sm:p-4">
                        <p className="text-xs text-mute">Total Pendapatan</p>
                        <p className="mt-1 font-mono text-base leading-tight font-semibold break-words tabular-nums text-ink min-[360px]:text-lg">
                            {formatRupiah(stats.total_revenue)}
                        </p>
                    </div>
                </section>

                {/* Filter & Tabs */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div
                        className="grid w-full grid-cols-3 gap-1 rounded-sm bg-bone p-1 sm:inline-flex sm:w-auto sm:rounded-full"
                        role="group"
                        aria-label="Menu superadmin"
                    >
                        {[
                            { id: 'merchants' as const, label: `Merchant (${merchants.length})` },
                            { id: 'businesses' as const, label: `Bisnis (${businesses.length})` },
                            { id: 'invoices' as const, label: `Invoice (${invoices.length})` },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                aria-pressed={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'min-h-10 cursor-pointer truncate rounded-xl px-2 py-2 text-center text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:rounded-full sm:px-4 sm:text-sm',
                                    activeTab === tab.id ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={applyFilter} className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full min-w-0 flex-1 sm:w-auto sm:min-w-[220px]">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" aria-hidden="true" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama, email, atau slug…"
                                className="pl-9"
                            />
                        </div>
                        <NativeSelect
                            aria-label="Filter status langganan"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                router.get(
                                    route('admin.index'),
                                    { search: search || undefined, status: e.target.value || undefined },
                                    { preserveState: true, preserveScroll: true, replace: true }
                                );
                            }}
                            className="w-full font-normal sm:w-auto"
                        >
                            <option value="">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="trialing">Trial</option>
                            <option value="expired">Expired</option>
                        </NativeSelect>
                        <Button type="submit" variant="outline" size="sm" className="w-full sm:w-auto">
                            Cari
                        </Button>
                    </form>
                </div>

                {/* Tab 1: Merchants */}
                {activeTab === 'merchants' && (
                    <div className="space-y-3">
                        {merchants.length === 0 ? (
                            <div className="rounded-md bg-bone p-8 text-center text-sm text-mute">
                                Tidak ada merchant yang cocok dengan filter.
                            </div>
                        ) : (
                            merchants.map((m) => {
                                const badgeInfo = STATUS_BADGE_MAP[m.subscription?.effective_status ?? 'expired'] ?? STATUS_BADGE_MAP.expired;

                                return (
                                    <div
                                        key={m.id}
                                        className="flex flex-col justify-between gap-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-5 lg:flex-row lg:items-center"
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-base font-semibold break-words text-ink">{m.name}</p>
                                                <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                                                {m.is_superadmin && <Badge variant="default">Superadmin</Badge>}
                                            </div>
                                            <p className="text-sm text-mute [overflow-wrap:anywhere]">
                                                {m.email} · {m.owned_businesses_count} bisnis
                                            </p>
                                            {m.subscription && (
                                                <p className="text-xs text-body">
                                                    Paket <span className="font-semibold">{m.subscription.plan_name}</span> · Sisa{' '}
                                                    <span className="font-mono font-semibold tabular-nums">{m.subscription.days_remaining}</span> hari
                                                </p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
                                            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                                                <Link href={route('admin.users.trial.edit', m.id)}>
                                                    <Clock className="size-3.5" aria-hidden="true" />
                                                    Perpanjang Trial
                                                </Link>
                                            </Button>
                                            <Button asChild size="sm" variant="default" className="w-full sm:w-auto">
                                                <Link href={route('admin.users.plan.edit', m.id)}>
                                                    <CreditCard className="size-3.5" aria-hidden="true" />
                                                    Aktivasi Paket
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Tab 2: Businesses */}
                {activeTab === 'businesses' && (
                    <div className="space-y-3">
                        {businesses.length === 0 ? (
                            <div className="rounded-md bg-bone p-8 text-center text-sm text-mute">
                                Belum ada bisnis terdaftar.
                            </div>
                        ) : (
                            businesses.map((b) => (
                                <div
                                    key={b.id}
                                    className="flex flex-col justify-between gap-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-5 lg:flex-row lg:items-center"
                                >
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-base font-semibold break-words text-ink">{b.name}</p>
                                            <span className="font-mono text-xs break-all text-mute">/b/{b.slug}</span>
                                            {b.is_suspended ? (
                                                <Badge variant="destructive">Ditangguhkan</Badge>
                                            ) : b.is_active ? (
                                                <Badge variant="secondary">Aktif</Badge>
                                            ) : (
                                                <Badge variant="outline">Nonaktif</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-mute [overflow-wrap:anywhere]">
                                            Owner: {b.owner_name} ({b.owner_email}) · {b.bookings_count} booking · {b.services_count} layanan · {b.staff_count} staff
                                        </p>
                                        {b.is_suspended && b.suspension_reason && (
                                            <p className="text-xs font-medium break-words text-destructive">Alasan suspend: {b.suspension_reason}</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {b.is_suspended ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="w-full sm:w-auto"
                                                onClick={() => handleUnsuspend(b)}
                                            >
                                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                                Cabut Penangguhan
                                            </Button>
                                        ) : (
                                            <Button asChild size="sm" variant="destructive" className="w-full sm:w-auto">
                                                <Link href={route('admin.businesses.suspend.edit', b.id)}>
                                                    <Ban className="size-3.5" aria-hidden="true" />
                                                    Tangguhkan Bisnis
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Tab 3: Subscription Invoices */}
                {activeTab === 'invoices' && (
                    <div className="space-y-3">
                        {invoices.length === 0 ? (
                            <div className="rounded-md bg-bone p-8 text-center text-sm text-mute">
                                Belum ada transaksi invoice langganan.
                            </div>
                        ) : (
                            invoices.map((inv) => (
                                <div
                                    key={inv.id}
                                    className="flex flex-col justify-between gap-3 rounded-md border border-hairline-soft bg-canvas p-4 sm:flex-row sm:items-center sm:p-5"
                                >
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs font-semibold break-all text-ink">{inv.invoice_number}</span>
                                            <Badge variant={inv.status === 'paid' ? 'secondary' : inv.status === 'pending' ? 'popular' : 'destructive'}>
                                                {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                                            </Badge>
                                            <Badge variant="outline">{inv.provider}</Badge>
                                        </div>
                                        <p className="text-sm text-body [overflow-wrap:anywhere]">
                                            {inv.user_name} ({inv.user_email}) · Paket {inv.plan_name} ({inv.billing_cycle})
                                        </p>
                                        {inv.notes && <p className="text-xs break-words text-mute">Catatan: {inv.notes}</p>}
                                    </div>
                                    <div className="shrink-0 text-left sm:text-right">
                                        <p className="font-mono text-base font-semibold tabular-nums text-ink">{formatRupiah(inv.amount)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
