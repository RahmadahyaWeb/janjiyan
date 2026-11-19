import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, Calendar, Check, CheckCircle2, Clock, Copy, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import { formatDateIndo, formatRupiah, RESERVATION_STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

interface TrendPoint {
    date: string;
    label: string;
    full_label: string;
    bookings_count: number;
    revenue: number;
}

interface DashboardIndexProps {
    stats: {
        today_bookings: number;
        pending_dp: number;
        monthly_revenue: number;
        total_customers: number;
    };
    todayDate?: string;
    onboarding?: {
        has_services: boolean;
        has_staff: boolean;
        has_payment_info: boolean;
        has_bookings: boolean;
    };
    weeklyTrend?: TrendPoint[];
    recentBookings: Array<{
        id: number;
        booking_code: string;
        customer_name: string;
        customer_phone: string;
        service_name: string;
        staff_name: string | null;
        booking_date: string;
        start_time_local: string;
        total_price: number;
        dp_amount: number;
        reservation_status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
        payment_status: 'unpaid' | 'waiting_verification' | 'dp_verified' | 'settled';
    }>;
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
    topServices,
}: DashboardIndexProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const [copied, setCopied] = useState(false);
    const [trendMetric, setTrendMetric] = useState<'bookings' | 'revenue'>('bookings');

    const publicUrl = activeBusiness
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${activeBusiness.slug}`
        : '';

    const copyLink = () => {
        if (!publicUrl) return;
        navigator.clipboard?.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusBadge = (status: string) => {
        const label = RESERVATION_STATUS_LABELS[status] ?? status;
        if (status === 'confirmed' || status === 'completed') return <Badge variant="success">{label}</Badge>;
        if (status === 'cancelled') return <Badge variant="danger">{label}</Badge>;
        return <Badge variant="warning">{label}</Badge>;
    };

    const setupSteps = onboarding
        ? [
              {
                  done: onboarding.has_services,
                  label: 'Tambahkan minimal 1 layanan',
                  href: route('dashboard.services'),
                  cta: 'Atur Layanan',
              },
              {
                  done: onboarding.has_staff,
                  label: 'Tambahkan anggota tim / staff',
                  href: route('dashboard.staff'),
                  cta: 'Atur Staff',
              },
              {
                  done: onboarding.has_payment_info,
                  label: 'Lengkapi rekening bank atau QRIS untuk DP',
                  href: route('dashboard.settings'),
                  cta: 'Atur Pembayaran',
              },
          ]
        : [];

    const completedSteps = setupSteps.filter((s) => s.done).length;
    const showOnboarding = setupSteps.length > 0 && completedSteps < setupSteps.length;

    const maxTrendValue = Math.max(
        1,
        ...weeklyTrend.map((d) => (trendMetric === 'bookings' ? d.bookings_count : d.revenue))
    );
    const midTrendValue = Math.round(maxTrendValue / 2);
    const totalWeeklyBookings = weeklyTrend.reduce((acc, d) => acc + d.bookings_count, 0);
    const totalWeeklyRevenue = weeklyTrend.reduce((acc, d) => acc + d.revenue, 0);

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
        'group flex flex-col justify-between rounded-[24px] border border-hairline-soft bg-canvas p-5 transition-colors hover:border-ink/30 hover:bg-bone/40 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none';

    return (
        <DashboardLayout title="Ringkasan Bisnis">
            <Head title="Dashboard" />

            {/* Public Link Share Banner */}
            {activeBusiness && (
                <div className="flex flex-col justify-between gap-4 rounded-[24px] bg-bone p-5 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-mute">Link Booking Publik Anda</p>
                        <p className="mt-0.5 truncate font-mono text-sm font-semibold text-ink">
                            /b/{activeBusiness.slug}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                            {copied ? (
                                <Check className="size-3.5 text-success" aria-hidden="true" />
                            ) : (
                                <Copy className="size-3.5" aria-hidden="true" />
                            )}
                            {copied ? 'Tersalin' : 'Salin Link'}
                        </Button>
                        <Button asChild size="sm">
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
                    className="rounded-[24px] border border-hairline-soft bg-canvas p-6"
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

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {setupSteps.map((step, idx) => (
                            <Link
                                key={step.label}
                                href={step.href}
                                className={cn(
                                    'flex items-center justify-between gap-3 rounded-[16px] border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
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

            {/* Clickable KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                    href={route(
                        'dashboard.bookings',
                        todayDate ? { status: 'all', date_from: todayDate, date_to: todayDate } : { status: 'all' }
                    )}
                    className={kpiCardClass}
                >
                    <div className="flex items-center justify-between text-mute">
                        <span className="text-xs font-semibold">Reservasi Hari Ini</span>
                        <Calendar className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
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
                    <div className="flex items-center justify-between text-mute">
                        <span className="text-xs font-semibold">Perlu Verifikasi DP</span>
                        <Clock className="size-4" aria-hidden="true" />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="text-2xl font-semibold tabular-nums text-ink sm:text-3xl">{stats.pending_dp}</p>
                        <span className="text-xs font-semibold text-electric">
                            {stats.pending_dp > 0 ? 'Tindak lanjuti' : 'Lihat'}
                        </span>
                    </div>
                </Link>

                <Link href={route('dashboard.bookings', { status: 'all' })} className={kpiCardClass}>
                    <div className="flex items-center justify-between text-mute">
                        <span className="text-xs font-semibold">Omzet Terverifikasi (Bln)</span>
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                            {formatRupiah(stats.monthly_revenue)}
                        </p>
                    </div>
                </Link>

                <Link href={route('dashboard.customers')} className={kpiCardClass}>
                    <div className="flex items-center justify-between text-mute">
                        <span className="text-xs font-semibold">Total Pelanggan</span>
                        <Users className="size-4" aria-hidden="true" />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                            {stats.total_customers}
                        </p>
                        <span className="text-xs font-semibold text-electric">Direktori</span>
                    </div>
                </Link>
            </div>

            {/* 7-Day Trend Chart */}
            {weeklyTrend.length > 0 && (
                <section
                    aria-label="Tren 7 hari terakhir"
                    className="rounded-[24px] border border-hairline-soft bg-canvas p-6"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-ink">Tren 7 Hari Terakhir</h2>
                            <p className="text-xs tabular-nums text-mute">
                                {trendMetric === 'bookings'
                                    ? `Total ${totalWeeklyBookings} reservasi dalam 7 hari terakhir`
                                    : `Total omzet terverifikasi ${formatRupiah(totalWeeklyRevenue)} dalam 7 hari terakhir`}
                            </p>
                        </div>

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
                                    'cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                    trendMetric === 'bookings' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                Reservasi
                            </button>
                            <button
                                type="button"
                                aria-pressed={trendMetric === 'revenue'}
                                onClick={() => setTrendMetric('revenue')}
                                className={cn(
                                    'cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                    trendMetric === 'revenue' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                Omzet
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 flex items-start gap-3">
                        {/* Y-axis scale aligned to the h-32 bar plot */}
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

                        {/* Plot area with reference gridlines and crisp bars */}
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
                                        trendMetric === 'bookings' ? day.bookings_count : day.revenue;
                                    const pct =
                                        val > 0 ? Math.max(8, Math.round((val / maxTrendValue) * 100)) : 0;
                                    const formattedVal =
                                        trendMetric === 'bookings'
                                            ? `${day.bookings_count}`
                                            : formatCompactCurrency(day.revenue);
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
                                                    ? `${day.bookings_count} reservasi`
                                                    : formatRupiah(day.revenue)
                                            }`}
                                            className="group flex min-w-0 flex-col items-center rounded-[14px] px-1 pt-1 pb-2 transition-colors hover:bg-bone/50 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-2"
                                        >
                                            <span
                                                className={cn(
                                                    'flex h-5 w-full items-center justify-center truncate text-xs font-semibold tabular-nums',
                                                    val > 0 ? 'text-ink' : 'text-transparent'
                                                )}
                                            >
                                                {val > 0 ? formattedVal : '0'}
                                            </span>

                                            <div className="flex h-32 w-full items-end justify-center px-0.5 sm:px-1.5">
                                                {val > 0 ? (
                                                    <div
                                                        className={cn(
                                                            'w-full max-w-10 rounded-t-[8px] transition-[height,background-color] duration-200',
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

            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                {/* Recent Bookings */}
                <div className="min-w-0 rounded-[24px] border border-hairline-soft bg-canvas p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-ink">Reservasi Terbaru</h2>
                        <Link
                            href={route('dashboard.bookings', { status: 'all' })}
                            className="inline-flex min-h-7 items-center rounded-sm text-sm font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            Lihat Semua
                        </Link>
                    </div>

                    {recentBookings.length === 0 ? (
                        <p className="rounded-[16px] bg-bone p-6 text-center text-sm text-mute">
                            Belum ada reservasi masuk. Bagikan link booking Anda!
                        </p>
                    ) : (
                        <div className="divide-y divide-divider">
                            {recentBookings.map((b) => (
                                <Link
                                    key={b.id}
                                    href={route('dashboard.bookings', { status: 'all', search: b.booking_code })}
                                    className="flex items-center justify-between gap-4 rounded-[12px] px-2 py-3.5 transition-colors hover:bg-bone/60 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-ink">
                                            {b.customer_name}{' '}
                                            <span className="font-mono text-xs font-normal text-mute">
                                                · {b.booking_code}
                                            </span>
                                        </p>
                                        <p className="truncate text-xs text-mute">
                                            {b.service_name} · {formatDateIndo(b.booking_date)} ({b.start_time_local})
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {statusBadge(b.reservation_status)}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Services */}
                <div className="min-w-0 rounded-[24px] border border-hairline-soft bg-canvas p-6">
                    <h2 className="mb-4 text-lg font-semibold text-ink">Layanan Terpopuler</h2>
                    {topServices.length === 0 ? (
                        <p className="rounded-[16px] bg-bone p-6 text-center text-sm text-mute">
                            Belum ada layanan.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {topServices.map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-3 rounded-[16px] bg-bone p-4"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                                        <p className="text-xs tabular-nums text-mute">{formatRupiah(s.price)}</p>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                                        {s.bookings_count} reservasi
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
