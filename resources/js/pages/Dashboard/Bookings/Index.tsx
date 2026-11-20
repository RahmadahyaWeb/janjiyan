import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Calendar, CalendarClock, Check, CheckCircle2, ChevronDown, Download, Eye, List, MessageCircle, MoreHorizontal, Plus, Search, SlidersHorizontal, UserX, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { BookingCalendarView, type CalendarBookingItem, type CalendarPayload } from '@/components/BookingCalendarView';
import { BookingRescheduleDialog } from '@/components/BookingRescheduleDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PaginationBar, type PaginationMeta } from '@/components/PaginationBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
    buildWhatsAppUrl,
    formatBookingScheduleShort,
    formatDateIndo,
    formatDateShortIndo,
    formatRupiah,
    formatTurnaroundLabel,
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
    const [cancellingBooking, setCancellingBooking] = useState<BookingRow | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [noShowBooking, setNoShowBooking] = useState<Pick<BookingRow, 'id' | 'booking_code' | 'customer_name'> | null>(null);
    const [reschedulingBooking, setReschedulingBooking] = useState<BookingRow | null>(null);
    const [selectedCalendarBooking, setSelectedCalendarBooking] = useState<CalendarBookingItem | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [timeError, setTimeError] = useState('');

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

    const todayString = new Date().toISOString().slice(0, 10);

    const manualForm = useForm({
        service_id: services[0]?.id ? String(services[0].id) : '',
        date: todayString,
        time: '',
        quantity: 1,
        fulfillment_type: 'dropoff' as 'dropoff' | 'pickup',
        pickup_session: 'anytime' as 'morning' | 'afternoon' | 'evening' | 'anytime',
        pickup_address: '',
        staff_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_notes: '',
        initial_payment_status: 'dp_verified',
    });

    const selectedService = services.find((s) => String(s.id) === manualForm.data.service_id) ?? null;
    const isManualDropoff = selectedService?.booking_mode === 'dropoff';

    const manualSlotUrl = useMemo(() => {
        if (!createOpen || !manualForm.data.service_id || !manualForm.data.date) {
            return null;
        }
        const params = new URLSearchParams({
            service_id: manualForm.data.service_id,
            date: manualForm.data.date,
        });
        if (!isManualDropoff && manualForm.data.staff_id) {
            params.set('staff_id', manualForm.data.staff_id);
        }
        return `${route('dashboard.bookings.slots')}?${params.toString()}`;
    }, [createOpen, manualForm.data.service_id, manualForm.data.date, manualForm.data.staff_id, isManualDropoff]);

    const {
        slots,
        dropoff: manualDropoff,
        hasLoaded: manualSlotsLoaded,
        showInitialLoading: manualInitialLoading,
        showRefreshing: manualRefreshing,
    } = useSlotFetcher({
        url: manualSlotUrl,
        enabled: createOpen && manualSlotUrl !== null,
        onResolved: (nextSlots: SlotItem[]) => {
            if (isManualDropoff) return;
            if (!nextSlots.some((s) => s.time === manualForm.data.time)) {
                manualForm.setData('time', nextSlots[0]?.time ?? '');
            }
        },
    });

    const openManualModal = () => {
        setTimeError('');
        manualForm.reset();
        manualForm.setData({
            service_id: services[0]?.id ? String(services[0].id) : '',
            date: todayString,
            time: '',
            quantity: 1,
            fulfillment_type: 'dropoff',
            pickup_session: 'anytime',
            pickup_address: '',
            staff_id: '',
            customer_name: '',
            customer_phone: '',
            customer_email: '',
            customer_notes: '',
            initial_payment_status: 'dp_verified',
        });
        setCreateOpen(true);
    };

    const handleManualSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (isManualDropoff) {
            if (!manualDropoff?.available || manualDropoff.remaining_capacity < manualForm.data.quantity) {
                setTimeError(manualDropoff?.reason ?? 'Kuota harian tidak mencukupi pada tanggal yang dipilih.');
                document.getElementById('manual-date')?.focus();
                return;
            }
            if (selectedService?.supports_pickup && manualForm.data.fulfillment_type === 'pickup' && manualForm.data.pickup_address.trim() === '') {
                setTimeError('Alamat penjemputan wajib diisi untuk layanan Jemput & Antar.');
                document.getElementById('manual-pickup-address')?.focus();
                return;
            }
        } else if (!manualForm.data.time) {
            setTimeError('Pilih jam reservasi yang tersedia terlebih dahulu.');
            document.getElementById('manual-date')?.focus();
            return;
        }
        setTimeError('');
        manualForm.post(route('dashboard.bookings.store'), {
            onSuccess: () => {
                setCreateOpen(false);
                manualForm.reset();
            },
        });
    };

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
                <div className="flex items-center justify-between gap-2">
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
                                variant="outline"
                                size="sm"
                                disabled
                                aria-label="Export CSV khusus paket Pro"
                                className="size-9 px-0 sm:h-10 sm:w-auto sm:px-4"
                            >
                                <Download className="size-4" aria-hidden="true" />
                                <span className="hidden sm:inline">Export CSV (Pro)</span>
                            </Button>
                        )}

                        <Button
                            type="button"
                            size="sm"
                            onClick={openManualModal}
                            disabled={services.length === 0}
                            className="h-9 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            <span className="sm:hidden">Baru</span>
                            <span className="hidden sm:inline">Tambah Reservasi</span>
                        </Button>
                    </div>
                </div>

                {filters.view === 'list' && (
                    <>
                        {/* Quick Status Tabs */}
                        <div
                            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0"
                            role="group"
                            aria-label="Filter cepat status reservasi"
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
                        </div>

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

                            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        type="button"
                                        variant={advancedFilterCount > 0 ? 'default' : 'outline'}
                                        size="sm"
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
                                </SheetTrigger>
                                <SheetContent
                                    side="bottom"
                                    className="max-h-[85vh] overflow-y-auto rounded-t-[24px] border-hairline-soft bg-canvas p-0 shadow-none"
                                >
                                    <SheetHeader className="border-b border-divider px-5 py-4 pr-12">
                                        <SheetTitle className="text-lg font-semibold text-ink">
                                            Filter Reservasi
                                        </SheetTitle>
                                        <SheetDescription className="text-xs text-mute">
                                            Saring daftar berdasarkan pembayaran, layanan, staff, atau tanggal.
                                        </SheetDescription>
                                    </SheetHeader>

                                    <div className="space-y-4 p-5">
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
                                    </div>

                                    <SheetFooter className="flex-row gap-2 border-t border-divider p-5">
                                        {hasActiveFilter && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => {
                                                    resetFilters();
                                                    setFilterSheetOpen(false);
                                                }}
                                            >
                                                Reset Filter
                                            </Button>
                                        )}
                                        <SheetClose asChild>
                                            <Button type="button" className="flex-1">
                                                Lihat Hasil
                                            </Button>
                                        </SheetClose>
                                    </SheetFooter>
                                </SheetContent>
                            </Sheet>
                        </div>

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
                                    <Button type="button" size="sm" onClick={openManualModal}>
                                        <Plus className="size-4" aria-hidden="true" />
                                        Tambah Reservasi Manual
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
                                            <Badge variant="popular" className="text-[10px]">
                                                VIP
                                            </Badge>
                                        )}
                                        {(b.customer_no_show_count ?? 0) > 0 && (
                                            <Badge variant="warning" className="text-[10px] tabular-nums">
                                                No-Show {b.customer_no_show_count}x
                                            </Badge>
                                        )}
                                        {b.customer_is_blocked && (
                                            <Badge variant="danger" className="text-[10px]">
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
                                                            onClick={() => setReschedulingBooking(b)}
                                                            className="cursor-pointer rounded-[12px] px-3 py-2 text-sm text-ink"
                                                        >
                                                            <CalendarClock className="mr-2 size-4" aria-hidden="true" />
                                                            Ubah Jadwal
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
                                                                onClick={() => {
                                                                    setCancelReason('');
                                                                    setCancellingBooking(b);
                                                                }}
                                                                className="cursor-pointer rounded-[12px] px-3 py-2 text-sm text-destructive focus:bg-destructive-soft focus:text-destructive"
                                                            >
                                                                <X className="mr-2 size-4" aria-hidden="true" />
                                                                Batalkan Reservasi
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

            {/* Manual / Walk-In Booking Modal */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-ink">Tambah Booking Manual</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleManualSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="manual-service">Layanan *</Label>
                            <NativeSelect
                                id="manual-service"
                                value={manualForm.data.service_id}
                                onChange={(e) => {
                                    manualForm.setData((prev) => ({
                                        ...prev,
                                        service_id: e.target.value,
                                        staff_id: '',
                                        time: '',
                                    }));
                                }}
                                required
                            >
                                {services.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({formatRupiah(s.price)} ·{' '}
                                        {s.booking_mode === 'dropoff'
                                            ? formatTurnaroundLabel(s.turnaround_days ?? 1)
                                            : `${s.duration_minutes} mnt`}
                                        )
                                    </option>
                                ))}
                            </NativeSelect>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="manual-date">{isManualDropoff ? 'Tanggal Drop-off *' : 'Tanggal *'}</Label>
                                <Input
                                    id="manual-date"
                                    type="date"
                                    min={todayString}
                                    value={manualForm.data.date}
                                    onChange={(e) => manualForm.setData('date', e.target.value)}
                                    required
                                />
                            </div>

                            {isManualDropoff ? (
                                <div className="space-y-1.5">
                                    <Label htmlFor="manual-quantity">Jumlah Item *</Label>
                                    <Input
                                        id="manual-quantity"
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={manualForm.data.quantity}
                                        onChange={(e) => manualForm.setData('quantity', Math.max(1, Number(e.target.value) || 1))}
                                        required
                                    />
                                </div>
                            ) : (
                                selectedService?.assignment_mode === 'staff' && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="manual-staff">Staff</Label>
                                        <NativeSelect
                                            id="manual-staff"
                                            value={manualForm.data.staff_id}
                                            onChange={(e) => manualForm.setData('staff_id', e.target.value)}
                                        >
                                            <option value="">Siapa saja yang tersedia</option>
                                            {selectedService.staff.map((st) => (
                                                <option key={st.id} value={st.id}>
                                                    {st.name}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </div>
                                )
                            )}
                        </div>

                        {isManualDropoff ? (
                            <div className="space-y-3">
                                <div className="rounded-[16px] bg-bone px-4 py-3 text-xs" aria-live="polite">
                                    {manualInitialLoading || !manualSlotsLoaded ? (
                                        <p className="text-mute">Memeriksa kuota harian…</p>
                                    ) : manualDropoff?.available ? (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-semibold text-ink tabular-nums">
                                                Sisa kuota: {manualDropoff.remaining_capacity} / {manualDropoff.total_capacity} item
                                            </span>
                                            {manualDropoff.estimated_ready_date && (
                                                <span className="text-mute">
                                                    Est. selesai: {formatDateShortIndo(manualDropoff.estimated_ready_date)}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-destructive">
                                            {manualDropoff?.reason ?? 'Kuota harian tidak tersedia pada tanggal ini.'}
                                        </p>
                                    )}
                                </div>

                                {selectedService?.supports_pickup && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="manual-fulfillment">Metode Penyerahan</Label>
                                            <NativeSelect
                                                id="manual-fulfillment"
                                                value={manualForm.data.fulfillment_type}
                                                onChange={(e) => manualForm.setData('fulfillment_type', e.target.value as 'dropoff' | 'pickup')}
                                            >
                                                <option value="dropoff">Antar ke Toko (Drop-off)</option>
                                                <option value="pickup">Jemput &amp; Antar</option>
                                            </NativeSelect>
                                        </div>
                                        {manualForm.data.fulfillment_type === 'pickup' && (
                                            <div className="space-y-1.5">
                                                <Label htmlFor="manual-pickup-session">Sesi Jemput</Label>
                                                <NativeSelect
                                                    id="manual-pickup-session"
                                                    value={manualForm.data.pickup_session}
                                                    onChange={(e) =>
                                                        manualForm.setData(
                                                            'pickup_session',
                                                            e.target.value as 'morning' | 'afternoon' | 'evening' | 'anytime'
                                                        )
                                                    }
                                                >
                                                    {(['morning', 'afternoon', 'evening', 'anytime'] as const).map((sess) => (
                                                        <option key={sess} value={sess}>
                                                            {PICKUP_SESSION_LABELS[sess]}
                                                        </option>
                                                    ))}
                                                </NativeSelect>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedService?.supports_pickup && manualForm.data.fulfillment_type === 'pickup' && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="manual-pickup-address">Alamat Penjemputan *</Label>
                                        <Textarea
                                            id="manual-pickup-address"
                                            rows={2}
                                            placeholder="Alamat lengkap penjemputan"
                                            value={manualForm.data.pickup_address}
                                            onChange={(e) => manualForm.setData('pickup_address', e.target.value)}
                                        />
                                    </div>
                                )}

                                {(timeError || manualForm.errors.date || manualForm.errors.pickup_address) && (
                                    <p role="alert" className="text-xs text-destructive">
                                        {timeError || manualForm.errors.date || manualForm.errors.pickup_address}
                                    </p>
                                )}
                            </div>
                        ) : (
                        <div className="min-h-[88px] space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label>Pilih Jam Tersedia *</Label>
                                {manualRefreshing && (
                                    <span className="text-xs font-medium text-mute">Memperbarui…</span>
                                )}
                            </div>
                            {manualInitialLoading ? (
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 6 }).map((_, idx) => (
                                        <div key={idx} className="h-8 w-16 rounded-full bg-bone" />
                                    ))}
                                </div>
                            ) : !manualSlotsLoaded ? (
                                <div className="min-h-[56px]" />
                            ) : slots.length === 0 ? (
                                <p className="rounded-[16px] bg-bone px-4 py-3 text-sm text-mute">
                                    Tidak ada slot tersedia pada tanggal yang dipilih.
                                </p>
                            ) : (
                                <div
                                    className={`flex flex-wrap gap-2 transition-opacity duration-150 ${
                                        manualRefreshing ? 'opacity-60' : ''
                                    }`}
                                    role="group"
                                    aria-label="Pilih jam reservasi"
                                >
                                    {slots.map((slot) => {
                                        const selected = manualForm.data.time === slot.time;
                                        return (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => {
                                                    manualForm.setData('time', slot.time);
                                                    setTimeError('');
                                                }}
                                                className={`cursor-pointer rounded-full px-3.5 py-2 font-mono text-xs font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                                    selected ? 'bg-ink text-canvas' : 'bg-bone text-ink hover:bg-hairline-soft'
                                                }`}
                                            >
                                                {slot.time}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {(timeError || manualForm.errors.time) && (
                                <p id="manual-time-error" role="alert" className="text-xs text-destructive">
                                    {timeError || manualForm.errors.time}
                                </p>
                            )}
                        </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="manual-customer-name">Nama Pelanggan *</Label>
                                <Input
                                    id="manual-customer-name"
                                    placeholder="Budi Santoso"
                                    value={manualForm.data.customer_name}
                                    onChange={(e) => manualForm.setData('customer_name', e.target.value)}
                                    aria-invalid={Boolean(manualForm.errors.customer_name)}
                                    aria-describedby={manualForm.errors.customer_name ? 'manual-name-error' : undefined}
                                    required
                                />
                                {manualForm.errors.customer_name && (
                                    <p id="manual-name-error" className="text-xs text-destructive">
                                        {manualForm.errors.customer_name}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="manual-customer-phone">Nomor WhatsApp *</Label>
                                <Input
                                    id="manual-customer-phone"
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="081234567890"
                                    value={manualForm.data.customer_phone}
                                    onChange={(e) => manualForm.setData('customer_phone', e.target.value)}
                                    aria-invalid={Boolean(manualForm.errors.customer_phone)}
                                    aria-describedby={manualForm.errors.customer_phone ? 'manual-phone-error' : undefined}
                                    required
                                />
                                {manualForm.errors.customer_phone && (
                                    <p id="manual-phone-error" className="text-xs text-destructive">
                                        {manualForm.errors.customer_phone}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="manual-customer-email">Email (Opsional)</Label>
                                <Input
                                    id="manual-customer-email"
                                    type="email"
                                    placeholder="pelanggan@email.com"
                                    value={manualForm.data.customer_email}
                                    onChange={(e) => manualForm.setData('customer_email', e.target.value)}
                                    aria-invalid={Boolean(manualForm.errors.customer_email)}
                                    aria-describedby={manualForm.errors.customer_email ? 'manual-email-error' : undefined}
                                />
                                {manualForm.errors.customer_email && (
                                    <p id="manual-email-error" className="text-xs text-destructive">
                                        {manualForm.errors.customer_email}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="manual-payment-status">Status Pembayaran Awal *</Label>
                                <NativeSelect
                                    id="manual-payment-status"
                                    value={manualForm.data.initial_payment_status}
                                    onChange={(e) => manualForm.setData('initial_payment_status', e.target.value)}
                                >
                                    <option value="dp_verified">DP Terverifikasi (Langsung Konfirmasi)</option>
                                    <option value="settled">Lunas (Langsung Konfirmasi)</option>
                                    <option value="unpaid">Belum Dibayar (Menunggu Konfirmasi)</option>
                                </NativeSelect>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="manual-notes">Catatan (Opsional)</Label>
                            <Textarea
                                id="manual-notes"
                                placeholder="Mis. Walk-in pelanggan tetap"
                                value={manualForm.data.customer_notes}
                                onChange={(e) => manualForm.setData('customer_notes', e.target.value)}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={manualForm.processing}>
                            {manualForm.processing ? 'Menyimpan…' : 'Simpan Reservasi Manual'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

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

            <BookingRescheduleDialog
                booking={reschedulingBooking}
                staffOptions={
                    services.find((s) => s.id === reschedulingBooking?.service_id)?.staff ?? []
                }
                onClose={() => setReschedulingBooking(null)}
            />

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
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setReschedulingBooking(selectedCalendarBooking);
                                            setSelectedCalendarBooking(null);
                                        }}
                                    >
                                        <CalendarClock className="size-3.5" aria-hidden="true" />
                                        Ubah Jadwal
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

            {/* Cancel Booking Dialog with Optional Reason */}
            <Dialog
                open={cancellingBooking !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setCancellingBooking(null);
                        setCancelReason('');
                    }
                }}
            >
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-ink">
                            Batalkan reservasi {cancellingBooking?.booking_code ?? ''}?
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed text-mute">
                            Reservasi atas nama {cancellingBooking?.customer_name ?? ''} akan dibatalkan dan slot jadwal akan dibuka kembali.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="cancel-booking-reason">Alasan pembatalan (opsional)</Label>
                        <Textarea
                            id="cancel-booking-reason"
                            placeholder="Mis. Pelanggan berhalangan hadir atau jadwal penuh"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            maxLength={255}
                        />
                    </div>
                    <DialogFooter className="mt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCancellingBooking(null);
                                setCancelReason('');
                            }}
                        >
                            Kembali
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (!cancellingBooking) return;
                                updateStatus(cancellingBooking.id, 'cancelled', cancelReason.trim() || null);
                                setCancellingBooking(null);
                                setCancelReason('');
                            }}
                        >
                            Batalkan Reservasi
                        </Button>
                    </DialogFooter>
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
