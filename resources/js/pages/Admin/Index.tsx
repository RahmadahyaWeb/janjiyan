import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Ban, CheckCircle2, Clock, CreditCard, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupiah } from '@/lib/format';
import { cn, parseNumericInput } from '@/lib/utils';
import type { PageProps } from '@/types';

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
    const { flash } = usePage<PageProps>().props;
    const [activeTab, setActiveTab] = useState<'merchants' | 'businesses' | 'invoices'>('merchants');
    const [search, setSearch] = useState(filters.search);
    const [statusFilter, setStatusFilter] = useState(filters.status);

    const [trialTarget, setTrialTarget] = useState<AdminMerchantRow | null>(null);
    const [planTarget, setPlanTarget] = useState<AdminMerchantRow | null>(null);
    const [suspendTarget, setSuspendTarget] = useState<AdminBusinessRow | null>(null);

    const trialForm = useForm({ days: 14 as number | '' });
    const planForm = useForm({
        plan_slug: plans[1]?.slug ?? plans[0]?.slug ?? 'professional',
        billing_cycle: 'monthly' as 'monthly' | 'yearly',
        notes: '',
    });
    const suspendForm = useForm({ reason: '' });

    const applyFilter = (e?: FormEvent) => {
        e?.preventDefault();
        router.get(
            route('admin.index'),
            { search: search || undefined, status: statusFilter || undefined },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const submitExtendTrial = (e: FormEvent) => {
        e.preventDefault();
        if (!trialTarget) return;
        trialForm.transform((data) => ({ ...data, days: Math.max(1, Number(data.days || 1)) }));
        trialForm.post(route('admin.users.extend-trial', trialTarget.id), {
            preserveScroll: true,
            onSuccess: () => setTrialTarget(null),
        });
    };

    const submitActivatePlan = (e: FormEvent) => {
        e.preventDefault();
        if (!planTarget) return;
        planForm.post(route('admin.users.activate-plan', planTarget.id), {
            preserveScroll: true,
            onSuccess: () => {
                setPlanTarget(null);
                planForm.setData('notes', '');
            },
        });
    };

    const submitSuspend = (e: FormEvent) => {
        e.preventDefault();
        if (!suspendTarget) return;
        suspendForm.post(route('admin.businesses.suspend', suspendTarget.id), {
            preserveScroll: true,
            onSuccess: () => {
                setSuspendTarget(null);
                suspendForm.reset();
            },
        });
    };

    const handleUnsuspend = (business: AdminBusinessRow) => {
        router.post(route('admin.businesses.unsuspend', business.id), {}, { preserveScroll: true });
    };

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <Head title="Panel Superadmin" />

            <header className="sticky top-0 z-40 border-b border-divider bg-canvas/95 backdrop-blur-xs">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <JanjiyanLogo size="sm" />
                        <Badge variant="popular" className="shrink-0">
                            Superadmin
                        </Badge>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link href={route('dashboard')}>
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            <span className="sm:hidden">Dashboard</span>
                            <span className="hidden sm:inline">Kembali ke Dashboard</span>
                        </Link>
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
                <div>
                    <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Operasional Platform Janjiyan</h1>
                    <p className="mt-1 text-sm text-mute">
                        Pantau merchant terdaftar, perpanjang trial, aktivasi paket manual, dan moderasi bisnis.
                    </p>
                </div>

                {flash.success && (
                    <div role="status" className="rounded-[16px] bg-bone px-4 py-3 text-sm font-semibold text-ink">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div role="alert" className="rounded-[16px] bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
                        {flash.error}
                    </div>
                )}

                {/* KPI Stats */}
                <section aria-label="Ringkasan platform" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="rounded-[20px] bg-bone p-4">
                        <p className="text-xs text-mute">Total Merchant</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{stats.total_merchants}</p>
                    </div>
                    <div className="rounded-[20px] bg-bone p-4">
                        <p className="text-xs text-mute">Paket Aktif</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{stats.active_paid}</p>
                    </div>
                    <div className="rounded-[20px] bg-bone p-4">
                        <p className="text-xs text-mute">Dalam Trial</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-electric">{stats.trialing}</p>
                    </div>
                    <div className="rounded-[20px] bg-bone p-4">
                        <p className="text-xs text-mute">Expired</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-destructive">{stats.expired}</p>
                    </div>
                    <div className="rounded-[20px] bg-bone p-4">
                        <p className="text-xs text-mute">Bisnis Ditangguhkan</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{stats.suspended_businesses}</p>
                    </div>
                    <div className="rounded-[20px] bg-bone p-4">
                        <p className="text-xs text-mute">Total Pendapatan</p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">{formatRupiah(stats.total_revenue)}</p>
                    </div>
                </section>

                {/* Filter & Tabs */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="inline-flex rounded-full bg-bone p-1" role="tablist" aria-label="Menu superadmin">
                        {[
                            { id: 'merchants' as const, label: `Merchant (${merchants.length})` },
                            { id: 'businesses' as const, label: `Bisnis (${businesses.length})` },
                            { id: 'invoices' as const, label: `Invoice (${invoices.length})` },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-sm',
                                    activeTab === tab.id ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={applyFilter} className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[220px]">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" aria-hidden="true" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama, email, atau slug…"
                                className="pl-9"
                            />
                        </div>
                        <select
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
                            className="h-11 rounded-[16px] border border-control-border bg-field px-3 text-sm text-ink focus:ring-2 focus:ring-ink focus:outline-none"
                        >
                            <option value="">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="trialing">Trial</option>
                            <option value="expired">Expired</option>
                        </select>
                        <Button type="submit" variant="outline" size="sm">
                            Cari
                        </Button>
                    </form>
                </div>

                {/* Tab 1: Merchants */}
                {activeTab === 'merchants' && (
                    <div className="space-y-3">
                        {merchants.length === 0 ? (
                            <div className="rounded-[24px] bg-bone p-8 text-center text-sm text-mute">
                                Tidak ada merchant yang cocok dengan filter.
                            </div>
                        ) : (
                            merchants.map((m) => {
                                const badgeInfo = STATUS_BADGE_MAP[m.subscription?.effective_status ?? 'expired'] ?? STATUS_BADGE_MAP.expired;

                                return (
                                    <div
                                        key={m.id}
                                        className="flex flex-col justify-between gap-4 rounded-[24px] border border-hairline-soft bg-canvas p-5 lg:flex-row lg:items-center"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-base font-semibold text-ink">{m.name}</p>
                                                <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                                                {m.is_superadmin && <Badge variant="default">Superadmin</Badge>}
                                            </div>
                                            <p className="text-sm text-mute">
                                                {m.email} · {m.owned_businesses_count} bisnis
                                            </p>
                                            {m.subscription && (
                                                <p className="text-xs text-body">
                                                    Paket <span className="font-semibold">{m.subscription.plan_name}</span> · Sisa{' '}
                                                    <span className="font-mono font-semibold tabular-nums">{m.subscription.days_remaining}</span> hari
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    trialForm.clearErrors();
                                                    trialForm.setData('days', 14);
                                                    setTrialTarget(m);
                                                }}
                                            >
                                                <Clock className="size-3.5" aria-hidden="true" />
                                                Perpanjang Trial
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="default"
                                                onClick={() => {
                                                    planForm.clearErrors();
                                                    planForm.setData('plan_slug', m.subscription?.plan_slug ?? 'professional');
                                                    setPlanTarget(m);
                                                }}
                                            >
                                                <CreditCard className="size-3.5" aria-hidden="true" />
                                                Aktivasi Paket
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
                            <div className="rounded-[24px] bg-bone p-8 text-center text-sm text-mute">
                                Belum ada bisnis terdaftar.
                            </div>
                        ) : (
                            businesses.map((b) => (
                                <div
                                    key={b.id}
                                    className="flex flex-col justify-between gap-4 rounded-[24px] border border-hairline-soft bg-canvas p-5 lg:flex-row lg:items-center"
                                >
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-base font-semibold text-ink">{b.name}</p>
                                            <span className="font-mono text-xs text-mute">/b/{b.slug}</span>
                                            {b.is_suspended ? (
                                                <Badge variant="destructive">Ditangguhkan</Badge>
                                            ) : b.is_active ? (
                                                <Badge variant="secondary">Aktif</Badge>
                                            ) : (
                                                <Badge variant="outline">Nonaktif</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-mute">
                                            Owner: {b.owner_name} ({b.owner_email}) · {b.bookings_count} booking · {b.services_count} layanan · {b.staff_count} staff
                                        </p>
                                        {b.is_suspended && b.suspension_reason && (
                                            <p className="text-xs font-medium text-destructive">Alasan suspend: {b.suspension_reason}</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {b.is_suspended ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleUnsuspend(b)}
                                            >
                                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                                Cabut Penangguhan
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => {
                                                    suspendForm.reset();
                                                    suspendForm.clearErrors();
                                                    setSuspendTarget(b);
                                                }}
                                            >
                                                <Ban className="size-3.5" aria-hidden="true" />
                                                Tangguhkan Bisnis
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
                            <div className="rounded-[24px] bg-bone p-8 text-center text-sm text-mute">
                                Belum ada transaksi invoice langganan.
                            </div>
                        ) : (
                            invoices.map((inv) => (
                                <div
                                    key={inv.id}
                                    className="flex flex-col justify-between gap-3 rounded-[24px] border border-hairline-soft bg-canvas p-5 sm:flex-row sm:items-center"
                                >
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-ink">{inv.invoice_number}</span>
                                            <Badge variant={inv.status === 'paid' ? 'secondary' : inv.status === 'pending' ? 'popular' : 'destructive'}>
                                                {inv.status}
                                            </Badge>
                                            <Badge variant="outline">{inv.provider}</Badge>
                                        </div>
                                        <p className="text-sm text-body">
                                            {inv.user_name} ({inv.user_email}) · Paket {inv.plan_name} ({inv.billing_cycle})
                                        </p>
                                        {inv.notes && <p className="text-xs text-mute">Catatan: {inv.notes}</p>}
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className="font-mono text-base font-semibold tabular-nums text-ink">{formatRupiah(inv.amount)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* Extend Trial Dialog */}
            <Dialog open={trialTarget !== null} onOpenChange={(open) => !open && setTrialTarget(null)}>
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-ink">Perpanjang Trial Merchant</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitExtendTrial} className="space-y-4">
                        <p className="text-sm text-mute">
                            Merchant: <span className="font-semibold text-ink">{trialTarget?.email}</span>
                        </p>
                        <div className="space-y-1.5">
                            <Label htmlFor="extend-trial-days">Tambah Hari Trial</Label>
                            <Input
                                id="extend-trial-days"
                                type="number"
                                min={1}
                                max={365}
                                value={trialForm.data.days}
                                onChange={(e) => trialForm.setData('days', parseNumericInput(e.target.value))}
                                aria-invalid={Boolean(trialForm.errors.days)}
                                required
                            />
                            {trialForm.errors.days && (
                                <p className="text-xs text-destructive">{trialForm.errors.days}</p>
                            )}
                        </div>
                        <Button type="submit" className="w-full" disabled={trialForm.processing}>
                            {trialForm.processing ? 'Menyimpan…' : 'Simpan Perpanjangan Trial'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Activate Plan Dialog */}
            <Dialog open={planTarget !== null} onOpenChange={(open) => !open && setPlanTarget(null)}>
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-ink">Aktivasi Paket Manual</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitActivatePlan} className="space-y-4">
                        <p className="text-sm text-mute">
                            Merchant: <span className="font-semibold text-ink">{planTarget?.email}</span>
                        </p>
                        <div className="space-y-1.5">
                            <Label htmlFor="admin-plan-slug">Pilih Paket</Label>
                            <select
                                id="admin-plan-slug"
                                value={planForm.data.plan_slug}
                                onChange={(e) => planForm.setData('plan_slug', e.target.value)}
                                className="h-11 w-full rounded-[16px] border border-control-border bg-field px-3 text-sm text-ink focus:ring-2 focus:ring-ink focus:outline-none"
                            >
                                {plans.map((p) => (
                                    <option key={p.id} value={p.slug}>
                                        {p.name} ({formatRupiah(p.price_monthly)}/bln)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="admin-billing-cycle">Siklus</Label>
                            <select
                                id="admin-billing-cycle"
                                value={planForm.data.billing_cycle}
                                onChange={(e) => planForm.setData('billing_cycle', e.target.value as 'monthly' | 'yearly')}
                                className="h-11 w-full rounded-[16px] border border-control-border bg-field px-3 text-sm text-ink focus:ring-2 focus:ring-ink focus:outline-none"
                            >
                                <option value="monthly">Bulanan (+1 Bulan)</option>
                                <option value="yearly">Tahunan (+1 Tahun)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="admin-plan-notes">Catatan Audit (Opsional)</Label>
                            <Input
                                id="admin-plan-notes"
                                placeholder="Mis. Transfer manual BCA / kompensasi"
                                value={planForm.data.notes}
                                onChange={(e) => planForm.setData('notes', e.target.value)}
                            />
                            {planForm.errors.notes && (
                                <p className="text-xs text-destructive">{planForm.errors.notes}</p>
                            )}
                        </div>
                        {Object.keys(planForm.errors).length > 0 && (
                            <p role="alert" className="text-xs text-destructive">
                                {Object.values(planForm.errors)[0]}
                            </p>
                        )}
                        <Button type="submit" className="w-full" disabled={planForm.processing}>
                            <ShieldCheck className="size-4" aria-hidden="true" />
                            {planForm.processing ? 'Memproses…' : 'Aktifkan Paket Sekarang'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Suspend Business Dialog */}
            <Dialog open={suspendTarget !== null} onOpenChange={(open) => !open && setSuspendTarget(null)}>
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-ink">Tangguhkan Bisnis</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitSuspend} className="space-y-4">
                        <p className="text-sm text-mute">
                            Portal publik <span className="font-mono text-ink">/b/{suspendTarget?.slug}</span> dan operasional dashboard akan diblokir.
                        </p>
                        <div className="space-y-1.5">
                            <Label htmlFor="suspend-reason">Alasan Penangguhan</Label>
                            <Input
                                id="suspend-reason"
                                placeholder="Mis. Pelanggaran syarat layanan / laporan spam"
                                value={suspendForm.data.reason}
                                onChange={(e) => suspendForm.setData('reason', e.target.value)}
                                aria-invalid={Boolean(suspendForm.errors.reason)}
                                required
                            />
                            {suspendForm.errors.reason && (
                                <p className="text-xs text-destructive">{suspendForm.errors.reason}</p>
                            )}
                        </div>
                        <Button type="submit" variant="destructive" className="w-full" disabled={suspendForm.processing}>
                            {suspendForm.processing ? 'Memproses…' : 'Konfirmasi Tangguhkan Bisnis'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
