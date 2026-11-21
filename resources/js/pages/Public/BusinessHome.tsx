import { Head, Link } from '@inertiajs/react';
import {
    CalendarCheck,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileSearch,
    MapPin,
    MessageCircle,
    Sparkles,
    type LucideIcon,
} from 'lucide-react';
import { Fragment, type ReactNode, useMemo, useState } from 'react';
import { BusinessMark } from '@/components/BusinessMark';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { brandVars, isHex } from '@/lib/brand';
import { getBusinessTypeConfig, resolveBusinessType } from '@/lib/businessType';
import {
    buildWhatsAppUrl,
    formatDateIndo,
    formatRupiah,
    formatShortTime,
    formatTurnaroundLabel,
    getLocalDayOfWeek,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BusinessType, ServiceUnitLabel } from '@/types';

interface OperatingHourItem {
    day_of_week: number;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
}

interface GalleryItem {
    id: number;
    image_url: string;
    caption: string | null;
}

interface ServiceItem {
    id: number;
    name: string;
    image_url: string | null;
    price: number;
    duration_minutes: number;
    capacity?: number;
    booking_mode: 'time_slot' | 'dropoff';
    turnaround_days: number;
    supports_pickup: boolean;
    unit_label?: ServiceUnitLabel;
    dp_amount: number;
}

// Longer lists link to the full list on the booking page.
const MAX_SERVICES = 5;

interface BusinessHomeProps {
    business: {
        name: string;
        slug: string;
        category: string;
        business_type?: BusinessType;
        description: string | null;
        phone: string | null;
        address: string | null;
        timezone: string;
        logo_url: string | null;
        brand_color: string | null;
        cover_url: string | null;
    };
    services: ServiceItem[];
    galleries: GalleryItem[];
    operatingHours: OperatingHourItem[];
    holidays: string[];
    bookingDisabledReason: string | null;
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

function ActionRow({
    href,
    external = false,
    icon: Icon,
    title,
    detail,
    primary = false,
}: {
    href: string;
    external?: boolean;
    icon: LucideIcon;
    title: string;
    detail?: ReactNode;
    primary?: boolean;
}) {
    const className = cn(
        'flex min-h-18 items-center gap-3.5 rounded-sm p-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none',
        primary
            ? 'bg-(--brand) text-(--on-brand) hover:opacity-95 focus-visible:ring-(--brand-ink)'
            : 'bg-bone text-ink focus-visible:ring-ink'
    );
    const body = (
        <>
            <span
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl',
                    primary ? 'bg-(--on-brand)/14' : 'bg-(--brand-soft) text-(--brand-ink)'
                )}
            >
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{title}</span>
                {detail && (
                    <span className={cn('mt-0.5 block text-sm leading-snug', !primary && 'text-mute')}>
                        {detail}
                    </span>
                )}
            </span>
            <ChevronRight className={cn('size-5 shrink-0', primary ? 'opacity-75' : 'text-stone')} aria-hidden="true" />
        </>
    );

    return external ? (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
            {body}
        </a>
    ) : (
        <Link href={href} className={className}>
            {body}
        </Link>
    );
}

export default function BusinessHome({
    business,
    services,
    galleries,
    operatingHours,
    holidays,
    bookingDisabledReason,
}: BusinessHomeProps) {
    const tz = business.timezone || 'Asia/Jakarta';
    const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const todayDayOfWeek = getLocalDayOfWeek(todayLocal);
    const [hoursExpanded, setHoursExpanded] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    const hoursByDay = useMemo(() => new Map(operatingHours.map((h) => [h.day_of_week, h])), [operatingHours]);
    const todaySchedule = hoursByDay.get(todayDayOfWeek);
    const isTodayHoliday = holidays.includes(todayLocal);
    const isOpenToday = Boolean(todaySchedule?.is_open && !isTodayHoliday);

    const businessType = resolveBusinessType(business.business_type);
    const typeConfig = getBusinessTypeConfig(businessType);
    const bookingUrl = route('public.booking.form', business.slug);
    const anyServiceImage = services.some((s) => s.image_url);
    const waTopic =
        businessType === 'dropoff'
            ? 'layanan dan jadwal drop-off'
            : businessType === 'space_booking'
              ? 'fasilitas dan jadwal booking'
              : 'layanan dan jadwal janji temu';
    const whatsappUrl = business.phone
        ? buildWhatsAppUrl(business.phone, `Halo ${business.name}, saya ingin bertanya tentang ${waTopic}.`)
        : null;
    const mapsUrl = business.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.address}`)}`
        : null;

    const fallbackDescription =
        businessType === 'dropoff'
            ? 'Pilih layanan, tentukan tanggal drop-off dan jumlah barang, lalu pesan langsung dari halaman ini.'
            : businessType === 'space_booking'
              ? 'Pilih fasilitas atau paket, tentukan jadwal sesi, lalu booking langsung dari halaman ini.'
              : 'Pilih layanan, tentukan staff serta tanggal, lalu buat janji temu langsung dari halaman ini.';

    const primaryDetail =
        services.length === 0
            ? 'Belum ada layanan'
            : businessType === 'dropoff'
              ? 'Pilih layanan, tanggal, dan jumlah'
              : businessType === 'space_booking'
                ? 'Pilih fasilitas dan jadwal sesi'
                : 'Pilih layanan dan jadwal';

    const lookupLabel =
        businessType === 'dropoff'
            ? 'Cek pesanan'
            : businessType === 'space_booking'
              ? 'Cek booking'
              : 'Cek reservasi';

    return (
        <div style={brandVars(business.brand_color)} className="min-h-screen bg-canvas text-ink">
            <Head title={business.name}>
                <meta
                    head-key="description"
                    name="description"
                    content={
                        business.description ||
                        `${typeConfig.publicPortal.ctaLabel} di ${business.name} (${business.category}) secara online dengan ketersediaan real-time di Janjiyan.`
                    }
                />
                {isHex(business.brand_color) && <meta head-key="theme-color" name="theme-color" content={business.brand_color} />}
            </Head>

            <div className="mx-auto max-w-lg lg:pt-6">
                {/* Cover band: shop photo in full color, or the plain shop color. The mark rides its bottom edge. */}
                <div className="relative">
                    <div className="h-36 overflow-hidden bg-(--band) sm:h-44 sm:rounded-b-md lg:rounded-md">
                        {business.cover_url && <img src={business.cover_url} alt="" className="size-full object-cover" />}
                    </div>
                    <BusinessMark
                        name={business.name}
                        logoUrl={business.logo_url}
                        branded
                        className="absolute bottom-0 left-1/2 size-24 -translate-x-1/2 translate-y-1/2 border-4 border-canvas text-3xl font-bold"
                    />
                </div>

                <main className="px-4 pb-10">
                    <section aria-labelledby="business-name" className="pt-14 text-center">
                        <h1
                            id="business-name"
                            className="text-2xl leading-snug font-bold text-balance [overflow-wrap:anywhere] sm:text-3xl"
                        >
                            {business.name}
                        </h1>
                        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-mute">
                            {business.description || fallbackDescription}
                        </p>

                        {operatingHours.length > 0 && (
                            <button
                                type="button"
                                aria-expanded={hoursExpanded}
                                aria-controls="business-operating-hours"
                                onClick={() => setHoursExpanded((v) => !v)}
                                className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-bone px-3.5 py-1.5 text-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn('size-2 rounded-full', isOpenToday ? 'bg-success' : 'bg-stone')}
                                />
                                {isOpenToday && todaySchedule
                                    ? `Buka hari ini, ${formatShortTime(todaySchedule.open_time)}–${formatShortTime(todaySchedule.close_time)}`
                                    : isTodayHoliday
                                      ? 'Libur hari ini'
                                      : 'Tutup hari ini'}
                                <ChevronDown
                                    aria-hidden="true"
                                    className={cn('size-3.5 text-mute motion-safe:transition-transform', hoursExpanded && 'rotate-180')}
                                />
                            </button>
                        )}
                    </section>

                    {hoursExpanded && operatingHours.length > 0 && (
                        <div id="business-operating-hours" className="mt-4 space-y-4 rounded-sm bg-bone p-4">
                            <div>
                                <h2 className="mb-2 text-sm font-semibold">Jadwal mingguan ({tz})</h2>
                                <ul className="divide-y divide-hairline text-sm">
                                    {DAY_NAMES_ORDERED.map(({ day, label }) => {
                                        const item = hoursByDay.get(day);
                                        const isToday = day === todayDayOfWeek;
                                        return (
                                            <li key={day} className="flex items-center justify-between gap-2 py-2">
                                                <span className={cn(isToday && 'font-semibold')}>
                                                    {label}
                                                    {isToday && <span className="ml-1.5 text-mute">(hari ini)</span>}
                                                </span>
                                                {item?.is_open ? (
                                                    <span className="font-mono text-mute tabular-nums">
                                                        {formatShortTime(item.open_time)}–{formatShortTime(item.close_time)}
                                                    </span>
                                                ) : (
                                                    <span className="text-mute">Tutup</span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                            {holidays.length > 0 && (
                                <div>
                                    <h2 className="mb-2 text-sm font-semibold">Hari libur khusus</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {holidays.slice(0, 6).map((hDate) => (
                                            <span
                                                key={hDate}
                                                className="rounded-full bg-canvas px-3 py-1 font-mono text-xs font-semibold tabular-nums"
                                            >
                                                {formatDateIndo(hDate)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {galleries.length > 0 && (
                        <div
                            role="region"
                            aria-label="Foto toko"
                            tabIndex={0}
                            className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 py-1 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                        >
                            {galleries.map((item, idx) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setLightboxIdx(idx)}
                                    aria-label={item.caption ? `Lihat foto: ${item.caption}` : `Lihat foto ${idx + 1}`}
                                    className="w-[30%] shrink-0 cursor-pointer snap-start overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                                >
                                    <img
                                        src={item.image_url}
                                        alt={item.caption || `${business.name} foto ${idx + 1}`}
                                        className="aspect-[4/5] w-full object-cover outline-1 -outline-offset-1 outline-black/10"
                                    />
                                </button>
                            ))}
                        </div>
                    )}

                    {bookingDisabledReason && (
                        <div role="alert" className="mt-6 rounded-sm bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
                            {bookingDisabledReason}
                        </div>
                    )}

                    <div className="mt-5">
                        <ActionRow
                            primary
                            href={bookingUrl}
                            icon={CalendarCheck}
                            title={typeConfig.publicPortal.ctaLabel}
                            detail={primaryDetail}
                        />
                    </div>

                    {services.length > 0 && (
                        <section aria-labelledby="services-heading" className="mt-6">
                            <h2 id="services-heading" className="mx-1 mb-2.5 flex items-center gap-1.5 text-base font-semibold">
                                {typeConfig.nav.servicesLabel}
                                <span className="rounded-full bg-bone px-2 text-xs text-mute tabular-nums">{services.length}</span>
                            </h2>
                            <ul className="divide-y divide-hairline overflow-hidden rounded-sm bg-bone">
                                {services.slice(0, MAX_SERVICES).map((service) => {
                                    const isDropoff = businessType === 'dropoff' || service.booking_mode === 'dropoff';
                                    const unitLabel = service.unit_label ?? 'item';
                                    const meta = [
                                        isDropoff
                                            ? formatTurnaroundLabel(service.turnaround_days)
                                            : `${service.duration_minutes} mnt`,
                                        businessType === 'space_booking' && service.capacity
                                            ? `Kapasitas ${service.capacity}`
                                            : null,
                                        isDropoff && service.supports_pickup ? 'bisa jemput-antar' : null,
                                        service.dp_amount > 0 ? `DP ${formatRupiah(service.dp_amount)}` : null,
                                    ].filter(Boolean);
                                    return (
                                        <li key={service.id}>
                                            <Link
                                                href={`${bookingUrl}?layanan=${service.id}`}
                                                className="flex items-center gap-3 py-3 pr-3 pl-3.5 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset focus-visible:outline-none"
                                            >
                                                {anyServiceImage &&
                                                    (service.image_url ? (
                                                        <img
                                                            src={service.image_url}
                                                            alt=""
                                                            className="size-12 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10"
                                                        />
                                                    ) : (
                                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-(--brand-soft) text-(--brand-ink)">
                                                            <Sparkles className="size-5" aria-hidden="true" />
                                                        </span>
                                                    ))}
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-base leading-snug font-semibold [overflow-wrap:anywhere]">
                                                        {service.name}
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-mute">
                                                        <strong className="font-semibold text-ink tabular-nums">
                                                            {formatRupiah(service.price)}
                                                            {isDropoff ? `/${unitLabel}` : ''}
                                                        </strong>
                                                        {meta.map((m) => (
                                                            <Fragment key={m}>
                                                                {' · '}
                                                                <span className="whitespace-nowrap">{m}</span>
                                                            </Fragment>
                                                        ))}
                                                    </span>
                                                </span>
                                                <ChevronRight className="size-4 shrink-0 text-stone" aria-hidden="true" />
                                            </Link>
                                        </li>
                                    );
                                })}
                                {services.length > MAX_SERVICES && (
                                    <li>
                                        <Link
                                            href={`${bookingUrl}#layanan`}
                                            className="flex items-center justify-center gap-1 py-3 text-sm font-semibold text-(--brand-ink) focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset focus-visible:outline-none"
                                        >
                                            Lihat semua {typeConfig.nav.servicesLabel.toLowerCase()} ({services.length})
                                            <ChevronRight className="size-4" aria-hidden="true" />
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        </section>
                    )}

                    <nav aria-label="Menu toko" className="mt-6 grid gap-2.5">
                        {whatsappUrl && (
                            <ActionRow
                                external
                                href={whatsappUrl}
                                icon={MessageCircle}
                                title="Chat WhatsApp"
                                detail={<span className="tabular-nums">+{business.phone}</span>}
                            />
                        )}
                        {mapsUrl && (
                            <ActionRow
                                external
                                href={mapsUrl}
                                icon={MapPin}
                                title="Lokasi"
                                detail={<span className="line-clamp-2">{business.address}</span>}
                            />
                        )}
                        <ActionRow
                            href={route('public.booking.invoices', business.slug)}
                            icon={FileSearch}
                            title={lookupLabel}
                            detail="Lihat status dan invoice"
                        />
                    </nav>
                </main>

                <footer className="pb-10 text-center text-xs text-mute">
                    <span className="inline-flex items-center gap-1.5">
                        Ditenagai oleh <JanjiyanLogo size="sm" />
                    </span>
                </footer>
            </div>

            <Dialog open={lightboxIdx !== null} onOpenChange={(open) => !open && setLightboxIdx(null)}>
                <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-2xl sm:p-6">
                    {lightboxIdx !== null && galleries[lightboxIdx] && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-base leading-snug font-semibold break-words text-ink">
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
                                        onClick={() => setLightboxIdx((lightboxIdx - 1 + galleries.length) % galleries.length)}
                                    >
                                        <ChevronLeft className="size-4" aria-hidden="true" />
                                        <span>Sebelumnya</span>
                                    </Button>
                                    <span className="shrink-0 font-mono text-xs font-semibold whitespace-nowrap text-mute tabular-nums">
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
