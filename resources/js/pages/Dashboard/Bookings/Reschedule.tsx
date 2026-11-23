import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select';
import { type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatDateIndo } from '@/lib/format';
import type { PageProps } from '@/types';

interface StaffOption {
    id: number;
    name: string;
    title: string | null;
}

interface ReschedulePageProps {
    booking: {
        id: number;
        booking_code: string;
        service_id: number;
        service_name: string;
        service_assignment_mode: 'staff' | 'capacity';
        booking_mode?: 'time_slot' | 'dropoff';
        quantity?: number;
        unit_label?: string;
        customer_name: string;
        staff_id: number | null;
        booking_date: string;
        start_time_local: string;
    };
    staffOptions: StaffOption[];
    todayDate?: string;
}

export default function BookingReschedule({ booking, staffOptions, todayDate }: ReschedulePageProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const [timeError, setTimeError] = useState('');
    const form = useForm({
        date: booking.booking_date,
        time: booking.start_time_local,
        staff_id: booking.staff_id ? String(booking.staff_id) : '',
    });

    const isDropoff = booking.booking_mode === 'dropoff';
    const requiredQty = Math.max(1, booking.quantity ?? 1);
    const unitLabel = booking.unit_label ?? 'item';
    const todayString = todayDate || new Date().toISOString().slice(0, 10);

    const slotUrl = useMemo(() => {
        if (!form.data.date) return null;
        const params = new URLSearchParams({
            service_id: String(booking.service_id),
            date: form.data.date,
            exclude_booking_id: String(booking.id),
        });
        if (form.data.staff_id) {
            params.set('staff_id', form.data.staff_id);
        }
        return `${route('dashboard.bookings.slots')}?${params.toString()}`;
    }, [booking.id, booking.service_id, form.data.date, form.data.staff_id]);

    const { slots, dropoff, hasLoaded, showInitialLoading, showRefreshing } = useSlotFetcher({
        url: slotUrl,
        enabled: slotUrl !== null,
        onResolved: (nextSlots: SlotItem[]) => {
            if (isDropoff) return;
            if (!nextSlots.some((s) => s.time === form.data.time)) {
                form.setData('time', nextSlots[0]?.time ?? '');
            }
        },
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (isDropoff) {
            if (!dropoff || !dropoff.available || dropoff.remaining_capacity < requiredQty) {
                setTimeError(dropoff?.reason ?? `Sisa kuota harian tidak mencukupi untuk ${requiredQty} ${unitLabel}.`);
                return;
            }
        } else if (!form.data.time) {
            setTimeError('Pilih jam baru yang tersedia terlebih dahulu.');
            return;
        }
        setTimeError('');
        form.post(route('dashboard.bookings.reschedule', booking.id));
    };

    return (
        <DashboardLayout
            title={`Ubah Jadwal ${config.bookings.itemSingular}`}
            back={{ href: route('dashboard.bookings'), label: `Kembali ke ${config.bookings.pageTitle}` }}
        >
            <Head title={`Ubah Jadwal ${booking.booking_code}`} />


            <form
                onSubmit={handleSubmit}
                className="max-w-lg space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
            >
                <div className="flex items-start gap-3 rounded-sm bg-bone p-3.5 text-xs sm:p-4">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold text-ink">{booking.booking_code}</p>
                        <p className="mt-0.5 break-words text-mute">
                            {booking.customer_name} · {booking.service_name}
                        </p>
                    </div>
                </div>

                <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="reschedule-date">Tanggal Baru</Label>
                    <DatePicker
                        id="reschedule-date"
                        min={todayString}
                        value={form.data.date}
                        onChange={(val) => form.setData('date', val)}
                        dialogTitle="Pilih Tanggal Baru"
                        required
                    />
                </div>

                {config.bookings.supportsStaffColumn && !isDropoff && booking.service_assignment_mode === 'staff' && staffOptions.length > 0 && (
                    <div className="space-y-1.5">
                        <Label htmlFor="reschedule-staff">Staff (Opsional)</Label>
                        <SelectField
                            id="reschedule-staff"
                            value={form.data.staff_id}
                            onValueChange={(val) => form.setData('staff_id', val)}
                            options={[
                                { value: '', label: 'Siapa saja yang tersedia' },
                                ...staffOptions.map((st) => ({
                                    value: String(st.id),
                                    label: st.title ? `${st.name} (${st.title})` : st.name,
                                })),
                            ]}
                        />
                    </div>
                )}

                {isDropoff ? (
                    <div className="space-y-2 rounded-sm bg-bone p-4 text-xs" aria-live="polite">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-ink">Ketersediaan Kuota Drop-off</span>
                            {showRefreshing && <span className="text-mute">Memperbarui…</span>}
                        </div>
                        {showInitialLoading || !hasLoaded ? (
                            <p className="text-mute">Memeriksa kuota harian…</p>
                        ) : dropoff?.available && dropoff.remaining_capacity >= requiredQty ? (
                            <div className="space-y-1 text-mute">
                                <p className="font-medium text-ink tabular-nums">
                                    Tersedia {dropoff.remaining_capacity} dari {dropoff.total_capacity} kuota (butuh {requiredQty} {dropoff.unit_label ?? unitLabel})
                                </p>
                                {dropoff.estimated_ready_date && (
                                    <p>Estimasi selesai baru: {formatDateIndo(dropoff.estimated_ready_date)}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-destructive">
                                {dropoff?.reason ?? `Sisa kuota (${dropoff?.remaining_capacity ?? 0}) tidak mencukupi untuk ${requiredQty} ${dropoff?.unit_label ?? unitLabel}.`}
                            </p>
                        )}
                        {(timeError || form.errors.date) && (
                            <p role="alert" className="font-medium text-destructive">
                                {timeError || form.errors.date}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="min-h-[108px] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label>Slot Waktu Tersedia</Label>
                            {showRefreshing && (
                                <span className="text-xs font-medium text-mute">Memperbarui…</span>
                            )}
                        </div>
                        {showInitialLoading ? (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {Array.from({ length: 8 }).map((_, idx) => (
                                    <div key={idx} className="h-10 rounded-xl bg-bone" />
                                ))}
                            </div>
                        ) : !hasLoaded ? (
                            <div className="min-h-[80px]" />
                        ) : slots.length === 0 ? (
                            <p className="rounded-xl bg-bone p-3 text-xs text-mute">
                                Tidak ada slot tersedia pada tanggal / staff ini. Coba pilih tanggal lain.
                            </p>
                        ) : (
                            <div
                                className={`grid grid-cols-3 gap-2 transition-opacity duration-150 sm:grid-cols-4 ${
                                    showRefreshing ? 'opacity-60' : ''
                                }`}
                                role="group"
                                aria-label="Pilih slot waktu baru"
                            >
                                {slots.map((slot) => {
                                    const selected = form.data.time === slot.time;
                                    return (
                                        <button
                                            key={slot.time}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => {
                                                setTimeError('');
                                                form.setData('time', slot.time);
                                            }}
                                            className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border px-2.5 py-2 text-center font-mono text-xs font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                                selected
                                                    ? 'border-ink bg-ink text-white'
                                                    : 'border-hairline-soft bg-canvas text-ink hover:bg-bone'
                                            }`}
                                        >
                                            {slot.time}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {(timeError || form.errors.time || form.errors.date) && (
                            <p role="alert" className="text-xs font-medium text-destructive">
                                {timeError || form.errors.time || form.errors.date}
                            </p>
                        )}
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
                    <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                        <Link href={route('dashboard.bookings')}>Batal</Link>
                    </Button>
                    <Button
                        type="submit"
                        className="w-full sm:w-auto"
                        disabled={form.processing}
                    >
                        {form.processing ? 'Menyimpan…' : 'Simpan Jadwal Baru'}
                    </Button>
                </div>
            </form>
        </DashboardLayout>
    );
}
