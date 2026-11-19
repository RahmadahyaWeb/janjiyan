import { useForm } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';

export interface ReschedulableBooking {
    id: number;
    booking_code: string;
    customer_name: string;
    service_id: number;
    service_name: string;
    service_assignment_mode: 'staff' | 'capacity';
    staff_id: number | null;
    booking_date: string;
    start_time_local: string;
}

interface StaffOption {
    id: number;
    name: string;
    title: string | null;
}

interface BookingRescheduleDialogProps {
    booking: ReschedulableBooking | null;
    staffOptions: StaffOption[];
    onClose: () => void;
}

export function BookingRescheduleDialog({
    booking,
    staffOptions,
    onClose,
}: BookingRescheduleDialogProps) {
    const [timeError, setTimeError] = useState('');

    const form = useForm({
        date: '',
        time: '',
        staff_id: '',
    });

    useEffect(() => {
        if (!booking) return;
        setTimeError('');
        form.setData({
            date: booking.booking_date,
            time: booking.start_time_local,
            staff_id: booking.staff_id ? String(booking.staff_id) : '',
        });
    }, [booking?.id]);

    const slotUrl = useMemo(() => {
        if (!booking || !form.data.date) return null;
        const params = new URLSearchParams({
            service_id: String(booking.service_id),
            date: form.data.date,
            exclude_booking_id: String(booking.id),
        });
        if (form.data.staff_id) {
            params.set('staff_id', form.data.staff_id);
        }
        return `${route('dashboard.bookings.slots')}?${params.toString()}`;
    }, [booking?.id, booking?.service_id, form.data.date, form.data.staff_id]);

    const { slots, hasLoaded, showInitialLoading, showRefreshing } = useSlotFetcher({
        url: slotUrl,
        enabled: booking !== null && slotUrl !== null,
        onResolved: (nextSlots: SlotItem[]) => {
            if (!nextSlots.some((s) => s.time === form.data.time)) {
                form.setData('time', nextSlots[0]?.time ?? '');
            }
        },
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!booking) return;
        if (!form.data.time) {
            setTimeError('Pilih jam baru yang tersedia terlebih dahulu.');
            return;
        }
        setTimeError('');
        form.post(route('dashboard.bookings.reschedule', booking.id), {
            preserveScroll: true,
            onSuccess: () => {
                onClose();
            },
        });
    };

    const todayString = new Date().toISOString().slice(0, 10);

    return (
        <Dialog open={booking !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-ink">
                        <CalendarClock className="size-5" aria-hidden="true" />
                        Ubah Jadwal Reservasi
                    </DialogTitle>
                </DialogHeader>

                {booking && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="rounded-[16px] bg-bone p-3.5 text-xs">
                            <p className="font-mono font-semibold text-ink">{booking.booking_code}</p>
                            <p className="mt-0.5 text-mute">
                                {booking.customer_name} · {booking.service_name}
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="reschedule-date">Tanggal Baru</Label>
                            <Input
                                id="reschedule-date"
                                type="date"
                                min={todayString}
                                value={form.data.date}
                                onChange={(e) => form.setData('date', e.target.value)}
                                required
                            />
                        </div>

                        {booking.service_assignment_mode === 'staff' && staffOptions.length > 0 && (
                            <div className="space-y-1.5">
                                <Label htmlFor="reschedule-staff">Staff (Opsional)</Label>
                                <NativeSelect
                                    id="reschedule-staff"
                                    value={form.data.staff_id}
                                    onChange={(e) => form.setData('staff_id', e.target.value)}
                                >
                                    <option value="">Siapa saja yang tersedia</option>
                                    {staffOptions.map((st) => (
                                        <option key={st.id} value={st.id}>
                                            {st.name}
                                            {st.title ? ` (${st.title})` : ''}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </div>
                        )}

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
                                        <div key={idx} className="h-9 rounded-[12px] bg-bone" />
                                    ))}
                                </div>
                            ) : !hasLoaded ? (
                                <div className="min-h-[80px]" />
                            ) : slots.length === 0 ? (
                                <p className="rounded-[14px] bg-bone p-3 text-xs text-mute">
                                    Tidak ada slot tersedia pada tanggal / staff ini. Coba pilih tanggal lain.
                                </p>
                            ) : (
                                <div
                                    className={`grid grid-cols-3 gap-2 transition-opacity duration-150 sm:grid-cols-4 ${
                                        showRefreshing ? 'opacity-60' : ''
                                    }`}
                                >
                                    {slots.map((slot) => {
                                        const selected = form.data.time === slot.time;
                                        return (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                onClick={() => {
                                                    setTimeError('');
                                                    form.setData('time', slot.time);
                                                }}
                                                className={`cursor-pointer rounded-[12px] border px-3 py-2 text-center font-mono text-xs font-semibold transition-colors ${
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
                            {timeError && <p className="text-xs text-destructive">{timeError}</p>}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={form.processing || !form.data.time}>
                                {form.processing ? 'Menyimpan…' : 'Simpan Jadwal Baru'}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
