import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatBookingScheduleShort, formatDateIndo, PAYMENT_STATUS_LABELS, RESERVATION_STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types';
import type { BookingRow } from '@/types/booking';

export type CalendarBookingItem = BookingRow;

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
    todayDate?: string;
    canCreateBooking?: boolean;
    onSelectDate: (date: string) => void;
    onSelectBooking: (booking: CalendarBookingItem) => void;
}

const SHORT_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HOUR_HEIGHT_PX = 68;

function shiftDate(dateStr: string, deltaDays: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
}

function parseTimeToMinutes(timeStr: string | null | undefined, fallbackMinutes: number): number {
    if (!timeStr) return fallbackMinutes;
    const parts = timeStr.split(':');
    const hh = Number.parseInt(parts[0] ?? '', 10);
    const mm = Number.parseInt(parts[1] ?? '0', 10);
    if (Number.isNaN(hh)) return fallbackMinutes;
    return hh * 60 + (Number.isNaN(mm) ? 0 : mm);
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

interface PositionedBooking {
    booking: CalendarBookingItem;
    topPx: number;
    heightPx: number;
    lane: number;
    totalLanes: number;
}

/** Assign horizontal lanes when multiple bookings overlap in the same column (e.g. capacity > 1 or unassigned). */
function layoutColumnBookings(
    items: CalendarBookingItem[],
    startMinutes: number,
    endMinutes: number
): PositionedBooking[] {
    if (items.length === 0) return [];

    const sorted = [...items].sort((a, b) => {
        const aStart = parseTimeToMinutes(a.start_time_local, startMinutes);
        const bStart = parseTimeToMinutes(b.start_time_local, startMinutes);
        return aStart - bStart || a.id - b.id;
    });

    const events = sorted.map((b) => {
        const s = Math.max(startMinutes, parseTimeToMinutes(b.start_time_local, startMinutes));
        const rawEnd = parseTimeToMinutes(b.end_time_local, s + 30);
        const e = Math.min(endMinutes, Math.max(s + 30, rawEnd));
        return { booking: b, s, e };
    });

    const laneEnds: number[] = [];
    const assigned = events.map((ev) => {
        let lane = laneEnds.findIndex((endVal) => endVal <= ev.s);
        if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(ev.e);
        } else {
            laneEnds[lane] = ev.e;
        }
        return { ...ev, lane };
    });

    return assigned.map((ev) => {
        const concurrent = assigned.filter((other) => other.s < ev.e && other.e > ev.s);
        const maxLane = Math.max(0, ...concurrent.map((c) => c.lane));
        const topPx = ((ev.s - startMinutes) / 60) * HOUR_HEIGHT_PX;
        const heightPx = Math.max(46, ((ev.e - ev.s) / 60) * HOUR_HEIGHT_PX - 2);
        return {
            booking: ev.booking,
            topPx,
            heightPx,
            lane: ev.lane,
            totalLanes: maxLane + 1,
        };
    });
}

export function BookingCalendarView({
    calendar,
    businessType,
    todayDate,
    canCreateBooking = true,
    onSelectDate,
    onSelectBooking,
}: BookingCalendarViewProps) {
    const config = getBusinessTypeConfig(businessType);
    const isSpaceBooking = config.type === 'space_booking';
    const todayString = todayDate || new Date().toISOString().slice(0, 10);
    const hasUnassignedBookings = calendar.bookings.some((b) => b.staff_id === null);

    const columns: Array<{ id: number | null; name: string; title: string | null }> = [
        ...calendar.staff_columns,
        ...(hasUnassignedBookings || calendar.staff_columns.length === 0
            ? [
                  isSpaceBooking
                      ? { id: null, name: 'Jadwal / Sesi', title: 'Semua fasilitas & paket' }
                      : { id: null, name: 'Belum Ditetapkan', title: 'Tanpa staff khusus' },
              ]
            : []),
    ];

    const openMinsRaw = parseTimeToMinutes(calendar.open_time, 8 * 60);
    const closeMinsRaw = parseTimeToMinutes(calendar.close_time, 20 * 60);
    const startHour = Math.max(0, Math.min(22, Math.floor(openMinsRaw / 60)));
    const endHour = Math.max(startHour + 1, Math.min(24, Math.ceil(closeMinsRaw / 60)));
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    const hours = Array.from({ length: endHour - startHour }, (_, idx) => startHour + idx);
    const gridHeightPx = hours.length * HOUR_HEIGHT_PX;

    const sortedMobileBookings = [...calendar.bookings].sort((a, b) =>
        (a.start_time_local || '').localeCompare(b.start_time_local || '')
    );

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
                    <div className="flex flex-wrap items-center gap-1.5">
                        <div className="min-w-0 flex-1 sm:w-40 sm:flex-initial">
                            <Label htmlFor="calendar-jump-date" className="sr-only">
                                Pilih tanggal kalender
                            </Label>
                            <DatePicker
                                id="calendar-jump-date"
                                value={calendar.selected_date}
                                onChange={(val) => val && onSelectDate(val)}
                                dialogTitle="Pilih Tanggal Kalender"
                                className="h-9 bg-canvas px-2.5 text-xs"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9"
                            aria-label="Minggu sebelumnya"
                            onClick={() => onSelectDate(shiftDate(calendar.selected_date, -7))}
                        >
                            <ChevronLeft className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => onSelectDate(todayString)}
                        >
                            Hari Ini
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9"
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

            {/* Mobile Hourly Agenda (< md) */}
            <div className="space-y-2.5 md:hidden">
                {sortedMobileBookings.length === 0 ? (
                    <div className="space-y-3 rounded-md bg-bone p-8 text-center">
                        <p className="text-base font-semibold text-ink">
                            Tidak ada {config.bookings.itemSingular.toLowerCase()} aktif pada {formatDateIndo(calendar.selected_date)}.
                        </p>
                        <p className="text-xs text-mute">
                            Pilih tanggal lain atau buat {config.bookings.itemSingular.toLowerCase()} baru pada tanggal ini.
                        </p>
                        {canCreateBooking && calendar.is_open && calendar.selected_date >= todayString && (
                            <Button asChild size="sm">
                                <Link href={route('dashboard.bookings.create', { date: calendar.selected_date })}>
                                    <Plus className="size-4" aria-hidden="true" />
                                    {config.bookings.createButtonLabel}
                                </Link>
                            </Button>
                        )}
                    </div>
                ) : (
                    sortedMobileBookings.map((b) => (
                        <button
                            key={b.id}
                            type="button"
                            onClick={() => onSelectBooking(b)}
                            className={`w-full cursor-pointer rounded-md border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${statusPillClasses(b.reservation_status)}`}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold tabular-nums">
                                    {formatBookingScheduleShort(b)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-semibold">
                                        {RESERVATION_STATUS_LABELS[b.reservation_status] ?? b.reservation_status}
                                    </span>
                                    <span className="text-[11px] opacity-80">
                                        · {PAYMENT_STATUS_LABELS[b.payment_status] ?? b.payment_status}
                                    </span>
                                </div>
                            </div>
                            <p className="mt-1 text-sm font-semibold">{b.customer_name}</p>
                            <p className="text-xs">
                                {b.service_summary || b.service_name}
                                {b.staff_name ? ` · ${b.staff_name}` : ''}
                            </p>
                        </button>
                    ))
                )}
            </div>

            {/* Desktop Interactive Time-Grid (md+) */}
            <div className="hidden overflow-x-auto rounded-md border border-hairline-soft bg-canvas md:block">
                <div
                    className="min-w-full"
                    style={{ minWidth: `${64 + columns.length * 165}px` }}
                >
                    {/* Header Row */}
                    <div
                        className="grid border-b border-divider bg-bone/70"
                        style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(165px, 1fr))` }}
                    >
                        <div className="border-r border-divider px-2 py-3 text-center font-mono text-xs font-semibold text-mute">
                            Jam
                        </div>
                        {columns.map((col) => {
                            const colCount = calendar.bookings.filter((b) =>
                                col.id === null ? b.staff_id === null : b.staff_id === col.id
                            ).length;
                            return (
                                <div
                                    key={col.id ?? 'unassigned'}
                                    className="flex items-center justify-between gap-2 border-r border-divider px-3 py-2.5 last:border-r-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-ink">{col.name}</p>
                                        {col.title && <p className="truncate text-xs text-mute">{col.title}</p>}
                                    </div>
                                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                                        {colCount}
                                    </Badge>
                                </div>
                            );
                        })}
                    </div>

                    {/* Grid Body */}
                    <div
                        className="relative grid"
                        style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(165px, 1fr))` }}
                    >
                        {/* Hour Axis */}
                        <div className="border-r border-divider bg-canvas" style={{ height: `${gridHeightPx}px` }}>
                            {hours.map((hr) => {
                                const label = `${String(hr).padStart(2, '0')}:00`;
                                return (
                                    <div
                                        key={hr}
                                        className="border-b border-dashed border-divider px-2 pt-1.5 text-right font-mono text-[11px] font-medium tabular-nums text-mute last:border-b-0"
                                        style={{ height: `${HOUR_HEIGHT_PX}px` }}
                                    >
                                        {label}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Resource Columns */}
                        {columns.map((col) => {
                            const colBookings = calendar.bookings.filter((b) =>
                                col.id === null ? b.staff_id === null : b.staff_id === col.id
                            );
                            const laidOut = layoutColumnBookings(colBookings, startMinutes, endMinutes);
                            const canBookOnDate =
                                canCreateBooking && calendar.is_open && calendar.selected_date >= todayString;

                            return (
                                <div
                                    key={col.id ?? 'unassigned'}
                                    className="relative border-r border-divider last:border-r-0"
                                    style={{ height: `${gridHeightPx}px` }}
                                >
                                    {/* Clickable Hourly Slot Cells */}
                                    {hours.map((hr) => {
                                        const timeStr = `${String(hr).padStart(2, '0')}:00`;
                                        const createHref = route('dashboard.bookings.create', {
                                            date: calendar.selected_date,
                                            time: timeStr,
                                            ...(col.id ? { staff_id: col.id } : {}),
                                        });

                                        return canBookOnDate ? (
                                            <Link
                                                key={hr}
                                                href={createHref}
                                                aria-label={`Buat jadwal baru pukul ${timeStr}${col.id ? ` untuk ${col.name}` : ''}`}
                                                className="group flex items-start justify-end border-b border-dashed border-divider px-2 pt-1.5 transition-colors hover:bg-bone/60 focus-visible:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-inset last:border-b-0"
                                                style={{ height: `${HOUR_HEIGHT_PX}px` }}
                                            >
                                                <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-mute opacity-0 transition-opacity group-hover:opacity-100">
                                                    <Plus className="size-3" aria-hidden="true" />
                                                    {timeStr}
                                                </span>
                                            </Link>
                                        ) : (
                                            <div
                                                key={hr}
                                                className="border-b border-dashed border-divider last:border-b-0"
                                                style={{ height: `${HOUR_HEIGHT_PX}px` }}
                                            />
                                        );
                                    })}

                                    {/* Positioned Booking Blocks */}
                                    {laidOut.map(({ booking: b, topPx, heightPx, lane, totalLanes }) => {
                                        const widthPct = 100 / totalLanes;
                                        const leftPct = lane * widthPct;
                                        return (
                                            <button
                                                key={b.id}
                                                type="button"
                                                onClick={() => onSelectBooking(b)}
                                                style={{
                                                    top: `${topPx + 2}px`,
                                                    height: `${heightPx}px`,
                                                    left: `calc(${leftPct}% + 4px)`,
                                                    width: `calc(${widthPct}% - 8px)`,
                                                }}
                                                className={cn(
                                                    'absolute z-10 flex cursor-pointer flex-col justify-start overflow-hidden rounded-xl border px-2.5 py-1.5 text-left transition-colors focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                    statusPillClasses(b.reservation_status)
                                                )}
                                            >
                                                <div className="flex items-center justify-between gap-1 text-xs font-semibold tabular-nums">
                                                    <span className="truncate font-mono">{b.start_time_local}–{b.end_time_local}</span>
                                                    {b.payment_status === 'waiting_verification' && (
                                                        <span className="shrink-0 rounded-full bg-warning px-1.5 py-0.5 text-[11px] leading-none text-canvas">
                                                            DP
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="truncate text-xs font-semibold leading-tight">
                                                    {b.customer_name}
                                                </p>
                                                {heightPx >= 62 && (
                                                    <p className="truncate text-[11px] opacity-85">
                                                        {b.service_summary || b.service_name}
                                                    </p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
