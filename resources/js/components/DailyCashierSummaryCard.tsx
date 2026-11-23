import { Link } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Download, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { formatDateShortIndo, formatRupiah, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DailyCashierSummary, PaymentMethod } from '@/types';

interface DailyCashierSummaryCardProps {
    initialSummary: DailyCashierSummary;
    canOpenBilling?: boolean;
}

const METHOD_ORDER: PaymentMethod[] = ['cash', 'qris', 'transfer', 'edc'];

export function DailyCashierSummaryCard({
    initialSummary,
    canOpenBilling = false,
}: DailyCashierSummaryCardProps) {
    const [summary, setSummary] = useState<DailyCashierSummary>(initialSummary);
    const [selectedDate, setSelectedDate] = useState<string>(initialSummary.date);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [retryNonce, setRetryNonce] = useState(0);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (selectedDate === initialSummary.date) {
            setSummary(initialSummary);
            setFetchError('');
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setFetchError('');
        fetch(`${route('dashboard.cashier.summary')}?date=${encodeURIComponent(selectedDate)}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
            })
            .then((data: DailyCashierSummary | null) => {
                if (!controller.signal.aborted && data) {
                    setSummary(data);
                    setFetchError('');
                }
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                if (!controller.signal.aborted) {
                    setFetchError('Gagal memuat ringkasan kasir untuk tanggal yang dipilih.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [initialSummary, retryNonce, selectedDate]);

    const cashierExportUrl = `${route('dashboard.cashier.export')}?date=${encodeURIComponent(summary.date)}`;

    return (
        <section
            aria-labelledby="daily-cashier-summary-heading"
            className="rounded-md bg-bone p-4 sm:p-5"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                            <Wallet className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2
                                    id="daily-cashier-summary-heading"
                                    className="text-base font-semibold text-ink"
                                >
                                    Ringkasan Kasir Harian
                                </h2>
                                <Badge variant="outline" className="border-hairline bg-canvas text-ink tabular-nums">
                                    {summary.transactions_count} transaksi
                                </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-mute">
                                {formatDateShortIndo(summary.date)} · Bersih{' '}
                                <span className="font-semibold whitespace-nowrap tabular-nums text-ink">
                                    {formatRupiah(summary.net_collected)}
                                </span>
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Ciutkan ringkasan kasir' : 'Tampilkan ringkasan kasir'}
                        onClick={() => setExpanded((prev) => !prev)}
                        className="size-11 sm:hidden"
                    >
                        {expanded ? (
                            <ChevronUp className="size-4" aria-hidden="true" />
                        ) : (
                            <ChevronDown className="size-4" aria-hidden="true" />
                        )}
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full min-w-0 min-[360px]:w-auto min-[360px]:flex-1 sm:w-44 sm:flex-initial">
                        <Label htmlFor="cashier-summary-date" className="sr-only">
                            Tanggal ringkasan kasir
                        </Label>
                        <DatePicker
                            id="cashier-summary-date"
                            value={selectedDate}
                            onChange={(val) => {
                                if (val) {
                                    setSelectedDate(val);
                                }
                            }}
                            dialogTitle="Tanggal Ringkasan Kasir"
                            className="h-10 bg-canvas text-sm md:text-xs"
                        />
                    </div>

                    {summary.can_export_csv ? (
                        <Button asChild variant="outline" size="sm" className="h-10 bg-canvas px-3.5 text-xs">
                            <a href={cashierExportUrl}>
                                <Download className="size-3.5" aria-hidden="true" />
                                <span>Export Kasir</span>
                            </a>
                        </Button>
                    ) : canOpenBilling ? (
                        <Button asChild variant="outline" size="sm" className="h-10 bg-canvas px-3.5 text-xs text-mute">
                            <Link href={route('dashboard.billing')}>
                                <Download className="size-3.5" aria-hidden="true" />
                                <span>Export Kasir (Pro)</span>
                            </Link>
                        </Button>
                    ) : null}

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Ciutkan ringkasan kasir' : 'Tampilkan ringkasan kasir'}
                        onClick={() => setExpanded((prev) => !prev)}
                        className="hidden sm:inline-flex"
                    >
                        {expanded ? (
                            <ChevronUp className="size-4" aria-hidden="true" />
                        ) : (
                            <ChevronDown className="size-4" aria-hidden="true" />
                        )}
                    </Button>
                </div>
            </div>

            {expanded && (
                <div className={cn('mt-4 space-y-3 transition-opacity', loading && 'opacity-60')}>
                    {fetchError && (
                        <div
                            role="alert"
                            className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-destructive/30 bg-destructive-soft px-3.5 py-2.5 text-xs text-destructive"
                        >
                            <span>{fetchError}</span>
                            <button
                                type="button"
                                onClick={() => setRetryNonce((n) => n + 1)}
                                className="cursor-pointer font-semibold underline underline-offset-2"
                            >
                                Coba lagi
                            </button>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        <div className="col-span-2 rounded-sm border border-hairline-soft bg-canvas p-3 sm:col-span-1 sm:p-3.5">
                            <p className="text-xs font-medium text-mute">Pemasukan Bersih</p>
                            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                                {formatRupiah(summary.net_collected)}
                            </p>
                        </div>
                        <div className="rounded-sm border border-hairline-soft bg-canvas p-3 sm:p-3.5">
                            <p className="text-xs font-medium text-mute">Total Masuk</p>
                            <p className="mt-1 text-base font-semibold tabular-nums text-ink sm:text-lg">
                                {formatRupiah(summary.total_collected)}
                            </p>
                        </div>
                        <div className="rounded-sm border border-hairline-soft bg-canvas p-3 sm:p-3.5">
                            <p className="text-xs font-medium text-mute">Pengembalian</p>
                            <p className="mt-1 text-base font-semibold tabular-nums text-ink sm:text-lg">
                                {formatRupiah(summary.total_refunds)}
                            </p>
                        </div>
                    </div>

                    {summary.can_view_breakdown ? (
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                            {METHOD_ORDER.map((methodKey) => {
                                const entry = summary.by_method?.[methodKey] ?? { amount: 0, count: 0 };
                                return (
                                    <div
                                        key={methodKey}
                                        className="flex flex-col justify-between rounded-xl border border-hairline-soft bg-canvas px-3 py-2.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-medium text-mute">
                                                {PAYMENT_METHOD_LABELS[methodKey]}
                                            </span>
                                            <span className="font-mono text-[11px] tabular-nums text-ash">
                                                {entry.count}x
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                                            {formatRupiah(entry.amount)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline-soft bg-canvas px-3.5 py-2.5 text-xs text-mute">
                            <span>
                                Rincian per metode pembayaran (Tunai, QRIS, Transfer, EDC) tersedia pada paket Professional &amp; Enterprise.
                            </span>
                            {canOpenBilling && (
                                <Link
                                    href={route('dashboard.billing')}
                                    className="font-semibold text-electric hover:underline"
                                >
                                    Lihat Paket
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
