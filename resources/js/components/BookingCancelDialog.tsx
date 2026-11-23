import { router } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDateIndo } from '@/lib/format';
import type { BookingRow } from '@/types/booking';

interface BookingCancelDialogProps {
    booking: BookingRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemSingular: string;
}

export function BookingCancelDialog({
    booking,
    open,
    onOpenChange,
    itemSingular,
}: BookingCancelDialogProps) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setReason('');
            setSubmitting(false);
        }
    }, [open, booking?.id]);

    if (!booking) return null;

    const unitLabel = booking.unit_label ?? 'item';

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        router.patch(
            route('dashboard.bookings.status', booking.id),
            {
                reservation_status: 'cancelled',
                cancellation_reason: reason.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`${itemSingular} ${booking.booking_code} telah dibatalkan.`);
                    onOpenChange(false);
                },
                onFinish: () => setSubmitting(false),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-md sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-ink">
                        Batalkan {itemSingular} {booking.booking_code}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-mute">
                        {itemSingular} akan dibatalkan dan{' '}
                        {booking.booking_mode === 'dropoff' ? 'kuota harian' : 'slot jadwal'} akan dibuka kembali secara otomatis.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1 rounded-sm bg-bone p-3.5 text-xs">
                        <p className="font-mono font-semibold text-ink">{booking.booking_code}</p>
                        <p className="break-words text-sm font-semibold text-ink">{booking.customer_name}</p>
                        <p className="break-words text-mute">
                            {booking.service_summary || booking.service_name} · {formatDateIndo(booking.booking_date)}
                            {booking.booking_mode === 'dropoff'
                                ? ` · ${booking.quantity ?? 1} ${unitLabel}`
                                : booking.start_time_local
                                  ? ` · ${booking.start_time_local}`
                                  : ''}
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="dialog-cancel-reason">Alasan pembatalan (opsional)</Label>
                        <Textarea
                            id="dialog-cancel-reason"
                            placeholder="Mis. Pelanggan berhalangan hadir atau jadwal penuh"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={255}
                        />
                    </div>

                    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => onOpenChange(false)}
                        >
                            Kembali
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            className="w-full sm:w-auto"
                            disabled={submitting}
                        >
                            {submitting ? 'Memproses…' : `Batalkan ${itemSingular}`}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
