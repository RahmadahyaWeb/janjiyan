import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    ExternalLink,
    FileText,
    Images,
    MapPin,
    MessageCircle,
    Minus,
    PackageCheck,
    Phone,
    Plus,
    ShieldCheck,
    Truck,
    Upload,
    UserCheck,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { HorizontalScrollContainer } from '@/components/HorizontalScrollContainer';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import {
    buildWhatsAppUrl,
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
    formatTurnaroundLabel,
    PICKUP_SESSION_LABELS,
} from '@/lib/format';
import { cn, scrollToFirstInvalid } from '@/lib/utils';
import type { PageProps } from '@/types';

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
    description: string | null;
    phone: string | null;
    address: string | null;
    timezone: string;
    logo_url: string | null;
    qris_url: string | null;
    bank_accounts: BankAccount[];
    dp_expiry_minutes: number;
    min_booking_lead_minutes?: number;
    max_booking_advance_days?: number;
}

interface GalleryItem {
    id: number;
    image_url: string;
    caption: string | null;
}

interface BookingPortalProps {
    business: BusinessData;
    services: ServiceItem[];
    galleries?: GalleryItem[];
    operatingHours?: OperatingHourItem[];
    holidays: string[];
    bookingDisabledReason?: string | null;
}

const DAY_NAMES_ORDERED = [
    { day: 1, label: 'Senin' },
    { day: 2, label: 'Selasa' },
    { day: 3, label: 'Rabu' },
    { day: 4, label: 'Kamis' },
    { day: 5, label: 'Jumat' },
    { day: 6, label: 'Sabtu' },
    { day: 0, label: 'Minggu' },
];

function formatShortTime(time: string | null): string {
    if (!time) return '';
    return time.slice(0, 5);
}

function getLocalDayOfWeek(dateString: string): number {
    const [y, m, d] = dateString.split('-').map(Number);
    if (!y || !m || !d) return new Date().getDay();
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Full class strings so Tailwind keeps them; tokens live in app.css.
const MONOGRAM_CLASSES = [
    'bg-monogram-1-surface text-monogram-1-text',
    'bg-monogram-2-surface text-monogram-2-text',
    'bg-monogram-3-surface text-monogram-3-text',
];

function BusinessMark({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
    if (logoUrl) {
        return (
            <img
                src={logoUrl}
                alt={`Logo ${name}`}
                className={cn('shrink-0 rounded-[30%] object-cover outline-1 -outline-offset-1 outline-black/10', className)}
            />
        );
    }

    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const words = name.trim().split(/\s+/);
    const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();

    return (
        <div
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center rounded-[30%] font-semibold',
                MONOGRAM_CLASSES[hash % MONOGRAM_CLASSES.length],
                className
            )}
        >
            {initials}
        </div>
    );
}

export default function BookingPortal({
    business,
    services,
    galleries = [],
    operatingHours = [],
    holidays,
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
    const todayDayOfWeek = getLocalDayOfWeek(todayLocal);

    const [selectedService, setSelectedService] = useState<ServiceItem | null>(services[0] ?? null);
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(todayLocal);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [quantity, setQuantity] = useState<number>(1);
    const [fulfillmentType, setFulfillmentType] = useState<'dropoff' | 'pickup'>('dropoff');
    const [pickupSession, setPickupSession] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('anytime');
    const [pickupAddress, setPickupAddress] = useState('');
    const [pickupAddressError, setPickupAddressError] = useState('');
    const [hoursExpanded, setHoursExpanded] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [heroInView, setHeroInView] = useState(true);
    const heroNameRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const el = heroNameRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        // -64px = sticky header height, so the brand appears as soon as the name slides under it.
        const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting), {
            rootMargin: '-64px 0px 0px 0px',
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Keep focused fields and scroll targets clear of the sticky header and the mobile bottom bar (WCAG 2.4.11).
    useEffect(() => {
        const padding = ['scroll-pt-20', 'scroll-pb-28', 'lg:scroll-pb-0'];
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

    const todaySchedule = hoursByDay.get(todayDayOfWeek);
    const isTodayHoliday = holidays.includes(todayLocal);
    const isOpenToday = Boolean(todaySchedule?.is_open && !isTodayHoliday);

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

    const isDropoffService = selectedService?.booking_mode === 'dropoff';

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
                staff_id: !isDropoffService && selectedService.assignment_mode === 'staff' ? selectedStaffId : null,
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

    const googleMapsUrl = business.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.address}`)}`
        : null;

    const whatsappChatUrl = business.phone
        ? buildWhatsAppUrl(business.phone, `Halo ${business.name}, saya ingin bertanya tentang layanan dan jadwal reservasi.`)
        : null;

    return (
        <div className={cn('min-h-screen bg-canvas text-ink', services.length > 0 && 'pb-24 lg:pb-0')}>
            <Head title={`${business.name} — Reservasi Online`}>
                <meta
                    head-key="description"
                    name="description"
                    content={
                        business.description ||
                        `Pesan layanan ${business.name} (${business.category}) secara online dengan jadwal real-time di Janjiyan.`
                    }
                />
            </Head>

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke daftar layanan
            </a>

            {/* Top Storefront Bar: brand fades in once the hero name scrolls away */}
            <header className="sticky top-0 z-40 border-b border-divider bg-canvas">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
                    <div
                        aria-hidden={heroInView}
                        className={cn(
                            'flex min-w-0 items-center gap-3 motion-safe:transition-opacity motion-safe:duration-200',
                            heroInView && 'pointer-events-none opacity-0'
                        )}
                    >
                        <BusinessMark name={business.name} logoUrl={business.logo_url} className="size-9 text-xs" />
                        <span className="truncate text-sm font-semibold text-ink sm:text-base">{business.name}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <Button asChild variant="outline" size="sm" className="px-3 sm:px-4">
                            <Link href={route('public.booking.invoices', business.slug)}>
                                <FileText className="size-4" aria-hidden="true" />
                                <span className="hidden sm:inline">Cek invoice</span>
                                <span className="sr-only sm:hidden">Invoice</span>
                            </Link>
                        </Button>
                        {whatsappChatUrl && (
                            <Button asChild variant="outline" size="sm" className="px-3 sm:px-4">
                                <a href={whatsappChatUrl} target="_blank" rel="noreferrer">
                                    <MessageCircle className="size-4" aria-hidden="true" />
                                    <span className="hidden sm:inline">Chat WhatsApp</span>
                                    <span className="sr-only sm:hidden">WhatsApp</span>
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </header>

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

                {/* Storefront Hero */}
                <section aria-labelledby="business-name" className="mb-10 border-b border-divider pb-8 sm:mb-12 sm:pb-10">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <BusinessMark
                            name={business.name}
                            logoUrl={business.logo_url}
                            className="size-16 text-xl sm:size-24 sm:text-3xl"
                        />
                        <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
                                <span className="font-semibold text-ink">{business.category}</span>
                                {operatingHours.length > 0 && (
                                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                                        <span
                                            aria-hidden="true"
                                            className={cn('size-2 rounded-full', isOpenToday ? 'bg-success' : 'bg-stone')}
                                        />
                                        {isOpenToday && todaySchedule
                                            ? `Buka hari ini, ${formatShortTime(todaySchedule.open_time)}–${formatShortTime(todaySchedule.close_time)}`
                                            : isTodayHoliday
                                              ? 'Libur hari ini'
                                              : 'Tutup hari ini'}
                                    </span>
                                )}
                            </p>
                            <h1
                                ref={heroNameRef}
                                id="business-name"
                                className="mt-1 text-3xl leading-[1.1] font-semibold text-balance text-ink sm:text-5xl"
                            >
                                {business.name}
                            </h1>
                        </div>
                    </div>

                    <p className="mt-5 max-w-prose text-base leading-relaxed text-mute">
                        {business.description || 'Pilih layanan, tentukan tanggal, lalu pesan langsung dari halaman ini.'}
                    </p>

                    {/* Contact & hours */}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        {googleMapsUrl && business.address && (
                            <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full bg-bone px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <MapPin className="size-3.5 shrink-0 text-electric" aria-hidden="true" />
                                <span className="text-left">{business.address}</span>
                                <ExternalLink className="size-3 shrink-0 text-mute" aria-hidden="true" />
                            </a>
                        )}

                        {whatsappChatUrl && business.phone && (
                            <a
                                href={whatsappChatUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-bone px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <Phone className="size-3.5 shrink-0 text-electric" aria-hidden="true" />
                                <span className="tabular-nums">+{business.phone}</span>
                            </a>
                        )}

                        {operatingHours.length > 0 && (
                            <button
                                type="button"
                                aria-expanded={hoursExpanded}
                                aria-controls="business-operating-hours"
                                onClick={() => setHoursExpanded((v) => !v)}
                                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-bone px-3.5 py-2 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <Clock className="size-3.5 shrink-0 text-mute" aria-hidden="true" />
                                <span>Jam operasional</span>
                                <ChevronDown
                                    aria-hidden="true"
                                    className={cn(
                                        'size-3.5 text-mute motion-safe:transition-transform',
                                        hoursExpanded && 'rotate-180'
                                    )}
                                />
                            </button>
                        )}
                    </div>

                    {/* Expandable Operating Hours & Upcoming Holidays */}
                    {hoursExpanded && operatingHours.length > 0 && (
                        <div
                            id="business-operating-hours"
                            className="mt-5 grid gap-4 rounded-md bg-bone p-4 sm:p-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
                        >
                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-ink">
                                    Jadwal mingguan ({tz})
                                </h2>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {DAY_NAMES_ORDERED.map(({ day, label }) => {
                                        const item = hoursByDay.get(day);
                                        const isToday = day === todayDayOfWeek;
                                        return (
                                            <div
                                                key={day}
                                                className={cn(
                                                    'flex items-center justify-between gap-2 rounded-xl bg-canvas px-3.5 py-2 text-xs',
                                                    isToday && 'ring-1 ring-ink'
                                                )}
                                            >
                                                <span className="font-semibold text-ink">
                                                    {label}
                                                    {isToday && (
                                                        <span className="ml-1.5 text-electric">(Hari ini)</span>
                                                    )}
                                                </span>
                                                {item?.is_open ? (
                                                    <span className="font-mono tabular-nums text-mute">
                                                        {formatShortTime(item.open_time)}–{formatShortTime(item.close_time)}
                                                    </span>
                                                ) : (
                                                    <span className="font-semibold text-mute">Tutup</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-ink">Hari libur khusus</h2>
                                {holidays.length === 0 ? (
                                    <p className="rounded-xl bg-canvas px-3.5 py-2.5 text-xs text-mute">
                                        Tidak ada jadwal libur khusus dalam waktu dekat.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {holidays.slice(0, 6).map((hDate) => (
                                            <span
                                                key={hDate}
                                                className="rounded-full bg-canvas px-3 py-1 font-mono text-xs font-semibold tabular-nums text-ink"
                                            >
                                                {formatDateIndo(hDate)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Business Portfolio & Atmosphere Gallery */}
                {galleries.length > 0 && (
                    <section aria-labelledby="portfolio-heading" className="mb-10">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <Images className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                <h2 id="portfolio-heading" className="text-lg font-semibold text-ink">
                                    Portofolio & suasana
                                </h2>
                            </div>
                            <Badge variant="secondary" className="shrink-0 tabular-nums">
                                {galleries.length} foto
                            </Badge>
                        </div>

                        <div
                            role="region"
                            aria-label="Galeri foto portofolio"
                            tabIndex={0}
                            className="flex snap-x snap-mandatory scroll-px-4 gap-3.5 overflow-x-auto pb-2 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0"
                        >
                            {galleries.map((item, idx) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setLightboxIdx(idx)}
                                    aria-label={item.caption ? `Lihat foto: ${item.caption}` : `Lihat foto portofolio ${idx + 1}`}
                                    className="group flex w-[76%] shrink-0 snap-start cursor-pointer flex-col overflow-hidden rounded-md border border-hairline-soft bg-canvas p-3 text-left transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
                                >
                                    <div className="overflow-hidden rounded-xs">
                                        <img
                                            src={item.image_url}
                                            alt={item.caption || `${business.name} portofolio ${idx + 1}`}
                                            className="aspect-[4/3] w-full object-cover outline-1 -outline-offset-1 outline-black/10 motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03]"
                                        />
                                    </div>
                                    {item.caption && (
                                        <p className="mt-3 px-0.5 text-xs font-medium leading-relaxed text-ink line-clamp-2">
                                            {item.caption}
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </section>
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
                            <section aria-labelledby="step-services-heading">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-mute">01</span>
                                    <h2 id="step-services-heading" className="text-xl font-semibold text-ink">
                                        Pilih layanan.
                                    </h2>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    {services.map((service) => {
                                        const active = selectedService?.id === service.id;
                                        return (
                                            <button
                                                key={service.id}
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
                                                                    Kuota {service.capacity}/hari
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

                            {/* Step 2: Pilih Staff (hanya jika time_slot & mode staff) */}
                            {!isDropoffService && selectedService?.assignment_mode === 'staff' && selectedService.staff.length > 0 && (
                                <section aria-labelledby="step-staff-heading">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-mute">02</span>
                                        <h2 id="step-staff-heading" className="text-xl font-semibold text-ink">
                                            Pilih staff.
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
                            <section aria-labelledby="step-schedule-heading" id="step-schedule" className="scroll-mt-24">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-mute">
                                        {!isDropoffService && selectedService?.assignment_mode === 'staff' && selectedService.staff.length > 0 ? '03' : '02'}
                                    </span>
                                    <h2 id="step-schedule-heading" className="text-xl font-semibold text-ink">
                                        {isDropoffService ? 'Pilih tanggal & jumlah.' : 'Pilih tanggal & jam.'}
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
                                                    <p className="text-sm font-semibold text-ink">Jumlah item / pasang</p>
                                                    <p className="text-xs text-mute">
                                                        {dropoff?.available
                                                            ? `Sisa kuota hari ini: ${dropoff.remaining_capacity} dari ${dropoff.total_capacity}`
                                                            : 'Kuota mengikuti jadwal buka toko'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        aria-label="Kurangi jumlah item"
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
                                                        aria-label="Tambah jumlah item"
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
                                                aria-label="Pilih jam reservasi"
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
                                                {!isDropoffService && selectedService?.assignment_mode === 'staff' && selectedService.staff.length > 0 ? '04' : '03'}
                                            </span>
                                            <h2 id="step-customer-heading" className="text-xl font-semibold text-ink">
                                                Detail pemesan.
                                            </h2>
                                        </div>
                                        <p className="mt-1 text-sm text-mute">
                                            Tanpa perlu membuat akun. Bukti & status reservasi langsung muncul setelah submit.
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
                                                    isDropoffService
                                                        ? 'Contoh: 2 pasang sneaker putih (bagian sol menguning, bahan suede)'
                                                        : 'Contoh: Potong rapi bagian samping, jangan terlalu pendek'
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
                                                    Slot akan ditahan selama <strong>{business.dp_expiry_minutes} menit</strong>. Jika bukti DP belum diunggah hingga batas waktu, reservasi otomatis dibatalkan.
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
                                            {submitting ? 'Memproses…' : isDropoffService ? 'Buat pesanan' : 'Buat reservasi'}
                                        </Button>
                                    </div>
                                </section>
                            ) : (
                                <div className="rounded-md border border-dashed border-hairline bg-canvas p-4 sm:p-6 text-center">
                                    <p className="text-sm font-semibold text-ink">
                                        {isDropoffService
                                            ? 'Pilih tanggal drop-off yang tersedia di atas untuk mengisi detail pemesan.'
                                            : 'Pilih salah satu jam tersedia di atas untuk mengisi detail pemesan.'}
                                    </p>
                                    <p className="mt-1 text-xs text-mute">
                                        Konfirmasi jadwal berlangsung instan tanpa harus membuat akun.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Sticky Booking Summary (Storefront Checkout Card) */}
                        <aside aria-label="Ringkasan reservasi" className="hidden lg:sticky lg:top-24 lg:block">
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
                                        <p className="text-xs font-semibold text-mute">Ringkasan reservasi</p>
                                        <h2 className="mt-0.5 truncate text-lg font-semibold text-ink">{business.name}</h2>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t border-divider pt-4 text-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-mute">Layanan</span>
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
                                                {effectiveQuantity} item
                                            </span>
                                        </div>
                                    )}

                                    {!isDropoffService && selectedService?.assignment_mode === 'staff' && selectedService.staff.length > 0 && (
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
                                        <span>{isDropoffService ? 'Jaminan pesanan' : 'Jaminan reservasi'}</span>
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
                                        {isDropoffService && ` × ${effectiveQuantity}`}
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
                                        {submitting ? 'Memproses…' : isDropoffService ? 'Buat pesanan' : 'Buat reservasi'}
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

            {/* Portfolio Lightbox Dialog */}
            <Dialog open={lightboxIdx !== null} onOpenChange={(open) => !open && setLightboxIdx(null)}>
                <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-2xl sm:p-6">
                    {lightboxIdx !== null && galleries[lightboxIdx] && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="break-words text-base leading-snug font-semibold text-ink">
                                    {galleries[lightboxIdx].caption || `${business.name} — Portofolio ${lightboxIdx + 1}`}
                                </DialogTitle>
                            </DialogHeader>

                            <img
                                src={galleries[lightboxIdx].image_url}
                                alt={galleries[lightboxIdx].caption || `${business.name} portofolio ${lightboxIdx + 1}`}
                                className="max-h-[60vh] w-full rounded-xs bg-bone object-contain outline-1 -outline-offset-1 outline-black/10"
                            />

                            {galleries.length > 1 && (
                                <div className="flex items-center justify-between gap-1.5 pt-1 sm:gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 px-2.5 text-xs sm:gap-1.5 sm:px-4 sm:text-sm"
                                        onClick={() =>
                                            setLightboxIdx((lightboxIdx - 1 + galleries.length) % galleries.length)
                                        }
                                    >
                                        <ChevronLeft className="size-4" aria-hidden="true" />
                                        <span>Sebelumnya</span>
                                    </Button>
                                    <span className="shrink-0 whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-mute">
                                        {lightboxIdx + 1} / {galleries.length}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 px-2.5 text-xs sm:gap-1.5 sm:px-4 sm:text-sm"
                                        onClick={() => setLightboxIdx((lightboxIdx + 1) % galleries.length)}
                                    >
                                        <span>Berikutnya</span>
                                        <ChevronRight className="size-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
