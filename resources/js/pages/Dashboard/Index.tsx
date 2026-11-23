import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowUpRight,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import {
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
    PAYMENT_STATUS_LABELS,
    RESERVATION_STATUS_LABELS,
    WORK_STATUS_LABELS,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

interface TrendPoint {
    date: string;
    label: string;
    full_label: string;
    bookings_count: number;
    /** Null when the viewer may not see revenue. */
    revenue: number | null;
}

interface OverviewBookingItem {
    id: number;
    booking_code: string;
    customer_name: string;
    customer_phone: string;
    service_name: string;
    staff_name: string | null;
    booking_mode?: 'time_slot' | 'dropoff';
    quantity?: number;
    unit_label?: string;
    fulfillment_type?: 'dropoff' | 'pickup';
    work_status?: 'awaiting_dropoff' | 'in_progress' | 'ready_for_pickup' | 'picked_up' | null;
    estimated_ready_date?: string | null;
    booking_date: string;
    start_time_local: string;
    total_price: number;
    dp_amount: number;
    reservation_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    payment_status: 'unpaid' | 'waiting_verification' | 'dp_verified' | 'settled';
}

interface DropoffPipelineStats {
    awaiting_dropoff: number;
    in_progress: number;
    ready_for_pickup: number;
    overdue: number;
}

interface DashboardIndexProps {
    stats: {
        today_bookings: number;
        pending_dp: number;
        /** Null when the viewer may not see revenue. */
        monthly_revenue: number | null;
        total_customers: number;
    };
    todayDate?: string;
    onboarding?: {
        has_services: boolean;
        has_staff?: boolean;
        has_payment_info: boolean;
        has_bookings: boolean;
    } | null;
    weeklyTrend?: TrendPoint[];
    recentBookings: OverviewBookingItem[];
    todaySchedule?: OverviewBookingItem[];
    dropoffPipeline?: DropoffPipelineStats | null;
    topServices: Array<{
        id: number;
        name: string;
        price: number;
        bookings_count: number;
    }>;
}

export default function DashboardIndex({
    stats,
    todayDate,
    onboarding,
    weeklyTrend = [],
    recentBookings,
    todaySchedule = [],
    dropoffPipeline = null,
    topServices,
}: DashboardIndexProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const isDropoff = config.type === 'dropoff';
    const bookingsItemLower = config.bookings.itemSingular.toLowerCase();
    const todayStr = todayDate || new Date().toISOString().slice(0, 10);
    const [copied, setCopied] = useState(false);
    const [trendMetric, setTrendMetric] = useState<'bookings' | 'revenue'>('bookings');
    const [bookingListTab, setBookingListTab] = useState<'schedule' | 'recent'>('schedule');

    const publicUrl = activeBusiness
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${activeBusiness.slug}`
        : '';

    const copyLink = () => {
        if (!publicUrl) return;
        navigator.clipboard?.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusBadge = (b: OverviewBookingItem) => {
        if (b.booking_mode === 'dropoff' && b.work_status && b.reservation_status !== 'cancelled') {
            return (
                <Badge
                    variant={
                        b.work_status === 'picked_up'
                            ? 'success'
                            : b.work_status === 'awaiting_dropoff'
                              ? 'warning'
                              : 'outline'
                    }
                >
                    {WORK_STATUS_LABELS[b.work_status] ?? b.work_status}
                </Badge>
            );
        }
        const label = RESERVATION_STATUS_LABELS[b.reservation_status] ?? b.reservation_status;
        if (b.reservation_status === 'confirmed' || b.reservation_status === 'completed') {
            return <Badge variant="success">{label}</Badge>;
        }
        if (b.reservation_status === 'cancelled') {
            return <Badge variant="danger">{label}</Badge>;
        }
        return <Badge variant="warning">{label}</Badge>;
    };

    const paymentBadge = (status: OverviewBookingItem['payment_status']) => {
        const label = PAYMENT_STATUS_LABELS[status] ?? status;
        if (status === 'dp_verified' || status === 'settled') {
            return <Badge variant="success">{label}</Badge>;
        }
        if (status === 'waiting_verification') {
            return <Badge variant="warning">{label}</Badge>;
        }
        return <Badge variant="secondary">{label}</Badge>;
    };

    const setupSteps = onboarding
        ? [
              {
                  done: onboarding.has_services,
                  label: config.dashboard.serviceStepLabel,
                  href: route('dashboard.services'),
                  cta: config.dashboard.serviceStepCta,
              },
              ...(config.dashboard.onboardingStepsIncludeStaff
                  ? [
                        {
                            done: Boolean(onboarding.has_staff),
                            label: 'Tambahkan anggota tim / staff',
                            href: route('dashboard.staff'),
                            cta: 'Atur Staff',
                        },
                    ]
                  : []),
              {
                  done: onboarding.has_payment_info,
                  label: config.dashboard.paymentStepLabel,
                  href: route('dashboard.settings'),
                  cta: 'Atur Pembayaran',
              },
          ]
        : [];

    const completedSteps = setupSteps.filter((s) => s.done).length;
    const showOnboarding = setupSteps.length > 0 && completedSteps < setupSteps.length;
    const isMatureWorkspace = Boolean(onboarding?.has_bookings && !showOnboarding);

    const maxTrendValue = Math.max(
        1,
        ...weeklyTrend.map((d) => (trendMetric === 'bookings' ? d.bookings_count : (d.revenue ?? 0)))
    );
    const midTrendValue = Math.round(maxTrendValue / 2);
    const totalWeeklyBookings = weeklyTrend.reduce((acc, d) => acc + d.bookings_count, 0);
    const totalWeeklyRevenue = weeklyTrend.reduce((acc, d) => acc + (d.revenue ?? 0), 0);
    const canSeeRevenue = stats.monthly_revenue !== null;

    const formatCompactCurrency = (amount: number): string => {
        if (amount === 0) return '0';
        if (amount >= 1_000_000) {
            const jt = (amount / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',');
            return `${jt}jt`;
        }
        if (amount >= 1_000) {
            return `${Math.round(amount / 1_000)}rb`;
        }
        return String(amount);
    };

    const kpiCardClass =
        'group flex min-w-0 flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-3.5 transition-colors hover:border-ink/30 hover:bg-bone/40 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none sm:p-5';

    const activeBookingList = bookingListTab === 'schedule' ? todaySchedule : recentBookings;

    return (
        <DashboardLayout title="Ringkasan Bisnis">
            <Head title="Dashboard" />

            {/* Public Link Share Banner (shown only during early setup; mature workspaces use topbar Portal Booking) */}
            {activeBusiness && !isMatureWorkspace && (
                <div className="flex flex-col justify-between gap-3 rounded-md bg-bone p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <p className="text-xs font-semibold text-mute">Link Booking Publik:</p>
                        <p className="truncate font-mono text-sm font-semibold text-ink">
                            /b/{activeBusiness.slug}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                        <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={copyLink}>
                            {copied ? (
                                <Check className="size-3.5 text-success" aria-hidden="true" />
                            ) : (
                                <Copy className="size-3.5" aria-hidden="true" />
                            )}
                            {copied ? 'Tersalin' : 'Salin Link'}
                        </Button>
                        <Button asChild size="sm" className="w-full sm:w-auto">
                            <a href={`/b/${activeBusiness.slug}`} target="_blank" rel="noreferrer">
                                Buka Portal
                                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                            </a>
                        </Button>
                    </div>
                </div>
            )}

            {/* Setup Checklist for incomplete businesses */}
            {showOnboarding && (
                <section
                    aria-label="Panduan mulai cepat"
                    className="rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-lg font-semibold text-ink">Lengkapi Pengaturan Awal Bisnis</h2>
                            <p className="text-xs text-mute">
                                Selesaikan langkah berikut agar pelanggan dapat langsung memesan layanan Anda.
                            </p>
                        </div>
                        <Badge variant="secondary" className="tabular-nums">
                            {completedSteps} / {setupSteps.length} selesai
                        </Badge>
                    </div>

                    <div
                        className={cn(
                            'mt-4 grid gap-3',
                            setupSteps.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
                        )}
                    >
                        {setupSteps.map((step, idx) => (
                            <Link
                                key={step.label}
                                href={step.href}
                                className={cn(
                                    'flex items-center justify-between gap-3 rounded-sm border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                    step.done
                                        ? 'border-success-border bg-success-soft/50 text-success'
                                        : 'border-hairline-soft bg-bone/50 text-ink hover:border-ink/30 hover:bg-bone'
                                )}
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                                            step.done ? 'bg-success text-canvas' : 'bg-ink text-canvas'
                                        )}
                                    >
                                        {step.done ? <Check className="size-3.5" /> : idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">{step.label}</p>
                                        <p className="text-xs text-mute">
                                            {step.done ? 'Sudah diatur' : step.cta}
                                        </p>
                                    </div>
                                </div>
                                {!step.done && (
                                    <ArrowUpRight className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Priority Operational Alerts */}
            {(stats.pending_dp > 0 || (dropoffPipeline?.overdue ?? 0) > 0) && (
                <div className="flex flex-col gap-2 sm:flex-row">
                    {stats.pending_dp > 0 && (
                        <Link
                            href={route('dashboard.bookings', { status: 'all', payment: 'waiting_verification' })}
                            className="flex flex-1 items-center justify-between gap-3 rounded-md border border-warning-border bg-warning-soft/50 px-4 py-3 text-xs font-semibold text-ink transition-colors hover:bg-warning-soft"
                        >
                            <span className="flex items-center gap-2">
                                <Clock className="size-4 shrink-0 text-warning" aria-hidden="true" />
                                <span className="tabular-nums">
                                    {stats.pending_dp} bukti uang muka menunggu verifikasi Anda
                                </span>
                            </span>
                            <span className="shrink-0 text-electric">Periksa →</span>
                        </Link>
                    )}
                    {(dropoffPipeline?.overdue ?? 0) > 0 && (
                        <Link
                            href={route('dashboard.bookings', { status: 'active', sla: 'overdue' })}
                            className="flex flex-1 items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive-soft/80"
                        >
                            <span className="flex items-center gap-2">
                                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                                <span className="tabular-nums">
                                    {dropoffPipeline?.overdue} pesanan melewati target selesai
                                </span>
                            </span>
                            <span className="shrink-0 underline">Lihat Antrean →</span>
                        </Link>
                    )}
                </div>
            )}

            {/* Clickable KPI Cards */}
            <div
                className={cn(
                    'grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4',
                    canSeeRevenue ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
                )}
            >
                <Link
                    href={route(
                        'dashboard.bookings',
                        todayDate
                            ? { status: 'active', date_from: todayDate, date_to: todayDate, sort: 'upcoming' }
                            : { status: 'active' }
                    )}
                    className={kpiCardClass}
                >
                    <div className="flex items-start justify-between gap-1.5 text-mute">
                        <span className="min-w-0 text-xs leading-snug font-semibold">
                            {config.dashboard.todayMetricLabel}
                        </span>
                        <Calendar className="size-4 shrink-0 motion-safe:transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 sm:mt-3">
                        <p className="text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                            {stats.today_bookings}
                        </p>
                        <span className="text-xs font-semibold text-electric">Lihat</span>
                    </div>
                </Link>

                <Link
                    href={route('dashboard.bookings', { status: 'all', payment: 'waiting_verification' })}
                    className={cn(
                        kpiCardClass,
                        stats.pending_dp > 0 && 'border-warning-border bg-warning-soft/30 hover:bg-warning-soft/50'
                    )}
                >
                    <div className="flex items-start justify-between gap-1.5 text-mute">
                        <span className="min-w-0 text-xs leading-snug font-semibold">Perlu Verifikasi Uang Muka</span>
                        <Clock className="size-4 shrink-0" aria-hidden="true" />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 sm:mt-3">
                        <p className="text-2xl font-semibold tabular-nums text-ink sm:text-3xl">{stats.pending_dp}</p>
                        <span className="text-xs font-semibold text-electric">
                            {stats.pending_dp > 0 ? 'Cek Bukti' : 'Lihat'}
                        </span>
                    </div>
                </Link>

                {stats.monthly_revenue !== null && (
                    <Link href={route('dashboard.bookings', { status: 'all' })} className={kpiCardClass}>
                        <div className="flex items-start justify-between gap-1.5 text-mute">
                            <span className="min-w-0 text-xs leading-snug font-semibold">Omzet Terverifikasi (Bln)</span>
                            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 sm:mt-3">
                            <p className="min-w-0 text-lg leading-tight font-semibold break-words tabular-nums text-ink sm:text-2xl">
                                {formatRupiah(stats.monthly_revenue)}
                            </p>
                            <span className="text-xs font-semibold text-electric">Lihat</span>
                        </div>
                    </Link>
                )}

                <Link
                    href={route('dashboard.customers')}
                    className={cn(kpiCardClass, !canSeeRevenue && 'min-[360px]:col-span-2 lg:col-span-1')}
                >
                    <div className="flex items-start justify-between gap-1.5 text-mute">
                        <span className="min-w-0 text-xs leading-snug font-semibold">Total Pelanggan</span>
                        <Users className="size-4 shrink-0" aria-hidden="true" />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 sm:mt-3">
                        <p className="text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                            {stats.total_customers}
                        </p>
                        <span className="text-xs font-semibold text-electric">Direktori</span>
                    </div>
                </Link>
            </div>

            {/* Drop-off Pipeline Summary Bar */}
            {isDropoff && dropoffPipeline && (
                <section aria-label="Antrean produksi drop-off" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Link
                        href={route('dashboard.bookings', { status: 'awaiting_dropoff' })}
                        className="rounded-md border border-hairline-soft bg-canvas p-3.5 transition-colors hover:border-ink/30 hover:bg-bone/40"
                    >
                        <p className="text-xs font-medium text-mute">Menunggu Masuk</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                            {dropoffPipeline.awaiting_dropoff}
                        </p>
                    </Link>
                    <Link
                        href={route('dashboard.bookings', { status: 'in_progress' })}
                        className="rounded-md border border-hairline-soft bg-canvas p-3.5 transition-colors hover:border-ink/30 hover:bg-bone/40"
                    >
                        <p className="text-xs font-medium text-mute">Sedang Dikerjakan</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                            {dropoffPipeline.in_progress}
                        </p>
                    </Link>
                    <Link
                        href={route('dashboard.bookings', { status: 'ready_for_pickup' })}
                        className="rounded-md border border-hairline-soft bg-canvas p-3.5 transition-colors hover:border-ink/30 hover:bg-bone/40"
                    >
                        <p className="text-xs font-medium text-mute">Siap Diambil</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-electric">
                            {dropoffPipeline.ready_for_pickup}
                        </p>
                    </Link>
                    <Link
                        href={route('dashboard.bookings', { status: 'active', sla: 'overdue' })}
                        className={cn(
                            'rounded-md border p-3.5 transition-colors',
                            dropoffPipeline.overdue > 0
                                ? 'border-destructive/30 bg-destructive-soft/50 hover:bg-destructive-soft'
                                : 'border-hairline-soft bg-canvas hover:border-ink/30 hover:bg-bone/40'
                        )}
                    >
                        <p className="text-xs font-medium text-mute">Lewat Tenggat</p>
                        <p
                            className={cn(
                                'mt-1 text-xl font-semibold tabular-nums',
                                dropoffPipeline.overdue > 0 ? 'text-destructive' : 'text-ink'
                            )}
                        >
                            {dropoffPipeline.overdue}
                        </p>
                    </Link>
                </section>
            )}

            {/* 7-Day Trend Chart */}
            {weeklyTrend.length > 0 && (
                <section
                    aria-label="Tren 7 hari terakhir"
                    className="rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-ink">Tren 7 Hari Terakhir</h2>
                            <p className="text-xs tabular-nums text-mute">
                                {trendMetric === 'bookings'
                                    ? `Total ${totalWeeklyBookings} ${bookingsItemLower} dalam 7 hari terakhir`
                                    : `Total omzet terverifikasi ${formatRupiah(totalWeeklyRevenue)} dalam 7 hari terakhir`}
                            </p>
                        </div>

                        {canSeeRevenue && (
                            <div
                                className="inline-flex rounded-full border border-hairline-soft bg-bone p-1"
                                role="group"
                                aria-label="Metrik grafik 7 hari"
                            >
                                <button
                                    type="button"
                                    aria-pressed={trendMetric === 'bookings'}
                                    onClick={() => setTrendMetric('bookings')}
                                    className={cn(
                                        'min-h-9 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                        trendMetric === 'bookings' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                    )}
                                >
                                    {config.bookings.itemSingular}
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={trendMetric === 'revenue'}
                                    onClick={() => setTrendMetric('revenue')}
                                    className={cn(
                                        'min-h-9 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                        trendMetric === 'revenue' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                    )}
                                >
                                    Omzet
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex items-start gap-3">
                        <div
                            aria-hidden="true"
                            className="hidden h-38 shrink-0 flex-col justify-between pt-6 text-right text-xs tabular-nums text-mute sm:flex"
                        >
                            <span className="-translate-y-1/2">
                                {trendMetric === 'bookings'
                                    ? maxTrendValue
                                    : formatCompactCurrency(maxTrendValue)}
                            </span>
                            <span className="-translate-y-1/2">
                                {trendMetric === 'bookings'
                                    ? midTrendValue
                                    : formatCompactCurrency(midTrendValue)}
                            </span>
                            <span className="translate-y-1/2">0</span>
                        </div>

                        <div className="relative min-w-0 flex-1">
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 top-6 flex h-32 flex-col justify-between"
                            >
                                <div className="border-t border-dashed border-divider" />
                                <div className="border-t border-dashed border-divider" />
                                <div className="border-t border-hairline" />
                            </div>

                            <div className="relative grid grid-cols-7 gap-1 sm:gap-3">
                                {weeklyTrend.map((day, idx) => {
                                    const val =
                                        trendMetric === 'bookings' ? day.bookings_count : (day.revenue ?? 0);
                                    const pct =
                                        val > 0 ? Math.max(8, Math.round((val / maxTrendValue) * 100)) : 0;
                                    const formattedVal =
                                        trendMetric === 'bookings'
                                            ? `${day.bookings_count}`
                                            : formatCompactCurrency(day.revenue ?? 0);
                                    const isToday = idx === weeklyTrend.length - 1;

                                    return (
                                        <Link
                                            key={day.date}
                                            href={route('dashboard.bookings', {
                                                status: 'all',
                                                date_from: day.date,
                                                date_to: day.date,
                                            })}
                                            aria-label={`${day.label} ${day.full_label}: ${
                                                trendMetric === 'bookings'
                                                    ? `${day.bookings_count} ${bookingsItemLower}`
                                                    : formatRupiah(day.revenue ?? 0)
                                            }`}
                                            className="group flex min-w-0 flex-col items-center rounded-xl px-1 pt-1 pb-2 transition-colors hover:bg-bone/50 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-2"
                                        >
                                            <span
                                                className={cn(
                                                    'flex h-5 w-full items-center justify-center truncate text-[11px] font-semibold tabular-nums sm:text-xs',
                                                    val > 0 ? 'text-ink' : 'text-transparent'
                                                )}
                                            >
                                                {val > 0 ? formattedVal : '0'}
                                            </span>

                                            <div className="flex h-32 w-full items-end justify-center px-0.5 sm:px-1.5">
                                                {val > 0 ? (
                                                    <div
                                                        className={cn(
                                                            'w-full max-w-10 rounded-t-xs transition-[height,background-color] duration-200',
                                                            isToday
                                                                ? 'bg-electric group-hover:bg-ink'
                                                                : 'bg-ink group-hover:bg-electric'
                                                        )}
                                                        style={{ height: `${pct}%` }}
                                                    />
                                                ) : (
                                                    <div className="h-[2px] w-full max-w-10 rounded-full bg-hairline transition-colors group-hover:bg-mute" />
                                                )}
                                            </div>

                                            <div className="mt-2.5 text-center">
                                                <p
                                                    className={cn(
                                                        'text-xs font-semibold',
                                                        isToday ? 'text-electric' : 'text-ink'
                                                    )}
                                                >
                                                    {day.label}
                                                </p>
                                                <p className="hidden text-xs tabular-nums text-mute sm:block">
                                                    {day.full_label}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                {/* Operational Schedule / Recent Bookings */}
                <div className="min-w-0 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div
                            className="inline-flex rounded-full border border-hairline-soft bg-bone p-1"
                            role="group"
                            aria-label="Daftar ringkasan operasional"
                        >
                            <button
                                type="button"
                                aria-pressed={bookingListTab === 'schedule'}
                                onClick={() => setBookingListTab('schedule')}
                                className={cn(
                                    'min-h-8 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors',
                                    bookingListTab === 'schedule' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                {isDropoff ? 'Antrean' : 'Hari Ini'}
                                {todaySchedule.length > 0 ? ` (${todaySchedule.length})` : ''}
                            </button>
                            <button
                                type="button"
                                aria-pressed={bookingListTab === 'recent'}
                                onClick={() => setBookingListTab('recent')}
                                className={cn(
                                    'min-h-8 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors',
                                    bookingListTab === 'recent' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                Terbaru
                            </button>
                        </div>

                        <Link
                            href={route('dashboard.bookings', { status: 'active' })}
                            className="inline-flex min-h-9 shrink-0 items-center rounded-sm text-sm font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            Lihat Semua
                        </Link>
                    </div>

                    {activeBookingList.length === 0 ? (
                        <p className="rounded-sm bg-bone p-6 text-center text-sm text-mute">
                            {bookingListTab === 'schedule'
                                ? isDropoff
                                    ? 'Tidak ada pesanan drop-off yang sedang aktif.'
                                    : `Belum ada ${bookingsItemLower} aktif untuk hari ini.`
                                : config.dashboard.emptyRecentText}
                        </p>
                    ) : (
                        <div className="divide-y divide-divider">
                            {activeBookingList.map((b) => {
                                const isOverdue =
                                    b.booking_mode === 'dropoff' &&
                                    Boolean(b.estimated_ready_date) &&
                                    b.estimated_ready_date! < todayStr &&
                                    b.work_status !== 'ready_for_pickup' &&
                                    b.work_status !== 'picked_up';

                                return (
                                    <Link
                                        key={b.id}
                                        href={route('dashboard.bookings', { status: 'all', search: b.booking_code })}
                                        className="block rounded-xl px-2 py-3.5 transition-colors hover:bg-bone/60 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                    >
                                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
                                            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                                <p className="truncate text-sm font-semibold text-ink">
                                                    {b.customer_name}
                                                </p>
                                                <p className="mt-0.5 font-mono text-xs tabular-nums text-mute">
                                                    {b.booking_code}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                                                {isOverdue && <Badge variant="danger">Lewat Tenggat</Badge>}
                                                {statusBadge(b)}
                                                {paymentBadge(b.payment_status)}
                                            </div>
                                        </div>
                                        <p className="mt-1 line-clamp-1 text-xs text-mute">
                                            {b.service_name}
                                            {b.booking_mode === 'dropoff' && (b.quantity ?? 1) > 1
                                                ? ` (${b.quantity} ${b.unit_label ?? 'item'})`
                                                : ''}{' '}
                                            · {formatDateIndo(b.booking_date)} (
                                            {b.booking_mode === 'dropoff'
                                                ? b.estimated_ready_date
                                                    ? `Target ${formatDateShortIndo(b.estimated_ready_date)}`
                                                    : b.fulfillment_type === 'pickup'
                                                      ? 'Jemput-Antar'
                                                      : 'Drop-off'
                                                : b.start_time_local}
                                            )
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Services */}
                <div className="min-w-0 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <h2 className="mb-4 text-lg font-semibold text-ink">{config.services.pageTitle} Terpopuler</h2>
                    {topServices.length === 0 ? (
                        <p className="rounded-sm bg-bone p-6 text-center text-sm text-mute">
                            Belum ada {config.services.pageTitle.toLowerCase()}.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {topServices.map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-3 rounded-sm bg-bone p-4"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                                        <p className="text-xs tabular-nums text-mute">{formatRupiah(s.price)}</p>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                                        {s.bookings_count} {bookingsItemLower}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
