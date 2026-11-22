import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatBookingScheduleShort, formatDateIndo, RESERVATION_STATUS_LABELS } from '@/lib/format';
import type { BusinessType } from '@/types';

export interface CalendarBookingItem {
    id: number;
    booking_code: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    service_id: number;
    service_name: string;
    service_assignment_mode: 'staff' | 'capacity';
    booking_mode?: 'time_slot' | 'dropoff';
    quantity?: number;
    unit_label?: string;
    fulfillment_type?: 'dropoff' | 'pickup';
    pickup_session?: string | null;
    staff_id: number | null;
    staff_name: string | null;
    booking_date: string;
    start_time_local: string;
    end_time_local: string;
    total_price: number;
    dp_amount: number;
    reservation_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    payment_status: 'unpaid' | 'waiting_verification' | 'dp_verified' | 'settled';
    has_dp_proof: boolean;
    dp_proof_url: string | null;
    invoice_url: string | null;
    customer_notes: string | null;
    cancellation_reason: string | null;
    rescheduled_count: number;
}

export interface CalendarPayload {
    selected_date: string;
    days: Array<{
        date: string;
        day_of_week: number;
        count: number;
    }>;
    bookings: CalendarBookingItem[];
    staff_columns: Array<{
        id: number;
        name: string;
        title: string | null;
    }>;
    open_time: string;
    close_time: string;
    is_open: boolean;
}

interface BookingCalendarViewProps {
    calendar: CalendarPayload;
    businessType?: BusinessType;
    onSelectDate: (date: string) => void;
    onSelectBooking: (booking: CalendarBookingItem) => void;
}

const SHORT_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function shiftDate(dateStr: string, deltaDays: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
}

function statusPillClasses(status: string): string {
    if (status === 'confirmed' || status === 'completed') {
        return 'border-success-border bg-success-soft text-success hover:bg-success-border/40';
    }
    if (status === 'no_show' || status === 'cancelled') {
        return 'border-destructive-border bg-destructive-soft text-destructive hover:bg-destructive-border/40';
    }
    return 'border-warning-border bg-warning-soft text-warning hover:bg-warning-border/40';
}

export function BookingCalendarView({
    calendar,
    businessType,
    onSelectDate,
    onSelectBooking,
}: BookingCalendarViewProps) {
    const config = getBusinessTypeConfig(businessType);
    const isSpaceBooking = config.type === 'space_booking';
    const todayString = new Date().toISOString().slice(0, 10);
    const hasUnassignedBookings = calendar.bookings.some((b) => b.staff_id === null);

    const columns: Array<{ id: number | null; name: string; title: string | null }> = [
        ...calendar.staff_columns,
        ...(hasUnassignedBookings || calendar.staff_columns.length === 0
            ? [
                  isSpaceBooking
                      ? { id: null, name: 'Jadwal / Sesi', title: 'Semua fasilitas & paket' }
                      : { id: null, name: 'Jadwal / Sesi', title: 'Belum ditetapkan ke staff' },
              ]
            : []),
    ];

    return (
        <div className="space-y-4">
            {/* Week Navigation & Day Strip */}
            <div className="rounded-md border border-hairline-soft bg-canvas p-3.5 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-base font-semibold text-ink">{formatDateIndo(calendar.selected_date)}</p>
                        <p className="text-xs tabular-nums text-mute">
                            {calendar.is_open
                                ? `Jam operasional: ${calendar.open_time.slice(0, 5)} – ${calendar.close_time.slice(0, 5)}`
                                : 'Bisnis tutup pada hari ini'}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Minggu sebelumnya"
                            onClick={() => onSelectDate(shiftDate(calendar.selected_date, -7))}
                        >
                            <ChevronLeft className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-initial"
                            onClick={() => onSelectDate(todayString)}
                        >
                            Hari Ini
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Minggu berikutnya"
                            onClick={() => onSelectDate(shiftDate(calendar.selected_date, 7))}
                        >
                            <ChevronRight className="size-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
                    {calendar.days.map((day) => {
                        const isSelected = day.date === calendar.selected_date;
                        const isToday = day.date === todayString;
                        const dayNum = Number(day.date.slice(8, 10));

                        return (
                            <button
                                key={day.date}
                                type="button"
                                aria-pressed={isSelected}
                                aria-label={`${formatDateIndo(day.date)}, ${day.count} jadwal`}
                                onClick={() => onSelectDate(day.date)}
                                className={`flex min-w-0 cursor-pointer flex-col items-center rounded-xl border px-0.5 py-2 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:rounded-sm sm:px-2 sm:py-2.5 ${
                                    isSelected
                                        ? 'border-ink bg-ink text-white'
                                        : isToday
                                          ? 'border-ink/40 bg-bone text-ink hover:bg-bone'
                                          : 'border-hairline-soft bg-canvas text-ink hover:bg-bone'
                                }`}
                            >
                                <span className={`text-[11px] font-medium sm:text-xs ${isSelected ? 'text-white/80' : 'text-mute'}`}>
                                    {SHORT_DAYS[day.day_of_week]}
                                </span>
                                <span className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base">{dayNum}</span>
                                <span
                                    className={`mt-1 rounded-full px-1 py-0.5 text-[11px] font-semibold tabular-nums sm:px-1.5 sm:text-xs ${
                                        isSelected
                                            ? 'bg-white/20 text-white'
                                            : day.count > 0
                                              ? 'bg-bone text-ink'
                                              : 'text-ash'
                                    }`}
                                >
                                    {day.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Staff / Resource Columns for Selected Day */}
            {calendar.bookings.length === 0 ? (
                <div className="rounded-md bg-bone p-8 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        Tidak ada {config.bookings.itemSingular.toLowerCase()} aktif pada {formatDateIndo(calendar.selected_date)}.
                    </p>
                    <p className="mt-1 text-sm text-mute">
                        Pilih tanggal lain di kalender mingguan di atas atau buat {config.bookings.itemSingular.toLowerCase()} manual.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {columns.map((col) => {
                        const colBookings = calendar.bookings.filter((b) =>
                            col.id === null ? b.staff_id === null : b.staff_id === col.id
                        );

                        return (
                            <div
                                key={col.id ?? 'unassigned'}
                                className={`flex-col rounded-md border border-hairline-soft bg-canvas ${
                                    colBookings.length === 0 ? 'hidden md:flex' : 'flex'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 rounded-t-md border-b border-divider bg-bone/60 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-ink">{col.name}</p>
                                        {col.title && <p className="truncate text-xs text-mute">{col.title}</p>}
                                    </div>
                                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                                        {colBookings.length} jadwal
                                    </Badge>
                                </div>

                                <div className="flex-1 space-y-2.5 p-3">
                                    {colBookings.length === 0 ? (
                                        <p className="py-6 text-center text-xs text-mute">Kosong sepanjang hari</p>
                                    ) : (
                                        colBookings.map((b) => (
                                            <button
                                                key={b.id}
                                                type="button"
                                                onClick={() => onSelectBooking(b)}
                                                className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${statusPillClasses(b.reservation_status)}`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                                                    <span className="font-mono text-xs font-semibold tabular-nums">
                                                        {formatBookingScheduleShort(b)}
                                                    </span>
                                                    <span className="text-xs font-medium">
                                                        {RESERVATION_STATUS_LABELS[b.reservation_status] ?? b.reservation_status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 break-words text-sm font-semibold">{b.customer_name}</p>
                                                <p className="break-words text-xs">
                                                    {b.service_name}
                                                    {b.booking_mode === 'dropoff' && (b.quantity ?? 1) > 1
                                                        ? ` · ${b.quantity} ${b.unit_label ?? 'item'}`
                                                        : ''}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
