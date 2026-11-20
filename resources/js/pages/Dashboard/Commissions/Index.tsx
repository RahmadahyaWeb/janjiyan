import { Head, Link, router } from '@inertiajs/react';
import { BadgePercent, Calendar, Download, Settings2, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import DashboardLayout from '@/layouts/DashboardLayout';

interface CommissionRow {
    staff_id: number;
    staff_name: string;
    staff_title: string | null;
    is_active: boolean;
    commission_type: 'none' | 'percentage' | 'fixed';
    commission_value: number;
    bookings_count: number;
    gross_revenue: number;
    total_commission: number;
    average_order_value: number;
}

interface CommissionReport {
    summary: {
        total_bookings: number;
        total_revenue: number;
        total_commission: number;
        active_staff_count: number;
    };
    rows: CommissionRow[];
}

interface CommissionsPageProps {
    report: CommissionReport;
    filters: {
        date_from: string;
        date_to: string;
        include_confirmed: boolean;
    };
    canExportCsv: boolean;
    canManageStaff: boolean;
}

const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);

function toDateInputString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function CommissionsIndex({
    report,
    filters,
    canExportCsv,
    canManageStaff,
}: CommissionsPageProps) {
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const [includeConfirmed, setIncludeConfirmed] = useState(filters.include_confirmed);

    const applyFilters = (next: {
        date_from?: string;
        date_to?: string;
        include_confirmed?: boolean;
    }) => {
        const params = {
            date_from: next.date_from ?? dateFrom,
            date_to: next.date_to ?? dateTo,
            include_confirmed: (next.include_confirmed ?? includeConfirmed) ? '1' : '0',
        };
        router.get(route('dashboard.commissions'), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const applyPreset = (preset: 'this_month' | 'last_month' | 'last_7_days') => {
        const now = new Date();
        let start: Date;
        let end: Date;

        if (preset === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (preset === 'last_month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else {
            end = now;
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        }

        const fromStr = toDateInputString(start);
        const toStr = toDateInputString(end);
        setDateFrom(fromStr);
        setDateTo(toStr);
        applyFilters({ date_from: fromStr, date_to: toStr });
    };

    const exportUrl = route('dashboard.commissions.export', {
        date_from: dateFrom,
        date_to: dateTo,
        include_confirmed: includeConfirmed ? '1' : '0',
    });

    return (
        <DashboardLayout title="Komisi Staff">
            <Head title="Laporan Komisi Staff" />

            <div className="space-y-6">
                {/* Header & Export */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-ink">
                            Laporan Komisi &amp; Performa Staff
                        </h2>
                        <p className="mt-1 text-sm text-mute">
                            Rekap otomatis jumlah layanan, omzet, dan komisi yang harus dibayarkan per staff.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canManageStaff && (
                            <Button asChild variant="secondary" size="sm" className="rounded-full">
                                <Link href={route('dashboard.staff')}>
                                    <Settings2 className="mr-1.5 size-4" aria-hidden="true" />
                                    Atur Tarif Komisi
                                </Link>
                            </Button>
                        )}
                        {canManageStaff && (
                            canExportCsv ? (
                                <Button asChild size="sm" className="rounded-full">
                                    <a href={exportUrl}>
                                        <Download className="mr-1.5 size-4" aria-hidden="true" />
                                        Export CSV
                                    </a>
                                </Button>
                            ) : (
                                <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full text-mute"
                                >
                                    <Link
                                        href={route('dashboard.billing')}
                                        title="Export CSV tersedia pada paket Professional & Enterprise"
                                        aria-label="Export CSV tersedia pada paket Professional, buka Paket & Billing"
                                    >
                                        <Download className="mr-1.5 size-4" aria-hidden="true" />
                                        Export CSV (Pro)
                                    </Link>
                                </Button>
                            )
                        )}
                    </div>
                </div>

                {/* Filters Card */}
                <Card className="rounded-[20px] border-hairline-soft shadow-none">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="min-w-0 flex-1 sm:flex-initial">
                                    <Label htmlFor="comm-date-from" className="text-xs text-mute">
                                        Dari Tanggal
                                    </Label>
                                    <Input
                                        id="comm-date-from"
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="mt-1 h-9 w-full rounded-full sm:w-40"
                                    />
                                </div>
                                <div className="min-w-0 flex-1 sm:flex-initial">
                                    <Label htmlFor="comm-date-to" className="text-xs text-mute">
                                        Sampai Tanggal
                                    </Label>
                                    <Input
                                        id="comm-date-to"
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="mt-1 h-9 w-full rounded-full sm:w-40"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => applyFilters({})}
                                    className="h-9 rounded-full px-4"
                                >
                                    Terapkan
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => applyPreset('this_month')}
                                    className="h-8 rounded-full text-xs"
                                >
                                    Bulan Ini
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => applyPreset('last_month')}
                                    className="h-8 rounded-full text-xs"
                                >
                                    Bulan Lalu
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => applyPreset('last_7_days')}
                                    className="h-8 rounded-full text-xs"
                                >
                                    7 Hari Terakhir
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 flex items-start gap-2.5 border-t border-divider pt-3 sm:items-center">
                            <Switch
                                id="include-confirmed"
                                className="mt-0.5 shrink-0 sm:mt-0"
                                checked={includeConfirmed}
                                onCheckedChange={(checked) => {
                                    setIncludeConfirmed(checked);
                                    applyFilters({ include_confirmed: checked });
                                }}
                            />
                            <Label
                                htmlFor="include-confirmed"
                                className="block min-w-0 cursor-pointer text-xs leading-relaxed text-mute"
                            >
                                Sertakan reservasi berstatus <strong className="text-ink">Confirmed</strong> (proyeksi komisi berjalan; default hanya menghitung reservasi <strong className="text-ink">Completed</strong>).
                            </Label>
                        </div>
                    </CardContent>
                </Card>

                {/* KPI Summary Cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="rounded-[20px] border-hairline-soft shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-mute uppercase">
                                Reservasi Terhitung
                            </CardTitle>
                            <Calendar className="size-4 text-mute" aria-hidden="true" />
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-semibold text-ink tabular-nums">
                                {report.summary.total_bookings}
                            </div>
                            <p className="mt-1 text-xs text-mute">
                                Dari {report.summary.active_staff_count} staff aktif
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[20px] border-hairline-soft shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-mute uppercase">
                                Total Omzet Staff
                            </CardTitle>
                            <TrendingUp className="size-4 text-mute" aria-hidden="true" />
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-semibold text-ink tabular-nums">
                                {formatRupiah(report.summary.total_revenue)}
                            </div>
                            <p className="mt-1 text-xs text-mute">
                                Periode {filters.date_from} s/d {filters.date_to}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[20px] border-hairline-soft bg-bone/50 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-mute uppercase">
                                Total Komisi Dibayarkan
                            </CardTitle>
                            <BadgePercent className="size-4 text-ink" aria-hidden="true" />
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-semibold text-ink tabular-nums">
                                {formatRupiah(report.summary.total_commission)}
                            </div>
                            <p className="mt-1 text-xs text-mute">
                                Dihitung otomatis dari tarif komisi saat reservasi dibuat
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Per-Staff Breakdown Table */}
                <Card className="overflow-hidden rounded-[20px] border-hairline-soft shadow-none">
                    <CardHeader className="border-b border-divider">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-ink">
                            <Users className="size-4 text-mute" aria-hidden="true" />
                            Rincian per Staff
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {report.rows.length === 0 ? (
                            <div className="p-10 text-center">
                                <p className="text-sm font-medium text-ink">Belum ada data staff.</p>
                                <p className="mt-1 text-xs text-mute">
                                    Tambahkan staff terlebih dahulu dan atur tarif komisinya di menu Tim & Staff.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Commission Cards (< md) */}
                                <div className="divide-y divide-divider md:hidden">
                                    {report.rows.map((row) => (
                                        <div key={row.staff_id} className="space-y-3 p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold text-ink">{row.staff_name}</p>
                                                        {!row.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                                                    </div>
                                                    {row.staff_title && (
                                                        <p className="text-xs text-mute">{row.staff_title}</p>
                                                    )}
                                                </div>
                                                {row.commission_type === 'percentage' ? (
                                                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                                                        {row.commission_value}%
                                                    </Badge>
                                                ) : row.commission_type === 'fixed' ? (
                                                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                                                        {formatRupiah(row.commission_value)} / sesi
                                                    </Badge>
                                                ) : (
                                                    <span className="shrink-0 text-xs text-mute">Belum diatur</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-bone p-3 text-xs">
                                                <div>
                                                    <span className="text-mute">Reservasi</span>
                                                    <p className="font-mono font-semibold tabular-nums text-ink">
                                                        {row.bookings_count}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-mute">Total Omzet</span>
                                                    <p className="font-mono font-semibold tabular-nums text-ink">
                                                        {formatRupiah(row.gross_revenue)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-mute">Rata-rata</span>
                                                    <p className="font-mono tabular-nums text-mute">
                                                        {formatRupiah(row.average_order_value)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-mute">Total Komisi</span>
                                                    <p className="font-mono font-semibold tabular-nums text-ink">
                                                        {formatRupiah(row.total_commission)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table (md+) */}
                                <div className="hidden overflow-x-auto md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-divider hover:bg-transparent">
                                                <TableHead>Staff</TableHead>
                                                <TableHead>Skema Komisi</TableHead>
                                                <TableHead className="text-right">Reservasi</TableHead>
                                                <TableHead className="text-right">Total Omzet</TableHead>
                                                <TableHead className="text-right">Rata-rata</TableHead>
                                                <TableHead className="text-right">Total Komisi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {report.rows.map((row) => (
                                                <TableRow key={row.staff_id} className="border-divider">
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div>
                                                                <div className="font-medium text-ink">
                                                                    {row.staff_name}
                                                                </div>
                                                                {row.staff_title && (
                                                                    <div className="text-xs text-mute">
                                                                        {row.staff_title}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {!row.is_active && (
                                                                <Badge variant="secondary">
                                                                    Nonaktif
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.commission_type === 'percentage' ? (
                                                            <Badge variant="secondary" className="font-mono text-xs">
                                                                {row.commission_value}%
                                                            </Badge>
                                                        ) : row.commission_type === 'fixed' ? (
                                                            <Badge variant="secondary" className="font-mono text-xs">
                                                                {formatRupiah(row.commission_value)} / sesi
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-mute">Belum diatur</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm tabular-nums">
                                                        {row.bookings_count}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm tabular-nums">
                                                        {formatRupiah(row.gross_revenue)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm text-mute tabular-nums">
                                                        {formatRupiah(row.average_order_value)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm font-semibold text-ink tabular-nums">
                                                        {formatRupiah(row.total_commission)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
