import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, FileText, Search } from 'lucide-react';
import { FormEvent } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateIndo, formatRupiah, PAYMENT_STATUS_LABELS, RESERVATION_STATUS_LABELS, WORK_STATUS_LABELS } from '@/lib/format';

interface HistoryItem {
    invoice_number: string | null;
    invoice_token: string | null;
    booking_code: string;
    service_name: string;
    staff_name: string | null;
    booking_date: string;
    start_time_local: string;
    booking_mode?: 'time_slot' | 'dropoff';
    quantity?: number;
    fulfillment_type?: 'dropoff' | 'pickup';
    work_status?: string | null;
    schedule_label?: string;
    total_price: number;
    dp_amount: number;
    reservation_status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    payment_status: 'unpaid' | 'waiting_verification' | 'dp_verified' | 'settled';
}

interface InvoiceLookupProps {
    business: {
        name: string;
        slug: string;
        logo_url: string | null;
    };
    customerName?: string | null;
    matchedInvoiceToken: string | null;
    history: HistoryItem[] | null;
}

export default function InvoiceLookup({
    business,
    customerName,
    matchedInvoiceToken,
    history,
}: InvoiceLookupProps) {
    const form = useForm({
        invoice_number: '',
        phone_last4: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('public.booking.invoices.lookup', business.slug), {
            preserveScroll: true,
        });
    };

    return (
        <div className="min-h-screen bg-canvas px-4 py-10 text-ink sm:px-6">
            <Head title={`Cek Invoice & Riwayat — ${business.name}`} />

            <main className="mx-auto max-w-xl space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <Link
                        href={route('public.booking', business.slug)}
                        className="inline-flex min-h-8 items-center text-sm font-semibold text-mute hover:text-ink"
                    >
                        ← Kembali ke {business.name}
                    </Link>
                </div>

                <div className="rounded-md border border-hairline-soft bg-canvas p-6 sm:p-8">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bone text-ink">
                            <FileText className="size-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-ink sm:text-2xl">Cek Invoice & Riwayat</h1>
                            <p className="text-sm text-mute">{business.name}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="lookup-invoice-number">Nomor Invoice atau Kode Booking</Label>
                            <Input
                                id="lookup-invoice-number"
                                placeholder="Contoh: INV-20261119-XXXXXX"
                                value={form.data.invoice_number}
                                onChange={(e) => form.setData('invoice_number', e.target.value)}
                                required
                            />
                            {form.errors.invoice_number && (
                                <p role="alert" className="text-xs font-medium text-destructive">
                                    {form.errors.invoice_number}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="lookup-phone-last4">4 Digit Terakhir Nomor WhatsApp</Label>
                            <Input
                                id="lookup-phone-last4"
                                inputMode="numeric"
                                maxLength={4}
                                placeholder="Contoh: 7890"
                                value={form.data.phone_last4}
                                onChange={(e) => form.setData('phone_last4', e.target.value.replace(/\D+/g, '').slice(0, 4))}
                                required
                            />
                            {form.errors.phone_last4 && (
                                <p role="alert" className="text-xs font-medium text-destructive">
                                    {form.errors.phone_last4}
                                </p>
                            )}
                        </div>

                        <Button type="submit" className="w-full" disabled={form.processing}>
                            <Search className="size-4" aria-hidden="true" />
                            {form.processing ? 'Mencari…' : 'Cari Invoice & Riwayat'}
                        </Button>
                    </form>
                </div>

                {history && (
                    <section aria-label="Riwayat invoice pelanggan" className="space-y-3 rounded-md bg-bone p-4 sm:p-6">
                        <div>
                            <h2 className="text-lg font-semibold text-ink">
                                Riwayat Pemesanan {customerName ? `· ${customerName}` : ''}
                            </h2>
                            <p className="text-xs text-mute">
                                Ditemukan {history.length} transaksi pada {business.name}.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {history.map((item) => {
                                const isMatched = matchedInvoiceToken && item.invoice_token === matchedInvoiceToken;
                                const href = item.invoice_token
                                    ? route('public.booking.invoice', { slug: business.slug, token: item.invoice_token })
                                    : route('public.booking.status', { slug: business.slug, code: item.booking_code });

                                return (
                                    <div
                                        key={item.booking_code}
                                        className="flex flex-col justify-between gap-3 rounded-md bg-canvas p-4 sm:flex-row sm:items-center"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-ink">
                                                    {item.invoice_number || item.booking_code}
                                                </span>
                                                {isMatched && <Badge variant="popular">Dicari</Badge>}
                                                <Badge variant="secondary">
                                                    {item.booking_mode === 'dropoff' && item.work_status
                                                        ? (WORK_STATUS_LABELS[item.work_status] ?? item.work_status)
                                                        : (RESERVATION_STATUS_LABELS[item.reservation_status] ?? item.reservation_status)}
                                                </Badge>
                                                <Badge variant="outline">
                                                    {PAYMENT_STATUS_LABELS[item.payment_status] ?? item.payment_status}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-semibold text-ink">
                                                {item.service_name}
                                                {item.booking_mode === 'dropoff' && (item.quantity ?? 1) > 1 ? ` (${item.quantity} item)` : ''}
                                            </p>
                                            <p className="text-xs text-mute">
                                                {formatDateIndo(item.booking_date)} · {item.schedule_label ?? item.start_time_local} · {formatRupiah(item.total_price)}
                                            </p>
                                        </div>

                                        <Button asChild size="sm" variant={isMatched ? 'default' : 'outline'}>
                                            <Link href={href}>
                                                Lihat Invoice
                                                <ArrowRight className="size-3.5" aria-hidden="true" />
                                            </Link>
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                <p className="text-center text-xs text-ash">
                    <span className="inline-flex items-center gap-1.5">
                        Ditenagai oleh <JanjiyanLogo size="sm" />
                    </span>
                </p>
            </main>
        </div>
    );
}
