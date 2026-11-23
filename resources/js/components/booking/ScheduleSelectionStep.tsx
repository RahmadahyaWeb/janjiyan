import { Calendar, PackageCheck, Truck } from 'lucide-react';
import { useMemo } from 'react';
import { HorizontalScrollContainer } from '@/components/HorizontalScrollContainer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DropoffAvailability, SlotItem } from '@/hooks/useSlotFetcher';
import { formatDateIndo, PICKUP_SESSION_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types';
import type { ActiveServiceLine, QuickDateItem, ServiceItem } from './types';

interface ScheduleSelectionStepProps {
    stepNumber: string;
    headingLabel: string;
    businessType: BusinessType;
    timezone: string;
    todayLocal: string;
    maxDateLocal: string;
    quickDates: QuickDateItem[];
    selectedDate: string;
    isCustomDate: boolean;
    isSelectedHoliday: boolean;
    isSelectedDateClosed: boolean;
    hasSelectedService: boolean;
    selectedService: ServiceItem | null;
    isDropoffService: boolean;
    isMultiDropoffMode: boolean;
    activeServiceLines: ActiveServiceLine[];
    singleQuantity: number;
    dropoff: DropoffAvailability | null;
    multiDropoffMap: Record<number, DropoffAvailability>;
    multiDropoffLoading: boolean;
    multiDropoffLoaded: boolean;
    isDropoffReady: boolean;
    multiEstimatedReadyDate: string | null;
    multiWindowInfo: { open_time: string | null; close_time: string | null } | null;
    anyPickupSupported: boolean;
    fulfillmentType: 'dropoff' | 'pickup';
    pickupSession: 'morning' | 'afternoon' | 'evening' | 'anytime';
    pickupAddress: string;
    pickupAddressError: string;
    slots: SlotItem[];
    slotsLoaded: boolean;
    showInitialLoading: boolean;
    showRefreshing: boolean;
    selectedTime: string;
    slotClearedMessage: string;
    serverPickupAddressError?: string;
    onSelectDate: (date: string) => void;
    onSelectTime: (time: string) => void;
    onAdjustMultiQty: (serviceId: number, qty: number) => void;
    onAdjustSingleQty: (qty: number) => void;
    onChangeFulfillmentType: (type: 'dropoff' | 'pickup') => void;
    onChangePickupSession: (session: 'morning' | 'afternoon' | 'evening' | 'anytime') => void;
    onChangePickupAddress: (address: string) => void;
}

type TimePeriodKey = 'morning' | 'afternoon' | 'evening' | 'night';

const TIME_PERIODS: Array<{ key: TimePeriodKey; label: string }> = [
    { key: 'morning', label: 'Pagi' },
    { key: 'afternoon', label: 'Siang' },
    { key: 'evening', label: 'Sore' },
    { key: 'night', label: 'Malam' },
];

function getTimePeriod(time: string): TimePeriodKey {
    const hour = Number.parseInt(time.slice(0, 2), 10);
    if (Number.isNaN(hour) || hour < 12) return 'morning';
    if (hour < 15) return 'afternoon';
    if (hour < 18) return 'evening';
    return 'night';
}

function formatTimezoneShort(tz: string): string {
    if (tz === 'Asia/Jakarta' || tz === 'Asia/Pontianak') return 'WIB';
    if (tz === 'Asia/Makassar') return 'WITA';
    if (tz === 'Asia/Jayapura') return 'WIT';
    return tz;
}

export function ScheduleSelectionStep({
    stepNumber,
    headingLabel,
    businessType,
    timezone,
    todayLocal,
    maxDateLocal,
    quickDates,
    selectedDate,
    isCustomDate,
    isSelectedHoliday,
    isSelectedDateClosed,
    hasSelectedService,
    selectedService,
    isDropoffService,
    isMultiDropoffMode,
    activeServiceLines,
    singleQuantity,
    dropoff,
    multiDropoffMap,
    multiDropoffLoading,
    multiDropoffLoaded,
    isDropoffReady,
    multiEstimatedReadyDate,
    multiWindowInfo,
    anyPickupSupported,
    fulfillmentType,
    pickupSession,
    pickupAddress,
    pickupAddressError,
    slots,
    slotsLoaded,
    showInitialLoading,
    showRefreshing,
    selectedTime,
    slotClearedMessage,
    serverPickupAddressError,
    onSelectDate,
    onSelectTime,
    onAdjustMultiQty,
    onAdjustSingleQty,
    onChangeFulfillmentType,
    onChangePickupSession,
    onChangePickupAddress,
}: ScheduleSelectionStepProps) {
    const groupedSlots = useMemo(() => {
        const buckets: Record<TimePeriodKey, SlotItem[]> = {
            morning: [],
            afternoon: [],
            evening: [],
            night: [],
        };
        for (const slot of slots) {
            buckets[getTimePeriod(slot.time)].push(slot);
        }
        return TIME_PERIODS.map((p) => ({
            ...p,
            items: buckets[p.key],
        })).filter((g) => g.items.length > 0);
    }, [slots]);

    const showSlotCapacityBadge = Boolean(selectedService && selectedService.capacity > 1);

    const customDateChipText = useMemo(() => {
        if (!isCustomDate || !selectedDate) return 'Tanggal lain';
        const d = new Date(`${selectedDate}T00:00:00Z`);
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
        }).format(d);
    }, [isCustomDate, selectedDate]);

    const selectedUnitLabel = selectedService?.unit_label ?? 'item';

    return (
        <section aria-labelledby="step-schedule-heading" id="step-schedule" className="scroll-mt-4">
            <div className="mb-3 flex items-center gap-2">
                <h2 id="step-schedule-heading" className="text-xl font-semibold text-ink">
                    {headingLabel}.
                </h2>
            </div>

            {!hasSelectedService ? (
                <div className="rounded-md border border-dashed border-hairline bg-canvas p-6 text-center">
                    <p className="text-sm font-semibold text-ink">
                        Pilih layanan di langkah 01 terlebih dahulu untuk melihat ketersediaan jadwal.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <div className="min-w-0 space-y-3">
                        <div className="flex min-w-0 items-stretch gap-2">
                            <HorizontalScrollContainer
                                role="group"
                                ariaLabel="Pilih tanggal"
                                wrapperClassName="-ml-4 min-w-0 flex-1 sm:ml-0"
                                className="flex gap-2 pr-8 pb-1 pl-4 sm:px-0"
                            >
                                {quickDates.map(({ date, closed }) => {
                                    const d = new Date(`${date}T00:00:00Z`);
                                    const active = date === selectedDate;
                                    return (
                                        <button
                                            key={date}
                                            type="button"
                                            disabled={closed}
                                            aria-pressed={active}
                                            aria-label={`${formatDateIndo(date)}${closed ? ' (tutup)' : ''}`}
                                            onClick={() => onSelectDate(date)}
                                            className={cn(
                                                'flex w-14 shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-sm border py-2 transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed',
                                                active
                                                    ? 'border-ink bg-ink text-canvas'
                                                    : closed
                                                      ? 'border-hairline-soft bg-bone text-stone line-through'
                                                      : 'border-hairline-soft bg-canvas text-ink hover:border-ink/40'
                                            )}
                                        >
                                            <span className="text-xs font-semibold">
                                                {date === todayLocal
                                                    ? 'Hari ini'
                                                    : new Intl.DateTimeFormat('id-ID', {
                                                          weekday: 'short',
                                                          timeZone: 'UTC',
                                                      }).format(d)}
                                            </span>
                                            <span className="text-lg leading-6 font-semibold tabular-nums">
                                                {d.getUTCDate()}
                                            </span>
                                            <span className="text-xs">
                                                {new Intl.DateTimeFormat('id-ID', {
                                                    month: 'short',
                                                    timeZone: 'UTC',
                                                }).format(d)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </HorizontalScrollContainer>

                            <label
                                className={cn(
                                    'relative mb-1 flex w-22 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border px-1.5 py-2 text-center text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2',
                                    isCustomDate
                                        ? 'border-ink bg-ink text-canvas'
                                        : 'border-dashed border-hairline bg-canvas text-ink hover:border-ink/40'
                                )}
                            >
                                <Calendar className="size-4" aria-hidden="true" />
                                <span className="leading-tight">{customDateChipText}</span>
                                <input
                                    id="booking-date"
                                    type="date"
                                    min={todayLocal}
                                    max={maxDateLocal}
                                    value={selectedDate}
                                    onChange={(e) => e.target.value && onSelectDate(e.target.value)}
                                    onClick={(e) => {
                                        try {
                                            e.currentTarget.showPicker();
                                        } catch {
                                            // Older browsers open the picker on tap anyway.
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter' && e.key !== ' ') return;
                                        e.preventDefault();
                                        try {
                                            e.currentTarget.showPicker();
                                        } catch {
                                            // No picker API: arrow keys still change the date.
                                        }
                                    }}
                                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                                />
                            </label>
                        </div>

                        <p className="text-sm text-mute">
                            {isDropoffService
                                ? fulfillmentType === 'pickup'
                                    ? 'Tanggal penjemputan'
                                    : 'Tanggal drop-off'
                                : 'Tanggal kunjungan'}
                            : <strong className="font-semibold text-ink">{formatDateIndo(selectedDate)}</strong>
                        </p>
                    </div>

                    {isDropoffService ? (
                        <div aria-live="polite" className="space-y-4">
                            {isSelectedHoliday ? (
                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                    Toko libur di tanggal ini. Pilih tanggal lain di atas.
                                </p>
                            ) : isSelectedDateClosed ? (
                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                    Toko tutup di hari itu. Pilih hari lain di atas.
                                </p>
                            ) : (
                                isMultiDropoffMode
                                    ? multiDropoffLoading || !multiDropoffLoaded
                                    : showInitialLoading || !slotsLoaded
                            ) ? (
                                <div className="h-20 rounded-sm bg-bone" aria-label="Memeriksa kuota harian" />
                            ) : (
                                <>
                                    {/* Quota Status Readout (without duplicating quantity steppers) */}
                                    <div className="space-y-2 border-t border-divider pt-4">
                                        {isMultiDropoffMode ? (
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold tracking-wide text-mute uppercase">
                                                    Cek Kuota Harian
                                                </p>
                                                {activeServiceLines.map((line) => {
                                                    const info = multiDropoffMap[line.service.id];
                                                    const svcUnit = line.service.unit_label ?? 'item';
                                                    const overQuota = Boolean(
                                                        info && (!info.available || line.quantity > info.remaining_capacity)
                                                    );
                                                    return (
                                                        <div
                                                            key={line.service.id}
                                                            className={cn(
                                                                'flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs',
                                                                overQuota ? 'bg-destructive-soft' : 'bg-bone'
                                                            )}
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="font-semibold break-words text-ink">
                                                                    {line.service.name} ({line.quantity} {svcUnit})
                                                                </p>
                                                                <p
                                                                    className={cn(
                                                                        'tabular-nums',
                                                                        overQuota ? 'font-medium text-destructive' : 'text-mute'
                                                                    )}
                                                                >
                                                                    {info?.available
                                                                        ? `Sisa kuota: ${info.remaining_capacity} dari ${info.total_capacity} ${svcUnit}`
                                                                        : info?.reason ?? 'Kuota penuh di tanggal ini'}
                                                                </p>
                                                            </div>
                                                            {overQuota && info?.available && info.remaining_capacity > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        onAdjustMultiQty(line.service.id, info.remaining_capacity)
                                                                    }
                                                                    className="min-h-8 cursor-pointer rounded-full bg-canvas px-3 py-1 font-semibold text-ink ring-1 ring-hairline transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                                                >
                                                                    Sesuaikan ke {info.remaining_capacity}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            dropoff && (
                                                <div
                                                    className={cn(
                                                        'flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs',
                                                        !dropoff.available || singleQuantity > dropoff.remaining_capacity
                                                            ? 'bg-destructive-soft'
                                                            : 'bg-bone'
                                                    )}
                                                >
                                                    <span className="tabular-nums text-ink">
                                                        {dropoff.available
                                                            ? `Sisa kuota hari ini: ${dropoff.remaining_capacity} dari ${dropoff.total_capacity} ${selectedUnitLabel}`
                                                            : dropoff.reason ?? 'Kuota harian penuh pada tanggal ini.'}
                                                    </span>
                                                    {dropoff.available &&
                                                        dropoff.remaining_capacity > 0 &&
                                                        singleQuantity > dropoff.remaining_capacity && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onAdjustSingleQty(dropoff.remaining_capacity)}
                                                                className="min-h-8 cursor-pointer rounded-full bg-canvas px-3 py-1 font-semibold text-ink ring-1 ring-hairline transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                                            >
                                                                Sesuaikan ke {dropoff.remaining_capacity}
                                                            </button>
                                                        )}
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {!isDropoffReady ? (
                                        <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                            {isMultiDropoffMode
                                                ? 'Kuota salah satu layanan tidak mencukupi pada tanggal ini. Sesuaikan jumlah atau pilih tanggal lain.'
                                                : dropoff?.reason ?? 'Kuota harian penuh pada tanggal ini. Silakan pilih tanggal lain.'}
                                        </p>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4 text-sm">
                                                <div className="flex items-center gap-2 text-ink">
                                                    <PackageCheck className="size-4 shrink-0 text-electric" aria-hidden="true" />
                                                    <span>
                                                        Datang kapan saja pukul{' '}
                                                        <strong className="font-mono tabular-nums">
                                                            {multiWindowInfo?.open_time ?? dropoff?.open_time}–
                                                            {multiWindowInfo?.close_time ?? dropoff?.close_time}
                                                        </strong>
                                                    </span>
                                                </div>
                                                {multiEstimatedReadyDate && (
                                                    <span className="font-semibold text-ink">
                                                        Est. selesai: {formatDateIndo(multiEstimatedReadyDate)}
                                                    </span>
                                                )}
                                            </div>

                                            {anyPickupSupported && (
                                                <div className="space-y-3 border-t border-divider pt-4">
                                                    <p className="text-sm font-semibold text-ink">Metode penyerahan</p>
                                                    <div
                                                        className="grid grid-cols-2 rounded-xl bg-bone p-1"
                                                        role="group"
                                                        aria-label="Pilih metode penyerahan barang"
                                                    >
                                                        <button
                                                            type="button"
                                                            aria-pressed={fulfillmentType === 'dropoff'}
                                                            onClick={() => onChangeFulfillmentType('dropoff')}
                                                            className={cn(
                                                                'min-h-10 cursor-pointer rounded-xs px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                                fulfillmentType === 'dropoff' ? 'bg-canvas text-ink' : 'text-mute'
                                                            )}
                                                        >
                                                            Antar ke toko
                                                        </button>
                                                        <button
                                                            type="button"
                                                            aria-pressed={fulfillmentType === 'pickup'}
                                                            onClick={() => onChangeFulfillmentType('pickup')}
                                                            className={cn(
                                                                'inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xs px-2 py-2 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                                fulfillmentType === 'pickup' ? 'bg-canvas text-ink' : 'text-mute'
                                                            )}
                                                        >
                                                            <Truck className="size-3.5 max-[359px]:hidden" aria-hidden="true" />
                                                            Jemput &amp; antar
                                                        </button>
                                                    </div>

                                                    {fulfillmentType === 'pickup' && (
                                                        <div className="space-y-3 pt-1">
                                                            <div className="space-y-1.5">
                                                                <p className="text-xs font-semibold text-mute">Sesi penjemputan</p>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {(['morning', 'afternoon', 'evening', 'anytime'] as const).map(
                                                                        (sess) => (
                                                                            <button
                                                                                key={sess}
                                                                                type="button"
                                                                                aria-pressed={pickupSession === sess}
                                                                                onClick={() => onChangePickupSession(sess)}
                                                                                className={cn(
                                                                                    'min-h-10 cursor-pointer rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                                                    pickupSession === sess
                                                                                        ? 'bg-ink text-canvas'
                                                                                        : 'bg-bone text-ink hover:bg-hairline-soft'
                                                                                )}
                                                                            >
                                                                                {PICKUP_SESSION_LABELS[sess]}
                                                                            </button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <Label htmlFor="pickup-address" className="text-xs">
                                                                    Alamat penjemputan *
                                                                </Label>
                                                                <Textarea
                                                                    id="pickup-address"
                                                                    rows={2}
                                                                    placeholder="Contoh: Jl. Melati No. 10, RT 02/05 (pagar hitam)"
                                                                    value={pickupAddress}
                                                                    onChange={(e) => onChangePickupAddress(e.target.value)}
                                                                    aria-invalid={Boolean(
                                                                        pickupAddressError || serverPickupAddressError
                                                                    )}
                                                                    aria-describedby={
                                                                        pickupAddressError || serverPickupAddressError
                                                                            ? 'pickup-address-error'
                                                                            : undefined
                                                                    }
                                                                />
                                                                {(pickupAddressError || serverPickupAddressError) && (
                                                                    <p
                                                                        id="pickup-address-error"
                                                                        className="text-xs font-medium text-destructive"
                                                                    >
                                                                        {pickupAddressError || serverPickupAddressError}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div aria-live="polite" className="min-h-[148px]">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-ink">
                                    Pilih jam ({formatTimezoneShort(timezone)})
                                </p>
                                {showRefreshing && <span className="text-xs font-medium text-mute">Memperbarui…</span>}
                            </div>

                            {slotClearedMessage && (
                                <p
                                    role="status"
                                    className="mb-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs font-medium text-warning"
                                >
                                    {slotClearedMessage}
                                </p>
                            )}

                            {isSelectedHoliday ? (
                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                    Toko libur di tanggal ini. Pilih tanggal lain di atas.
                                </p>
                            ) : isSelectedDateClosed ? (
                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                    Toko tutup di hari itu. Pilih hari lain di atas.
                                </p>
                            ) : showInitialLoading ? (
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Memuat ketersediaan jadwal">
                                    {Array.from({ length: 8 }).map((_, idx) => (
                                        <div key={idx} className="h-11 rounded-full bg-bone" />
                                    ))}
                                </div>
                            ) : !slotsLoaded ? (
                                <div className="min-h-[104px]" />
                            ) : slots.length === 0 ? (
                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                    Tidak ada slot tersisa di tanggal ini. Coba pilih tanggal lain.
                                </p>
                            ) : (
                                <div
                                    className={cn(
                                        'space-y-4 transition-opacity duration-150',
                                        showRefreshing && 'opacity-60'
                                    )}
                                    role="group"
                                    aria-label={
                                        businessType === 'space_booking' ? 'Pilih jam sesi' : 'Pilih jam reservasi'
                                    }
                                >
                                    {groupedSlots.map((group) => (
                                        <div key={group.key} className="space-y-2">
                                            <p className="text-xs font-semibold text-mute">{group.label}</p>
                                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                                {group.items.map((slot) => {
                                                    const active = selectedTime === slot.time;
                                                    const lowCap =
                                                        showSlotCapacityBadge && slot.available_capacity <= 3;
                                                    return (
                                                        <button
                                                            key={slot.time}
                                                            type="button"
                                                            aria-pressed={active}
                                                            onClick={() => onSelectTime(slot.time)}
                                                            className={cn(
                                                                'flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-full px-2 py-1.5 font-mono text-sm font-semibold tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                                                active
                                                                    ? 'bg-ink text-canvas'
                                                                    : 'bg-bone text-ink hover:bg-hairline'
                                                            )}
                                                        >
                                                            <span>{slot.time}</span>
                                                            {lowCap && (
                                                                <span
                                                                    className={cn(
                                                                        'font-sans text-[10px] leading-none font-medium',
                                                                        active ? 'text-on-dark-mute' : 'text-mute'
                                                                    )}
                                                                >
                                                                    sisa {slot.available_capacity}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
