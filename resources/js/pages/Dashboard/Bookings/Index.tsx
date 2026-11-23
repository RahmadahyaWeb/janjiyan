import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowUpDown,
    Calendar,
    CalendarClock,
    Check,
    CheckCircle2,
    Download,
    Eye,
    FileText,
    List,
    MapPin,
    MessageCircle,
    MoreHorizontal,
    Plus,
    Printer,
    SlidersHorizontal,
    UserX,
    Wallet,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BookingCalendarView, type CalendarPayload } from '@/components/BookingCalendarView';
import { BookingCancelDialog } from '@/components/BookingCancelDialog';
import { BookingDetailDrawer } from '@/components/BookingDetailDrawer';
import { BookingRescheduleDialog } from '@/components/BookingRescheduleDialog';
import { CashierSettlementDialog } from '@/components/CashierSettlementDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DailyCashierSummaryCard } from '@/components/DailyCashierSummaryCard';
import { DpProofVerifyDialog } from '@/components/DpProofVerifyDialog';
import { PaginationBar, type PaginationMeta } from '@/components/PaginationBar';
import { ReceiptPrintDialog } from '@/components/ReceiptPrintSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/search-input';
import { SelectField } from '@/components/ui/select';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import {
    buildWhatsAppUrl,
    formatBookingScheduleShort,
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
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
import type {
    DailyCashierSummary,
    PageProps,
    ServiceAddon,
} from '@/types';
import type { BookingRow } from '@/types/booking';

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

function shiftYmd(dateStr: string, deltaDays: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
}

interface BookingsIndexProps {
    bookings: BookingRow[];
    pagination?: PaginationMeta | null;
    services: ServiceOption[];
    addons?: ServiceAddon[];
    staffOptions?: StaffFilterOption[];
    filters: {
        status: string;
        payment: string;
        staff_id?: string;
        service_id?: string;
        search: string;
        date_from: string;
        date_to: string;
        sla?: string;
        sort?: string;
        mode: BookingMode;
        view: 'list' | 'calendar';
        calendar_date: string;
    };
    openCashierId?: number | null;
    openReceiptId?: number | null;
    dropoffStageCounts?: Record<string, number> | null;
    dropoffSlaCounts?: { overdue: number; due_today: number } | null;
    todayDate?: string;
    calendar: CalendarPayload;
    businessName: string;
    businessAddress?: string;
    businessPhone?: string | null;
    businessEmail?: string | null;
    cashierUserName?: string | null;
    whatsappTemplates?: WhatsappTemplatesMap;
    canExportCsv: boolean;
    canVerifyPayments?: boolean;
    canUseGoogleReview?: boolean;
    dailyCashierSummary?: DailyCashierSummary | null;
}

export default function BookingsIndex({
    bookings,
    pagination,
    services,
    addons = [],
    staffOptions = [],
    filters,
    openCashierId = null,
    openReceiptId = null,
    dropoffStageCounts,
    dropoffSlaCounts,
    todayDate,
    calendar,
    businessName,
    businessAddress = '',
    businessPhone = null,
    businessEmail = null,
    cashierUserName = null,
    whatsappTemplates,
    canExportCsv,
    canVerifyPayments: propCanVerifyPayments,
    dailyCashierSummary = null,
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
    const tomorrowStr = shiftYmd(todayStr, 1);
    const weekEndStr = shiftYmd(todayStr, 6);
    const visibleWaTemplates = getWhatsappTemplateMetaForBusiness(activeBusiness?.business_type);

    const canVerifyPayments = propCanVerifyPayments ?? activeBusiness?.can?.verify_payments ?? true;
    const canManageBookings = activeBusiness?.can?.manage_bookings ?? true;
    const canAccessPos = canVerifyPayments || canManageBookings;
    const canOpenBilling = activeBusiness?.can?.manage_settings ?? true;

    const [search, setSearch] = useState(filters.search);
    const isInitialSearchMount = useRef(true);
    const [detailBookingId, setDetailBookingId] = useState<number | null>(null);
    const [proofVerifyBookingId, setProofVerifyBookingId] = useState<number | null>(null);
    const [rescheduleBooking, setRescheduleBooking] = useState<BookingRow | null>(null);
    const [cancelBooking, setCancelBooking] = useState<BookingRow | null>(null);
    const [noShowBooking, setNoShowBooking] = useState<Pick<BookingRow, 'id' | 'booking_code' | 'customer_name'> | null>(null);
    const [cashierState, setCashierState] = useState<{ id: number; markCompleted: boolean } | null>(() =>
        openCashierId ? { id: openCashierId, markCompleted: false } : null
    );
    const [receiptBookingId, setReceiptBookingId] = useState<number | null>(openReceiptId);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);
    const desktopFilterRef = useRef<HTMLDivElement>(null);

    const findBookingById = (id: number | null): BookingRow | null => {
        if (id === null) return null;
        return (
            bookings.find((b) => b.id === id) ??
            calendar.bookings.find((b) => b.id === id) ??
            null
        );
    };

    const detailBooking = findBookingById(detailBookingId);
    const proofVerifyBooking = findBookingById(proofVerifyBookingId);
    const cashierBooking = findBookingById(cashierState?.id ?? null);
    const receiptBooking = findBookingById(receiptBookingId);

    useEffect(() => {
        setSearch(filters.search);
    }, [filters.search]);

    useEffect(() => {
        if (openCashierId) {
            setCashierState({ id: openCashierId, markCompleted: false });
        }
    }, [openCashierId]);

    useEffect(() => {
        if (openReceiptId) {
            setReceiptBookingId(openReceiptId);
        }
    }, [openReceiptId]);

    // Debounced live search when typing in search box
    useEffect(() => {
        if (isInitialSearchMount.current) {
            isInitialSearchMount.current = false;
            return;
        }
        if (search === filters.search) return;

        const timer = window.setTimeout(() => {
            router.get(
                route('dashboard.bookings'),
                { ...filters, search },
                { preserveState: true, preserveScroll: true, replace: true }
            );
        }, 350);

        return () => window.clearTimeout(timer);
    }, [search]);

    const getPaymentTotals = (b: BookingRow) => {
        const paid = b.paid_amount ?? (b.payment_status === 'settled' ? b.total_price : 0);
        const remaining = b.remaining_balance ?? Math.max(0, b.total_price - paid);
        return { paid, remaining };
    };

    const getServiceSummaryDisplay = (b: BookingRow) => b.service_summary || b.service_name;

    const hasMultiServiceItems = (b: BookingRow) =>
        (b.items?.filter((item) => item.item_type === 'service').length ?? 0) > 1;

    useEffect(() => {
        if (!mobileFilterOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileFilterOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [mobileFilterOpen]);

    useEffect(() => {
        if (!desktopFilterOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDesktopFilterOpen(false);
        const onPointerDown = (e: MouseEvent) => {
            const target = e.target as Element | null;
            if (target?.closest('[data-slot="popover-content"], [data-slot="dialog-content"], [data-slot="select-content"]')) {
                return;
            }
            if (desktopFilterRef.current && !desktopFilterRef.current.contains(e.target as Node)) {
                setDesktopFilterOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onPointerDown);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, [desktopFilterOpen]);

    const statusTabs = STATUS_TABS[isDropoffMode ? 'dropoff' : 'time_slot'];

    const currentStatus = filters.status || 'active';
    const advancedFilterCount = [
        filters.payment,
        filters.service_id,
        supportsStaffFilter ? filters.staff_id : '',
        filters.date_from || filters.date_to ? 'date' : '',
    ].filter(Boolean).length;
    const desktopAdvancedFilterCount = [
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
            filters.date_to ||
            filters.sla
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
        if (filters.sla) params.set('sla', filters.sla);
        return `${route('dashboard.bookings.export')}?${params.toString()}`;
    })();

    const buildQuickWaUrl = (
        b: Pick<
            BookingRow,
            | 'customer_name'
            | 'customer_phone'
            | 'booking_code'
            | 'service_name'
            | 'service_summary'
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
        const svcDisplay = b.service_summary || b.service_name;
        let msg = `Halo ${b.customer_name}, kami dari ${businessName}.`;
        if (b.payment_status === 'unpaid' && b.reservation_status === 'pending') {
            msg += ` Mengingatkan untuk menyelesaikan pembayaran uang muka ${nounLower} ${b.booking_code} (${svcDisplay}, ${dateLabel} · ${timeOrMode}).`;
        } else if (isDropoff && b.work_status === 'ready_for_pickup') {
            msg += ` Pesanan ${b.booking_code} (${svcDisplay}, ${b.quantity ?? 1} ${unitLabel}) sudah selesai dan siap diambil/diantar.`;
        } else if (b.reservation_status === 'confirmed') {
            msg += isDropoff
                ? ` Pesanan drop-off ${b.booking_code} (${svcDisplay}, ${b.quantity ?? 1} ${unitLabel}) pada ${dateLabel} telah dikonfirmasi.`
                : ` ${itemSingular} ${b.booking_code} untuk ${svcDisplay} pada ${dateLabel} pukul ${b.start_time_local} telah dikonfirmasi. Kami tunggu kedatangannya.`;
        } else {
            msg += ` Terkait ${nounLower} ${b.booking_code} (${svcDisplay}, ${dateLabel} · ${timeOrMode}).`;
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
            | 'review_url'
            | 'service_summary'
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
            service_name: b.service_summary || b.service_name,
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
            review_url: b.review_url ?? '',
            business_address: businessAddress,
        });
    };

    const updateStatus = (id: number, reservation_status: string, bookingForToast?: BookingRow) => {
        router.patch(
            route('dashboard.bookings.status', id),
            { reservation_status },
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (reservation_status === 'confirmed' && bookingForToast) {
                        const waUrl = buildTemplateWaUrl(bookingForToast, 'confirmed');
                        toast.success(`${itemSingular} ${bookingForToast.booking_code} dikonfirmasi.`, {
                            action: {
                                label: 'Kirim WA',
                                onClick: () => window.open(waUrl, '_blank', 'noopener,noreferrer'),
                            },
                        });
                    }
                },
            }
        );
    };

    const updateWorkStatus = (
        b: BookingRow,
        work_status: 'awaiting_dropoff' | 'in_progress' | 'ready_for_pickup' | 'picked_up'
    ) => {
        router.patch(
            route('dashboard.bookings.status', b.id),
            { work_status },
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (work_status === 'ready_for_pickup') {
                        const waUrl = buildTemplateWaUrl(b, 'ready_for_pickup');
                        toast.success(`Pesanan ${b.booking_code} siap diambil.`, {
                            action: {
                                label: 'Kirim WA',
                                onClick: () => window.open(waUrl, '_blank', 'noopener,noreferrer'),
                            },
                        });
                    }
                },
            }
        );
    };

    const reservationBadge = (status: string) => {
        const label = RESERVATION_STATUS_LABELS[status] ?? status;
        if (status === 'confirmed' || status === 'completed') return <Badge variant="success">{label}</Badge>;
        if (status === 'cancelled' || status === 'no_show') return <Badge variant="danger">{label}</Badge>;
        return <Badge variant="warning">{label}</Badge>;
    };

    const paymentBadge = (status: string) => {
        const compactLabels: Record<string, string> = {
            unpaid: 'Belum Bayar',
            waiting_verification: 'Cek Bukti DP',
            dp_verified: 'DP Terverifikasi',
            settled: 'Lunas',
        };
        const label = compactLabels[status] ?? PAYMENT_STATUS_LABELS[status] ?? status;
        if (status === 'dp_verified' || status === 'settled') {
            return <Badge variant="success">{label}</Badge>;
        }
        if (status === 'waiting_verification') {
            return <Badge variant="warning">{label}</Badge>;
        }
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

    const getBookingMeta = (b: BookingRow) => {
        const isDropoff = b.booking_mode === 'dropoff';
        const isDropoffActive =
            isDropoff && (b.reservation_status === 'pending' || b.reservation_status === 'confirmed');
        const showSlaWarning =
            isDropoffActive &&
            !!b.estimated_ready_date &&
            b.work_status !== 'picked_up' &&
            b.work_status !== 'ready_for_pickup';
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

        return {
            isDropoff,
            showSlaWarning,
            canReschedule,
            canNoShow,
            showWorkBadge,
            canCancel,
        };
    };

    const renderBookingActions = (b: BookingRow, layout: 'mobile' | 'desktop') => {
        const { isDropoff, canReschedule, canNoShow, canCancel } = getBookingMeta(b);
        const { remaining } = getPaymentTotals(b);
        const isDesktop = layout === 'desktop';
        const primaryBtnClass = isDesktop ? 'h-8 px-2.5 text-xs' : 'min-w-0 flex-1 px-3 text-xs';
        const iconSize = isDesktop ? 'icon-sm' : 'icon';

        const isCheckoutStage =
            remaining > 0 &&
            canAccessPos &&
            ((isDropoff && b.work_status === 'ready_for_pickup' && (b.reservation_status === 'pending' || b.reservation_status === 'confirmed')) ||
                (!isDropoff && b.reservation_status === 'confirmed'));

        return (
            <>
                {b.payment_status === 'waiting_verification' && canVerifyPayments ? (
                    <Button
                        type="button"
                        size="sm"
                        className={primaryBtnClass}
                        onClick={() => setProofVerifyBookingId(b.id)}
                    >
                        <Check className="size-3.5" aria-hidden="true" />
                        Verifikasi DP
                    </Button>
                ) : isDropoff && (b.reservation_status === 'pending' || b.reservation_status === 'confirmed') ? (
                    b.work_status === 'awaiting_dropoff' || !b.work_status ? (
                        <Button
                            type="button"
                            size="sm"
                            className={primaryBtnClass}
                            onClick={() => updateWorkStatus(b, 'in_progress')}
                        >
                            <Check className="size-3.5" aria-hidden="true" />
                            Terima &amp; Proses
                        </Button>
                    ) : b.work_status === 'in_progress' ? (
                        <Button
                            type="button"
                            size="sm"
                            className={primaryBtnClass}
                            onClick={() => updateWorkStatus(b, 'ready_for_pickup')}
                        >
                            <Check className="size-3.5" aria-hidden="true" />
                            Siap Diambil
                        </Button>
                    ) : isCheckoutStage ? (
                        <Button
                            type="button"
                            size="sm"
                            className={primaryBtnClass}
                            onClick={() => setCashierState({ id: b.id, markCompleted: true })}
                        >
                            <Wallet className="size-3.5" aria-hidden="true" />
                            Selesaikan &amp; Bayar
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={primaryBtnClass}
                            onClick={() => updateWorkStatus(b, 'picked_up')}
                        >
                            <Check className="size-3.5" aria-hidden="true" />
                            Tandai Selesai
                        </Button>
                    )
                ) : b.reservation_status === 'pending' ? (
                    <Button
                        type="button"
                        size="sm"
                        className={primaryBtnClass}
                        onClick={() => updateStatus(b.id, 'confirmed', b)}
                    >
                        <Check className="size-3.5" aria-hidden="true" />
                        Konfirmasi
                    </Button>
                ) : b.reservation_status === 'confirmed' ? (
                    isCheckoutStage ? (
                        <Button
                            type="button"
                            size="sm"
                            className={primaryBtnClass}
                            onClick={() => setCashierState({ id: b.id, markCompleted: true })}
                        >
                            <Wallet className="size-3.5" aria-hidden="true" />
                            Selesaikan &amp; Bayar
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={primaryBtnClass}
                            onClick={() => updateStatus(b.id, 'completed')}
                        >
                            <Check className="size-3.5" aria-hidden="true" />
                            Tandai Selesai
                        </Button>
                    )
                ) : null}

                <div className="flex shrink-0 items-center gap-1.5">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size={iconSize}
                                aria-label={`Kirim WhatsApp ke ${b.customer_name}`}
                                title="Kirim WhatsApp"
                            >
                                <MessageCircle className="size-4" aria-hidden="true" />
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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="secondary"
                                size={iconSize}
                                aria-label={`Aksi lainnya untuk ${isDropoff ? 'pesanan' : 'reservasi'} ${b.booking_code}`}
                            >
                                <MoreHorizontal className="size-4" aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-56 max-w-[calc(100vw-2rem)] rounded-md border-hairline-soft p-2 shadow-none"
                        >
                            <DropdownMenuItem
                                onClick={() => setDetailBookingId(b.id)}
                                className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                            >
                                <Eye className="mr-2 size-4" aria-hidden="true" />
                                Lihat Detail Lengkap
                            </DropdownMenuItem>
                            {canAccessPos && (
                                <>
                                    <DropdownMenuItem
                                        onClick={() => setCashierState({ id: b.id, markCompleted: false })}
                                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                                    >
                                        <Wallet className="mr-2 size-4" aria-hidden="true" />
                                        Kasir / Bayar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setReceiptBookingId(b.id)}
                                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                                    >
                                        <Printer className="mr-2 size-4" aria-hidden="true" />
                                        Struk / Cetak
                                    </DropdownMenuItem>
                                </>
                            )}
                            {b.dp_proof_url && (
                                <DropdownMenuItem
                                    onClick={() => setProofVerifyBookingId(b.id)}
                                    className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                                >
                                    <Eye className="mr-2 size-4" aria-hidden="true" />
                                    Bukti Uang Muka
                                </DropdownMenuItem>
                            )}
                            {isCheckoutStage && (
                                <DropdownMenuItem
                                    onClick={() =>
                                        isDropoff
                                            ? updateWorkStatus(b, 'picked_up')
                                            : updateStatus(b.id, 'completed')
                                    }
                                    className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                                >
                                    <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                                    Tandai Selesai (Tanpa Lunasi)
                                </DropdownMenuItem>
                            )}
                            {canReschedule && (
                                <DropdownMenuItem
                                    onClick={() => setRescheduleBooking(b)}
                                    className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                                >
                                    <CalendarClock className="mr-2 size-4" aria-hidden="true" />
                                    Ubah Jadwal
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
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => setCancelBooking(b)}
                                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-destructive focus:bg-destructive-soft focus:text-destructive"
                                    >
                                        <X className="mr-2 size-4" aria-hidden="true" />
                                        Batalkan {isDropoff ? 'Pesanan' : 'Reservasi'}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </>
        );
    };

    const isTodayPreset = filters.date_from === todayStr && filters.date_to === todayStr && !filters.sla;
    const isTomorrowPreset = filters.date_from === tomorrowStr && filters.date_to === tomorrowStr && !filters.sla;
    const isNext7DaysPreset = filters.date_from === todayStr && filters.date_to === weekEndStr && !filters.sla;
    const isUpcomingSort = filters.sort === 'upcoming';

    return (
        <DashboardLayout
            title={nounTitle}
            actions={
                <>
                    {exportButton}
                    {createButton}
                </>
            }
        >
            <Head title={nounTitle} />

            {dailyCashierSummary && (
                <DailyCashierSummaryCard
                    initialSummary={dailyCashierSummary}
                    canOpenBilling={canOpenBilling}
                />
            )}

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

                        {filters.view === 'calendar' ? (
                            <div className="flex flex-wrap items-center gap-2">
                                {supportsStaffFilter && staffOptions.length > 0 && (
                                    <SelectField
                                        aria-label="Filter staff di kalender"
                                        value={String(filters.staff_id ?? '')}
                                        onValueChange={(val) => applyFilters({ staff_id: val })}
                                        className="h-9 w-auto bg-canvas py-0 text-xs"
                                        options={[
                                            { value: '', label: 'Semua Staff' },
                                            ...staffOptions.map((st) => ({
                                                value: String(st.id),
                                                label: st.name,
                                            })),
                                        ]}
                                    />
                                )}
                                <SelectField
                                    aria-label="Filter layanan di kalender"
                                    value={String(filters.service_id ?? '')}
                                    onValueChange={(val) => applyFilters({ service_id: val })}
                                    className="h-9 w-auto bg-canvas py-0 text-xs"
                                    options={[
                                        { value: '', label: `Semua ${config.services.pageTitle}` },
                                        ...services.map((svc) => ({
                                            value: String(svc.id),
                                            label: svc.name,
                                        })),
                                    ]}
                                />
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => applyFilters({ sort: isUpcomingSort ? 'newest' : 'upcoming' })}
                                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-hairline-soft bg-canvas px-3 py-1 text-xs font-semibold text-mute transition-colors hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <ArrowUpDown className="size-3.5" aria-hidden="true" />
                                <span>{isUpcomingSort ? 'Terdekat dulu' : 'Terbaru'}</span>
                            </button>
                        )}
                    </div>
                )}

                {(supportsCalendar ? filters.view === 'list' : true) && (
                    <>
                        {/* Quick Status Tabs (Wrap cleanly on mobile so nothing clips or hides) */}
                        <div
                            role="group"
                            aria-label={`Filter cepat status ${nounLower}`}
                            className="flex flex-wrap gap-1.5 sm:gap-2"
                        >
                            {statusTabs.map((tab) => {
                                const active = currentStatus === tab.value && !filters.sla;
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
                                        onClick={() => applyFilters({ status: tab.value, sla: '' })}
                                        className={cn(
                                            'inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-3.5',
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
                        </div>

                        {/* Quick Date / SLA Presets */}
                        {(isDropoffMode || !supportsCalendar) && (
                            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter cepat tanggal atau tenggat">
                                {isDropoffMode ? (
                                    <>
                                        <button
                                            type="button"
                                            aria-pressed={filters.sla === 'overdue'}
                                            onClick={() =>
                                                applyFilters({
                                                    status: 'active',
                                                    sla: filters.sla === 'overdue' ? '' : 'overdue',
                                                    date_from: '',
                                                    date_to: '',
                                                })
                                            }
                                            className={cn(
                                                'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                filters.sla === 'overdue'
                                                    ? 'border-destructive bg-destructive text-canvas'
                                                    : (dropoffSlaCounts?.overdue ?? 0) > 0
                                                      ? 'border-destructive/40 bg-destructive-soft text-destructive hover:bg-destructive-soft/80'
                                                      : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                            )}
                                        >
                                            <span>Lewat Tenggat</span>
                                            {(dropoffSlaCounts?.overdue ?? 0) > 0 && (
                                                <span className="tabular-nums">({dropoffSlaCounts?.overdue})</span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={filters.sla === 'due_today'}
                                            onClick={() =>
                                                applyFilters({
                                                    status: 'active',
                                                    sla: filters.sla === 'due_today' ? '' : 'due_today',
                                                    date_from: '',
                                                    date_to: '',
                                                })
                                            }
                                            className={cn(
                                                'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                filters.sla === 'due_today'
                                                    ? 'border-ink bg-ink text-canvas'
                                                    : (dropoffSlaCounts?.due_today ?? 0) > 0
                                                      ? 'border-warning-border bg-warning-soft text-warning hover:bg-warning-soft/80'
                                                      : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                            )}
                                        >
                                            <span>Tenggat Hari Ini</span>
                                            {(dropoffSlaCounts?.due_today ?? 0) > 0 && (
                                                <span className="tabular-nums">({dropoffSlaCounts?.due_today})</span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={isTodayPreset}
                                            onClick={() =>
                                                applyFilters(
                                                    isTodayPreset
                                                        ? { date_from: '', date_to: '' }
                                                        : { sla: '', date_from: todayStr, date_to: todayStr }
                                                )
                                            }
                                            className={cn(
                                                'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                isTodayPreset
                                                    ? 'border-ink bg-ink text-canvas'
                                                    : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                            )}
                                        >
                                            Masuk Hari Ini
                                        </button>
                                    </>
                                ) : null}
                            </div>
                        )}

                        {/* Mobile Search + Filter Sheet Trigger */}
                        <div className="flex items-center gap-2 md:hidden">
                            <div className="min-w-0 flex-1">
                                <label htmlFor="bookings-search-mobile" className="sr-only">
                                    Cari {nounLower} berdasarkan kode, nama, atau WhatsApp
                                </label>
                                <SearchInput
                                    id="bookings-search-mobile"
                                    className="h-11 bg-field pr-9"
                                    placeholder="Cari nama, kode, WA…"
                                    value={search}
                                    onValueChange={setSearch}
                                    onClear={() => applyFilters({ search: '' })}
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters({ search })}
                                />
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
                                {!isDropoffMode && (
                                    <div className="space-y-1.5">
                                        <span className="text-xs font-semibold text-mute">Filter Tanggal Cepat</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                aria-pressed={isTodayPreset}
                                                onClick={() =>
                                                    applyFilters(
                                                        isTodayPreset
                                                            ? { date_from: '', date_to: '', sort: '' }
                                                            : { date_from: todayStr, date_to: todayStr, sort: 'upcoming' }
                                                    )
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                                    isTodayPreset ? 'border-ink bg-ink text-canvas' : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                                )}
                                            >
                                                Hari Ini
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={isTomorrowPreset}
                                                onClick={() =>
                                                    applyFilters(
                                                        isTomorrowPreset
                                                            ? { date_from: '', date_to: '', sort: '' }
                                                            : { date_from: tomorrowStr, date_to: tomorrowStr, sort: 'upcoming' }
                                                    )
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                                    isTomorrowPreset ? 'border-ink bg-ink text-canvas' : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                                )}
                                            >
                                                Besok
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={isNext7DaysPreset}
                                                onClick={() =>
                                                    applyFilters(
                                                        isNext7DaysPreset
                                                            ? { date_from: '', date_to: '', sort: '' }
                                                            : { date_from: todayStr, date_to: weekEndStr, sort: 'upcoming' }
                                                    )
                                                }
                                                className={cn(
                                                    'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                                    isNext7DaysPreset ? 'border-ink bg-ink text-canvas' : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                                )}
                                            >
                                                7 Hari
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="mobile-filter-payment">Status Pembayaran</Label>
                                    <SelectField
                                        id="mobile-filter-payment"
                                        value={filters.payment}
                                        onValueChange={(val) => applyFilters({ payment: val })}
                                        options={[
                                            { value: '', label: 'Semua Pembayaran' },
                                            { value: 'unpaid', label: 'Belum Bayar' },
                                            { value: 'waiting_verification', label: 'Cek Bukti DP' },
                                            { value: 'dp_verified', label: 'DP Terverifikasi' },
                                            { value: 'settled', label: 'Lunas' },
                                        ]}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="mobile-filter-service">{config.services.pageTitle}</Label>
                                    <SelectField
                                        id="mobile-filter-service"
                                        value={String(filters.service_id ?? '')}
                                        onValueChange={(val) => applyFilters({ service_id: val })}
                                        options={[
                                            { value: '', label: `Semua ${config.services.pageTitle}` },
                                            ...services.map((svc) => ({
                                                value: String(svc.id),
                                                label: svc.name,
                                            })),
                                        ]}
                                    />
                                </div>

                                {supportsStaffFilter && staffOptions.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mobile-filter-staff">Staff</Label>
                                        <SelectField
                                            id="mobile-filter-staff"
                                            value={String(filters.staff_id ?? '')}
                                            onValueChange={(val) => applyFilters({ staff_id: val })}
                                            options={[
                                                { value: '', label: 'Semua Staff' },
                                                ...staffOptions.map((st) => ({
                                                    value: String(st.id),
                                                    label: st.name,
                                                })),
                                            ]}
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="min-w-0 space-y-1.5">
                                        <Label htmlFor="mobile-filter-date-from">Dari Tanggal</Label>
                                        <DatePicker
                                            id="mobile-filter-date-from"
                                            clearable
                                            dialogTitle="Dari Tanggal"
                                            value={filters.date_from}
                                            onChange={(val) => applyFilters({ date_from: val, sla: '' })}
                                        />
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                        <Label htmlFor="mobile-filter-date-to">Sampai Tanggal</Label>
                                        <DatePicker
                                            id="mobile-filter-date-to"
                                            clearable
                                            dialogTitle="Sampai Tanggal"
                                            value={filters.date_to}
                                            onChange={(val) => applyFilters({ date_to: val, sla: '' })}
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

                        {/* Desktop Single-Row Toolbar */}
                        <div className="hidden md:flex md:items-center md:gap-2.5">
                            <div className="min-w-[200px] flex-1 lg:max-w-sm">
                                <label htmlFor="bookings-search" className="sr-only">
                                    Cari {nounLower} berdasarkan kode, nama, atau WhatsApp
                                </label>
                                <SearchInput
                                    id="bookings-search"
                                    className="h-10 bg-canvas pr-9 text-sm"
                                    placeholder="Cari kode, nama, atau WA…"
                                    value={search}
                                    onValueChange={setSearch}
                                    onClear={() => applyFilters({ search: '' })}
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters({ search })}
                                />
                            </div>

                            <SelectField
                                aria-label="Filter status pembayaran"
                                value={filters.payment}
                                onValueChange={(val) => applyFilters({ payment: val })}
                                wrapperClassName="shrink-0"
                                className="h-10 w-auto min-w-[175px] max-w-[220px] shrink-0 bg-canvas text-sm"
                                options={[
                                    { value: '', label: 'Semua Pembayaran' },
                                    { value: 'unpaid', label: 'Belum Bayar' },
                                    { value: 'waiting_verification', label: 'Cek Bukti DP' },
                                    { value: 'dp_verified', label: 'DP Terverifikasi' },
                                    { value: 'settled', label: 'Lunas' },
                                ]}
                            />

                            <div ref={desktopFilterRef} className="relative shrink-0">
                                <Button
                                    type="button"
                                    variant={desktopAdvancedFilterCount > 0 || desktopFilterOpen ? 'default' : 'outline'}
                                    size="sm"
                                    aria-expanded={desktopFilterOpen}
                                    onClick={() => setDesktopFilterOpen((prev) => !prev)}
                                    className="h-10 rounded-sm px-3.5 text-sm"
                                >
                                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                                    <span>Filter</span>
                                    {desktopAdvancedFilterCount > 0 && (
                                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-canvas text-xs font-semibold tabular-nums text-ink">
                                            {desktopAdvancedFilterCount}
                                        </span>
                                    )}
                                </Button>

                                {desktopFilterOpen && (
                                    <div
                                        role="dialog"
                                        aria-label="Filter lanjutan"
                                        className="absolute top-full right-0 z-30 mt-2 w-80 space-y-4 overscroll-contain rounded-md border border-hairline bg-canvas p-4"
                                    >
                                        {!isDropoffMode && (
                                            <div className="space-y-1.5">
                                                <span className="text-xs font-semibold text-mute">Filter Tanggal Cepat</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <button
                                                        type="button"
                                                        aria-pressed={isTodayPreset}
                                                        onClick={() =>
                                                            applyFilters(
                                                                isTodayPreset
                                                                    ? { date_from: '', date_to: '', sort: '' }
                                                                    : { date_from: todayStr, date_to: todayStr, sort: 'upcoming' }
                                                            )
                                                        }
                                                        className={cn(
                                                            'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                                            isTodayPreset ? 'border-ink bg-ink text-canvas' : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                                        )}
                                                    >
                                                        Hari Ini
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-pressed={isTomorrowPreset}
                                                        onClick={() =>
                                                            applyFilters(
                                                                isTomorrowPreset
                                                                    ? { date_from: '', date_to: '', sort: '' }
                                                                    : { date_from: tomorrowStr, date_to: tomorrowStr, sort: 'upcoming' }
                                                            )
                                                        }
                                                        className={cn(
                                                            'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                                            isTomorrowPreset ? 'border-ink bg-ink text-canvas' : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                                        )}
                                                    >
                                                        Besok
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-pressed={isNext7DaysPreset}
                                                        onClick={() =>
                                                            applyFilters(
                                                                isNext7DaysPreset
                                                                    ? { date_from: '', date_to: '', sort: '' }
                                                                    : { date_from: todayStr, date_to: weekEndStr, sort: 'upcoming' }
                                                            )
                                                        }
                                                        className={cn(
                                                            'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                                            isNext7DaysPreset ? 'border-ink bg-ink text-canvas' : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                                        )}
                                                    >
                                                        7 Hari
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            <Label htmlFor="desktop-filter-service">{config.services.pageTitle}</Label>
                                            <SelectField
                                                id="desktop-filter-service"
                                                value={String(filters.service_id ?? '')}
                                                onValueChange={(val) => applyFilters({ service_id: val })}
                                                className="h-10 bg-canvas text-sm"
                                                options={[
                                                    { value: '', label: `Semua ${config.services.pageTitle}` },
                                                    ...services.map((svc) => ({
                                                        value: String(svc.id),
                                                        label: svc.name,
                                                    })),
                                                ]}
                                            />
                                        </div>

                                        {supportsStaffFilter && staffOptions.length > 0 && (
                                            <div className="space-y-1.5">
                                                <Label htmlFor="desktop-filter-staff">Staff</Label>
                                                <SelectField
                                                    id="desktop-filter-staff"
                                                    value={String(filters.staff_id ?? '')}
                                                    onValueChange={(val) => applyFilters({ staff_id: val })}
                                                    className="h-10 bg-canvas text-sm"
                                                    options={[
                                                        { value: '', label: 'Semua Staff' },
                                                        ...staffOptions.map((st) => ({
                                                            value: String(st.id),
                                                            label: st.name,
                                                        })),
                                                    ]}
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="min-w-0 space-y-1.5">
                                                <Label htmlFor="bookings-date-from">Dari Tanggal</Label>
                                                <DatePicker
                                                    id="bookings-date-from"
                                                    clearable
                                                    align="start"
                                                    dialogTitle="Dari Tanggal"
                                                    value={filters.date_from}
                                                    onChange={(val) => applyFilters({ date_from: val, sla: '' })}
                                                    className="h-10 bg-canvas px-2.5 py-2 text-xs"
                                                />
                                            </div>
                                            <div className="min-w-0 space-y-1.5">
                                                <Label htmlFor="bookings-date-to">Sampai Tanggal</Label>
                                                <DatePicker
                                                    id="bookings-date-to"
                                                    clearable
                                                    align="end"
                                                    dialogTitle="Sampai Tanggal"
                                                    value={filters.date_to}
                                                    onChange={(val) => applyFilters({ date_to: val, sla: '' })}
                                                    className="h-10 bg-canvas px-2.5 py-2 text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 border-t border-divider pt-3">
                                            {desktopAdvancedFilterCount > 0 ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => applyFilters({ service_id: '', staff_id: '', date_from: '', date_to: '' })}
                                                >
                                                    Reset Filter
                                                </Button>
                                            ) : (
                                                <span />
                                            )}
                                            <Button type="button" size="sm" onClick={() => setDesktopFilterOpen(false)}>
                                                Tutup
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {hasActiveFilter && (
                                <Button type="button" variant="ghost" size="sm" className="h-10 shrink-0" onClick={resetFilters}>
                                    Reset
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {supportsCalendar && filters.view === 'calendar' ? (
                <BookingCalendarView
                    calendar={calendar}
                    businessType={activeBusiness?.business_type}
                    todayDate={todayStr}
                    canCreateBooking={canManageBookings && services.length > 0}
                    onSelectDate={(date) => applyFilters({ view: 'calendar', calendar_date: date })}
                    onSelectBooking={(booking) => setDetailBookingId(booking.id)}
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
                <div className="space-y-4">
                    {/* Mobile & Tablet Cards (< lg) */}
                    <div className="grid gap-3 md:grid-cols-2 lg:hidden">
                        {bookings.map((b) => {
                            const { isDropoff, showSlaWarning, showWorkBadge } = getBookingMeta(b);
                            const { paid, remaining } = getPaymentTotals(b);
                            const isClosed =
                                b.reservation_status === 'cancelled' || b.reservation_status === 'no_show';

                            return (
                                <div
                                    key={b.id}
                                    className="flex flex-col justify-between gap-3 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-5"
                                >
                                    <div className="min-w-0 flex-1 space-y-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="line-clamp-1 break-words text-base font-semibold text-ink">
                                                    <Link
                                                        href={route('dashboard.customers.show', b.customer_id)}
                                                        className="hover:underline"
                                                    >
                                                        {b.customer_name}
                                                    </Link>
                                                </p>
                                                <p className="mt-0.5 line-clamp-1 text-xs text-mute">
                                                    <span className="font-medium text-body">
                                                        {getServiceSummaryDisplay(b)}
                                                    </span>
                                                    {isDropoff && !hasMultiServiceItems(b) ? (
                                                        <span className="tabular-nums">
                                                            {` · ${b.quantity ?? 1} ${b.unit_label ?? 'item'}`}
                                                        </span>
                                                    ) : null}
                                                    {supportsStaffFilter && b.staff_name ? ` · ${b.staff_name}` : ''}
                                                </p>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <p className="text-base font-semibold tabular-nums text-ink">
                                                    {formatRupiah(b.total_price)}
                                                </p>
                                                {remaining > 0 && !isClosed ? (
                                                    <p className="text-xs font-medium tabular-nums text-electric">
                                                        Sisa {formatRupiah(remaining)}
                                                    </p>
                                                ) : paid > 0 ? (
                                                    <p className="text-xs tabular-nums text-mute">
                                                        Dibayar {formatRupiah(paid)}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        {/* Schedule / Fulfillment Strip */}
                                        {isDropoff ? (
                                            <div
                                                className={cn(
                                                    'grid gap-1.5 rounded-xl bg-bone/70 px-2.5 py-2 text-xs min-[360px]:gap-2 min-[360px]:px-3',
                                                    b.estimated_ready_date ? 'grid-cols-2' : 'grid-cols-1'
                                                )}
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-medium text-mute">Masuk</p>
                                                    <p className="text-[11px] font-semibold whitespace-nowrap tabular-nums text-ink min-[360px]:text-xs">
                                                        {formatDateShortIndo(b.booking_date)}
                                                    </p>
                                                </div>
                                                {b.estimated_ready_date && (
                                                    <div className="min-w-0 border-l border-divider pl-2 min-[360px]:pl-3">
                                                        <p className="text-[11px] font-medium text-mute">Target Selesai</p>
                                                        <p
                                                            className={cn(
                                                                'text-[11px] font-semibold whitespace-nowrap tabular-nums min-[360px]:text-xs',
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
                                            {b.customer_tags?.includes('VIP') && <Badge variant="popular">VIP</Badge>}
                                            {supportsNoShow && (b.customer_no_show_count ?? 0) > 0 && (
                                                <Badge variant="warning" className="tabular-nums">
                                                    No-Show {b.customer_no_show_count}x
                                                </Badge>
                                            )}
                                            {b.customer_is_blocked && <Badge variant="danger">Diblokir</Badge>}
                                            {b.dp_proof_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setProofVerifyBookingId(b.id)}
                                                    className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full bg-bone px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                                >
                                                    <Eye className="size-3" aria-hidden="true" />
                                                    Bukti DP
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
                                            <button
                                                type="button"
                                                onClick={() => setDetailBookingId(b.id)}
                                                className="inline-flex min-h-8 cursor-pointer flex-wrap items-center gap-x-2 rounded-sm font-mono font-semibold text-ink hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                            >
                                                <span>{b.booking_code}</span>
                                                <span className="font-normal text-mute tabular-nums">+{b.customer_phone}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDetailBookingId(b.id)}
                                                className="inline-flex min-h-8 cursor-pointer items-center rounded-sm px-2 font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                            >
                                                Detail
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-3">
                                        {renderBookingActions(b, 'mobile')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Table (lg+) */}
                    <div className="hidden overflow-x-auto rounded-md border border-hairline-soft bg-canvas lg:block">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-divider bg-bone text-xs font-semibold whitespace-nowrap text-mute">
                                <tr>
                                    <th scope="col" className="py-3 pr-2 pl-3">Pelanggan</th>
                                    <th scope="col" className="px-2 py-3">Layanan</th>
                                    <th scope="col" className="px-2 py-3">{isDropoffMode ? 'Masuk & Target' : 'Jadwal'}</th>
                                    <th scope="col" className="px-2 py-3">Status</th>
                                    <th scope="col" className="px-2 py-3 text-right">Total</th>
                                    <th scope="col" className="py-3 pr-3 pl-2 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-divider">
                                {bookings.map((b) => {
                                    const { isDropoff, showSlaWarning, showWorkBadge } = getBookingMeta(b);
                                    const { paid, remaining } = getPaymentTotals(b);
                                    const isClosed =
                                        b.reservation_status === 'cancelled' || b.reservation_status === 'no_show';
                                    const hasSecondaryNotes = Boolean(
                                        b.customer_notes ||
                                            (b.booking_mode === 'dropoff' && b.fulfillment_type === 'pickup' && b.pickup_address) ||
                                            (b.reservation_status === 'cancelled' && b.cancellation_reason)
                                    );

                                    return (
                                        <tr key={b.id} className="align-top transition-colors hover:bg-bone/50">
                                            <td className="max-w-[150px] py-3 pr-2 pl-3">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Link
                                                        href={route('dashboard.customers.show', b.customer_id)}
                                                        className="font-semibold text-ink hover:underline"
                                                    >
                                                        {b.customer_name}
                                                    </Link>
                                                    {b.customer_tags?.includes('VIP') && (
                                                        <Badge variant="popular">VIP</Badge>
                                                    )}
                                                    {supportsNoShow && (b.customer_no_show_count ?? 0) > 0 && (
                                                        <Badge variant="warning" className="tabular-nums">
                                                            No-Show {b.customer_no_show_count}x
                                                        </Badge>
                                                    )}
                                                    {b.customer_is_blocked && (
                                                        <Badge variant="danger">Diblokir</Badge>
                                                    )}
                                                </div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-xs text-ash">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailBookingId(b.id)}
                                                        className="cursor-pointer font-semibold text-mute hover:text-ink hover:underline"
                                                    >
                                                        {b.booking_code}
                                                    </button>
                                                    <span className="tabular-nums">+{b.customer_phone}</span>
                                                </div>
                                            </td>

                                            <td className="max-w-[165px] px-2 py-3">
                                                <p className="line-clamp-2 font-medium break-words text-ink">
                                                    {getServiceSummaryDisplay(b)}
                                                    {isDropoff && !hasMultiServiceItems(b) && (
                                                        <span className="ml-1 font-normal whitespace-nowrap text-mute tabular-nums">
                                                            ({b.quantity ?? 1} {b.unit_label ?? 'item'})
                                                        </span>
                                                    )}
                                                </p>
                                                {supportsStaffFilter && b.staff_name && (
                                                    <p className="mt-0.5 text-xs text-mute">{b.staff_name}</p>
                                                )}
                                                {hasSecondaryNotes && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailBookingId(b.id)}
                                                        className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-bone px-2 py-0.5 text-[11px] font-medium text-mute hover:text-ink"
                                                    >
                                                        {b.booking_mode === 'dropoff' && b.fulfillment_type === 'pickup' && b.pickup_address ? (
                                                            <>
                                                                <MapPin className="size-3" aria-hidden="true" />
                                                                <span>Alamat jemput</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FileText className="size-3" aria-hidden="true" />
                                                                <span>{b.reservation_status === 'cancelled' ? 'Alasan batal' : 'Ada catatan'}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </td>

                                            <td className="px-2 py-3">
                                                {isDropoff ? (
                                                    <div className="space-y-1 text-xs">
                                                        <p className="font-semibold whitespace-nowrap tabular-nums text-ink">
                                                            {formatDateShortIndo(b.booking_date)}
                                                        </p>
                                                        {b.estimated_ready_date && (
                                                            <p
                                                                className={cn(
                                                                    'font-medium tabular-nums',
                                                                    showSlaWarning && b.estimated_ready_date < todayStr
                                                                        ? 'text-destructive'
                                                                        : showSlaWarning && b.estimated_ready_date === todayStr
                                                                          ? 'text-warning'
                                                                          : 'text-mute'
                                                                )}
                                                            >
                                                                <span className="whitespace-nowrap">Est: {formatDateShortIndo(b.estimated_ready_date)}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0.5 text-xs">
                                                        <p className="font-semibold whitespace-nowrap tabular-nums text-ink">
                                                            {formatDateShortIndo(b.booking_date)}
                                                        </p>
                                                        <p className="font-mono whitespace-nowrap text-mute tabular-nums">
                                                            {b.schedule_label ?? formatBookingScheduleShort(b)}
                                                        </p>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-2 py-3">
                                                <div className="flex flex-col items-start gap-1">
                                                    <div className="flex flex-wrap items-center gap-1">
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
                                                    </div>
                                                    {paymentBadge(b.payment_status)}
                                                    {b.payment_status === 'unpaid' && b.dp_expires_at_local && !isClosed && (
                                                        <span className="text-[11px] tabular-nums text-mute">
                                                            Batas DP: {b.dp_expires_at_local}
                                                        </span>
                                                    )}
                                                    {b.dp_proof_url && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setProofVerifyBookingId(b.id)}
                                                            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-bone px-2 py-0.5 text-[11px] font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                                        >
                                                            <Eye className="size-3" aria-hidden="true" />
                                                            Bukti Uang Muka
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-2 py-3 text-right whitespace-nowrap">
                                                <p className="font-semibold tabular-nums text-ink">
                                                    {formatRupiah(b.total_price)}
                                                </p>
                                                {remaining > 0 && !isClosed ? (
                                                    <p className="mt-0.5 text-xs font-medium tabular-nums text-electric">
                                                        Sisa {formatRupiah(remaining)}
                                                    </p>
                                                ) : paid > 0 ? (
                                                    <p className="mt-0.5 text-xs tabular-nums text-mute">
                                                        Dibayar {formatRupiah(paid)}
                                                    </p>
                                                ) : null}
                                            </td>

                                            <td className="py-3 pr-3 pl-2 text-right whitespace-nowrap">
                                                <div className="inline-flex flex-nowrap items-center justify-end gap-1">
                                                    {renderBookingActions(b, 'desktop')}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <PaginationBar pagination={pagination} />
                </div>
            )}

            <BookingDetailDrawer
                booking={detailBooking}
                open={detailBooking !== null}
                onOpenChange={(open) => !open && setDetailBookingId(null)}
                todayDate={todayStr}
                itemSingular={itemSingular}
                supportsStaff={supportsStaffFilter}
                supportsNoShow={supportsNoShow}
                canAccessPos={canAccessPos}
                canVerifyPayments={canVerifyPayments}
                visibleWaTemplates={visibleWaTemplates}
                buildTemplateWaUrl={buildTemplateWaUrl}
                buildQuickWaUrl={buildQuickWaUrl}
                onVerifyProof={(b) => setProofVerifyBookingId(b.id)}
                onUpdateStatus={(id, status) => updateStatus(id, status, detailBooking ?? undefined)}
                onUpdateWorkStatus={(b, ws) => updateWorkStatus(b, ws)}
                onOpenCashier={(b, markCompleted = false) =>
                    setCashierState({ id: b.id, markCompleted })
                }
                onOpenReceipt={(id) => setReceiptBookingId(id)}
                onOpenReschedule={(b) => setRescheduleBooking(b)}
                onOpenNoShow={(b) => setNoShowBooking(b)}
                onOpenCancel={(b) => setCancelBooking(b)}
            />

            <DpProofVerifyDialog
                booking={proofVerifyBooking}
                open={proofVerifyBooking !== null}
                onOpenChange={(open) => !open && setProofVerifyBookingId(null)}
                canVerifyPayments={canVerifyPayments}
                itemSingular={itemSingular}
                quickWaUrl={proofVerifyBooking ? buildQuickWaUrl(proofVerifyBooking) : '#'}
            />

            <BookingRescheduleDialog
                booking={rescheduleBooking}
                staffOptions={staffOptions}
                todayDate={todayStr}
                onClose={() => setRescheduleBooking(null)}
            />

            <BookingCancelDialog
                booking={cancelBooking}
                open={cancelBooking !== null}
                onOpenChange={(open) => !open && setCancelBooking(null)}
                itemSingular={itemSingular}
            />

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

            <CashierSettlementDialog
                booking={cashierBooking}
                open={cashierBooking !== null}
                onOpenChange={(open) => !open && setCashierState(null)}
                services={services.map((s) => ({
                    id: s.id,
                    name: s.name,
                    price: s.price,
                    unit_label: s.unit_label,
                }))}
                addons={addons}
                canVerifyPayments={canVerifyPayments}
                canManageBookings={canManageBookings}
                defaultMarkCompleted={cashierState?.markCompleted ?? false}
                supportsCommissions={config.nav.showCommissions}
                businessName={businessName}
                businessAddress={businessAddress}
                businessPhone={businessPhone}
                businessEmail={businessEmail}
                cashierName={cashierUserName}
                onOpenReceiptDialog={(id) => setReceiptBookingId(id)}
            />

            <ReceiptPrintDialog
                booking={receiptBooking}
                open={receiptBooking !== null}
                onOpenChange={(open) => !open && setReceiptBookingId(null)}
                businessName={businessName}
                businessAddress={businessAddress}
                businessPhone={businessPhone}
                businessEmail={businessEmail}
                cashierName={cashierUserName}
            />
        </DashboardLayout>
    );
}
