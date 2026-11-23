import { Link } from '@inertiajs/react';
import {
    Calendar,
    CalendarClock,
    Check,
    CheckCircle2,
    Copy,
    ExternalLink,
    Eye,
    FileText,
    MapPin,
    MessageCircle,
    Printer,
    UserX,
    Wallet,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    formatBookingScheduleShort,
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
    FULFILLMENT_TYPE_LABELS,
    PAYMENT_METHOD_LABELS,
    PAYMENT_STATUS_LABELS,
    PAYMENT_TYPE_LABELS,
    RESERVATION_STATUS_LABELS,
    WORK_STATUS_LABELS,
} from '@/lib/format';
import { type WhatsappTemplateKey } from '@/lib/whatsappTemplates';
import { cn } from '@/lib/utils';
import type { BookingRow } from '@/types/booking';

interface BookingDetailDrawerProps {
    booking: BookingRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    todayDate: string;
    itemSingular: string;
    supportsStaff: boolean;
    supportsNoShow: boolean;
    canAccessPos: boolean;
    canVerifyPayments: boolean;
    visibleWaTemplates: Array<{ key: WhatsappTemplateKey; shortLabel: string }>;
    buildTemplateWaUrl: (b: BookingRow, key: WhatsappTemplateKey) => string;
    buildQuickWaUrl: (b: BookingRow) => string;
    onVerifyProof: (b: BookingRow) => void;
    onUpdateStatus: (id: number, status: string) => void;
    onUpdateWorkStatus: (
        b: BookingRow,
        workStatus: 'awaiting_dropoff' | 'in_progress' | 'ready_for_pickup' | 'picked_up'
    ) => void;
    onOpenCashier: (b: BookingRow, markCompleted?: boolean) => void;
    onOpenReceipt: (id: number) => void;
    onOpenReschedule: (b: BookingRow) => void;
    onOpenNoShow: (b: BookingRow) => void;
    onOpenCancel: (b: BookingRow) => void;
}

export function BookingDetailDrawer({
    booking,
    open,
    onOpenChange,
    todayDate,
    itemSingular,
    supportsStaff,
    supportsNoShow,
    canAccessPos,
    canVerifyPayments,
    visibleWaTemplates,
    buildTemplateWaUrl,
    buildQuickWaUrl,
    onVerifyProof,
    onUpdateStatus,
    onUpdateWorkStatus,
    onOpenCashier,
    onOpenReceipt,
    onOpenReschedule,
    onOpenNoShow,
    onOpenCancel,
}: BookingDetailDrawerProps) {
    const [copiedInvoice, setCopiedInvoice] = useState(false);

    if (!booking) return null;

    const isDropoff = booking.booking_mode === 'dropoff';
    const isDropoffActive =
        isDropoff && (booking.reservation_status === 'pending' || booking.reservation_status === 'confirmed');
    const showSlaWarning =
        isDropoffActive &&
        Boolean(booking.estimated_ready_date) &&
        booking.work_status !== 'picked_up' &&
        booking.work_status !== 'ready_for_pickup';
    const dropoffInShop = isDropoff && Boolean(booking.work_status) && booking.work_status !== 'awaiting_dropoff';
    const canReschedule =
        !dropoffInShop && (booking.reservation_status === 'pending' || booking.reservation_status === 'confirmed');
    const canNoShow = supportsNoShow && !isDropoff && booking.reservation_status === 'confirmed';
    const canCancel =
        booking.reservation_status !== 'cancelled' &&
        booking.reservation_status !== 'completed' &&
        booking.reservation_status !== 'no_show';
    const isClosed = booking.reservation_status === 'cancelled' || booking.reservation_status === 'no_show';

    const paid = booking.paid_amount ?? (booking.payment_status === 'settled' ? booking.total_price : 0);
    const remaining = booking.remaining_balance ?? Math.max(0, booking.total_price - paid);
    const payments = booking.payments ?? [];
    const items = booking.items ?? [];

    const copyInvoiceUrl = () => {
        if (!booking.invoice_url) return;
        navigator.clipboard?.writeText(booking.invoice_url);
        setCopiedInvoice(true);
        toast.success('Link invoice disalin.');
        setTimeout(() => setCopiedInvoice(false), 1800);
    };

    const renderReservationBadge = () => {
        const label = RESERVATION_STATUS_LABELS[booking.reservation_status] ?? booking.reservation_status;
        if (booking.reservation_status === 'confirmed' || booking.reservation_status === 'completed') {
            return <Badge variant="success">{label}</Badge>;
        }
        if (booking.reservation_status === 'cancelled' || booking.reservation_status === 'no_show') {
            return <Badge variant="danger">{label}</Badge>;
        }
        return <Badge variant="warning">{label}</Badge>;
    };

    const renderPaymentBadge = () => {
        const label = PAYMENT_STATUS_LABELS[booking.payment_status] ?? booking.payment_status;
        if (booking.payment_status === 'dp_verified' || booking.payment_status === 'settled') {
            return <Badge variant="success">{label}</Badge>;
        }
        if (booking.payment_status === 'waiting_verification') {
            return <Badge variant="warning">{label}</Badge>;
        }
        return <Badge variant="secondary">{label}</Badge>;
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex h-full w-full flex-col gap-0 overflow-hidden border-hairline-soft bg-canvas p-0 sm:max-w-lg"
            >
                <SheetHeader className="shrink-0 border-b border-divider bg-canvas p-4 pr-12 sm:p-5 sm:pr-12">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-mute">{booking.booking_code}</span>
                        {booking.invoice_number && (
                            <span className="font-mono text-xs text-ash">· {booking.invoice_number}</span>
                        )}
                    </div>
                    <SheetTitle className="text-lg font-semibold text-ink">
                        Detail {itemSingular}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        Informasi lengkap dan tindakan operasional untuk {booking.booking_code}
                    </SheetDescription>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {isDropoff && booking.work_status && !isClosed ? (
                            <Badge
                                variant={
                                    booking.work_status === 'picked_up'
                                        ? 'success'
                                        : booking.work_status === 'awaiting_dropoff'
                                          ? 'warning'
                                          : 'outline'
                                }
                            >
                                {WORK_STATUS_LABELS[booking.work_status] ?? booking.work_status}
                            </Badge>
                        ) : (
                            renderReservationBadge()
                        )}
                        {renderPaymentBadge()}
                        {showSlaWarning && booking.estimated_ready_date! < todayDate && (
                            <Badge variant="danger">Lewat Tenggat</Badge>
                        )}
                        {showSlaWarning && booking.estimated_ready_date! === todayDate && (
                            <Badge variant="warning">Tenggat Hari Ini</Badge>
                        )}
                        {(booking.rescheduled_count ?? 0) > 0 && (
                            <Badge variant="outline" className="tabular-nums">
                                Reschedule {booking.rescheduled_count}x
                            </Badge>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
                    {/* Customer Block */}
                    <div className="rounded-sm border border-hairline-soft bg-bone/50 p-3.5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <Link
                                    href={route('dashboard.customers.show', booking.customer_id)}
                                    className="text-sm font-semibold text-ink hover:underline"
                                >
                                    {booking.customer_name}
                                </Link>
                                <p className="mt-0.5 font-mono text-xs tabular-nums text-mute">
                                    +{booking.customer_phone}
                                </p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="xs" className="h-8 bg-canvas px-2.5 text-xs">
                                        <MessageCircle className="size-3.5" aria-hidden="true" />
                                        WhatsApp
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 rounded-md border-hairline-soft p-2 shadow-none">
                                    {visibleWaTemplates.map((item) => (
                                        <DropdownMenuItem
                                            key={item.key}
                                            asChild
                                            className="min-h-10 cursor-pointer rounded-xl px-3 py-2 text-sm text-ink"
                                        >
                                            <a
                                                href={buildTemplateWaUrl(booking, item.key)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <MessageCircle className="mr-2 size-3.5 text-mute" aria-hidden="true" />
                                                {item.shortLabel}
                                            </a>
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        asChild
                                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2 text-xs text-mute"
                                    >
                                        <a
                                            href={buildQuickWaUrl(booking)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Chat Cepat (Ringkasan)
                                        </a>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {(booking.customer_tags?.includes('VIP') ||
                            (supportsNoShow && (booking.customer_no_show_count ?? 0) > 0) ||
                            booking.customer_is_blocked) && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {booking.customer_tags?.includes('VIP') && <Badge variant="popular">VIP</Badge>}
                                {supportsNoShow && (booking.customer_no_show_count ?? 0) > 0 && (
                                    <Badge variant="warning" className="tabular-nums">
                                        No-Show {booking.customer_no_show_count}x
                                    </Badge>
                                )}
                                {booking.customer_is_blocked && <Badge variant="danger">Diblokir</Badge>}
                            </div>
                        )}
                    </div>

                    {/* Schedule & Fulfillment */}
                    <div className="space-y-2 rounded-sm border border-hairline-soft bg-canvas p-3.5 text-xs">
                        <div className="flex items-start gap-2.5">
                            <Calendar className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-semibold text-ink">
                                    {formatDateIndo(booking.booking_date)}
                                </p>
                                <p className="font-mono text-mute">
                                    {booking.schedule_label ?? formatBookingScheduleShort(booking)}
                                </p>
                                {supportsStaff && booking.staff_name && (
                                    <p className="text-body">Staff: <span className="font-medium text-ink">{booking.staff_name}</span></p>
                                )}
                                {isDropoff && booking.estimated_ready_date && (
                                    <p
                                        className={cn(
                                            'font-medium tabular-nums',
                                            showSlaWarning && booking.estimated_ready_date < todayDate
                                                ? 'text-destructive'
                                                : showSlaWarning && booking.estimated_ready_date === todayDate
                                                  ? 'text-warning'
                                                  : 'text-mute'
                                        )}
                                    >
                                        Target selesai: {formatDateShortIndo(booking.estimated_ready_date)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {isDropoff && booking.fulfillment_type === 'pickup' && booking.pickup_address && (
                            <div className="flex items-start gap-2.5 border-t border-divider pt-2.5">
                                <MapPin className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="font-medium text-mute">
                                        Alamat {FULFILLMENT_TYPE_LABELS[booking.fulfillment_type] ?? 'Jemput'}
                                    </p>
                                    <p className="mt-0.5 break-words text-body">{booking.pickup_address}</p>
                                </div>
                            </div>
                        )}

                        {booking.customer_notes && (
                            <div className="flex items-start gap-2.5 border-t border-divider pt-2.5">
                                <FileText className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="font-medium text-mute">Catatan Pelanggan</p>
                                    <p className="mt-0.5 break-words text-body">{booking.customer_notes}</p>
                                </div>
                            </div>
                        )}

                        {booking.reservation_status === 'cancelled' && booking.cancellation_reason && (
                            <div className="rounded-xs bg-destructive-soft px-3 py-2 text-destructive">
                                Alasan pembatalan: {booking.cancellation_reason}
                            </div>
                        )}
                    </div>

                    {/* Itemized Services & Add-ons */}
                    <div className="space-y-2 rounded-sm border border-hairline-soft bg-canvas p-3.5 text-xs">
                        <p className="font-semibold text-ink">Rincian Layanan</p>
                        {items.length > 0 ? (
                            <div className="divide-y divide-divider">
                                {items.map((item) => (
                                    <div key={item.id} className="flex items-start justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="font-medium text-ink">{item.name_snapshot}</p>
                                            <p className="text-mute tabular-nums">
                                                {item.quantity} {item.unit_label_snapshot} × {formatRupiah(item.unit_price)}
                                            </p>
                                        </div>
                                        <span className="shrink-0 font-semibold tabular-nums text-ink">
                                            {formatRupiah(item.subtotal)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-ink">
                                    {booking.service_summary || booking.service_name}
                                    {isDropoff ? ` (${booking.quantity ?? 1} ${booking.unit_label ?? 'item'})` : ''}
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-ink">
                                    {formatRupiah(booking.total_price)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Payment Summary & Ledger */}
                    <div className="space-y-3 rounded-sm bg-bone p-3.5 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <p className="text-mute">Total</p>
                                <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                                    {formatRupiah(booking.total_price)}
                                </p>
                            </div>
                            <div>
                                <p className="text-mute">Dibayar</p>
                                <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                                    {formatRupiah(paid)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-mute">Sisa</p>
                                <p
                                    className={cn(
                                        'mt-0.5 text-sm font-semibold tabular-nums',
                                        remaining > 0 && !isClosed ? 'text-electric' : 'text-ink'
                                    )}
                                >
                                    {formatRupiah(remaining)}
                                </p>
                            </div>
                        </div>

                        {booking.payment_status === 'unpaid' && booking.dp_expires_at_local && !isClosed && (
                            <p className="rounded-xs bg-warning-soft px-2.5 py-1.5 text-[11px] font-medium text-warning">
                                Batas pembayaran uang muka otomatis kedaluwarsa pada {booking.dp_expires_at_local}.
                            </p>
                        )}

                        {booking.dp_proof_url && (
                            <button
                                type="button"
                                onClick={() => onVerifyProof(booking)}
                                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-hairline-soft bg-canvas px-3 py-2 font-semibold text-ink transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <Eye className="size-3.5" aria-hidden="true" />
                                    {booking.payment_status === 'waiting_verification'
                                        ? 'Tinjau & Verifikasi Bukti Uang Muka'
                                        : 'Lihat Bukti Uang Muka'}
                                </span>
                                <span className="text-electric">Buka</span>
                            </button>
                        )}

                        {payments.length > 0 && (
                            <div className="space-y-1.5 border-t border-divider pt-2.5">
                                <p className="font-semibold text-ink">Riwayat Transaksi</p>
                                {payments.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                                        <span className="text-mute">
                                            {PAYMENT_TYPE_LABELS[p.payment_type] ?? p.payment_type} ({PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method})
                                            {p.paid_at_local ? ` · ${p.paid_at_local}` : ''}
                                        </span>
                                        <span className="font-semibold tabular-nums text-ink">
                                            {formatRupiah(p.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {booking.invoice_url && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-2.5">
                                <button
                                    type="button"
                                    onClick={copyInvoiceUrl}
                                    className="inline-flex cursor-pointer items-center gap-1 font-semibold text-electric hover:underline"
                                >
                                    {copiedInvoice ? <Check className="size-3" /> : <Copy className="size-3" />}
                                    {copiedInvoice ? 'Tersalin' : 'Salin Link Invoice'}
                                </button>
                                <a
                                    href={booking.invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-mute hover:text-ink"
                                >
                                    Buka Invoice
                                    <ExternalLink className="size-3" aria-hidden="true" />
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky Operational Actions Footer */}
                <div className="shrink-0 space-y-2 border-t border-divider bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
                    <div className="flex flex-wrap gap-2">
                            {booking.payment_status === 'waiting_verification' && canVerifyPayments && (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => onVerifyProof(booking)}
                                >
                                    <Check className="size-3.5" aria-hidden="true" />
                                    Verifikasi Uang Muka
                                </Button>
                            )}

                            {isDropoff && (booking.reservation_status === 'pending' || booking.reservation_status === 'confirmed') && booking.payment_status !== 'waiting_verification' && (
                                booking.work_status === 'awaiting_dropoff' || !booking.work_status ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onUpdateWorkStatus(booking, 'in_progress')}
                                    >
                                        <Check className="size-3.5" aria-hidden="true" />
                                        Terima &amp; Proses
                                    </Button>
                                ) : booking.work_status === 'in_progress' ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onUpdateWorkStatus(booking, 'ready_for_pickup')}
                                    >
                                        <Check className="size-3.5" aria-hidden="true" />
                                        Siap Diambil
                                    </Button>
                                ) : remaining > 0 && canAccessPos ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => {
                                            onOpenChange(false);
                                            onOpenCashier(booking, true);
                                        }}
                                    >
                                        <Wallet className="size-3.5" aria-hidden="true" />
                                        Selesaikan &amp; Bayar
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onUpdateWorkStatus(booking, 'picked_up')}
                                    >
                                        <Check className="size-3.5" aria-hidden="true" />
                                        Tandai Selesai
                                    </Button>
                                )
                            )}

                            {!isDropoff && booking.payment_status !== 'waiting_verification' && (
                                booking.reservation_status === 'pending' ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                                    >
                                        <Check className="size-3.5" aria-hidden="true" />
                                        Konfirmasi
                                    </Button>
                                ) : booking.reservation_status === 'confirmed' ? (
                                    remaining > 0 && canAccessPos ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                onOpenChange(false);
                                                onOpenCashier(booking, true);
                                            }}
                                        >
                                            <Wallet className="size-3.5" aria-hidden="true" />
                                            Selesaikan &amp; Bayar
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => onUpdateStatus(booking.id, 'completed')}
                                        >
                                            <Check className="size-3.5" aria-hidden="true" />
                                            Tandai Selesai
                                        </Button>
                                    )
                                ) : null
                            )}

                            {canAccessPos && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            onOpenChange(false);
                                            onOpenCashier(booking, false);
                                        }}
                                    >
                                        <Wallet className="size-3.5" aria-hidden="true" />
                                        Kasir / Bayar
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            onOpenChange(false);
                                            onOpenReceipt(booking.id);
                                        }}
                                    >
                                        <Printer className="size-3.5" aria-hidden="true" />
                                        Struk / Cetak
                                    </Button>
                                </>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {canReschedule && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        onOpenChange(false);
                                        onOpenReschedule(booking);
                                    }}
                                >
                                    <CalendarClock className="size-3.5" aria-hidden="true" />
                                    Ubah Jadwal
                                </Button>
                            )}
                            {canNoShow && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        onOpenChange(false);
                                        onOpenNoShow(booking);
                                    }}
                                >
                                    <UserX className="size-3.5" aria-hidden="true" />
                                    Tidak Hadir
                                </Button>
                            )}
                            {remaining > 0 &&
                                ((isDropoff && booking.work_status === 'ready_for_pickup') ||
                                    (!isDropoff && booking.reservation_status === 'confirmed')) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            isDropoff
                                                ? onUpdateWorkStatus(booking, 'picked_up')
                                                : onUpdateStatus(booking.id, 'completed')
                                        }
                                    >
                                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                        Selesai Tanpa Lunasi
                                    </Button>
                                )}
                            {canCancel && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                    onClick={() => {
                                        onOpenChange(false);
                                        onOpenCancel(booking);
                                    }}
                                >
                                    <X className="size-3.5" aria-hidden="true" />
                                    Batalkan
                                </Button>
                            )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
