import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Calendar,
    Check,
    Clock,
    CreditCard,
    FileText,
    MessageCircle,
    Minus,
    PackageCheck,
    Plus,
    ShieldCheck,
    Truck,
    Upload,
    UserCheck,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { HorizontalScrollContainer } from '@/components/HorizontalScrollContainer';
import { BusinessHeader, headerActionClass } from '@/components/BusinessHeader';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import { getBusinessTypeConfig, resolveBusinessType } from '@/lib/businessType';
import {
    buildWhatsAppUrl,
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
    getLocalDayOfWeek,
    formatTurnaroundLabel,
    PICKUP_SESSION_LABELS,
} from '@/lib/format';
import { cn, scrollToFirstInvalid } from '@/lib/utils';
import type { BusinessType, PageProps, ServiceUnitLabel } from '@/types';

interface StaffOption {
    id: number;
    name: string;
    title: string | null;
}

interface ServiceItem {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    duration_minutes: number;
    buffer_minutes: number;
    capacity: number;
    assignment_mode: 'staff' | 'capacity';
    booking_mode?: 'time_slot' | 'dropoff';
    turnaround_days?: number;
    supports_pickup?: boolean;
    unit_label?: ServiceUnitLabel;
    dp_type: 'none' | 'fixed' | 'percentage';
    dp_value: number;
    dp_amount: number;
    staff: StaffOption[];
}

interface BankAccount {
    bank_name: string;
    account_number: string;
    account_holder: string;
}

interface OperatingHourItem {
    day_of_week: number;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
    break_start: string | null;
    break_end: string | null;
}

interface BusinessData {
    id: number;
    name: string;
    slug: string;
    category: string;
    business_type?: BusinessType;
    phone: string | null;
    timezone: string;
    logo_url: string | null;
    brand_color: string | null;
    qris_url: string | null;
    bank_accounts: BankAccount[];
    dp_expiry_minutes: number;
    min_booking_lead_minutes?: number;
    max_booking_advance_days?: number;
}

interface BookingPortalProps {
    business: BusinessData;
    services: ServiceItem[];
    operatingHours?: OperatingHourItem[];
    holidays: string[];
    selectedServiceId?: number | null;
    bookingDisabledReason?: string | null;
}

export default function BookingPortal({
    business,
    services,
    operatingHours = [],
    holidays,
    selectedServiceId = null,
    bookingDisabledReason = null,
}: BookingPortalProps) {
    const { flash, errors = {} } = usePage<PageProps & { errors?: Record<string, string> }>().props;

    const tz = business.timezone || 'Asia/Jakarta';
    const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const maxAdvanceDays = business.max_booking_advance_days ?? 60;
    const maxDateLocal = useMemo(() => {
        const d = new Date(`${todayLocal}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + maxAdvanceDays);
        return d.toISOString().slice(0, 10);
    }, [todayLocal, maxAdvanceDays]);

    const [selectedService, setSelectedService] = useState<ServiceItem | null>(
        services.find((s) => s.id === selectedServiceId) ?? services[0] ?? null
    );
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(todayLocal);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [quantity, setQuantity] = useState<number>(1);
    const [fulfillmentType, setFulfillmentType] = useState<'dropoff' | 'pickup'>('dropoff');
    const [pickupSession, setPickupSession] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('anytime');
    const [pickupAddress, setPickupAddress] = useState('');
    const [pickupAddressError, setPickupAddressError] = useState('');

    // Arrived from a service on the shop home: show that card, it may be far down the list.
    useEffect(() => {
        if (selectedServiceId) document.getElementById(`service-${selectedServiceId}`)?.scrollIntoView({ block: 'center' });
    }, [selectedServiceId]);

    // Keep focused fields and scroll targets clear of the mobile bottom bar (WCAG 2.4.11).
    useEffect(() => {
        const padding = ['scroll-pt-4', 'scroll-pb-28', 'lg:scroll-pb-0'];
        document.documentElement.classList.add(...padding);
        return () => document.documentElement.classList.remove(...padding);
    }, []);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');
    const [dpMode, setDpMode] = useState<'now' | 'later'>('now');
    const [dpProof, setDpProof] = useState<File | null>(null);
    const [dpProofError, setDpProofError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    const hoursByDay = useMemo(() => {
        const map = new Map<number, OperatingHourItem>();
        for (const h of operatingHours) {
            map.set(h.day_of_week, h);
        }
        return map;
    }, [operatingHours]);

    const selectedDateDayOfWeek = getLocalDayOfWeek(selectedDate);
    const selectedDateSchedule = hoursByDay.get(selectedDateDayOfWeek);
    const isSelectedDateClosed = Boolean(selectedDateSchedule && !selectedDateSchedule.is_open);

    // Quick-pick strip for the next 14 days; the native date input stays for dates further out.
    const quickDates = useMemo(() => {
        const days: { date: string; closed: boolean }[] = [];
        const d = new Date(`${todayLocal}T00:00:00Z`);
        for (let i = 0; i < 14; i++) {
            const date = d.toISOString().slice(0, 10);
            if (date > maxDateLocal) break;
            const schedule = hoursByDay.get(d.getUTCDay());
            days.push({ date, closed: Boolean(schedule && !schedule.is_open) || holidays.includes(date) });
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return days;
    }, [todayLocal, maxDateLocal, hoursByDay, holidays]);

    const selectedStaffObj = useMemo(() => {
        if (!selectedService || selectedStaffId === null) return null;
        return selectedService.staff.find((s) => s.id === selectedStaffId) ?? null;
    }, [selectedService, selectedStaffId]);

    const isSelectedHoliday = holidays.includes(selectedDate);
    const isCustomDate = !quickDates.some((q) => q.date === selectedDate);

    const slotUrl = useMemo(() => {
        if (!selectedService || !selectedDate || isSelectedHoliday || isSelectedDateClosed) {
            return null;
        }
        const params = new URLSearchParams({
            service_id: String(selectedService.id),
            date: selectedDate,
        });
        if (selectedService.assignment_mode === 'staff' && selectedStaffId !== null) {
            params.set('staff_id', String(selectedStaffId));
        }
        return `/b/${business.slug}/slots?${params.toString()}`;
    }, [business.slug, selectedService, selectedStaffId, selectedDate, isSelectedHoliday, isSelectedDateClosed]);

    const businessType = resolveBusinessType(business.business_type);
    const typeConfig = getBusinessTypeConfig(businessType);
    const isStaffAppointment = businessType === 'staff_appointment';
    const isDropoffService = businessType === 'dropoff' || selectedService?.booking_mode === 'dropoff';
    const selectedUnitLabel = selectedService?.unit_label ?? 'item';
    const showStaffStep = Boolean(
        isStaffAppointment && !isDropoffService && selectedService?.assignment_mode === 'staff' && selectedService.staff.length > 0
    );
    const bookingNoun = businessType === 'dropoff' ? 'pesanan' : businessType === 'space_booking' ? 'booking' : 'reservasi';
    const lookupLabel = businessType === 'dropoff' ? 'Cek pesanan' : businessType === 'space_booking' ? 'Cek booking' : 'Cek reservasi';
    const submitLabel = businessType === 'dropoff' ? 'Buat pesanan' : businessType === 'space_booking' ? 'Buat booking' : 'Buat reservasi';

    const { slots, dropoff, hasLoaded: slotsLoaded, showInitialLoading, showRefreshing } = useSlotFetcher({
        url: slotUrl,
        enabled: slotUrl !== null,
        onResolved: (nextSlots: SlotItem[], nextDropoff) => {
            if (isDropoffService) {
                setSelectedTime('');
                if (nextDropoff && nextDropoff.remaining_capacity > 0) {
                    setQuantity((prev) => Math.min(prev, nextDropoff.remaining_capacity));
                }
                return;
            }
            setSelectedTime((prev) => (prev && nextSlots.some((s) => s.time === prev) ? prev : ''));
        },
    });

    useEffect(() => {
        if (isSelectedHoliday || isSelectedDateClosed) {
            setSelectedTime('');
        }
    }, [isSelectedHoliday, isSelectedDateClosed]);

    const effectiveQuantity = isDropoffService ? Math.max(1, quantity) : 1;
    const computedTotalPrice = (selectedService?.price ?? 0) * effectiveQuantity;
    const computedDpAmount = Math.min(computedTotalPrice, (selectedService?.dp_amount ?? 0) * effectiveQuantity);
    const requiresDp = computedDpAmount > 0;

    const isDropoffReady = Boolean(
        isDropoffService &&
            dropoff?.available &&
            dropoff.remaining_capacity >= effectiveQuantity &&
            !isSelectedHoliday &&
            !isSelectedDateClosed
    );
    const canShowCustomerStep = isDropoffService ? isDropoffReady : Boolean(selectedTime);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!selectedService) return;
        if (!isDropoffService && !selectedTime) return;
        if (isDropoffService && !isDropoffReady) return;

        if (isDropoffService && selectedService.supports_pickup && fulfillmentType === 'pickup' && pickupAddress.trim() === '') {
            setPickupAddressError('Alamat penjemputan wajib diisi untuk layanan jemput & antar.');
            document.getElementById('pickup-address')?.focus();
            return;
        }
        setPickupAddressError('');

        if (requiresDp && dpMode === 'now' && !dpProof) {
            setDpProofError('Unggah bukti transfer DP terlebih dahulu, atau pilih opsi Bayar DP nanti.');
            document.getElementById('dp-proof-upload')?.focus();
            return;
        }
        setDpProofError('');

        setSubmitting(true);
        router.post(
            route('public.booking.store', business.slug),
            {
                service_id: selectedService.id,
                date: selectedDate,
                time: isDropoffService ? null : selectedTime,
                quantity: effectiveQuantity,
                fulfillment_type: isDropoffService && selectedService.supports_pickup ? fulfillmentType : 'dropoff',
                pickup_session: isDropoffService && selectedService.supports_pickup && fulfillmentType === 'pickup' ? pickupSession : null,
                pickup_address: isDropoffService && selectedService.supports_pickup && fulfillmentType === 'pickup' ? pickupAddress.trim() : null,
                staff_id: showStaffStep ? selectedStaffId : null,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: customerEmail || null,
                customer_notes: customerNotes || null,
                dp_proof: dpMode === 'now' ? dpProof : null,
            },
            {
                forceFormData: true,
                onError: () => scrollToFirstInvalid(),
                onFinish: () => setSubmitting(false),
            }
        );
    };

    const waTopic =
        businessType === 'dropoff'
            ? 'layanan dan jadwal drop-off'
            : businessType === 'space_booking'
              ? 'fasilitas dan jadwal booking'
              : 'layanan dan jadwal janji temu';
    const whatsappChatUrl = business.phone
        ? buildWhatsAppUrl(business.phone, `Halo ${business.name}, saya ingin bertanya tentang ${waTopic}.`)
        : null;

    return (
        <div className={cn('min-h-screen bg-canvas text-ink', services.length > 0 && 'pb-24 lg:pb-0')}>
            <Head title={`${typeConfig.publicPortal.bookingPageTitle} — ${business.name}`} />

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke daftar layanan
            </a>

            <BusinessHeader business={business} label={typeConfig.publicPortal.bookingPageTitle}>
                <Link href={route('public.booking.invoices', business.slug)} className={headerActionClass}>
                    <FileText className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{lookupLabel}</span>
                    <span className="sr-only sm:hidden">{lookupLabel}</span>
                </Link>
                {whatsappChatUrl && (
                    <a href={whatsappChatUrl} target="_blank" rel="noreferrer" className={headerActionClass}>
                        <MessageCircle className="size-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Chat WhatsApp</span>
                        <span className="sr-only sm:hidden">WhatsApp</span>
                    </a>
                )}
            </BusinessHeader>

            <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-6 sm:py-12">
                {bookingDisabledReason && (
                    <div role="alert" className="mb-6 rounded-sm bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
                        {bookingDisabledReason}
                    </div>
                )}
                {flash.error && (
                    <div role="alert" className="mb-6 rounded-sm bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
                        {flash.error}
                    </div>
                )}

                {services.length === 0 ? (
                    <div className="rounded-md bg-bone p-10 text-center">
                        <p className="text-lg font-semibold text-ink">Belum ada layanan tersedia.</p>
                        <p className="mt-1 text-sm text-mute">Toko sedang menyiapkan daftar layanan.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                        {/* Left Column: Booking Steps */}
                        <div className="min-w-0 space-y-10">
                            {/* Step 1: Pilih Layanan */}
                            <section aria-labelledby="step-services-heading" id="layanan" className="scroll-mt-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-mute">01</span>
                                    <h2 id="step-services-heading" className="text-xl font-semibold text-ink">
                                        {typeConfig.publicPortal.steps.serviceLabel}.
                                    </h2>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    {services.map((service) => {
                                        const active = selectedService?.id === service.id;
                                        return (
                                            <button
                                                key={service.id}
                                                id={`service-${service.id}`}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => {
                                                    setSelectedService(service);
                                                    setSelectedStaffId(null);
                                                    setQuantity(1);
                                                    setFulfillmentType('dropoff');
                                                    setPickupSession('anytime');
                                                    setPickupAddressError('');
                                                }}
                                                className={cn(
                                                    'flex cursor-pointer flex-col justify-between rounded-md p-5 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                                    active
                                                        ? 'bg-canvas ring-2 ring-ink'
                                                        : 'bg-canvas ring-1 ring-hairline hover:ring-ink/40'
                                                )}
                                            >
                                                <div className="flex items-start gap-3.5 sm:block">
                                                    {service.image_url && (
                                                        <img
                                                            src={service.image_url}
                                                            alt={`Foto layanan ${service.name}`}
                                                            className="size-20 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10 sm:mb-4 sm:aspect-[16/10] sm:h-auto sm:w-full sm:rounded-xs"
                                                        />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h3 className="text-base font-semibold text-ink">{service.name}</h3>
                                                            {active && (
                                                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
                                                                    <Check className="size-3" aria-hidden="true" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        {service.description && (
                                                            <p className="mt-1.5 text-sm leading-relaxed text-mute">
                                                                {service.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 space-y-2 border-t border-divider pt-3">
                                                    <span className="block text-lg font-semibold tabular-nums text-ink">
                                                        {formatRupiah(service.price)}
                                                        {(businessType === 'dropoff' || service.booking_mode === 'dropoff') && (
                                                            <span className="text-sm font-normal text-mute">
                                                                {' '}
                                                                / {service.unit_label ?? 'item'}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-mute">
                                                        <span className="inline-flex items-center gap-1 tabular-nums">
                                                            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                                                            {service.booking_mode === 'dropoff'
                                                                ? formatTurnaroundLabel(service.turnaround_days ?? 1)
                                                                : `${service.duration_minutes} mnt`}
                                                        </span>
                                                        {service.booking_mode === 'dropoff' ? (
                                                            <>
                                                                <span className="inline-flex items-center gap-1 tabular-nums">
                                                                    <PackageCheck className="size-3.5 shrink-0" aria-hidden="true" />
                                                                    Kuota {service.capacity} {service.unit_label ?? 'item'}/hari
                                                                </span>
                                                                {service.supports_pickup && (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Truck className="size-3.5 shrink-0" aria-hidden="true" />
                                                                        Bisa jemput-antar
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            service.assignment_mode === 'capacity' && (
                                                                <span className="inline-flex items-center gap-1 tabular-nums">
                                                                    <UserCheck className="size-3.5 shrink-0" aria-hidden="true" />
                                                                    Kapasitas {service.capacity}
                                                                </span>
                                                            )
                                                        )}
                                                        {service.dp_amount > 0 && (
                                                            <span className="inline-flex items-center gap-1 tabular-nums">
                                                                <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
                                                                DP {formatRupiah(service.dp_amount)}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Step 2: Pilih Staff (hanya jika staff_appointment) */}
                            {showStaffStep && selectedService && (
                                <section aria-labelledby="step-staff-heading">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-mute">02</span>
                                        <h2 id="step-staff-heading" className="text-xl font-semibold text-ink">
                                            {typeConfig.publicPortal.steps.staffLabel ?? 'Pilih Staff'}.
                                        </h2>
                                    </div>

                                    <div className="flex flex-wrap gap-2.5" role="group" aria-label="Pilih staff">
                                        <button
                                            type="button"
                                            aria-pressed={selectedStaffId === null}
                                            onClick={() => setSelectedStaffId(null)}
                                            className={cn(
                                                'inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                                selectedStaffId === null
                                                    ? 'bg-ink text-canvas'
                                                    : 'bg-bone text-ink hover:bg-hairline-soft'
                                            )}
                                        >
                                            <UserCheck className="size-4" aria-hidden="true" />
                                            Siapa saja yang tersedia
                                        </button>

                                        {selectedService.staff.map((staff) => (
                                            <button
                                                key={staff.id}
                                                type="button"
                                                aria-pressed={selectedStaffId === staff.id}
                                                onClick={() => setSelectedStaffId(staff.id)}
                                                className={cn(
                                                    'inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                                    selectedStaffId === staff.id
                                                        ? 'bg-ink text-canvas'
                                                        : 'bg-bone text-ink hover:bg-hairline-soft'
                                                )}
                                            >
                                                <span>{staff.name}</span>
                                                {staff.title && (
                                                    <span
                                                        className={cn(
                                                            'text-xs font-normal',
                                                            selectedStaffId === staff.id ? 'text-on-dark-mute' : 'text-mute'
                                                        )}
                                                    >
                                                        · {staff.title}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Step 3: Tanggal & Slot Waktu atau Drop-off Harian */}
                            <section aria-labelledby="step-schedule-heading" id="step-schedule" className="scroll-mt-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-mute">
                                        {showStaffStep ? '03' : '02'}
                                    </span>
                                    <h2 id="step-schedule-heading" className="text-xl font-semibold text-ink">
                                        {typeConfig.publicPortal.steps.scheduleLabel}.
                                    </h2>
                                </div>

                                <div className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                                    <div className="min-w-0 space-y-3">
                                    <div className="flex items-stretch gap-2">
                                    <HorizontalScrollContainer
                                        role="group"
                                        ariaLabel="Pilih tanggal"
                                        wrapperClassName="-ml-4 flex-1 sm:ml-0"
                                        className="flex gap-2 pb-1 pl-4 sm:pl-0"
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
                                                    onClick={() => setSelectedDate(date)}
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
                                                            : new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(d)}
                                                    </span>
                                                    <span className="text-lg leading-6 font-semibold tabular-nums">{d.getUTCDate()}</span>
                                                    <span className="text-xs">
                                                        {new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(d)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </HorizontalScrollContainer>
                                        {/* Kept outside the scroll strip so it is always reachable; dates beyond the strip: transparent native date input over the chip */}
                                        <label
                                            className={cn(
                                                'relative mb-1 flex w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border py-2 text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2',
                                                isCustomDate
                                                    ? 'border-ink bg-ink text-canvas'
                                                    : 'border-dashed border-hairline bg-canvas text-ink hover:border-ink/40'
                                            )}
                                        >
                                            <Calendar className="size-4" aria-hidden="true" />
                                            <span className="whitespace-nowrap">Tanggal lain</span>
                                            <input
                                                id="booking-date"
                                                type="date"
                                                min={todayLocal}
                                                max={maxDateLocal}
                                                value={selectedDate}
                                                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                                                onClick={(e) => {
                                                    try {
                                                        e.currentTarget.showPicker();
                                                    } catch {
                                                        // Older browsers open the picker on tap anyway.
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    // The segments are invisible, so Enter/Space open the picker instead of submitting the form.
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
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-ink">Jumlah {selectedUnitLabel}</p>
                                                    <p className="text-xs text-mute">
                                                        {dropoff?.available
                                                            ? `Sisa kuota hari ini: ${dropoff.remaining_capacity} dari ${dropoff.total_capacity} ${selectedUnitLabel}`
                                                            : 'Kuota mengikuti jadwal buka toko'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        aria-label={`Kurangi jumlah ${selectedUnitLabel}`}
                                                        disabled={quantity <= 1}
                                                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                                        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-hairline-soft bg-canvas text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <Minus className="size-4" aria-hidden="true" />
                                                    </button>
                                                    <span
                                                        aria-live="polite"
                                                        className="min-w-8 text-center font-mono text-base font-semibold tabular-nums text-ink"
                                                    >
                                                        {quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Tambah jumlah ${selectedUnitLabel}`}
                                                        disabled={
                                                            dropoff?.available
                                                                ? quantity >= Math.min(50, dropoff.remaining_capacity)
                                                                : quantity >= 50
                                                        }
                                                        onClick={() =>
                                                            setQuantity((q) =>
                                                                Math.min(dropoff?.available ? Math.min(50, dropoff.remaining_capacity) : 50, q + 1)
                                                            )
                                                        }
                                                        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-hairline-soft bg-canvas text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <Plus className="size-4" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>

                                            {isSelectedHoliday ? (
                                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                                    Toko libur di tanggal ini. Pilih tanggal lain.
                                                </p>
                                            ) : isSelectedDateClosed ? (
                                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                                    Toko tutup di hari itu. Pilih hari lain.
                                                </p>
                                            ) : showInitialLoading || !slotsLoaded ? (
                                                <div className="h-20 rounded-sm bg-bone" aria-label="Memeriksa kuota harian" />
                                            ) : !dropoff?.available ? (
                                                <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                                    {dropoff?.reason ?? 'Kuota harian penuh pada tanggal ini. Silakan pilih tanggal lain.'}
                                                </p>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4 text-sm">
                                                        <div className="flex items-center gap-2 text-ink">
                                                            <PackageCheck className="size-4 shrink-0 text-electric" aria-hidden="true" />
                                                            <span>
                                                                Datang kapan saja pukul{' '}
                                                                <strong className="font-mono tabular-nums">
                                                                    {dropoff.open_time}–{dropoff.close_time}
                                                                </strong>
                                                            </span>
                                                        </div>
                                                        {dropoff.estimated_ready_date && (
                                                            <span className="font-semibold text-ink">
                                                                Est. selesai: {formatDateIndo(dropoff.estimated_ready_date)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {selectedService?.supports_pickup && (
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
                                                                    onClick={() => {
                                                                        setFulfillmentType('dropoff');
                                                                        setPickupAddressError('');
                                                                    }}
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
                                                                    onClick={() => setFulfillmentType('pickup')}
                                                                    className={cn(
                                                                        'inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xs px-2 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
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
                                                                            {(['morning', 'afternoon', 'evening', 'anytime'] as const).map((sess) => (
                                                                                <button
                                                                                    key={sess}
                                                                                    type="button"
                                                                                    aria-pressed={pickupSession === sess}
                                                                                    onClick={() => setPickupSession(sess)}
                                                                                    className={cn(
                                                                                        'min-h-10 cursor-pointer rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                                                        pickupSession === sess
                                                                                            ? 'bg-ink text-canvas'
                                                                                            : 'bg-bone text-ink hover:bg-hairline-soft'
                                                                                    )}
                                                                                >
                                                                                    {PICKUP_SESSION_LABELS[sess]}
                                                                                </button>
                                                                            ))}
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
                                                                            onChange={(e) => {
                                                                                setPickupAddress(e.target.value);
                                                                                setPickupAddressError('');
                                                                            }}
                                                                            aria-invalid={Boolean(pickupAddressError || errors.pickup_address)}
                                                                            aria-describedby={pickupAddressError || errors.pickup_address ? 'pickup-address-error' : undefined}
                                                                        />
                                                                        {(pickupAddressError || errors.pickup_address) && (
                                                                            <p id="pickup-address-error" className="text-xs font-medium text-destructive">
                                                                                {pickupAddressError || errors.pickup_address}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                    <div aria-live="polite" className="min-h-[148px]">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-ink">
                                                Slot tersedia ({tz})
                                            </p>
                                            {showRefreshing && (
                                                <span className="text-xs font-medium text-mute">
                                                    Memperbarui…
                                                </span>
                                            )}
                                        </div>

                                        {isSelectedHoliday ? (
                                            <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                                Toko libur di tanggal ini. Pilih tanggal lain.
                                            </p>
                                        ) : isSelectedDateClosed ? (
                                            <p className="rounded-sm bg-bone p-4 text-sm text-mute">
                                                Toko tutup di hari itu. Pilih hari lain.
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
                                                    'grid grid-cols-3 gap-2 transition-opacity duration-150 sm:grid-cols-4',
                                                    showRefreshing && 'opacity-60'
                                                )}
                                                role="group"
                                                aria-label={businessType === 'space_booking' ? 'Pilih jam sesi' : 'Pilih jam reservasi'}
                                            >
                                                {slots.map((slot) => {
                                                    const active = selectedTime === slot.time;
                                                    return (
                                                        <button
                                                            key={slot.time}
                                                            type="button"
                                                            aria-pressed={active}
                                                            onClick={() => setSelectedTime(slot.time)}
                                                            className={cn(
                                                                'flex h-11 cursor-pointer flex-col items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                                                active
                                                                    ? 'bg-ink text-canvas'
                                                                    : 'bg-bone text-ink hover:bg-hairline'
                                                            )}
                                                        >
                                                            <span>{slot.time}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </div>
                            </section>

                            {/* Step 4: Data Pemesan & DP */}
                            {canShowCustomerStep ? (
                                <section aria-labelledby="step-customer-heading" className="space-y-6 rounded-md bg-bone p-5 sm:p-6">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-mute">
                                                {showStaffStep ? '04' : '03'}
                                            </span>
                                            <h2 id="step-customer-heading" className="text-xl font-semibold text-ink">
                                                Detail pemesan.
                                            </h2>
                                        </div>
                                        <p className="mt-1 text-sm text-mute">
                                            Tanpa perlu membuat akun. Bukti &amp; status {bookingNoun} langsung muncul setelah submit.
                                        </p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="customer_name">Nama lengkap *</Label>
                                            <Input
                                                id="customer_name"
                                                autoComplete="name"
                                                className="bg-canvas"
                                                placeholder="Contoh: Andi Wijaya"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                aria-invalid={Boolean(errors.customer_name)}
                                                aria-describedby={errors.customer_name ? 'customer-name-error' : undefined}
                                                required
                                            />
                                            {errors.customer_name && (
                                                <p id="customer-name-error" className="text-xs text-destructive">
                                                    {errors.customer_name}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="customer_phone">Nomor WhatsApp *</Label>
                                            <Input
                                                id="customer_phone"
                                                type="tel"
                                                inputMode="tel"
                                                autoComplete="tel"
                                                className="bg-canvas"
                                                placeholder="08123456789"
                                                value={customerPhone}
                                                onChange={(e) => setCustomerPhone(e.target.value)}
                                                aria-invalid={Boolean(errors.customer_phone)}
                                                aria-describedby={errors.customer_phone ? 'customer-phone-error' : undefined}
                                                required
                                            />
                                            {errors.customer_phone && (
                                                <p id="customer-phone-error" className="text-xs text-destructive">
                                                    {errors.customer_phone}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 sm:col-span-2">
                                            <Label htmlFor="customer_email">Email (opsional)</Label>
                                            <Input
                                                id="customer_email"
                                                type="email"
                                                autoComplete="email"
                                                className="bg-canvas"
                                                placeholder="andi@email.com"
                                                value={customerEmail}
                                                onChange={(e) => setCustomerEmail(e.target.value)}
                                                aria-invalid={Boolean(errors.customer_email)}
                                                aria-describedby={errors.customer_email ? 'customer-email-error' : undefined}
                                            />
                                            {errors.customer_email && (
                                                <p id="customer-email-error" className="text-xs text-destructive">
                                                    {errors.customer_email}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 sm:col-span-2">
                                            <Label htmlFor="customer_notes">Catatan tambahan (opsional)</Label>
                                            <Textarea
                                                id="customer_notes"
                                                className="bg-canvas"
                                                placeholder={
                                                    businessType === 'dropoff'
                                                        ? 'Contoh: Ada noda di bagian kerah, atau patokan alamat rumah'
                                                        : businessType === 'space_booking'
                                                          ? 'Contoh: Butuh tambahan perlengkapan atau persiapan ruangan'
                                                          : 'Contoh: Preferensi khusus layanan atau catatan untuk staff'
                                                }
                                                value={customerNotes}
                                                onChange={(e) => setCustomerNotes(e.target.value)}
                                                aria-invalid={Boolean(errors.customer_notes)}
                                                aria-describedby={errors.customer_notes ? 'customer-notes-error' : undefined}
                                            />
                                            {errors.customer_notes && (
                                                <p id="customer-notes-error" className="text-xs text-destructive">
                                                    {errors.customer_notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* DP Payment Section */}
                                    {requiresDp && selectedService && (
                                        <div className="space-y-4 rounded-xs border border-hairline-soft bg-canvas p-5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <h3 className="text-base font-semibold text-ink">
                                                        Down payment (DP) diperlukan
                                                    </h3>
                                                    <p className="text-xs text-mute">
                                                        Transfer langsung ke rekening toko.
                                                    </p>
                                                </div>
                                                <span className="text-lg font-semibold tabular-nums text-ink">
                                                    {formatRupiah(computedDpAmount)}
                                                </span>
                                            </div>

                                            {business.bank_accounts.length > 0 && (
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {business.bank_accounts.map((acc, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-bone p-3 text-xs">
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-ink">{acc.bank_name}</p>
                                                                <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
                                                                    {acc.account_number}
                                                                </p>
                                                                <p className="text-mute">a.n. {acc.account_holder}</p>
                                                            </div>
                                                            <CopyButton value={acc.account_number} label={`nomor rekening ${acc.bank_name}`} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {business.qris_url && (
                                                <div className="flex items-center gap-4 rounded-md bg-bone p-3">
                                                    <img
                                                        src={business.qris_url}
                                                        alt={`QRIS ${business.name}`}
                                                        className="size-24 shrink-0 rounded-xs object-cover outline-1 -outline-offset-1 outline-black/10"
                                                    />
                                                    <div className="text-xs text-mute">
                                                        <p className="font-semibold text-ink">Scan QRIS</p>
                                                        <p className="mt-1">Gunakan aplikasi mobile banking atau e-wallet Anda.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Segmented Choice: Upload Now vs Pay Later */}
                                            <div className="grid w-full grid-cols-2 rounded-sm bg-bone p-1 sm:inline-flex sm:h-11 sm:w-auto sm:items-center sm:rounded-full" role="group" aria-label="Metode unggah bukti DP">
                                                <button
                                                    type="button"
                                                    aria-pressed={dpMode === 'now'}
                                                    onClick={() => setDpMode('now')}
                                                    className={cn(
                                                        'min-h-10 cursor-pointer rounded-xl px-3 py-2 text-center text-xs font-semibold leading-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:h-9 sm:min-h-0 sm:rounded-full sm:px-4 sm:py-0',
                                                        dpMode === 'now' ? 'bg-canvas text-ink' : 'text-mute'
                                                    )}
                                                >
                                                    Upload bukti sekarang
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-pressed={dpMode === 'later'}
                                                    onClick={() => {
                                                        setDpMode('later');
                                                        setDpProof(null);
                                                        setDpProofError('');
                                                    }}
                                                    className={cn(
                                                        'min-h-10 cursor-pointer rounded-xl px-3 py-2 text-center text-xs font-semibold leading-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:h-9 sm:min-h-0 sm:rounded-full sm:px-4 sm:py-0',
                                                        dpMode === 'later' ? 'bg-canvas text-ink' : 'text-mute'
                                                    )}
                                                >
                                                    Bayar DP nanti ({business.dp_expiry_minutes} mnt)
                                                </button>
                                            </div>

                                            {dpMode === 'now' ? (
                                                <div className="space-y-1.5">
                                                    <label
                                                        htmlFor="dp-proof-upload"
                                                        className={cn(
                                                            'flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed bg-field px-4 py-4 text-sm text-ink transition-colors duration-150 hover:bg-bone focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2',
                                                            dpProofError || errors.dp_proof ? 'border-destructive' : 'border-control-border'
                                                        )}
                                                    >
                                                        <Upload className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                                        <span className="break-words">
                                                            {dpProof ? dpProof.name : 'Pilih foto/screenshot bukti transfer (JPG/PNG/WebP, maks 5MB)'}
                                                        </span>
                                                        <input
                                                            id="dp-proof-upload"
                                                            type="file"
                                                            accept="image/png,image/jpeg,image/webp"
                                                            className="sr-only"
                                                            aria-invalid={Boolean(dpProofError || errors.dp_proof)}
                                                            aria-describedby={dpProofError || errors.dp_proof ? 'dp-proof-error' : undefined}
                                                            onChange={(e) => {
                                                                setDpProof(e.target.files?.[0] ?? null);
                                                                setDpProofError('');
                                                            }}
                                                        />
                                                    </label>
                                                    {(dpProofError || errors.dp_proof) && (
                                                        <p id="dp-proof-error" className="text-xs font-medium text-destructive">
                                                            {dpProofError || errors.dp_proof}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-mute">
                                                    {isDropoffService ? 'Kuota' : 'Slot'} akan ditahan selama{' '}
                                                    <strong>{business.dp_expiry_minutes} menit</strong>. Jika bukti DP belum diunggah hingga batas waktu,{' '}
                                                    {bookingNoun} otomatis dibatalkan.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {Object.keys(errors).length > 0 && (
                                        <div
                                            role="alert"
                                            data-form-error="true"
                                            className="rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-xs font-medium text-destructive"
                                        >
                                            {Object.values(errors)[0]}
                                        </div>
                                    )}

                                    <div className="hidden lg:block">
                                        <Button type="submit" size="lg" className="w-full" disabled={submitting || Boolean(bookingDisabledReason)}>
                                            {submitting ? 'Memproses…' : submitLabel}
                                        </Button>
                                    </div>
                                </section>
                            ) : (
                                <div className="rounded-md border border-dashed border-hairline bg-canvas p-4 sm:p-6 text-center">
                                    <p className="text-sm font-semibold text-ink">
                                        {isDropoffService
                                            ? 'Pilih tanggal drop-off yang tersedia di atas untuk mengisi detail pemesan.'
                                            : businessType === 'space_booking'
                                              ? 'Pilih salah satu jam sesi tersedia di atas untuk mengisi detail pemesan.'
                                              : 'Pilih salah satu jam tersedia di atas untuk mengisi detail pemesan.'}
                                    </p>
                                    <p className="mt-1 text-xs text-mute">
                                        Konfirmasi jadwal berlangsung instan tanpa harus membuat akun.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Sticky Booking Summary (Storefront Checkout Card) */}
                        <aside aria-label={`Ringkasan ${bookingNoun}`} className="hidden lg:sticky lg:top-6 lg:block">
                            <div className="space-y-5 rounded-md bg-bone p-4 sm:p-6">
                                <div className="flex items-center gap-3">
                                    {selectedService?.image_url && (
                                        <img
                                            src={selectedService.image_url}
                                            alt={selectedService.name}
                                            className="size-12 shrink-0 rounded-xs object-cover outline-1 -outline-offset-1 outline-black/10"
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-mute">Ringkasan {bookingNoun}</p>
                                        <h2 className="mt-0.5 truncate text-lg font-semibold text-ink">{business.name}</h2>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t border-divider pt-4 text-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-mute">
                                            {businessType === 'space_booking' ? 'Fasilitas / Paket' : 'Layanan'}
                                        </span>
                                        <span className="text-right font-semibold text-ink">
                                            {selectedService?.name ?? 'Belum dipilih'}
                                        </span>
                                    </div>

                                    {selectedService && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-mute">{isDropoffService ? 'Estimasi' : 'Durasi'}</span>
                                            <span className="font-semibold tabular-nums text-ink">
                                                {isDropoffService
                                                    ? formatTurnaroundLabel(selectedService.turnaround_days ?? 1)
                                                    : `${selectedService.duration_minutes} menit`}
                                            </span>
                                        </div>
                                    )}

                                    {isDropoffService && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-mute">Jumlah</span>
                                            <span className="font-semibold tabular-nums text-ink">
                                                {effectiveQuantity} {selectedUnitLabel}
                                            </span>
                                        </div>
                                    )}

                                    {showStaffStep && (
                                        <div className="flex items-start justify-between gap-3">
                                            <span className="text-mute">Staff</span>
                                            <span className="text-right font-semibold text-ink">
                                                {selectedStaffObj ? selectedStaffObj.name : 'Siapa saja tersedia'}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-mute">{isDropoffService ? 'Tanggal drop-off' : 'Tanggal'}</span>
                                        <span className="text-right font-semibold tabular-nums text-ink">
                                            {formatDateIndo(selectedDate)}
                                        </span>
                                    </div>

                                    {isDropoffService ? (
                                        <>
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-mute">Metode</span>
                                                <span className="text-right font-semibold text-ink">
                                                    {selectedService?.supports_pickup && fulfillmentType === 'pickup'
                                                        ? `Jemput (${PICKUP_SESSION_LABELS[pickupSession]})`
                                                        : 'Antar ke toko'}
                                                </span>
                                            </div>
                                            {dropoff?.estimated_ready_date && (
                                                <div className="flex items-start justify-between gap-3">
                                                    <span className="text-mute">Est. selesai</span>
                                                    <span className="text-right font-semibold tabular-nums text-ink">
                                                        {formatDateIndo(dropoff.estimated_ready_date)}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-mute">Jam</span>
                                            <span className="font-mono font-semibold tabular-nums text-ink">
                                                {selectedTime || 'Belum dipilih'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 border-t border-divider pt-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-mute">Total biaya</span>
                                        <span className="text-lg font-semibold tabular-nums text-ink">
                                            {formatRupiah(computedTotalPrice)}
                                        </span>
                                    </div>
                                    {requiresDp && selectedService && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-mute">Nominal DP</span>
                                            <span className="font-semibold tabular-nums text-electric">
                                                {formatRupiah(computedDpAmount)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 rounded-sm bg-canvas p-4 text-xs text-mute">
                                    <div className="flex items-center gap-2 font-semibold text-ink">
                                        <ShieldCheck className="size-4 shrink-0 text-electric" aria-hidden="true" />
                                        <span>Jaminan {bookingNoun}</span>
                                    </div>
                                    <ul className="space-y-1 leading-relaxed">
                                        <li>
                                            •{' '}
                                            {isDropoffService
                                                ? 'Kuota harian terkunci otomatis tanpa perlu antre jam.'
                                                : 'Slot terkunci otomatis dan bebas bentrok jadwal.'}
                                        </li>
                                        {requiresDp && (
                                            <li>• Transfer DP langsung ke rekening toko.</li>
                                        )}
                                        <li>• Halaman status & ringkasan WhatsApp tersedia setelah submit.</li>
                                    </ul>
                                </div>
                            </div>
                        </aside>

                        {/* Mobile/tablet sticky total + CTA */}
                        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-canvas px-4 py-3 sm:px-6 lg:hidden">
                            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="truncate text-xs text-mute">
                                        {selectedService?.name}
                                        {isDropoffService && ` × ${effectiveQuantity} ${selectedUnitLabel}`}
                                        {` · ${formatDateShortIndo(selectedDate)}`}
                                        {!isDropoffService && selectedTime && `, ${selectedTime}`}
                                    </p>
                                    <p className="text-lg font-semibold whitespace-nowrap tabular-nums text-ink">
                                        {formatRupiah(computedTotalPrice)}
                                    </p>
                                </div>
                                {canShowCustomerStep ? (
                                    <Button
                                        type="submit"
                                        className="shrink-0"
                                        disabled={submitting || Boolean(bookingDisabledReason)}
                                    >
                                        {submitting ? 'Memproses…' : submitLabel}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        className="shrink-0"
                                        disabled={Boolean(bookingDisabledReason)}
                                        onClick={() => document.getElementById('step-schedule')?.scrollIntoView()}
                                    >
                                        {isDropoffService ? 'Pilih tanggal' : 'Pilih jam'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                )}
            </main>

            <footer className="border-t border-divider py-10 text-center text-xs text-mute">
                <span className="inline-flex items-center gap-1.5">
                    Ditenagai oleh <JanjiyanLogo size="sm" />
                </span>
            </footer>

        </div>
    );
}
