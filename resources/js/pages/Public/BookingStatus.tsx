import { Head, Link, router, usePage } from '@inertiajs/react';
import { CalendarPlus, CheckCircle2, Clock, Download, FileText, MessageCircle, PackageCheck, Printer, Sparkles, Truck, Upload, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { BusinessHeader, headerActionClass } from '@/components/BusinessHeader';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveBusinessType } from '@/lib/businessType';
import {
    buildWhatsAppUrl,
    formatBookingScheduleShort,
    formatDateIndo,
    formatRupiah,
    FULFILLMENT_TYPE_LABELS,
    PAYMENT_STATUS_LABELS,
    RESERVATION_STATUS_LABELS,
    WORK_STATUS_LABELS,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BusinessType, PageProps, ServiceUnitLabel } from '@/types';

interface BookingStatusProps {
    business: {
        name: string;
        slug: string;
        business_type?: BusinessType;
        phone: string | null;
        address: string | null;
        timezone: string;
        logo_url: string | null;
        brand_color: string | null;
        qris_url: string | null;
        bank_accounts: Array<{
            bank_name: string;
            account_number: string;
            account_holder: string;
        }>;
    };
    booking: {
        booking_code: string;
        invoice_number: string | null;
        invoice_token: string | null;
        service_name: string;
        staff_name: string | null;
        customer_name: string;
        customer_phone: string;
        booking_date: string;
        start_time_local: string;
        end_time_local: string;
        booking_mode?: 'time_slot' | 'dropoff';
        quantity?: number;
        unit_label?: ServiceUnitLabel;
        fulfillment_type?: 'dropoff' | 'pickup';
        pickup_session?: string | null;
        pickup_address?: string | null;
        estimated_ready_date?: string | null;
        work_status?: 'awaiting_dropoff' | 'in_progress' | 'ready_for_pickup' | 'picked_up' | null;
        schedule_label?: string;
        start_at_utc?: string;
        end_at_utc?: string;
        calendar_ics_url?: string;
        created_at_local?: string | null;
        total_price: number;
        dp_amount: number;
        reservation_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
        payment_status: 'unpaid' | 'waiting_verification' | 'dp_verified' | 'settled';
        has_dp_proof: boolean;
        dp_expires_at: string | null;
        cancellation_reason: string | null;
        customer_notes?: string | null;
    };
}

export default function BookingStatus({ business, booking }: BookingStatusProps) {
    const { flash } = usePage<PageProps>().props;
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [remainingText, setRemainingText] = useState<string>('');
    const dpExpired = remainingText === 'Waktu habis';

    const businessType = resolveBusinessType(business.business_type);
    const invoiceLabel = booking.invoice_number || booking.booking_code;
    const isDropoff = businessType === 'dropoff' || booking.booking_mode === 'dropoff';
    const qty = Math.max(1, booking.quantity ?? 1);
    const unitLabel = booking.unit_label ?? 'item';
    const scheduleLabel = booking.schedule_label ?? formatBookingScheduleShort(booking);
    const bookingNoun = businessType === 'dropoff' ? 'pesanan' : businessType === 'space_booking' ? 'booking' : 'reservasi';
    const lookupLabel = businessType === 'dropoff' ? 'Cek pesanan' : businessType === 'space_booking' ? 'Cek booking' : 'Cek reservasi';

    const dropoffSteps = [
        {
            key: 'awaiting_dropoff',
            label: booking.fulfillment_type === 'pickup' ? 'Menunggu Jemput' : 'Menunggu Drop-off',
            icon: Truck,
        },
        {
            key: 'in_progress',
            label: 'Sedang Dikerjakan',
            icon: Sparkles,
        },
        {
            key: 'ready_for_pickup',
            label: booking.fulfillment_type === 'pickup' ? 'Siap Diantar' : 'Siap Diambil',
            icon: PackageCheck,
        },
        {
            key: 'picked_up',
            label: 'Selesai',
            icon: CheckCircle2,
        },
    ] as const;

    const currentWorkIndex = isDropoff
        ? Math.max(0, dropoffSteps.findIndex((s) => s.key === (booking.work_status ?? 'awaiting_dropoff')))
        : 0;

    useEffect(() => {
        if (!booking.dp_expires_at || booking.payment_status !== 'unpaid' || booking.reservation_status === 'cancelled') {
            return;
        }

        const updateTimer = () => {
            const diff = new Date(booking.dp_expires_at!).getTime() - Date.now();
            if (diff <= 0) {
                setRemainingText('Waktu habis');
                return;
            }
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setRemainingText(`${mins}m ${secs.toString().padStart(2, '0')}d`);
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [booking.dp_expires_at, booking.payment_status, booking.reservation_status]);

    const handleUpload = (e: FormEvent) => {
        e.preventDefault();
        if (!file) {
            setFileError('Pilih gambar bukti pembayaran terlebih dahulu.');
            document.getElementById('status-dp-proof')?.focus();
            return;
        }
        setFileError('');

        const proofUrl = booking.invoice_token
            ? route('public.booking.invoice.proof', { slug: business.slug, token: booking.invoice_token })
            : route('public.booking.proof', { slug: business.slug, code: booking.booking_code });

        setUploading(true);
        router.post(
            proofUrl,
            { dp_proof: file },
            {
                forceFormData: true,
                onFinish: () => {
                    setUploading(false);
                    setFile(null);
                },
            }
        );
    };

    const waMessage = [
        `Halo ${business.name}, saya ingin konfirmasi ${bookingNoun}:`,
        `No. Invoice: ${invoiceLabel}`,
        `Kode Booking: ${booking.booking_code}`,
        `Nama: ${booking.customer_name}`,
        `${businessType === 'space_booking' ? 'Fasilitas / Paket' : 'Layanan'}: ${booking.service_name}${isDropoff ? ` (${qty} ${unitLabel})` : ''}`,
        `Jadwal: ${formatDateIndo(booking.booking_date)} (${scheduleLabel})`,
        isDropoff && booking.estimated_ready_date
            ? `Estimasi Selesai: ${formatDateIndo(booking.estimated_ready_date)}`
            : '',
        booking.dp_amount > 0 ? `Uang Muka: ${formatRupiah(booking.dp_amount)}` : '',
        `Link Invoice: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    ]
        .filter(Boolean)
        .join('\n');

    const showCalendarActions =
        booking.reservation_status !== 'cancelled' && booking.reservation_status !== 'no_show';

    const googleCalendarUrl =
        booking.start_at_utc && booking.end_at_utc
            ? `https://calendar.google.com/calendar/render?${new URLSearchParams({
                  action: 'TEMPLATE',
                  text: `${isDropoff ? (booking.fulfillment_type === 'pickup' ? 'Jemput ' : 'Drop-off ') : ''}${booking.service_name} — ${business.name}`,
                  dates: `${booking.start_at_utc}/${booking.end_at_utc}`,
                  details: [
                      `Kode Booking: ${booking.booking_code}`,
                      isDropoff ? `Jumlah: ${qty} ${unitLabel}` : '',
                      isDropoff && booking.estimated_ready_date
                          ? `Estimasi Selesai: ${formatDateIndo(booking.estimated_ready_date)}`
                          : '',
                      businessType === 'staff_appointment' && booking.staff_name ? `Staff: ${booking.staff_name}` : '',
                      `Total: ${formatRupiah(booking.total_price)}`,
                  ]
                      .filter(Boolean)
                      .join('\n'),
                  location: business.address || business.name,
              }).toString()}`
            : null;

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <Head title={`Invoice ${invoiceLabel} — ${business.name}`} />

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none print:hidden"
            >
                Lewati ke detail invoice
            </a>

            <BusinessHeader business={business} label="Invoice" widthClassName="box-content max-w-xl">
                <Link href={route('public.booking.invoices', business.slug)} className={headerActionClass}>
                    <FileText className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{lookupLabel}</span>
                    <span className="sr-only sm:hidden">{lookupLabel}</span>
                </Link>
            </BusinessHeader>

            <main id="main-content" tabIndex={-1} className="mx-auto box-content max-w-xl space-y-6 px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] outline-none sm:px-6 print:py-0">
                {flash.success && (
                    <div role="status" className="rounded-sm bg-bone px-4 py-3 text-sm font-semibold text-ink print:hidden">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div role="alert" className="rounded-sm bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive print:hidden">
                        {flash.error}
                    </div>
                )}

                <div className="rounded-md border border-hairline-soft bg-canvas p-4 sm:p-8 print:border-0 print:p-0">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="font-mono text-xs font-semibold break-all text-mute">
                                INVOICE {invoiceLabel}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                                {booking.reservation_status === 'cancelled' ? (
                                    <XCircle className="size-6 shrink-0 text-destructive" aria-hidden="true" />
                                ) : (
                                    <CheckCircle2 className="size-6 shrink-0 text-ink" aria-hidden="true" />
                                )}
                                <h1 className="text-xl font-semibold break-words text-ink sm:text-2xl">
                                    {isDropoff && booking.work_status && booking.reservation_status !== 'cancelled' && booking.reservation_status !== 'no_show'
                                        ? (WORK_STATUS_LABELS[booking.work_status] ?? RESERVATION_STATUS_LABELS[booking.reservation_status])
                                        : (RESERVATION_STATUS_LABELS[booking.reservation_status] ?? booking.reservation_status)}
                                </h1>
                            </div>
                            <p className="mt-1 text-sm break-words text-mute">{business.name}</p>
                        </div>

                        <Badge variant="secondary" className="max-w-full whitespace-normal text-center">
                            {PAYMENT_STATUS_LABELS[booking.payment_status] ?? booking.payment_status}
                        </Badge>
                    </div>

                    {isDropoff && booking.reservation_status !== 'cancelled' && booking.reservation_status !== 'no_show' && (
                        <div className="mt-6 rounded-sm bg-bone p-4" aria-label="Progres pengerjaan pesanan">
                            <p className="mb-3 text-xs font-semibold text-mute">Progres Pengerjaan</p>
                            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
                                {dropoffSteps.map((step, idx) => {
                                    const Icon = step.icon;
                                    const isDone = idx <= currentWorkIndex;
                                    const isCurrent = idx === currentWorkIndex;
                                    return (
                                        <li
                                            key={step.key}
                                            className={cn(
                                                'flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold sm:px-3',
                                                isCurrent
                                                    ? 'bg-ink text-canvas'
                                                    : isDone
                                                      ? 'bg-canvas text-ink'
                                                      : 'bg-canvas/50 text-ash'
                                            )}
                                        >
                                            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                                            <span className="min-w-0 leading-tight break-words">{step.label}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    )}

                    <div className="mt-6 space-y-3 border-t border-divider pt-6 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="shrink-0 text-mute">No. Invoice</span>
                            <span className="min-w-0 text-right font-mono font-semibold break-all text-ink">{invoiceLabel}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="shrink-0 text-mute">Kode Booking</span>
                            <span className="min-w-0 text-right font-mono break-all text-ink">{booking.booking_code}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="shrink-0 text-mute">Pelanggan</span>
                            <span className="min-w-0 text-right font-semibold break-words text-ink">
                                {booking.customer_name} <span className="font-mono text-xs font-normal tabular-nums text-mute">({booking.customer_phone})</span>
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="shrink-0 text-mute">{businessType === 'space_booking' ? 'Fasilitas / Paket' : 'Layanan'}</span>
                            <span className="min-w-0 text-right font-semibold break-words text-ink">
                                {booking.service_name}
                                {isDropoff ? ` (${qty} ${unitLabel})` : ''}
                            </span>
                        </div>
                        {isDropoff && (
                            <div className="flex justify-between gap-4">
                                <span className="shrink-0 text-mute">Metode</span>
                                <span className="min-w-0 text-right font-semibold text-ink">
                                    {FULFILLMENT_TYPE_LABELS[booking.fulfillment_type ?? 'dropoff'] ?? 'Antar ke Toko'}
                                </span>
                            </div>
                        )}
                        {isDropoff && booking.fulfillment_type === 'pickup' && booking.pickup_address && (
                            <div className="flex justify-between gap-4">
                                <span className="shrink-0 text-mute">Alamat Jemput</span>
                                <span className="min-w-0 max-w-xs text-right break-words text-body">{booking.pickup_address}</span>
                            </div>
                        )}
                        {businessType === 'staff_appointment' && booking.staff_name && (
                            <div className="flex justify-between gap-4">
                                <span className="shrink-0 text-mute">Staff</span>
                                <span className="min-w-0 text-right font-semibold break-words text-ink">{booking.staff_name}</span>
                            </div>
                        )}
                        <div className="flex justify-between gap-4">
                            <span className="shrink-0 text-mute">{isDropoff ? 'Jadwal Drop-off' : 'Jadwal'}</span>
                            <span className="min-w-0 text-right font-semibold tabular-nums text-ink">
                                {formatDateIndo(booking.booking_date)} · {scheduleLabel}
                            </span>
                        </div>
                        {isDropoff && booking.estimated_ready_date && (
                            <div className="flex justify-between gap-4">
                                <span className="shrink-0 text-mute">Estimasi Selesai</span>
                                <span className="min-w-0 text-right font-semibold tabular-nums text-ink">
                                    {formatDateIndo(booking.estimated_ready_date)}
                                </span>
                            </div>
                        )}
                        {booking.created_at_local && (
                            <div className="flex justify-between gap-4">
                                <span className="shrink-0 text-mute">Dibuat Pada</span>
                                <span className="min-w-0 text-right tabular-nums text-mute">{booking.created_at_local}</span>
                            </div>
                        )}
                        {booking.customer_notes && (
                            <div className="flex justify-between gap-4">
                                <span className="shrink-0 text-mute">Catatan</span>
                                <span className="min-w-0 max-w-xs text-right break-words text-body">{booking.customer_notes}</span>
                            </div>
                        )}
                        <div className="flex justify-between gap-4 border-t border-divider pt-3">
                            <span className="shrink-0 text-mute">Total Biaya</span>
                            <span className="font-semibold tabular-nums text-ink">{formatRupiah(booking.total_price)}</span>
                        </div>
                        {booking.dp_amount > 0 && (
                            <div className="flex justify-between gap-4">
                                <span className="shrink-0 text-mute">Nominal Uang Muka</span>
                                <span className="font-semibold tabular-nums text-electric">{formatRupiah(booking.dp_amount)}</span>
                            </div>
                        )}
                    </div>

                    {/* Pay-Later Uang Muka Upload Box */}
                    {booking.dp_amount > 0 && booking.payment_status === 'unpaid' && booking.reservation_status !== 'cancelled' && (
                        <div className="mt-6 space-y-4 rounded-md bg-bone p-5 print:hidden">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-ink">{dpExpired ? 'Pembayaran Uang Muka' : 'Unggah Bukti Transfer Uang Muka'}</p>
                                {remainingText && !dpExpired && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-canvas px-3 py-1 font-mono text-xs font-semibold whitespace-nowrap tabular-nums text-electric">
                                        <Clock className="size-3.5" aria-hidden="true" />
                                        {remainingText}
                                    </span>
                                )}
                            </div>

                            {/* Server rejects uploads after expiry, so show what to do instead of a dead form */}
                            {dpExpired && (
                                <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
                                    Batas waktu unggah bukti uang muka sudah lewat. Hubungi bisnis lewat WhatsApp untuk mengatur ulang jadwal.
                                </p>
                            )}

                            {!dpExpired && business.bank_accounts.length > 0 && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {business.bank_accounts.map((acc, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-canvas p-3 text-xs">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-ink">{acc.bank_name}</p>
                                                <p className="font-mono text-sm font-semibold break-all tabular-nums text-ink">{acc.account_number}</p>
                                                <p className="break-words text-mute">a.n. {acc.account_holder}</p>
                                            </div>
                                            <CopyButton value={acc.account_number} label={`nomor rekening ${acc.bank_name}`} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!dpExpired && business.qris_url && (
                                <div className="flex items-center gap-4 rounded-md bg-canvas p-3">
                                    <img
                                        src={business.qris_url}
                                        alt={`QRIS ${business.name}`}
                                        className="size-20 shrink-0 rounded-xs object-cover outline-1 -outline-offset-1 outline-black/10"
                                    />
                                    <div className="text-xs text-mute">
                                        <p className="font-semibold text-ink">Scan QRIS Merchant</p>
                                        <p className="mt-1">Gunakan aplikasi mobile banking atau e-wallet Anda.</p>
                                    </div>
                                </div>
                            )}

                            {!dpExpired && (
                            <form onSubmit={handleUpload} className="space-y-3">
                                <label
                                    htmlFor="status-dp-proof"
                                    className="flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-control-border bg-canvas px-4 py-4 text-sm text-ink transition-colors hover:bg-bone focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
                                >
                                    <Upload className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                    <span className="min-w-0 [overflow-wrap:anywhere]">{file ? file.name : 'Pilih gambar bukti bayar (JPG/PNG)'}</span>
                                    <input
                                        id="status-dp-proof"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="sr-only"
                                        onChange={(e) => {
                                            setFile(e.target.files?.[0] ?? null);
                                            setFileError('');
                                        }}
                                    />
                                </label>
                                {fileError && (
                                    <p role="alert" className="text-xs font-medium text-destructive">
                                        {fileError}
                                    </p>
                                )}
                                <Button type="submit" className="w-full" disabled={uploading || !file}>
                                    {uploading ? 'Mengunggah…' : 'Kirim Bukti Pembayaran'}
                                </Button>
                            </form>
                            )}
                        </div>
                    )}

                    {/* Action CTAs */}
                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 print:hidden">
                        <Button asChild variant="outline" className="w-full">
                            <a href={buildWhatsAppUrl(business.phone, waMessage)} target="_blank" rel="noreferrer">
                                <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
                                <span>WhatsApp</span>
                            </a>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => window.print()}
                            className="w-full"
                        >
                            <Printer className="size-4 shrink-0" aria-hidden="true" />
                            <span>Cetak / PDF</span>
                        </Button>
                    </div>

                    {showCalendarActions && (googleCalendarUrl || booking.calendar_ics_url) && (
                        <div className="mt-3 print:hidden rounded-sm border border-hairline-soft bg-bone/50 p-3.5">
                            <p className="text-xs font-medium text-mute">
                                Simpan jadwal agar tidak terlewat:
                            </p>
                            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                                {googleCalendarUrl && (
                                    <Button asChild variant="outline" size="sm" className="w-full rounded-full bg-canvas sm:w-auto sm:flex-1">
                                        <a href={googleCalendarUrl} target="_blank" rel="noreferrer">
                                            <CalendarPlus className="mr-1.5 size-4" aria-hidden="true" />
                                            Google Calendar
                                        </a>
                                    </Button>
                                )}
                                {booking.calendar_ics_url && (
                                    <Button asChild variant="outline" size="sm" className="w-full rounded-full bg-canvas sm:w-auto sm:flex-1">
                                        <a href={booking.calendar_ics_url}>
                                            <Download className="mr-1.5 size-4" aria-hidden="true" />
                                            Apple / Outlook (.ics)
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center print:hidden">
                    <Link
                        href={route('public.booking', business.slug)}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                    >
                        Buat {bookingNoun} lain
                    </Link>
                </p>

                <p className="text-center text-xs text-ash">
                    <span className="inline-flex items-center gap-1.5">
                        Ditenagai oleh <JanjiyanLogo size="sm" />
                    </span>
                </p>
            </main>
        </div>
    );
}
