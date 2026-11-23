import { Head, router, usePage } from '@inertiajs/react';
import { Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatRupiah, INVOICE_STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PageProps, SubscriptionPlan } from '@/types';

interface SubscriptionInvoiceRow {
    id: number;
    invoice_number: string;
    plan_name: string;
    billing_cycle: 'monthly' | 'yearly';
    amount: number;
    status: 'pending' | 'paid' | 'expired' | 'failed';
    provider: string;
    payment_url: string | null;
    paid_at: string | null;
    created_at: string | null;
}

interface BillingIndexProps {
    plans: SubscriptionPlan[];
    usage: {
        businesses: number;
        services: number;
        staff: number;
        monthly_bookings: number;
        customers: number;
    };
    billingSimulationEnabled?: boolean;
    mayarEnabled?: boolean;
    isOwner?: boolean;
    invoices?: SubscriptionInvoiceRow[];
}

export default function BillingIndex({
    plans,
    usage,
    billingSimulationEnabled = false,
    mayarEnabled = false,
    isOwner = true,
    invoices = [],
}: BillingIndexProps) {
    const { subscription, activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const activePlan = subscription?.plan;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [submittingSlug, setSubmittingSlug] = useState<string | null>(null);
    const [checkingInvoiceId, setCheckingInvoiceId] = useState<number | null>(null);

    const switchPlan = (slug: string) => {
        router.post(route('dashboard.billing.switch'), { plan_slug: slug });
    };

    const checkoutPlan = (slug: string) => {
        setSubmittingSlug(slug);
        router.post(
            route('dashboard.billing.checkout'),
            { plan_slug: slug, billing_cycle: billingCycle },
            {
                onFinish: () => setSubmittingSlug(null),
            }
        );
    };

    const checkInvoiceStatus = (invoiceId: number) => {
        setCheckingInvoiceId(invoiceId);
        router.post(
            route('dashboard.billing.check-invoice', invoiceId),
            {},
            {
                preserveScroll: true,
                onFinish: () => setCheckingInvoiceId(null),
            }
        );
    };

    const meters = [
        { label: 'Bisnis', used: usage.businesses, max: activePlan?.max_businesses },
        { label: `${config.services.pageTitle} (Bisnis Aktif)`, used: usage.services, max: activePlan?.max_services_per_business },
        { label: `${config.nav.teamLabel} (Bisnis Aktif)`, used: usage.staff, max: activePlan?.max_staff_per_business },
        { label: `${config.bookings.itemSingular} Bulan Ini`, used: usage.monthly_bookings, max: activePlan?.max_bookings_per_month },
        { label: 'Pelanggan (Bisnis Aktif)', used: usage.customers, max: activePlan?.max_customers_per_business },
    ];

    return (
        <DashboardLayout title="Paket & Billing">
            <Head title="Paket & Billing" />

            {/* Current Usage */}
            <div className="rounded-md bg-bone p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-mute">Paket Aktif Saat Ini</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2.5">
                            <h2 className="text-2xl font-semibold text-ink">{activePlan?.name ?? 'Professional'}</h2>
                            {subscription?.is_expired ? (
                                <Badge variant="destructive" className="whitespace-normal text-center">
                                    Masa Aktif Berakhir
                                </Badge>
                            ) : subscription?.is_trial ? (
                                <Badge variant="popular" className="whitespace-normal text-center">
                                    Free Trial · {subscription.days_remaining} hari tersisa
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="whitespace-normal text-center">
                                    Aktif · {subscription?.days_remaining ?? 0} hari tersisa
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Billing Cycle Toggle */}
                    <div
                        className="grid w-full grid-cols-2 items-center gap-1 rounded-sm bg-canvas p-1 sm:inline-flex sm:w-auto sm:rounded-full"
                        role="group"
                        aria-label="Siklus penagihan"
                    >
                        <button
                            type="button"
                            aria-pressed={billingCycle === 'monthly'}
                            onClick={() => setBillingCycle('monthly')}
                            className={cn(
                                'min-h-10 cursor-pointer rounded-sm px-3 py-1.5 text-center text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:rounded-full sm:px-4',
                                billingCycle === 'monthly' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                            )}
                        >
                            Bulanan
                        </button>
                        <button
                            type="button"
                            aria-pressed={billingCycle === 'yearly'}
                            onClick={() => setBillingCycle('yearly')}
                            className={cn(
                                'min-h-10 cursor-pointer rounded-sm px-3 py-1.5 text-center text-xs font-semibold leading-tight transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:rounded-full sm:px-4',
                                billingCycle === 'yearly' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                            )}
                        >
                            Tahunan (Hemat 2 Bln)
                        </button>
                    </div>
                </div>

                <div className="mt-6 grid gap-x-8 gap-y-4 rounded-sm bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {meters.map((m) => {
                        const pct = m.max ? Math.min(100, Math.round((m.used / m.max) * 100)) : 0;
                        return (
                            <div key={m.label} className="min-w-0">
                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="min-w-0 text-mute">{m.label}</span>
                                    <span className="shrink-0 font-semibold tabular-nums text-ink">
                                        {m.used} / {m.max ?? '∞'}
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone" aria-hidden="true">
                                    <div
                                        className={cn(
                                            'h-full rounded-full',
                                            pct >= 90 ? 'bg-destructive' : pct >= 75 ? 'bg-warning' : 'bg-ink'
                                        )}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {!isOwner && (
                <div className="rounded-md border border-hairline-soft bg-bone px-5 py-4 text-sm text-body">
                    Pembayaran dan perubahan paket langganan hanya dapat dilakukan oleh pemilik bisnis (Owner).
                </div>
            )}

            {!mayarEnabled && !billingSimulationEnabled && (
                <div className="rounded-md border border-hairline-soft bg-bone px-5 py-4 text-sm text-body">
                    Gateway pembayaran Mayar belum dikonfigurasi. Hubungi tim Janjiyan untuk aktivasi paket.
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {plans.map((plan) => {
                    const isCurrentActive = activePlan?.id === plan.id && !subscription?.is_expired && !subscription?.is_trial;
                    const isPopular = plan.slug === 'professional';
                    const displayPrice = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
                    const isProcessing = submittingSlug === plan.slug;

                    return (
                        <div
                            key={plan.id}
                            className={cn(
                                'flex flex-col justify-between rounded-md p-4 sm:p-6',
                                isPopular ? 'bg-bone' : 'border border-hairline-soft bg-canvas'
                            )}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xl font-semibold text-ink">{plan.name}</h3>
                                    {isPopular && <Badge variant="popular">Rekomendasi</Badge>}
                                </div>
                                <p className="mt-3 text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                                    {formatRupiah(displayPrice)}
                                    <span className="text-sm font-normal text-mute">
                                        {billingCycle === 'yearly' ? ' / thn' : ' / bln'}
                                    </span>
                                </p>

                                <ul className="mt-5 space-y-2.5 text-sm text-body">
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 shrink-0" aria-hidden="true" />
                                        <span>{plan.max_businesses ?? 'Unlimited'} Bisnis</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 shrink-0" aria-hidden="true" />
                                        <span>{plan.max_services_per_business ?? 'Unlimited'} Layanan / bisnis</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 shrink-0" aria-hidden="true" />
                                        <span>
                                            {plan.max_addons_per_business != null
                                                ? `Maks. ${plan.max_addons_per_business} add-on / bisnis`
                                                : 'Add-on unlimited'}
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 shrink-0" aria-hidden="true" />
                                        <span>{plan.max_staff_per_business ?? 'Unlimited'} Staff</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 shrink-0" aria-hidden="true" />
                                        <span>{plan.max_bookings_per_month ?? 'Unlimited'} Booking / bulan</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 shrink-0" aria-hidden="true" />
                                        <span>{plan.max_customers_per_business ?? 'Unlimited'} Pelanggan / bisnis</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        {plan.can_export_csv ? (
                                            <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                        ) : (
                                            <X className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                        )}
                                        <span className={plan.can_export_csv ? 'text-body' : 'text-mute'}>
                                            Export CSV: {plan.can_export_csv ? 'Tersedia' : 'Tidak tersedia'}
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        {plan.can_use_google_review ? (
                                            <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                        ) : (
                                            <X className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                        )}
                                        <span className={plan.can_use_google_review ? 'text-body' : 'text-mute'}>
                                            Google Maps Review &amp; Stiker QR: {plan.can_use_google_review ? 'Tersedia' : 'Tidak tersedia'}
                                        </span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-6 space-y-2">
                                {mayarEnabled ? (
                                    <Button
                                        type="button"
                                        variant={isCurrentActive ? 'secondary' : isPopular ? 'default' : 'outline'}
                                        className="h-auto min-h-12 w-full whitespace-normal py-2.5 text-center leading-snug"
                                        disabled={!isOwner || isProcessing}
                                        onClick={() => checkoutPlan(plan.slug)}
                                    >
                                        {isProcessing
                                            ? 'Membuat Invoice Mayar…'
                                            : isCurrentActive
                                                ? `Perpanjang ${plan.name} via Mayar`
                                                : `Bayar ${plan.name} via Mayar`}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant={isCurrentActive ? 'secondary' : isPopular ? 'default' : 'outline'}
                                        className="h-auto min-h-12 w-full whitespace-normal py-2.5 text-center leading-snug"
                                        disabled={!isOwner || isCurrentActive || !billingSimulationEnabled}
                                        onClick={() => switchPlan(plan.slug)}
                                    >
                                        {isCurrentActive
                                            ? 'Paket Aktif'
                                            : billingSimulationEnabled
                                                ? `Pilih ${plan.name} (Simulasi)`
                                                : 'Pembayaran Belum Aktif'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Subscription Invoices */}
            {invoices.length > 0 && (
                <section aria-label="Riwayat invoice langganan" className="rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-ink">Riwayat Tagihan Langganan</h2>
                    <div className="mt-4 divide-y divide-divider">
                        {invoices.map((inv) => (
                            <div
                                key={inv.id}
                                className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                            >
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs font-semibold break-all text-ink">{inv.invoice_number}</span>
                                        <Badge variant={inv.status === 'paid' ? 'secondary' : inv.status === 'pending' ? 'popular' : 'destructive'}>
                                            {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                                        </Badge>
                                        <span className="text-xs uppercase text-mute">{inv.provider}</span>
                                    </div>
                                    <p className="text-sm text-body">
                                        Paket {inv.plan_name} ({inv.billing_cycle === 'yearly' ? 'Tahunan' : 'Bulanan'})
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                                    <span className="font-mono text-sm font-semibold tabular-nums text-ink sm:mr-2">
                                        {formatRupiah(inv.amount)}
                                    </span>

                                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                                        {inv.status === 'pending' && inv.payment_url && (
                                            <Button asChild size="sm" variant="default" className="flex-1 sm:flex-initial">
                                                <a href={inv.payment_url} target="_blank" rel="noreferrer">
                                                    Lanjutkan Bayar
                                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                                </a>
                                            </Button>
                                        )}

                                        {inv.status === 'pending' && inv.provider === 'mayar' && isOwner && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 sm:flex-initial"
                                                disabled={checkingInvoiceId === inv.id}
                                                onClick={() => checkInvoiceStatus(inv.id)}
                                            >
                                                <RefreshCw className={cn('size-3.5', checkingInvoiceId === inv.id && 'animate-spin')} aria-hidden="true" />
                                                Cek Status
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </DashboardLayout>
    );
}
