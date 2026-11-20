import { Head, Link, router, usePage } from '@inertiajs/react';
import { Calendar, CalendarClock, Check, CheckCircle2, ChevronDown, Download, Eye, List, MessageCircle, MoreHorizontal, Plus, Search, SlidersHorizontal, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { BookingCalendarView, type CalendarBookingItem, type CalendarPayload } from '@/components/BookingCalendarView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HorizontalScrollContainer } from '@/components/HorizontalScrollContainer';
import { PaginationBar, type PaginationMeta } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
    buildWhatsAppUrl,
    formatBookingScheduleShort,
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
    FULFILLMENT_TYPE_LABELS,
    PAYMENT_STATUS_LABELS,
    PICKUP_SESSION_LABELS,
    RESERVATION_STATUS_LABELS,
    WORK_STATUS_LABELS,
} from '@/lib/format';
import {
    buildWhatsappTemplateUrl,
    WHATSAPP_TEMPLATE_META,
    type WhatsappTemplateKey,
    type WhatsappTemplatesMap,
} from '@/lib/whatsappTemplates';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

interface BookingRow {
    id: number;
    booking_code: string;
    invoice_number?: string | null;
    invoice_token?: string | null;
    invoice_url?: string | null;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    customer_tags?: string[];
    customer_no_show_count?: number;
    customer_is_blocked?: boolean;
    service_id: number;
    service_name: string;
    service_assignment_mode: 'staff' | 'capacity';
    booking_mode?: 'time_slot' | 'dropoff';
    quantity?: number;
    fulfillment_type?: 'dropoff' | 'pickup';
    pickup_session?: string | null;
    pickup_address?: string | null;
    estimated_ready_date?: string | null;
    work_status?: 'awaiting_dropoff' | 'in_progress' | 'ready_for_pickup' | 'picked_up' | null;
    schedule_label?: string;
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
    customer_notes: string | null;
    cancellation_reason: string | null;
    rescheduled_count?: number;
}

interface ServiceOption {
    id: number;
    name: string;
    price: number;
    duration_minutes: number;
    capacity: number;
    assignment_mode: 'staff' | 'capacity';
    booking_mode?: 'time_slot' | 'dropoff';
    turnaround_days?: number;
    supports_pickup?: boolean;
    dp_amount: number;
    staff: Array<{
        id: number;
        name: string;
        title: string | null;
    }>;
}

interface StaffFilterOption {
    id: number;
    name: string;
    title: string | null;
}

interface BookingsIndexProps {
    bookings: BookingRow[];
    pagination?: PaginationMeta | null;
    services: ServiceOption[];
    staffOptions?: StaffFilterOption[];
    filters: {
        status: string;
        payment: string;
        staff_id?: string;
        service_id?: string;
        search: string;
        date_from: string;
        date_to: string;
        view: 'list' | 'calendar';
        calendar_date: string;
    };
    calendar: CalendarPayload;
    businessName: string;
    businessAddress?: string;
    whatsappTemplates?: WhatsappTemplatesMap;
    canExportCsv: boolean;
}

export default function BookingsIndex({
    bookings,
    pagination,
    services,
    staffOptions = [],
    filters,
    calendar,
    businessName,
    businessAddress = '',
    whatsappTemplates,
    canExportCsv,
}: BookingsIndexProps) {
    const { pendingBookingsCount = 0 } = usePage<PageProps>().props;
    const [search, setSearch] = useState(filters.search);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [noShowBooking, setNoShowBooking] = useState<Pick<BookingRow, 'id' | 'booking_code' | 'customer_name'> | null>(null);
    const [selectedCalendarBooking, setSelectedCalendarBooking] = useState<CalendarBookingItem | null>(null);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

    const STATUS_TABS = [
        { value: 'active', label: 'Aktif' },
        { value: 'pending', label: 'Menunggu' },
        { value: 'confirmed', label: 'Dikonfirmasi' },
        { value: 'completed', label: 'Selesai' },
        { value: 'no_show', label: 'Tidak Hadir' },
        { value: 'cancelled', label: 'Dibatalkan' },
        { value: 'all', label: 'Semua' },
    ] as const;

    const currentStatus = filters.status || 'active';
    const advancedFilterCount = [
        filters.payment,
        filters.service_id,
        filters.staff_id,
        filters.date_from || filters.date_to ? 'date' : '',
    ].filter(Boolean).length;

    const hasActiveFilter = Boolean(
        (filters.status && filters.status !== 'active') ||
            filters.payment ||
            filters.staff_id ||
            filters.service_id ||
            filters.search ||
            filters.date_from ||
            filters.date_to
    );

    const applyFilters = (next: Partial<typeof filters>) => {
        router.get(
            route('dashboard.bookings'),
            { ...filters, search, ...next },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const resetFilters = () => {
        setSearch('');
        router.get(
            route('dashboard.bookings'),
            { view: filters.view, calendar_date: filters.calendar_date },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const exportUrl = (() => {
        const params = new URLSearchParams();
        if (filters.status && filters.status !== 'all') params.set('status', filters.status);
        if (filters.payment) params.set('payment', filters.payment);
        if (filters.staff_id) params.set('staff_id', filters.staff_id);
        if (filters.service_id) params.set('service_id', filters.service_id);
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        const qs = params.toString();
        return qs ? `${route('dashboard.bookings.export')}?${qs}` : route('dashboard.bookings.export');
    })();

    const buildQuickWaUrl = (
        b: Pick<
            BookingRow,
            | 'customer_name'
            | 'customer_phone'
            | 'booking_code'
            | 'service_name'
            | 'booking_date'
            | 'start_time_local'
            | 'booking_mode'
            | 'quantity'
            | 'fulfillment_type'
            | 'pickup_session'
            | 'work_status'
            | 'schedule_label'
            | 'payment_status'
            | 'reservation_status'
            | 'invoice_url'
        >
    ) => {
        const dateLabel = formatDateIndo(b.booking_date);
        const isDropoff = b.booking_mode === 'dropoff';
        const timeOrMode = b.schedule_label ?? formatBookingScheduleShort(b);
        let msg = `Halo ${b.customer_name}, kami dari ${businessName}.`;
        if (b.payment_status === 'unpaid' && b.reservation_status === 'pending') {
            msg += ` Mengingatkan untuk menyelesaikan pembayaran DP pesanan ${b.booking_code} (${b.service_name}, ${dateLabel} · ${timeOrMode}).`;
        } else if (isDropoff && b.work_status === 'ready_for_pickup') {
            msg += ` Pesanan ${b.booking_code} (${b.service_name}, ${b.quantity ?? 1} item) sudah selesai dan siap diambil/diantar!`;
        } else if (b.reservation_status === 'confirmed') {
            msg += isDropoff
                ? ` Pesanan drop-off ${b.booking_code} (${b.service_name}, ${b.quantity ?? 1} item) pada ${dateLabel} telah dikonfirmasi.`
                : ` Reservasi ${b.booking_code} untuk ${b.service_name} pada ${dateLabel} pukul ${b.start_time_local} telah dikonfirmasi. Kami tunggu kedatangannya!`;
        } else {
            msg += ` Terkait pesanan ${b.booking_code} (${b.service_name}, ${dateLabel} · ${timeOrMode}).`;
        }
        if (b.invoice_url) {
            msg += ` Detail invoice: ${b.invoice_url}`;
        }
        return buildWhatsAppUrl(b.customer_phone, msg);
    };

    const buildTemplateWaUrl = (
        b: Pick<
            BookingRow,
            | 'customer_name'
            | 'customer_phone'
            | 'service_name'
            | 'staff_name'
            | 'booking_date'
            | 'start_time_local'
            | 'booking_mode'
            | 'quantity'
            | 'fulfillment_type'
            | 'pickup_session'
            | 'estimated_ready_date'
            | 'schedule_label'
            | 'booking_code'
            | 'dp_amount'
            | 'total_price'
            | 'invoice_url'
        >,
        key: WhatsappTemplateKey
    ): string => {
        const template = whatsappTemplates?.[key];
        if (!template) {
            return buildQuickWaUrl(b as BookingRow);
        }

        return buildWhatsappTemplateUrl(b.customer_phone, template, {
            customer_name: b.customer_name,
            business_name: businessName,
            service_name: b.service_name,
            quantity: b.quantity ?? 1,
            staff_name: b.staff_name,
            date: formatDateIndo(b.booking_date),
            time: b.booking_mode === 'dropoff' ? (b.schedule_label ?? formatBookingScheduleShort(b)) : b.start_time_local,
            estimated_ready_date: b.estimated_ready_date ? formatDateIndo(b.estimated_ready_date) : '-',
            booking_code: b.booking_code,
            dp_amount: b.dp_amount,
            total_price: b.total_price,
            invoice_url: b.invoice_url,
            business_address: businessAddress,
        });
    };

    const verifyDp = (id: number) => {
        router.post(route('dashboard.bookings.verify-dp', id), {}, { preserveScroll: true });
    };

    const updateStatus = (id: number, reservation_status: string, cancellation_reason?: string | null) => {
        router.patch(
            route('dashboard.bookings.status', id),
            cancellation_reason ? { reservation_status, cancellation_reason } : { reservation_status },
            { preserveScroll: true }
        );
    };

    const updateWorkStatus = (id: number, work_status: 'awaiting_dropoff' | 'in_progress' | 'ready_for_pickup' | 'picked_up') => {
        router.patch(route('dashboard.bookings.status', id), { work_status }, { preserveScroll: true });
    };

    const settlePayment = (id: number) => {
        router.patch(route('dashboard.bookings.status', id), { payment_status: 'settled' }, { preserveScroll: true });
    };

    const reservationBadge = (status: string) => {
        const label = RESERVATION_STATUS_LABELS[status] ?? status;
        if (status === 'confirmed' || status === 'completed') return <Badge variant="success">{label}</Badge>;
        if (status === 'cancelled' || status === 'no_show') return <Badge variant="danger">{label}</Badge>;
        return <Badge variant="warning">{label}</Badge>;
    };

    const paymentBadge = (status: string) => {
        const label = PAYMENT_STATUS_LABELS[status] ?? status;
        if (status === 'dp_verified' || status === 'settled') return <Badge variant="success">{label}</Badge>;
        if (status === 'waiting_verification') return <Badge variant="warning">{label}</Badge>;
        return <Badge variant="secondary">{label}</Badge>;
    };

    return (
        <DashboardLayout title="Manajemen Reservasi">
            <Head title="Reservasi" />

            {/* Toolbar */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                        className="inline-flex rounded-full border border-hairline-soft bg-bone p-1"
                        role="group"
                        aria-label="Tampilan reservasi"
                    >
                        <button
                            type="button"
                            aria-pressed={filters.view === 'list'}
                            onClick={() => applyFilters({ view: 'list' })}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-4 ${
                                filters.view === 'list' ? 'bg-ink text-white' : 'text-mute hover:text-ink'
                            }`}
                        >
                            <List className="size-3.5" aria-hidden="true" />
                            Daftar
                        </button>
                        <button
                            type="button"
                            aria-pressed={filters.view === 'calendar'}
                            onClick={() => applyFilters({ view: 'calendar' })}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-4 ${
                                filters.view === 'calendar' ? 'bg-ink text-white' : 'text-mute hover:text-ink'
                            }`}
                        >
                            <Calendar className="size-3.5" aria-hidden="true" />
                            Kalender
                        </button>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {canExportCsv ? (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="size-9 px-0 sm:h-10 sm:w-auto sm:px-4"
                            >
                                <a href={exportUrl} aria-label="Export CSV reservasi">
                                    <Download className="size-4" aria-hidden="true" />
                                    <span className="hidden sm:inline">Export CSV</span>
                                </a>
                            </Button>
                        ) : (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="size-9 px-0 text-mute sm:h-10 sm:w-auto sm:px-4"
                            >
                                <Link
                                    href={route('dashboard.billing')}
                                    aria-label="Export CSV tersedia pada paket Professional, buka Paket & Billing"
                                    title="Export CSV tersedia pada paket Professional & Enterprise"
                                >
                                    <Download className="size-4" aria-hidden="true" />
                                    <span className="hidden sm:inline">Export CSV (Pro)</span>
                                </Link>
                            </Button>
                        )}

                        {services.length > 0 ? (
                            <Button
                                asChild
                                size="sm"
                                className="h-9 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
                            >
                                <Link href={route('dashboard.bookings.create')}>
                                    <Plus className="size-4" aria-hidden="true" />
                                    <span className="sm:hidden">Baru</span>
                                    <span className="hidden sm:inline">Tambah Reservasi</span>
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                disabled
                                className="h-9 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                <span className="sm:hidden">Baru</span>
                                <span className="hidden sm:inline">Tambah Reservasi</span>
                            </Button>
                        )}
                    </div>
                </div>

                {filters.view === 'list' && (
                    <>
                        {/* Quick Status Tabs */}
                        <HorizontalScrollContainer
                            role="group"
                            ariaLabel="Filter cepat status reservasi"
                            wrapperClassName="-mx-4 sm:mx-0"
                            fadeBreakpointClass="sm:hidden"
                            className="flex gap-1.5 px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
                        >
                            {STATUS_TABS.map((tab) => {
                                const active = currentStatus === tab.value;
                                const showPendingBadge = tab.value === 'pending' && pendingBookingsCount > 0;
                                return (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => applyFilters({ status: tab.value })}
                                        className={cn(
                                            'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                            active
                                                ? 'border-ink bg-ink text-canvas'
                                                : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                        )}
                                    >
                                        <span>{tab.label}</span>
                                        {showPendingBadge && (
                                            <span
                                                className={cn(
                                                    'inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-none',
                                                    active ? 'bg-canvas text-ink' : 'bg-electric text-canvas'
                                                )}
                                            >
                                                {pendingBookingsCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </HorizontalScrollContainer>

                        {/* Mobile Search + Filter Sheet Trigger */}
                        <div className="flex items-center gap-2 md:hidden">
                            <div className="relative flex min-w-0 flex-1 items-center">
                                <label htmlFor="bookings-search-mobile" className="sr-only">
                                    Cari reservasi berdasarkan kode, nama, atau WhatsApp
                                </label>
                                <Search className="pointer-events-none absolute left-3.5 size-4 text-ash" aria-hidden="true" />
                                <Input
                                    id="bookings-search-mobile"
                                    className="h-11 bg-field pl-10 pr-9"
                                    placeholder="Cari nama, kode, WA…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters({ search })}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        aria-label="Hapus pencarian"
                                        onClick={() => {
                                            setSearch('');
                                            applyFilters({ search: '' });
                                        }}
                                        className="absolute right-1.5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-mute hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                    >
                                        <X className="size-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>

                            <Button
                                type="button"
                                variant={advancedFilterCount > 0 || mobileFilterOpen ? 'default' : 'outline'}
                                size="sm"
                                aria-expanded={mobileFilterOpen}
                                onClick={() => setMobileFilterOpen((prev) => !prev)}
                                className="h-11 shrink-0 rounded-[16px] px-3.5"
                            >
                                <SlidersHorizontal className="size-4" aria-hidden="true" />
                                <span>Filter</span>
                                {advancedFilterCount > 0 && (
                                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-canvas text-xs font-semibold tabular-nums text-ink">
                                        {advancedFilterCount}
                                    </span>
                                )}
                            </Button>
                        </div>

                        {mobileFilterOpen && (
                            <div className="space-y-4 rounded-[20px] border border-hairline-soft bg-canvas p-4 md:hidden">
                                <div className="space-y-1.5">
                                    <Label htmlFor="mobile-filter-payment">Status Pembayaran</Label>
                                    <NativeSelect
                                        id="mobile-filter-payment"
                                        value={filters.payment}
                                        onChange={(e) => applyFilters({ payment: e.target.value })}
                                    >
                                        <option value="">Semua Pembayaran</option>
                                        <option value="unpaid">Belum Dibayar</option>
                                        <option value="waiting_verification">Menunggu Verifikasi DP</option>
                                        <option value="dp_verified">DP Terverifikasi</option>
                                        <option value="settled">Lunas</option>
                                    </NativeSelect>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="mobile-filter-service">Layanan</Label>
                                    <NativeSelect
                                        id="mobile-filter-service"
                                        value={filters.service_id ?? ''}
                                        onChange={(e) => applyFilters({ service_id: e.target.value })}
                                    >
                                        <option value="">Semua Layanan</option>
                                        {services.map((svc) => (
                                            <option key={svc.id} value={String(svc.id)}>
                                                {svc.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </div>

                                {staffOptions.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mobile-filter-staff">Staff</Label>
                                        <NativeSelect
                                            id="mobile-filter-staff"
                                            value={filters.staff_id ?? ''}
                                            onChange={(e) => applyFilters({ staff_id: e.target.value })}
                                        >
                                            <option value="">Semua Staff</option>
                                            {staffOptions.map((st) => (
                                                <option key={st.id} value={String(st.id)}>
                                                    {st.name}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mobile-filter-date-from">Dari Tanggal</Label>
                                        <Input
                                            id="mobile-filter-date-from"
                                            type="date"
                                            value={filters.date_from}
                                            onChange={(e) => applyFilters({ date_from: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mobile-filter-date-to">Sampai Tanggal</Label>
                                        <Input
                                            id="mobile-filter-date-to"
                                            type="date"
                                            value={filters.date_to}
                                            onChange={(e) => applyFilters({ date_to: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 border-t border-divider pt-3">
                                    {hasActiveFilter && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                resetFilters();
                                                setMobileFilterOpen(false);
                                            }}
                                        >
                                            Reset Filter
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        className="flex-1"
                                        onClick={() => setMobileFilterOpen(false)}
                                    >
                                        Tutup Filter
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Desktop Inline Filter Panel */}
                        <div className="hidden space-y-2.5 rounded-[20px] border border-hairline-soft bg-bone/50 p-3 md:block">
                            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
                                <div className="relative flex min-w-0 items-center">
                                    <label htmlFor="bookings-search" className="sr-only">
                                        Cari reservasi berdasarkan kode, nama, atau WhatsApp
                                    </label>
                                    <Search className="pointer-events-none absolute top-4 left-4 size-4 text-ash" aria-hidden="true" />
                                    <Input
                                        id="bookings-search"
                                        className="bg-canvas pl-10 pr-10"
                                        placeholder="Cari kode, nama, atau WA…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyFilters({ search })}
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            aria-label="Hapus pencarian"
                                            onClick={() => {
                                                setSearch('');
                                                applyFilters({ search: '' });
                                            }}
                                            className="absolute right-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-mute hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                        >
                                            <X className="size-4" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>

                                <NativeSelect
                                    aria-label="Filter status pembayaran"
                                    value={filters.payment}
                                    onChange={(e) => applyFilters({ payment: e.target.value })}
                                    className="bg-canvas"
                                >
                                    <option value="">Semua Pembayaran</option>
                                    <option value="unpaid">Belum Dibayar</option>
                                    <option value="waiting_verification">Menunggu Verifikasi DP</option>
                                    <option value="dp_verified">DP Terverifikasi</option>
                                    <option value="settled">Lunas</option>
                                </NativeSelect>

                                <NativeSelect
                                    aria-label="Filter layanan"
                                    value={filters.service_id ?? ''}
                                    onChange={(e) => applyFilters({ service_id: e.target.value })}
                                    className="bg-canvas"
                                >
                                    <option value="">Semua Layanan</option>
                                    {services.map((svc) => (
                                        <option key={svc.id} value={String(svc.id)}>
                                            {svc.name}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {staffOptions.length > 0 && (
                                        <NativeSelect
                                            aria-label="Filter staff"
                                            value={filters.staff_id ?? ''}
                                            onChange={(e) => applyFilters({ staff_id: e.target.value })}
                                            className="h-10 w-48 bg-canvas py-0"
                                        >
                                            <option value="">Semua Staff</option>
                                            {staffOptions.map((st) => (
                                                <option key={st.id} value={String(st.id)}>
                                                    {st.name}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <span className="shrink-0 text-xs font-semibold text-mute">Tanggal:</span>
                                        <Label htmlFor="bookings-date-from" className="sr-only">
                                            Dari tanggal
                                        </Label>
                                        <Input
                                            id="bookings-date-from"
                                            type="date"
                                            value={filters.date_from}
                                            onChange={(e) => applyFilters({ date_from: e.target.value })}
                                            className="h-10 w-40 bg-canvas px-3 py-2 text-sm"
                                        />
                                        <span className="text-xs text-mute">–</span>
                                        <Label htmlFor="bookings-date-to" className="sr-only">
                                            Sampai tanggal
                                        </Label>
                                        <Input
                                            id="bookings-date-to"
                                            type="date"
                                            value={filters.date_to}
                                            onChange={(e) => applyFilters({ date_to: e.target.value })}
                                            className="h-10 w-40 bg-canvas px-3 py-2 text-sm"
                                        />
                                    </div>
                                </div>

                                {hasActiveFilter && (
                                    <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                                        Reset Filter
                                    </Button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {filters.view === 'calendar' ? (
                <BookingCalendarView
                    calendar={calendar}
                    onSelectDate={(date) => applyFilters({ view: 'calendar', calendar_date: date })}
                    onSelectBooking={(booking) => setSelectedCalendarBooking(booking)}
                />
            ) : bookings.length === 0 ? (
                <div className="space-y-3 rounded-[24px] bg-bone p-10 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        {hasActiveFilter
                            ? 'Tidak ada reservasi yang cocok dengan filter saat ini.'
                            : currentStatus === 'active'
                              ? 'Tidak ada reservasi aktif saat ini.'
                              : 'Belum ada reservasi masuk.'}
                    </p>
                    <p className="text-sm text-mute">
                        {hasActiveFilter
                            ? 'Ubah kata kunci pencarian atau reset filter untuk melihat reservasi lainnya.'
                            : currentStatus === 'active'
                              ? 'Belum ada reservasi yang menunggu konfirmasi atau sedang berjalan. Anda dapat melihat seluruh riwayat atau membuat reservasi manual.'
                              : 'Bagikan link portal booking bisnis Anda atau tambahkan reservasi walk-in secara manual.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        {hasActiveFilter ? (
                            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                                Reset Filter
                            </Button>
                        ) : (
                            <>
                                {currentStatus === 'active' && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyFilters({ status: 'all' })}
                                    >
                                        Lihat Semua Reservasi
                                    </Button>
                                )}
                                {services.length > 0 && (
                                    <Button asChild size="sm">
                                        <Link href={route('dashboard.bookings.create')}>
                                            <Plus className="size-4" aria-hidden="true" />
                                            Tambah Reservasi Manual
                                        </Link>
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {bookings.map((b) => {
                        const canReschedule = b.reservation_status === 'pending' || b.reservation_status === 'confirmed';
                        const canNoShow = b.reservation_status === 'confirmed';
                        const canCancel =
                            b.reservation_status !== 'cancelled' &&
                            b.reservation_status !== 'completed' &&
                            b.reservation_status !== 'no_show';
                        const canSettle =
                            b.payment_status !== 'settled' &&
                            b.payment_status !== 'waiting_verification' &&
                            b.reservation_status !== 'cancelled' &&
                            b.reservation_status !== 'no_show';
                        const showSettleAsPrimary =
                            b.reservation_status === 'completed' && canSettle;
                        const hasOverflowActions =
                            canReschedule || canNoShow || canCancel || (canSettle && !showSettleAsPrimary);

                        return (
                            <div
                                key={b.id}
                                className="flex flex-col justify-between gap-3.5 rounded-[24px] border border-hairline-soft bg-canvas p-4 sm:p-5 md:flex-row md:items-start md:gap-6"
                            >
                                <div className="min-w-0 flex-1 space-y-2">
                                    {/* Mobile-first header: Customer & Schedule lead, Price aligned top-right */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-base font-semibold text-ink">
                                                <Link
                                                    href={route('dashboard.customers.show', b.customer_id)}
                                                    className="hover:underline"
                                                >
                                                    {b.customer_name}
                                                </Link>
                                            </p>
                                             <p className="mt-0.5 text-sm font-medium text-ink">
                                                {formatDateShortIndo(b.booking_date)}{' '}
                                                <span className="whitespace-nowrap tabular-nums text-mute">
                                                    · {b.schedule_label ?? formatBookingScheduleShort(b)}
                                                </span>
                                            </p>
                                        </div>

                                        <div className="shrink-0 text-right md:hidden">
                                            <p className="text-base font-semibold tabular-nums text-ink">
                                                {formatRupiah(b.total_price)}
                                            </p>
                                            {b.dp_amount > 0 && (
                                                <p className="text-xs tabular-nums text-mute">
                                                    DP {formatRupiah(b.dp_amount)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-mute">
                                        <span className="font-medium text-body">{b.service_name}</span>
                                        {b.booking_mode === 'dropoff' ? ` · ${b.quantity ?? 1} item` : ''}
                                        {b.booking_mode === 'dropoff' && b.estimated_ready_date
                                            ? ` · Est. selesai ${formatDateShortIndo(b.estimated_ready_date)}`
                                            : ''}
                                        {b.staff_name ? ` · ${b.staff_name}` : ''}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {reservationBadge(b.reservation_status)}
                                        {b.booking_mode === 'dropoff' && b.work_status && (
                                            <Badge variant="outline">
                                                {WORK_STATUS_LABELS[b.work_status] ?? b.work_status}
                                            </Badge>
                                        )}
                                        {paymentBadge(b.payment_status)}
                                        {(b.rescheduled_count ?? 0) > 0 && (
                                            <Badge variant="outline" className="tabular-nums">
                                                Reschedule {b.rescheduled_count}x
                                            </Badge>
                                        )}
                                        {b.customer_tags?.includes('VIP') && (
                                            <Badge variant="popular">
                                                VIP
                                            </Badge>
                                        )}
                                        {(b.customer_no_show_count ?? 0) > 0 && (
                                            <Badge variant="warning" className="tabular-nums">
                                                No-Show {b.customer_no_show_count}x
                                            </Badge>
                                        )}
                                        {b.customer_is_blocked && (
                                            <Badge variant="danger">
                                                Diblokir
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-ash">
                                        <span>{b.booking_code}</span>
                                        {b.invoice_number && <span>· {b.invoice_number}</span>}
                                        <span className="tabular-nums">· +{b.customer_phone}</span>
                                    </p>

                                    {b.booking_mode === 'dropoff' && b.fulfillment_type === 'pickup' && b.pickup_address && (
                                        <p className="rounded-[12px] bg-bone px-3 py-2 text-xs text-body">
                                            Alamat Jemput ({FULFILLMENT_TYPE_LABELS[b.fulfillment_type] ?? 'Jemput'}): {b.pickup_address}
                                        </p>
                                    )}

                                    {b.customer_notes && (
                                        <p className="rounded-[12px] bg-bone px-3 py-2 text-xs text-body">
                                            Catatan: {b.customer_notes}
                                        </p>
                                    )}

                                    {b.reservation_status === 'cancelled' && b.cancellation_reason && (
                                        <p className="rounded-[12px] bg-destructive-soft px-3 py-2 text-xs text-destructive">
                                            Alasan pembatalan: {b.cancellation_reason}
                                        </p>
                                    )}
                                </div>

                                <div className="flex shrink-0 flex-col gap-3 border-t border-divider pt-3 md:items-end md:border-t-0 md:pt-0">
                                    <div className="hidden text-right md:block">
                                        <p className="text-base font-semibold tabular-nums text-ink">
                                            {formatRupiah(b.total_price)}
                                        </p>
                                        {b.dp_amount > 0 && (
                                            <p className="text-xs tabular-nums text-mute">DP: {formatRupiah(b.dp_amount)}</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                        {b.payment_status === 'waiting_verification' ? (
                                            <Button type="button" size="sm" className="flex-1 md:flex-initial" onClick={() => verifyDp(b.id)}>
                                                <Check className="size-3.5" aria-hidden="true" />
                                                Verifikasi DP
                                            </Button>
                                        ) : b.booking_mode === 'dropoff' && (b.reservation_status === 'pending' || b.reservation_status === 'confirmed') ? (
                                            b.work_status === 'awaiting_dropoff' || !b.work_status ? (
                                                <Button type="button" size="sm" className="flex-1 md:flex-initial" onClick={() => updateWorkStatus(b.id, 'in_progress')}>
                                                    <Check className="size-3.5" aria-hidden="true" />
                                                    Terima &amp; Proses
                                                </Button>
                                            ) : b.work_status === 'in_progress' ? (
                                                <Button type="button" size="sm" className="flex-1 md:flex-initial" onClick={() => updateWorkStatus(b.id, 'ready_for_pickup')}>
                                                    <Check className="size-3.5" aria-hidden="true" />
                                                    Siap Diambil
                                                </Button>
                                            ) : (
                                                <Button type="button" variant="outline" size="sm" className="flex-1 md:flex-initial" onClick={() => updateWorkStatus(b.id, 'picked_up')}>
                                                    <Check className="size-3.5" aria-hidden="true" />
                                                    Tandai Selesai
                                                </Button>
                                            )
                                        ) : b.reservation_status === 'pending' ? (
                                            <Button type="button" size="sm" className="flex-1 md:flex-initial" onClick={() => updateStatus(b.id, 'confirmed')}>
                                                <Check className="size-3.5" aria-hidden="true" />
                                                Konfirmasi
                                            </Button>
                                        ) : b.reservation_status === 'confirmed' ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 md:flex-initial"
                                                onClick={() => updateStatus(b.id, 'completed')}
                                            >
                                                <Check className="size-3.5" aria-hidden="true" />
                                                Tandai Selesai
                                            </Button>
                                        ) : showSettleAsPrimary ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 md:flex-initial"
                                                onClick={() => settlePayment(b.id)}
                                            >
                                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                                Tandai Lunas
                                            </Button>
                                        ) : null}

                                        {b.dp_proof_url && (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setPreviewUrl(b.dp_proof_url)}
                                            >
                                                <Eye className="size-3.5" aria-hidden="true" />
                                                Bukti DP
                                            </Button>
                                        )}

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button type="button" variant="outline" size="sm">
                                                    <MessageCircle className="size-3.5" aria-hidden="true" />
                                                    <span className="sm:hidden">WA</span>
                                                    <span className="hidden sm:inline">WhatsApp</span>
                                                    <ChevronDown className="size-3 text-mute" aria-hidden="true" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="w-56 rounded-[20px] border-hairline-soft p-2 shadow-none"
                                            >
                                                {WHATSAPP_TEMPLATE_META.map((item) => (
                                                    <DropdownMenuItem
                                                        key={item.key}
                                                        asChild
                                                        className="cursor-pointer rounded-[12px] px-3 py-2 text-sm text-ink"
                                                    >
                                                        <a
                                                            href={buildTemplateWaUrl(b, item.key)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <MessageCircle className="mr-2 size-3.5 text-mute" aria-hidden="true" />
                                                            {item.shortLabel}
                                                        </a>
                                                    </DropdownMenuItem>
                                                ))}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    asChild
                                                    className="cursor-pointer rounded-[12px] px-3 py-2 text-xs text-mute"
                                                >
                                                    <a
                                                        href={buildQuickWaUrl(b)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        Chat Cepat (Ringkasan)
                                                    </a>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {hasOverflowActions && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={`Aksi lainnya untuk reservasi ${b.booking_code}`}
                                                    >
                                                        <MoreHorizontal className="size-4" aria-hidden="true" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="w-52 rounded-[20px] border-hairline-soft p-2 shadow-none"
                                                >
                                                    {canSettle && !showSettleAsPrimary && (
                                                        <DropdownMenuItem
                                                            onClick={() => settlePayment(b.id)}
                                                            className="cursor-pointer rounded-[12px] px-3 py-2 text-sm text-ink"
                                                        >
                                                            <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                                                            Tandai Lunas
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canReschedule && (
                                                        <DropdownMenuItem
                                                            asChild
                                                            className="cursor-pointer rounded-[12px] px-3 py-2 text-sm text-ink"
                                                        >
                                                            <Link href={route('dashboard.bookings.reschedule.edit', b.id)}>
                                                                <CalendarClock className="mr-2 size-4" aria-hidden="true" />
                                                                Ubah Jadwal
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canNoShow && (
                                                        <DropdownMenuItem
                                                            onClick={() => setNoShowBooking(b)}
                                                            className="cursor-pointer rounded-[12px] px-3 py-2 text-sm text-ink"
                                                        >
                                                            <UserX className="mr-2 size-4" aria-hidden="true" />
                                                            Tandai Tidak Hadir
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canCancel && (
                                                        <>
                                                            {(canReschedule || canNoShow || (canSettle && !showSettleAsPrimary)) && (
                                                                <DropdownMenuSeparator />
                                                            )}
                                                            <DropdownMenuItem
                                                                asChild
                                                                className="cursor-pointer rounded-[12px] px-3 py-2 text-sm text-destructive focus:bg-destructive-soft focus:text-destructive"
                                                            >
                                                                <Link href={route('dashboard.bookings.cancel.edit', b.id)}>
                                                                    <X className="mr-2 size-4" aria-hidden="true" />
                                                                    Batalkan Reservasi
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <PaginationBar pagination={pagination} />
                </div>
            )}

            {/* Proof Preview Modal */}
            <Dialog open={previewUrl !== null} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-ink">Bukti Pembayaran DP</DialogTitle>
                    </DialogHeader>
                    {previewUrl && (
                        <img
                            src={previewUrl}
                            alt="Bukti pembayaran DP pelanggan"
                            className="max-h-[70vh] w-full rounded-[16px] bg-bone object-contain outline-1 -outline-offset-1 outline-black/10"
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Calendar Booking Quick Detail Dialog */}
            <Dialog
                open={selectedCalendarBooking !== null}
                onOpenChange={(open) => !open && setSelectedCalendarBooking(null)}
            >
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-ink">
                            Detail Reservasi {selectedCalendarBooking?.booking_code}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedCalendarBooking && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {reservationBadge(selectedCalendarBooking.reservation_status)}
                                {paymentBadge(selectedCalendarBooking.payment_status)}
                            </div>
                            <div className="space-y-1 text-sm">
                                <p className="font-semibold text-ink">
                                    <Link
                                        href={route('dashboard.customers.show', selectedCalendarBooking.customer_id)}
                                        className="hover:underline"
                                    >
                                        {selectedCalendarBooking.customer_name}
                                    </Link>{' '}
                                    · +{selectedCalendarBooking.customer_phone}
                                </p>
                                <p className="text-mute">
                                    {selectedCalendarBooking.service_name}
                                    {selectedCalendarBooking.staff_name ? ` · ${selectedCalendarBooking.staff_name}` : ''}
                                </p>
                                <p className="text-mute">
                                    {formatDateIndo(selectedCalendarBooking.booking_date)} ·{' '}
                                    {formatBookingScheduleShort(selectedCalendarBooking)}
                                </p>
                                <p className="font-semibold tabular-nums text-ink">
                                    {formatRupiah(selectedCalendarBooking.total_price)}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
                                <Button asChild variant="outline" size="sm">
                                    <a
                                        href={buildQuickWaUrl(selectedCalendarBooking)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <MessageCircle className="size-3.5" aria-hidden="true" />
                                        WhatsApp
                                    </a>
                                </Button>

                                {(selectedCalendarBooking.reservation_status === 'pending' ||
                                    selectedCalendarBooking.reservation_status === 'confirmed') && (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={route('dashboard.bookings.reschedule.edit', selectedCalendarBooking.id)}>
                                            <CalendarClock className="size-3.5" aria-hidden="true" />
                                            Ubah Jadwal
                                        </Link>
                                    </Button>
                                )}

                                {selectedCalendarBooking.payment_status === 'waiting_verification' && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                            verifyDp(selectedCalendarBooking.id);
                                            setSelectedCalendarBooking(null);
                                        }}
                                    >
                                        <Check className="size-3.5" aria-hidden="true" />
                                        Verifikasi DP
                                    </Button>
                                )}

                                {selectedCalendarBooking.payment_status !== 'settled' &&
                                    selectedCalendarBooking.payment_status !== 'waiting_verification' &&
                                    selectedCalendarBooking.reservation_status !== 'cancelled' &&
                                    selectedCalendarBooking.reservation_status !== 'no_show' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                settlePayment(selectedCalendarBooking.id);
                                                setSelectedCalendarBooking(null);
                                            }}
                                        >
                                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                            Tandai Lunas
                                        </Button>
                                    )}

                                {selectedCalendarBooking.reservation_status === 'confirmed' && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                updateStatus(selectedCalendarBooking.id, 'completed');
                                                setSelectedCalendarBooking(null);
                                            }}
                                        >
                                            Tandai Selesai
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setNoShowBooking(selectedCalendarBooking);
                                                setSelectedCalendarBooking(null);
                                            }}
                                        >
                                            Tandai Tidak Hadir
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={noShowBooking !== null}
                onOpenChange={(open) => !open && setNoShowBooking(null)}
                title={`Tandai tidak hadir untuk ${noShowBooking?.booking_code ?? ''}?`}
                description={`Reservasi atas nama ${noShowBooking?.customer_name ?? ''} akan ditandai sebagai Tidak Hadir (No-Show) dan tercatat di riwayat pelanggan.`}
                confirmLabel="Tandai Tidak Hadir"
                onConfirm={() => {
                    if (!noShowBooking) return;
                    updateStatus(noShowBooking.id, 'no_show');
                    setNoShowBooking(null);
                }}
            />
        </DashboardLayout>
    );
}
