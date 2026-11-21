import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatDateIndo } from '@/lib/format';
import type { PageProps } from '@/types';

interface BookingCancelProps {
    booking: {
        id: number;
        booking_code: string;
        customer_name: string;
        service_name: string;
        booking_date: string;
        booking_mode: 'time_slot' | 'dropoff';
        quantity: number;
        unit_label?: string;
        start_time_local: string;
    };
}

export default function BookingCancel({ booking }: BookingCancelProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const itemSingular = config.bookings.itemSingular;
    const unitLabel = booking.unit_label ?? 'item';

    const form = useForm({
        reservation_status: 'cancelled',
        cancellation_reason: '',
        redirect_to_index: true,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            cancellation_reason: data.cancellation_reason.trim() || null,
        }));
        form.patch(route('dashboard.bookings.status', booking.id));
    };

    return (
        <DashboardLayout
            title={`Batalkan ${itemSingular} ${booking.booking_code}`}
            back={{ href: route('dashboard.bookings'), label: `Kembali ke ${config.bookings.pageTitle}` }}
        >
            <Head title={`Batalkan ${booking.booking_code}`} />

            <form
                onSubmit={handleSubmit}
                className="max-w-lg space-y-4 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6"
            >
                <div className="space-y-1 rounded-sm bg-bone p-4 text-sm">
                    <p className="font-mono text-xs font-semibold text-mute">{booking.booking_code}</p>
                    <p className="font-semibold text-ink">{booking.customer_name}</p>
                    <p className="text-xs text-mute">
                        {booking.service_name} · {formatDateIndo(booking.booking_date)}
                        {booking.booking_mode === 'dropoff'
                            ? ` · ${booking.quantity} ${unitLabel}`
                            : booking.start_time_local
                              ? ` · ${booking.start_time_local}`
                              : ''}
                    </p>
                </div>

                <p className="text-sm leading-relaxed text-mute">
                    {itemSingular} akan dibatalkan dan{' '}
                    {booking.booking_mode === 'dropoff' ? 'kuota harian' : 'slot jadwal'} akan dibuka kembali secara
                    otomatis.
                </p>

                <div className="space-y-1.5">
                    <Label htmlFor="cancel-booking-reason">Alasan pembatalan (opsional)</Label>
                    <Textarea
                        id="cancel-booking-reason"
                        placeholder="Mis. Pelanggan berhalangan hadir atau jadwal penuh"
                        value={form.data.cancellation_reason}
                        onChange={(e) => form.setData('cancellation_reason', e.target.value)}
                        maxLength={255}
                    />
                    {form.errors.cancellation_reason && (
                        <p className="text-xs text-destructive">{form.errors.cancellation_reason}</p>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    <Button asChild type="button" variant="outline">
                        <Link href={route('dashboard.bookings')}>Kembali</Link>
                    </Button>
                    <Button type="submit" variant="destructive" disabled={form.processing}>
                        {form.processing ? 'Memproses…' : `Batalkan ${itemSingular}`}
                    </Button>
                </div>
            </form>
        </DashboardLayout>
    );
}
