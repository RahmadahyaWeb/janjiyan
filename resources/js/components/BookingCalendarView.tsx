import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateIndo, RESERVATION_STATUS_LABELS } from '@/lib/format';

export interface CalendarBookingItem {
    id: number;
    booking_code: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    service_id: number;
    service_name: string;
    service_assignment_mode: 'staff' | 'capacity';
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
    onSelectDate,
    onSelectBooking,
}: BookingCalendarViewProps) {
    const todayString = new Date().toISOString().slice(0, 10);
    const hasUnassignedBookings = calendar.bookings.some((b) => b.staff_id === null);

    const columns: Array<{ id: number | null; name: string; title: string | null }> = [
        ...calendar.staff_columns,
        ...(hasUnassignedBookings || calendar.staff_columns.length === 0
            ? [{ id: null, name: 'Umum / Kapasitas', title: 'Tanpa staff khusus' }]
            : []),
    ];

    return (
        <div className="space-y-4">
            {/* Week Navigation & Day Strip */}
            <div className="rounded-[24px] border border-hairline-soft bg-canvas p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-base font-semibold text-ink">{formatDateIndo(calendar.selected_date)}</p>
                        <p className="text-xs text-mute">
                            {calendar.is_open
                                ? `Jam operasional: ${calendar.open_time.slice(0, 5)} – ${calendar.close_time.slice(0, 5)}`
                                : 'Bisnis tutup pada hari ini'}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Minggu sebelumnya"
                            onClick={() => onSelectDate(shiftDate(calendar.selected_date, -7))}
                        >
                            <ChevronLeft className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectDate(todayString)}
                        >
                            Hari Ini
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
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
                                onClick={() => onSelectDate(day.date)}
                                className={`flex cursor-pointer flex-col items-center rounded-[14px] border px-1 py-2 text-center transition-colors sm:rounded-[16px] sm:px-2 sm:py-2.5 ${
                                    isSelected
                                        ? 'border-ink bg-ink text-white'
                                        : isToday
                                          ? 'border-ink/40 bg-bone text-ink hover:bg-bone'
                                          : 'border-hairline-soft bg-canvas text-ink hover:bg-bone'
                                }`}
                            >
                                <span className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-mute'}`}>
                                    {SHORT_DAYS[day.day_of_week]}
                                </span>
                                <span className="mt-0.5 text-base font-semibold tabular-nums">{dayNum}</span>
                                <span
                                    className={`mt-1 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
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
                <div className="rounded-[24px] bg-bone p-12 text-center">
                    <p className="text-base font-semibold text-ink">
                        Tidak ada jadwal reservasi aktif pada {formatDateIndo(calendar.selected_date)}.
                    </p>
                    <p className="mt-1 text-sm text-mute">
                        Pilih tanggal lain di kalender mingguan di atas atau tambahkan booking manual.
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
                                className={`flex-col rounded-[24px] border border-hairline-soft bg-canvas ${
                                    colBookings.length === 0 ? 'hidden md:flex' : 'flex'
                                }`}
                            >
                                <div className="flex items-center justify-between border-b border-divider bg-bone/60 px-4 py-3 rounded-t-[24px]">
                                    <div>
                                        <p className="text-sm font-semibold text-ink">{col.name}</p>
                                        {col.title && <p className="text-xs text-mute">{col.title}</p>}
                                    </div>
                                    <Badge variant="secondary" className="tabular-nums">
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
                                                className={`w-full cursor-pointer rounded-[16px] border p-3 text-left transition-colors ${statusPillClasses(b.reservation_status)}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-mono text-xs font-semibold tabular-nums">
                                                        {b.start_time_local} – {b.end_time_local}
                                                    </span>
                                                    <span className="text-xs font-medium">
                                                        {RESERVATION_STATUS_LABELS[b.reservation_status] ?? b.reservation_status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm font-semibold">{b.customer_name}</p>
                                                <p className="text-xs">{b.service_name}</p>
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
