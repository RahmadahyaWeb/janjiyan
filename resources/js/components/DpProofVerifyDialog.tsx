import { router } from '@inertiajs/react';
import { Check, MessageCircle, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatDateShortIndo, formatRupiah, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/types';
import type { BookingRow } from '@/types/booking';

interface DpProofVerifyDialogProps {
    booking: BookingRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canVerifyPayments: boolean;
    itemSingular: string;
    quickWaUrl: string;
}

const VERIFY_METHODS: PaymentMethod[] = ['transfer', 'qris', 'cash', 'edc'];

export function DpProofVerifyDialog({
    booking,
    open,
    onOpenChange,
    canVerifyPayments,
    itemSingular,
    quickWaUrl,
}: DpProofVerifyDialogProps) {
    const [method, setMethod] = useState<PaymentMethod>('transfer');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setMethod('transfer');
            setSubmitting(false);
        }
    }, [open, booking?.id]);

    if (!booking) return null;

    const canConfirmVerify = canVerifyPayments && booking.payment_status === 'waiting_verification';

    const handleVerify = (e: FormEvent) => {
        e.preventDefault();
        if (!canConfirmVerify || submitting) return;
        setSubmitting(true);
        router.post(
            route('dashboard.bookings.verify-dp', booking.id),
            { payment_method: method },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`Uang muka ${booking.booking_code} diverifikasi & ${itemSingular.toLowerCase()} dikonfirmasi.`);
                    onOpenChange(false);
                },
                onFinish: () => setSubmitting(false),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-lg sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink">
                        <ShieldCheck className="size-5 shrink-0 text-ink" aria-hidden="true" />
                        Bukti &amp; Verifikasi Uang Muka
                    </DialogTitle>
                    <DialogDescription className="text-xs text-mute">
                        {booking.booking_code} · {booking.customer_name} · {booking.service_summary || booking.service_name}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2.5 rounded-sm bg-bone p-3.5 text-xs">
                        <div>
                            <p className="text-mute">Nominal Uang Muka</p>
                            <p className="mt-0.5 text-base font-semibold tabular-nums text-ink">
                                {formatRupiah(booking.dp_amount)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-mute">Total Tagihan</p>
                            <p className="mt-0.5 text-base font-semibold tabular-nums text-ink">
                                {formatRupiah(booking.total_price)}
                            </p>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-2 text-[11px] text-mute">
                            <span>Jadwal: {formatDateShortIndo(booking.booking_date)}</span>
                            {booking.dp_expires_at_local && booking.payment_status === 'unpaid' && (
                                <Badge variant="warning" className="tabular-nums">
                                    Batas bayar: {booking.dp_expires_at_local}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {booking.dp_proof_url ? (
                        <div className="overflow-hidden rounded-sm border border-hairline-soft bg-bone">
                            <img
                                src={booking.dp_proof_url}
                                alt={`Bukti pembayaran uang muka ${booking.booking_code}`}
                                className="max-h-[52dvh] w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="rounded-sm border border-hairline-soft bg-bone/60 p-4 text-center text-xs text-mute">
                            Pelanggan belum mengunggah gambar bukti pembayaran. Pastikan dana sudah masuk sebelum memverifikasi manual.
                        </div>
                    )}

                    {canConfirmVerify && (
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-ink">
                                Catat Metode Pembayaran Masuk
                            </Label>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label="Pilih metode pembayaran uang muka">
                                {VERIFY_METHODS.map((m) => {
                                    const active = method === m;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setMethod(m)}
                                            className={cn(
                                                'min-h-10 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                active ? 'bg-ink text-canvas' : 'bg-bone text-ink hover:bg-hairline-soft'
                                            )}
                                        >
                                            {PAYMENT_METHOD_LABELS[m]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-2 border-t border-divider pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <Button asChild type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                            <a href={quickWaUrl} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="size-3.5" aria-hidden="true" />
                                Hubungi via WA
                            </a>
                        </Button>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => onOpenChange(false)}
                            >
                                Tutup
                            </Button>
                            {canConfirmVerify && (
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    disabled={submitting}
                                >
                                    <Check className="size-3.5" aria-hidden="true" />
                                    {submitting ? 'Memverifikasi…' : 'Verifikasi & Konfirmasi'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
