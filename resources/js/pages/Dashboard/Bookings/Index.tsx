import { Head, Link, router, usePage } from '@inertiajs/react';
import { Calendar, CalendarClock, Check, CheckCircle2, ChevronDown, Download, Eye, List, MessageCircle, MoreHorizontal, Plus, Search, SlidersHorizontal, UserX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { getBusinessTypeConfig } from '@/lib/businessType';
import {
    buildWhatsAppUrl,
    formatBookingScheduleShort,
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
    FULFILLMENT_TYPE_LABELS,
    PAYMENT_STATUS_LABELS,
    RESERVATION_STATUS_LABELS,
    WORK_STATUS_LABELS,
} from '@/lib/format';
import {
    buildWhatsappTemplateUrl,
    getWhatsappTemplateMetaForBusiness,
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
    unit_label?: string;
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
    unit_label?: string;
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

type BookingMode = 'time_slot' | 'dropoff';

// Must match BookingController::MODE_STATUS_TABS.
const STATUS_TABS: Record<BookingMode, { value: string; label: string }[]> = {
    time_slot: [
        { value: 'active', label: 'Aktif' },
        { value: 'pending', label: 'Menunggu' },
        { value: 'confirmed', label: 'Dikonfirmasi' },
        { value: 'completed', label: 'Selesai' },
        { value: 'no_show', label: 'Tidak Hadir' },
        { value: 'cancelled', label: 'Dibatalkan' },
        { value: 'all', label: 'Semua' },
    ],
    dropoff: [
        { value: 'active', label: 'Aktif' },
        { value: 'awaiting_dropoff', label: 'Masuk' },
        { value: 'in_progress', label: 'Dikerjakan' },
        { value: 'ready_for_pickup', label: 'Siap Diambil' },
        { value: 'completed', label: 'Selesai' },
        { value: 'cancelled', label: 'Dibatalkan' },
        { value: 'all', label: 'Semua' },
    ],
};

const DROPOFF_COUNTER_TABS = new Set(['active', 'awaiting_dropoff', 'in_progress', 'ready_for_pickup']);

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
        mode: BookingMode;
        view: 'list' | 'calendar';
        calendar_date: string;
    };
    dropoffStageCounts?: Record<string, number> | null;
    todayDate?: string;
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
    dropoffStageCounts,
    todayDate,
    calendar,
    businessName,
    businessAddress = '',
    whatsappTemplates,
    canExportCsv,
}: BookingsIndexProps) {
    const { pendingBookingsCount = 0, activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const isDropoffMode = config.type === 'dropoff';
    const supportsCalendar = config.bookings.supportsCalendar;
    const supportsStaffFilter = config.bookings.supportsStaffColumn;
    const supportsNoShow = config.bookings.supportsNoShow;
    const nounTitle = config.bookings.pageTitle;
    const itemSingular = config.bookings.itemSingular;
    const nounLower = itemSingular.toLowerCase();
    const todayStr = todayDate || new Date().toISOString().slice(0, 10);
    const visibleWaTemplates = getWhatsappTemplateMetaForBusiness(activeBusiness?.business_type);

    // Verifying DP and marking paid need verify_payments on the server.
    const canVerifyPayments = activeBusiness?.can?.verify_payments ?? true;
    const canOpenBilling = activeBusiness?.can?.manage_settings ?? true;
    const [search, setSearch] = useState(filters.search);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [noShowBooking, setNoShowBooking] = useState<Pick<BookingRow, 'id' | 'booking_code' | 'customer_name'> | null>(null);
    const [selectedCalendarBooking, setSelectedCalendarBooking] = useState<CalendarBookingItem | null>(null);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

    useEffect(() => {
        if (!mobileFilterOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileFilterOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [mobileFilterOpen]);

    const statusTabs = STATUS_TABS[isDropoffMode ? 'dropoff' : 'time_slot'];

    const currentStatus = filters.status || 'active';
    const advancedFilterCount = [
        filters.payment,
        filters.service_id,
        supportsStaffFilter ? filters.staff_id : '',
        filters.date_from || filters.date_to ? 'date' : '',
    ].filter(Boolean).length;

    const hasActiveFilter = Boolean(
        (filters.status && filters.status !== 'active') ||
            filters.payment ||
            (supportsStaffFilter && filters.staff_id) ||
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
            { view: supportsCalendar ? filters.view : 'list', calendar_date: filters.calendar_date },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const exportUrl = (() => {
        const params = new URLSearchParams();
        params.set('status', filters.status);
        if (filters.payment) params.set('payment', filters.payment);
        if (supportsStaffFilter && filters.staff_id) params.set('staff_id', filters.staff_id);
        if (filters.service_id) params.set('service_id', filters.service_id);
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        return `${route('dashboard.bookings.export')}?${params.toString()}`;
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
            | 'unit_label'
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
        const unitLabel = b.unit_label ?? 'item';
        const timeOrMode = b.schedule_label ?? formatBookingScheduleShort(b);
        let msg = `Halo ${b.customer_name}, kami dari ${businessName}.`;
        if (b.payment_status === 'unpaid' && b.reservation_status === 'pending') {
            msg += ` Mengingatkan untuk menyelesaikan pembayaran DP ${nounLower} ${b.booking_code} (${b.service_name}, ${dateLabel} · ${timeOrMode}).`;
        } else if (isDropoff && b.work_status === 'ready_for_pickup') {
            msg += ` Pesanan ${b.booking_code} (${b.service_name}, ${b.quantity ?? 1} ${unitLabel}) sudah selesai dan siap diambil/diantar.`;
        } else if (b.reservation_status === 'confirmed') {
            msg += isDropoff
                ? ` Pesanan drop-off ${b.booking_code} (${b.service_name}, ${b.quantity ?? 1} ${unitLabel}) pada ${dateLabel} telah dikonfirmasi.`
                : ` ${itemSingular} ${b.booking_code} untuk ${b.service_name} pada ${dateLabel} pukul ${b.start_time_local} telah dikonfirmasi. Kami tunggu kedatangannya.`;
        } else {
            msg += ` Terkait ${nounLower} ${b.booking_code} (${b.service_name}, ${dateLabel} · ${timeOrMode}).`;
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
            | 'unit_label'
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
            unit_label: b.unit_label ?? 'item',
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

    const exportButton = canExportCsv ? (
        <Button
            asChild
            variant="outline"
            size="sm"
            className="size-10 px-0 sm:h-10 sm:w-auto sm:px-4"
        >
            <a href={exportUrl} aria-label={`Export CSV ${nounLower}`}>
                <Download className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Export CSV</span>
            </a>
        </Button>
    ) : canOpenBilling ? (
        <Button
            asChild
            variant="outline"
            size="sm"
            className="size-10 px-0 text-mute sm:h-10 sm:w-auto sm:px-4"
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
    ) : (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-10 px-0 text-mute sm:h-10 sm:w-auto sm:px-4"
            disabled
            aria-label="Export CSV tersedia pada paket Professional"
            title="Export CSV tersedia pada paket Professional & Enterprise"
        >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Export CSV (Pro)</span>
        </Button>
    );

    const createButton =
        services.length > 0 ? (
            <Button
                asChild
                size="sm"
                className="h-10 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
            >
                <Link href={route('dashboard.bookings.create')}>
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="sm:hidden">Baru</span>
                    <span className="hidden sm:inline">{config.bookings.createButtonLabel}</span>
                </Link>
            </Button>
        ) : (
            <Button
                type="button"
                size="sm"
                disabled
                className="h-10 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
            >
                <Plus className="size-4" aria-hidden="true" />
                <span className="sm:hidden">Baru</span>
                <span className="hidden sm:inline">{config.bookings.createButtonLabel}</span>
            </Button>
        );

    return (
        <DashboardLayout
            title={nounTitle}
            actions={
                <>
                    {!supportsCalendar && exportButton}
                    {createButton}
                </>
            }
        >
            <Head title={nounTitle} />

            {/* Toolbar */}
            <div className="space-y-3">
                {supportsCalendar && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div
                            className="inline-flex rounded-full border border-hairline-soft bg-bone p-1"
                            role="group"
                            aria-label={`Tampilan ${nounLower}`}
                        >
                            <button
                                type="button"
                                aria-pressed={filters.view === 'list'}
                                onClick={() => applyFilters({ view: 'list' })}
                                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-4 ${
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
                                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-4 ${
                                    filters.view === 'calendar' ? 'bg-ink text-white' : 'text-mute hover:text-ink'
                                }`}
                            >
                                <Calendar className="size-3.5" aria-hidden="true" />
                                Kalender
                            </button>
                        </div>

                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            {exportButton}
                        </div>
                    </div>
                )}

                {(supportsCalendar ? filters.view === 'list' : true) && (
                    <>
                        {/* Quick Status Tabs */}
                        <HorizontalScrollContainer
                            role="group"
                            ariaLabel={`Filter cepat status ${nounLower}`}
                            wrapperClassName="-mx-4 sm:mx-0"
                            fadeBreakpointClass="sm:hidden"
                            className="flex gap-2 px-4 pr-10 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
                        >
                            {statusTabs.map((tab) => {
                                const active = currentStatus === tab.value;
                                const showPendingBadge = tab.value === 'pending' && pendingBookingsCount > 0;
                                const stageCount =
                                    isDropoffMode && dropoffStageCounts && DROPOFF_COUNTER_TABS.has(tab.value)
                                        ? (dropoffStageCounts[tab.value] ?? 0)
                                        : 0;
                                const showStageBadge = stageCount > 0;
                                return (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => applyFilters({ status: tab.value })}
                                        className={cn(
                                            'inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:min-h-9',
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
                                        {showStageBadge && (
                                            <span
                                                className={cn(
                                                    'inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-none',
                                                    active
                                                        ? 'bg-canvas text-ink'
                                                        : tab.value === 'awaiting_dropoff'
                                                          ? 'bg-electric text-canvas'
                                                          : 'bg-bone text-ink'
                                                )}
                                            >
                                                {stageCount}
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
                                    Cari {nounLower} berdasarkan kode, nama, atau WhatsApp
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
                                className="h-11 shrink-0 rounded-sm px-3.5"
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
                            <div className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 md:hidden">
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
                                    <Label htmlFor="mobile-filter-service">{config.services.pageTitle}</Label>
                                    <NativeSelect
                                        id="mobile-filter-service"
                                        value={filters.service_id ?? ''}
                                        onChange={(e) => applyFilters({ service_id: e.target.value })}
                                    >
                                        <option value="">Semua {config.services.pageTitle}</option>
                                        {services.map((svc) => (
                                            <option key={svc.id} value={String(svc.id)}>
                                                {svc.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </div>

                                {supportsStaffFilter && staffOptions.length > 0 && (
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

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="min-w-0 space-y-1.5">
                                        <Label htmlFor="mobile-filter-date-from">Dari Tanggal</Label>
                                        <Input
                                            id="mobile-filter-date-from"
                                            type="date"
                                            className="min-w-0"
                                            value={filters.date_from}
                                            onChange={(e) => applyFilters({ date_from: e.target.value })}
                                        />
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                        <Label htmlFor="mobile-filter-date-to">Sampai Tanggal</Label>
                                        <Input
                                            id="mobile-filter-date-to"
                                            type="date"
                                            className="min-w-0"
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
                        <div className="hidden space-y-2.5 rounded-md border border-hairline-soft bg-bone/50 p-3 md:block">
                            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
                                <div className="relative flex min-w-0 items-center">
                                    <label htmlFor="bookings-search" className="sr-only">
                                        Cari {nounLower} berdasarkan kode, nama, atau WhatsApp
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
                                    <option value="">Semua {config.services.pageTitle}</option>
                                    {services.map((svc) => (
                                        <option key={svc.id} value={String(svc.id)}>
                                            {svc.name}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {supportsStaffFilter && staffOptions.length > 0 && (
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

            {supportsCalendar && filters.view === 'calendar' ? (
                <BookingCalendarView
                    calendar={calendar}
                    businessType={activeBusiness?.business_type}
                    onSelectDate={(date) => applyFilters({ view: 'calendar', calendar_date: date })}
                    onSelectBooking={(booking) => setSelectedCalendarBooking(booking)}
                />
            ) : bookings.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-10 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        {hasActiveFilter
                            ? `Tidak ada ${nounLower} yang cocok dengan filter saat ini.`
                            : currentStatus === 'active'
                              ? `Tidak ada ${nounLower} aktif saat ini.`
                              : `Belum ada ${nounLower} masuk.`}
                    </p>
                    <p className="text-sm text-mute">
                        {hasActiveFilter
                            ? `Ubah kata kunci pencarian atau reset filter untuk melihat ${nounLower} lainnya.`
                            : config.bookings.emptyStateText}
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
                                        Lihat Semua {itemSingular}
                                    </Button>
                                )}
                                {services.length > 0 && (
                                    <Button asChild size="sm">
                                        <Link href={route('dashboard.bookings.create')}>
                                            <Plus className="size-4" aria-hidden="true" />
                                            {config.bookings.createButtonLabel}
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
                        const isDropoff = b.booking_mode === 'dropoff';
                        const isDropoffActive =
                            isDropoff && (b.reservation_status === 'pending' || b.reservation_status === 'confirmed');
                        const showSlaWarning =
                            isDropoffActive &&
                            !!b.estimated_ready_date &&
                            b.work_status !== 'picked_up' &&
                            b.work_status !== 'ready_for_pickup';
                        // Once a drop-off item is in the shop, rescheduling or no-show no longer apply.
                        const dropoffInShop = isDropoff && !!b.work_status && b.work_status !== 'awaiting_dropoff';
                        const canReschedule =
                            !dropoffInShop && (b.reservation_status === 'pending' || b.reservation_status === 'confirmed');
                        const canNoShow =
                            supportsNoShow && !isDropoff && b.reservation_status === 'confirmed';
                        const showWorkBadge =
                            isDropoff && !!b.work_status && b.reservation_status !== 'cancelled' && b.reservation_status !== 'no_show';
                        const canCancel =
                            b.reservation_status !== 'cancelled' &&
                            b.reservation_status !== 'completed' &&
                            b.reservation_status !== 'no_show';
                        const canSettle =
                            canVerifyPayments &&
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
                                className="flex flex-col justify-between gap-3.5 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-6"
                            >
                                <div className="min-w-0 flex-1 space-y-3">
                                    {/* Top Header: Customer & Service on left, Price & DP on right (mobile/tablet) */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="line-clamp-2 break-words text-base font-semibold text-ink">
                                                <Link
                                                    href={route('dashboard.customers.show', b.customer_id)}
                                                    className="hover:underline"
                                                >
                                                    {b.customer_name}
                                                </Link>
                                            </p>
                                            <p className="mt-0.5 text-xs text-mute">
                                                <span className="font-medium text-body">{b.service_name}</span>
                                                {isDropoff ? (
                                                    <span className="tabular-nums">
                                                        {` · ${b.quantity ?? 1} ${b.unit_label ?? 'item'}`}
                                                    </span>
                                                ) : null}
                                                {supportsStaffFilter && b.staff_name ? ` · ${b.staff_name}` : ''}
                                            </p>
                                        </div>

                                        <div className="shrink-0 text-right lg:hidden">
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

                                    {/* Schedule / Fulfillment Strip (full card width to avoid overflow) */}
                                    {isDropoff ? (
                                        <div
                                            className={cn(
                                                'grid gap-2.5 rounded-xl bg-bone/70 px-3 py-2.5 text-xs',
                                                b.estimated_ready_date ? 'grid-cols-1 min-[360px]:grid-cols-2' : 'grid-cols-1'
                                            )}
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <p className="text-[11px] font-medium whitespace-nowrap text-mute">Masuk</p>
                                                <p className="font-semibold tabular-nums text-ink">
                                                    {formatDateShortIndo(b.booking_date)}
                                                </p>
                                                <p className="break-words text-[11px] text-mute">
                                                    {b.schedule_label ?? formatBookingScheduleShort(b)}
                                                </p>
                                            </div>
                                            {b.estimated_ready_date && (
                                                <div className="min-w-0 space-y-0.5 border-t border-divider pt-2 min-[360px]:border-t-0 min-[360px]:border-l min-[360px]:pt-0 min-[360px]:pl-3">
                                                    <p className="text-[11px] font-medium whitespace-nowrap text-mute">Target Selesai</p>
                                                    <p
                                                        className={cn(
                                                            'font-semibold tabular-nums',
                                                            showSlaWarning && b.estimated_ready_date < todayStr
                                                                ? 'text-destructive'
                                                                : showSlaWarning && b.estimated_ready_date === todayStr
                                                                  ? 'text-warning'
                                                                  : 'text-ink'
                                                        )}
                                                    >
                                                        {formatDateShortIndo(b.estimated_ready_date)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-bone/70 px-3 py-2 text-xs">
                                            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-ink">
                                                <Calendar className="size-3.5 shrink-0 text-mute" aria-hidden="true" />
                                                {formatDateShortIndo(b.booking_date)}
                                            </span>
                                            <span className="text-ash" aria-hidden="true">·</span>
                                            <span className="font-mono font-medium tabular-nums text-body">
                                                {b.schedule_label ?? formatBookingScheduleShort(b)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {showWorkBadge ? (
                                            <Badge variant={b.work_status === 'picked_up' ? 'success' : b.work_status === 'awaiting_dropoff' ? 'warning' : 'outline'}>
                                                {WORK_STATUS_LABELS[b.work_status!] ?? b.work_status}
                                            </Badge>
                                        ) : (
                                            reservationBadge(b.reservation_status)
                                        )}
                                        {showSlaWarning && b.estimated_ready_date! < todayStr && (
                                            <Badge variant="danger">Lewat Tenggat</Badge>
                                        )}
                                        {showSlaWarning && b.estimated_ready_date! === todayStr && (
                                            <Badge variant="warning">Tenggat Hari Ini</Badge>
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

                                    {b.booking_mode === 'dropoff' && b.fulfillment_type === 'pickup' && b.pickup_address && (
                                        <p className="break-words rounded-xl bg-bone px-3 py-2 text-xs text-body">
                                            Alamat Jemput ({FULFILLMENT_TYPE_LABELS[b.fulfillment_type] ?? 'Jemput'}): {b.pickup_address}
                                        </p>
                                    )}

                                    {b.customer_notes && (
                                        <p className="break-words rounded-xl bg-bone px-3 py-2 text-xs text-body">
                                            Catatan: {b.customer_notes}
                                        </p>
                                    )}

                                    {b.reservation_status === 'cancelled' && b.cancellation_reason && (
                                        <p className="break-words rounded-xl bg-destructive-soft px-3 py-2 text-xs text-destructive">
                                            Alasan pembatalan: {b.cancellation_reason}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ash">
                                        <span className="font-medium text-mute">{b.booking_code}</span>
                                        <span className="tabular-nums">+{b.customer_phone}</span>
                                        {b.invoice_number && (
                                            <span className="break-all">{b.invoice_number}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex shrink-0 flex-col gap-3 border-t border-divider pt-3 lg:items-end lg:border-t-0 lg:pt-0">
                                    <div className="hidden text-right lg:block">
                                        <p className="text-base font-semibold tabular-nums text-ink">
                                            {formatRupiah(b.total_price)}
                                        </p>
                                        {b.dp_amount > 0 && (
                                            <p className="text-xs tabular-nums text-mute">DP: {formatRupiah(b.dp_amount)}</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                        {b.payment_status === 'waiting_verification' && canVerifyPayments ? (
                                            <Button type="button" size="sm" className="flex-1 lg:flex-initial" onClick={() => verifyDp(b.id)}>
                                                <Check className="size-3.5" aria-hidden="true" />
                                                Verifikasi DP
                                            </Button>
                                        ) : b.booking_mode === 'dropoff' && (b.reservation_status === 'pending' || b.reservation_status === 'confirmed') ? (
                                            b.work_status === 'awaiting_dropoff' || !b.work_status ? (
                                                <Button type="button" size="sm" className="flex-1 lg:flex-initial" onClick={() => updateWorkStatus(b.id, 'in_progress')}>
                                                    <Check className="size-3.5" aria-hidden="true" />
                                                    Terima &amp; Proses
                                                </Button>
                                            ) : b.work_status === 'in_progress' ? (
                                                <Button type="button" size="sm" className="flex-1 lg:flex-initial" onClick={() => updateWorkStatus(b.id, 'ready_for_pickup')}>
                                                    <Check className="size-3.5" aria-hidden="true" />
                                                    Siap Diambil
                                                </Button>
                                            ) : (
                                                <Button type="button" variant="outline" size="sm" className="flex-1 lg:flex-initial" onClick={() => updateWorkStatus(b.id, 'picked_up')}>
                                                    <Check className="size-3.5" aria-hidden="true" />
                                                    Tandai Selesai
                                                </Button>
                                            )
                                        ) : b.reservation_status === 'pending' ? (
                                            <Button type="button" size="sm" className="flex-1 lg:flex-initial" onClick={() => updateStatus(b.id, 'confirmed')}>
                                                <Check className="size-3.5" aria-hidden="true" />
                                                Konfirmasi
                                            </Button>
                                        ) : b.reservation_status === 'confirmed' ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 lg:flex-initial"
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
                                                className="flex-1 lg:flex-initial"
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

                                        <div className="flex shrink-0 items-center gap-2">
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
                                                    className="w-56 max-w-[calc(100vw-2rem)] rounded-md border-hairline-soft p-2 shadow-none"
                                                >
                                                    {visibleWaTemplates.map((item) => (
                                                        <DropdownMenuItem
                                                            key={item.key}
                                                            asChild
                                                            className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
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
                                                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-xs text-mute"
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
                                                            variant="secondary"
                                                            size="icon"
                                                            aria-label={`Aksi lainnya untuk ${b.booking_mode === 'dropoff' ? 'pesanan' : 'reservasi'} ${b.booking_code}`}
                                                        >
                                                            <MoreHorizontal className="size-4" aria-hidden="true" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-52 max-w-[calc(100vw-2rem)] rounded-md border-hairline-soft p-2 shadow-none"
                                                    >
                                                        {canSettle && !showSettleAsPrimary && (
                                                            <DropdownMenuItem
                                                                onClick={() => settlePayment(b.id)}
                                                                className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                                                            >
                                                                <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                                                                Tandai Lunas
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canReschedule && (
                                                            <DropdownMenuItem
                                                                asChild
                                                                className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
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
                                                                className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
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
                                                                    className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-destructive focus:bg-destructive-soft focus:text-destructive"
                                                                >
                                                                    <Link href={route('dashboard.bookings.cancel.edit', b.id)}>
                                                                        <X className="mr-2 size-4" aria-hidden="true" />
                                                                        Batalkan {b.booking_mode === 'dropoff' ? 'Pesanan' : 'Reservasi'}
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
                            </div>
                        );
                    })}
                    <PaginationBar pagination={pagination} />
                </div>
            )}

            {/* Proof Preview Modal */}
            <Dialog open={previewUrl !== null} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 sm:p-6 shadow-none sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-ink">Bukti Pembayaran DP</DialogTitle>
                    </DialogHeader>
                    {previewUrl && (
                        <img
                            src={previewUrl}
                            alt="Bukti pembayaran DP pelanggan"
                            className="max-h-[70dvh] w-full rounded-sm bg-bone object-contain outline-1 -outline-offset-1 outline-black/10"
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Calendar Booking Quick Detail Dialog */}
            <Dialog
                open={selectedCalendarBooking !== null}
                onOpenChange={(open) => !open && setSelectedCalendarBooking(null)}
            >
                <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 sm:p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-ink">
                            Detail {itemSingular} {selectedCalendarBooking?.booking_code}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedCalendarBooking && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {reservationBadge(selectedCalendarBooking.reservation_status)}
                                {paymentBadge(selectedCalendarBooking.payment_status)}
                            </div>
                            <div className="space-y-1.5 rounded-xl bg-bone/70 p-3.5 text-sm">
                                <p className="break-words font-semibold text-ink">
                                    <Link
                                        href={route('dashboard.customers.show', selectedCalendarBooking.customer_id)}
                                        className="hover:underline"
                                    >
                                        {selectedCalendarBooking.customer_name}
                                    </Link>
                                </p>
                                <p className="font-mono text-xs tabular-nums text-mute">
                                    +{selectedCalendarBooking.customer_phone}
                                </p>
                                <p className="text-xs text-body">
                                    {selectedCalendarBooking.service_name}
                                    {supportsStaffFilter && selectedCalendarBooking.staff_name
                                        ? ` · ${selectedCalendarBooking.staff_name}`
                                        : ''}
                                </p>
                                <p className="text-xs tabular-nums text-mute">
                                    {formatDateIndo(selectedCalendarBooking.booking_date)} ·{' '}
                                    {formatBookingScheduleShort(selectedCalendarBooking)}
                                </p>
                                <p className="pt-0.5 text-base font-semibold tabular-nums text-ink">
                                    {formatRupiah(selectedCalendarBooking.total_price)}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
                                <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
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
                                    <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
                                        <Link href={route('dashboard.bookings.reschedule.edit', selectedCalendarBooking.id)}>
                                            <CalendarClock className="size-3.5" aria-hidden="true" />
                                            Ubah Jadwal
                                        </Link>
                                    </Button>
                                )}

                                {canVerifyPayments && selectedCalendarBooking.payment_status === 'waiting_verification' && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            verifyDp(selectedCalendarBooking.id);
                                            setSelectedCalendarBooking(null);
                                        }}
                                    >
                                        <Check className="size-3.5" aria-hidden="true" />
                                        Verifikasi DP
                                    </Button>
                                )}

                                {canVerifyPayments &&
                                    selectedCalendarBooking.payment_status !== 'settled' &&
                                    selectedCalendarBooking.payment_status !== 'waiting_verification' &&
                                    selectedCalendarBooking.reservation_status !== 'cancelled' &&
                                    selectedCalendarBooking.reservation_status !== 'no_show' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 sm:flex-initial"
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
                                            className="flex-1 sm:flex-initial"
                                            onClick={() => {
                                                updateStatus(selectedCalendarBooking.id, 'completed');
                                                setSelectedCalendarBooking(null);
                                            }}
                                        >
                                            Tandai Selesai
                                        </Button>
                                        {supportsNoShow && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="w-full sm:w-auto"
                                                onClick={() => {
                                                    setNoShowBooking(selectedCalendarBooking);
                                                    setSelectedCalendarBooking(null);
                                                }}
                                            >
                                                Tandai Tidak Hadir
                                            </Button>
                                        )}
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
                description={`${itemSingular} atas nama ${noShowBooking?.customer_name ?? ''} akan ditandai sebagai Tidak Hadir (No-Show) dan tercatat di riwayat pelanggan.`}
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
