import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Check, Minus, Plus, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { type DropoffAvailability, type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import {
    formatDateShortIndo,
    formatRupiah,
    formatTurnaroundLabel,
    PAYMENT_METHOD_LABELS,
    PICKUP_SESSION_LABELS,
} from '@/lib/format';
import { cn, parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';
import type { PageProps, PaymentMethod, ServiceAddon } from '@/types';

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
    staff: Array<{ id: number; name: string; title: string | null }>;
}

interface CustomerSuggestion {
    id: number;
    name: string;
    name_aliases?: string[];
    phone: string;
    email: string | null;
    tags?: string[];
    is_blocked?: boolean;
    bookings_count: number;
    no_show_count: number;
    total_spent?: number;
}

interface BookingCreateProps {
    services: ServiceOption[];
    addons?: ServiceAddon[];
    canUseMultiServiceDropoff?: boolean;
    todayDate?: string;
    prefill?: {
        date?: string | null;
        time?: string;
        staff_id?: string;
        customer?: CustomerSuggestion | null;
    };
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'qris', 'transfer', 'edc'];

function normalizePhoneForComparison(phone: string): string {
    const digits = phone.replace(/\D+/g, '');
    if (digits.startsWith('0')) {
        return `62${digits.slice(1)}`;
    }
    if (digits.startsWith('8')) {
        return `62${digits}`;
    }
    return digits;
}

export default function BookingCreate({
    services,
    addons = [],
    canUseMultiServiceDropoff = false,
    todayDate,
    prefill,
}: BookingCreateProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const canManageServices = activeBusiness?.can?.manage_services ?? true;
    const canOpenBilling = activeBusiness?.can?.manage_settings ?? false;
    const isDropoffBusiness = config.type === 'dropoff';
    const [timeError, setTimeError] = useState('');
    const [lookupQuery, setLookupQuery] = useState('');
    const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerSuggestion | null>(
        prefill?.customer ?? null
    );
    const [dropoffCart, setDropoffCart] = useState<Array<{ service_id: number; quantity: number }>>(() =>
        services[0]?.id ? [{ service_id: services[0].id, quantity: 1 }] : []
    );
    const [addonQuantities, setAddonQuantities] = useState<Record<number, number>>({});
    const [multiDropoffMap, setMultiDropoffMap] = useState<Record<number, DropoffAvailability>>({});
    const [multiDropoffLoading, setMultiDropoffLoading] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const customerLookupRef = useRef<HTMLDivElement>(null);
    const postActionRef = useRef<'index' | 'receipt'>('index');
    const todayString = todayDate || new Date().toISOString().slice(0, 10);

    const form = useForm({
        service_id: services[0]?.id ? String(services[0].id) : '',
        date: prefill?.date || todayString,
        time: prefill?.time || '',
        quantity: 1 as number | '',
        fulfillment_type: 'dropoff' as 'dropoff' | 'pickup',
        pickup_session: 'anytime' as 'morning' | 'afternoon' | 'evening' | 'anytime',
        pickup_address: '',
        start_in_progress: true as boolean,
        staff_id: prefill?.staff_id || '',
        customer_name: prefill?.customer?.name || '',
        customer_phone: prefill?.customer?.phone || '',
        customer_email: prefill?.customer?.email || '',
        customer_notes: '',
        initial_payment_status: (services[0]?.dp_amount ?? 0) > 0 ? 'dp_verified' : 'settled',
        payment_method: 'cash' as PaymentMethod,
        received_amount: '' as number | '',
    });

    const selectedService = services.find((s) => String(s.id) === form.data.service_id) ?? null;
    const isDropoff = isDropoffBusiness || selectedService?.booking_mode === 'dropoff';
    const isMultiDropoffMode = Boolean(isDropoff && canUseMultiServiceDropoff);

    const activeServiceLines = useMemo(() => {
        if (isMultiDropoffMode) {
            return dropoffCart
                .map((entry) => {
                    const svc = services.find((s) => s.id === entry.service_id);
                    return svc ? { service: svc, quantity: Math.max(1, entry.quantity) } : null;
                })
                .filter((x): x is { service: ServiceOption; quantity: number } => x !== null);
        }

        if (!selectedService) return [];
        const qty = isDropoff ? Math.max(1, Number(form.data.quantity || 1)) : 1;
        return [{ service: selectedService, quantity: qty }];
    }, [isMultiDropoffMode, dropoffCart, services, selectedService, isDropoff, form.data.quantity]);

    const selectedServiceIds = useMemo(
        () => activeServiceLines.map((l) => l.service.id),
        [activeServiceLines]
    );

    const applicableAddons = useMemo(
        () =>
            addons.filter((addon) => {
                if (!addon.is_active || selectedServiceIds.length === 0) return false;
                if (addon.service_ids && addon.service_ids.length > 0) {
                    return selectedServiceIds.some((id) => addon.service_ids.includes(id));
                }
                return Boolean(addon.applies_to_all_services);
            }),
        [addons, selectedServiceIds]
    );

    const selectedAddonLines = useMemo(
        () =>
            applicableAddons
                .map((addon) => ({
                    addon,
                    quantity: addonQuantities[addon.id] ?? 0,
                }))
                .filter((line) => line.quantity > 0),
        [applicableAddons, addonQuantities]
    );

    const extraAddonDuration = useMemo(
        () =>
            isDropoff
                ? 0
                : selectedAddonLines.reduce(
                      (sum, line) => sum + Math.max(0, line.addon.duration_minutes) * line.quantity,
                      0
                  ),
        [isDropoff, selectedAddonLines]
    );

    const anyPickupSupported = activeServiceLines.some((l) => Boolean(l.service.supports_pickup));
    const unitLabel = selectedService?.unit_label ?? 'item';
    const effectiveQty = isDropoff ? Math.max(1, Number(form.data.quantity || 1)) : 1;
    const servicesSubtotal = activeServiceLines.reduce(
        (sum, line) => sum + line.service.price * line.quantity,
        0
    );
    const addonsSubtotal = selectedAddonLines.reduce(
        (sum, line) => sum + line.addon.price * line.quantity,
        0
    );
    const estimatedTotalPrice = servicesSubtotal + addonsSubtotal;
    const rawDpTotal = activeServiceLines.reduce(
        (sum, line) => sum + (line.service.dp_amount ?? 0) * line.quantity,
        0
    );
    const estimatedDpAmount = Math.min(estimatedTotalPrice, rawDpTotal);
    const serviceRequiresDp = estimatedDpAmount > 0;

    useEffect(() => {
        if (!serviceRequiresDp && form.data.initial_payment_status === 'dp_verified') {
            form.setData('initial_payment_status', 'settled');
        }
    }, [serviceRequiresDp, form.data.initial_payment_status]);

    const expectedInitialPayAmount =
        form.data.initial_payment_status === 'settled'
            ? estimatedTotalPrice
            : form.data.initial_payment_status === 'dp_verified'
              ? estimatedDpAmount
              : 0;

    const slotUrl = useMemo(() => {
        if (isMultiDropoffMode || !form.data.service_id || !form.data.date) {
            return null;
        }
        const params = new URLSearchParams({
            service_id: form.data.service_id,
            date: form.data.date,
        });
        if (!isDropoff && form.data.staff_id) {
            params.set('staff_id', form.data.staff_id);
        }
        if (!isDropoff) {
            selectedAddonLines.forEach((line, idx) => {
                params.set(`addons[${idx}][service_addon_id]`, String(line.addon.id));
                params.set(`addons[${idx}][quantity]`, String(line.quantity));
            });
        }
        return `${route('dashboard.bookings.slots')}?${params.toString()}`;
    }, [
        isMultiDropoffMode,
        form.data.service_id,
        form.data.date,
        form.data.staff_id,
        isDropoff,
        selectedAddonLines,
    ]);

    const {
        slots,
        dropoff,
        hasLoaded,
        showInitialLoading,
        showRefreshing,
    } = useSlotFetcher({
        url: slotUrl,
        enabled: slotUrl !== null,
        onResolved: (nextSlots: SlotItem[]) => {
            if (isDropoff) return;
            if (!nextSlots.some((s) => s.time === form.data.time)) {
                form.setData('time', nextSlots[0]?.time ?? '');
            }
        },
    });

    const multiDropoffIdsKey = selectedServiceIds.join(',');
    useEffect(() => {
        if (!isMultiDropoffMode || !form.data.date || selectedServiceIds.length === 0) {
            setMultiDropoffMap({});
            setMultiDropoffLoading(false);
            return;
        }

        const controller = new AbortController();
        setMultiDropoffLoading(true);
        Promise.all(
            selectedServiceIds.map((id) => {
                const params = new URLSearchParams({
                    service_id: String(id),
                    date: form.data.date,
                });
                return fetch(`${route('dashboard.bookings.slots')}?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data: { dropoff?: DropoffAvailability | null } | null) => ({
                        id,
                        dropoff: data?.dropoff ?? null,
                    }));
            })
        )
            .then((results) => {
                if (controller.signal.aborted) return;
                const nextMap: Record<number, DropoffAvailability> = {};
                for (const r of results) {
                    if (r.dropoff) {
                        nextMap[r.id] = r.dropoff;
                    }
                }
                setMultiDropoffMap(nextMap);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setMultiDropoffMap({});
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setMultiDropoffLoading(false);
                }
            });

        return () => controller.abort();
    }, [isMultiDropoffMode, form.data.date, multiDropoffIdsKey]);

    useEffect(() => {
        const trimmed = lookupQuery.trim();
        if (trimmed.length < 2) {
            setSuggestions([]);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const url = `${route('dashboard.customers.lookup')}?q=${encodeURIComponent(trimmed)}`;
            fetch(url, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then((res) => (res.ok ? res.json() : { customers: [] }))
                .then((data: { customers?: CustomerSuggestion[] } | CustomerSuggestion[]) => {
                    if (controller.signal.aborted) return;
                    const list = Array.isArray(data)
                        ? data
                        : Array.isArray(data?.customers)
                          ? data.customers
                          : [];
                    setSuggestions(list);
                })
                .catch(() => {
                    if (controller.signal.aborted) return;
                    setSuggestions([]);
                });
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [lookupQuery]);

    useEffect(() => {
        const handleDocumentMouseDown = (event: MouseEvent) => {
            if (
                customerLookupRef.current &&
                event.target instanceof Node &&
                !customerLookupRef.current.contains(event.target)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);
        return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
    }, []);

    const handleSelectCustomer = (c: CustomerSuggestion) => {
        const localPhone = c.phone.startsWith('62') ? '0' + c.phone.slice(2) : c.phone;
        form.setData((prev) => ({
            ...prev,
            customer_name: c.name,
            customer_phone: localPhone,
            customer_email: c.email ?? '',
        }));
        setSelectedCustomer(c);
        setShowSuggestions(false);
        setSuggestions([]);
        setLookupQuery('');
    };

    const handleClearSelectedCustomer = () => {
        setSelectedCustomer(null);
        setShowSuggestions(false);
        setSuggestions([]);
        setLookupQuery('');
        form.setData((prev) => ({
            ...prev,
            customer_name: '',
            customer_phone: '',
            customer_email: '',
        }));
        document.getElementById('manual-customer-name')?.focus();
    };

    const toggleDropoffCartService = (serviceId: number) => {
        setTimeError('');
        setDropoffCart((prev) => {
            const exists = prev.some((item) => item.service_id === serviceId);
            if (exists) {
                if (prev.length <= 1) return prev;
                return prev.filter((item) => item.service_id !== serviceId);
            }
            return [...prev, { service_id: serviceId, quantity: 1 }];
        });
    };

    const updateDropoffCartQty = (serviceId: number, nextQty: number) => {
        const clamped = Math.max(1, Math.min(50, nextQty));
        setDropoffCart((prev) =>
            prev.map((item) => (item.service_id === serviceId ? { ...item, quantity: clamped } : item))
        );
    };

    const updateAddonQty = (addonId: number, nextQty: number) => {
        const clamped = Math.max(0, Math.min(50, nextQty));
        setAddonQuantities((prev) => ({
            ...prev,
            [addonId]: clamped,
        }));
    };

    const multiEstimatedReadyDate = useMemo(() => {
        if (!isMultiDropoffMode) return dropoff?.estimated_ready_date ?? null;
        let maxDate: string | null = null;
        for (const line of activeServiceLines) {
            const d = multiDropoffMap[line.service.id]?.estimated_ready_date;
            if (d && (!maxDate || d > maxDate)) {
                maxDate = d;
            }
        }
        return maxDate;
    }, [isMultiDropoffMode, dropoff, activeServiceLines, multiDropoffMap]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const normalizedQuantity = Math.max(1, Number(form.data.quantity || 1));

        if (isDropoff) {
            if (isMultiDropoffMode) {
                if (activeServiceLines.length === 0) {
                    setTimeError('Pilih minimal 1 layanan drop-off.');
                    return;
                }
                for (const line of activeServiceLines) {
                    const info = multiDropoffMap[line.service.id];
                    if (!info?.available || info.remaining_capacity < line.quantity) {
                        setTimeError(
                            info?.reason ??
                                `Kuota harian untuk ${line.service.name} tidak mencukupi pada tanggal yang dipilih.`
                        );
                        document.getElementById('manual-date')?.focus();
                        return;
                    }
                }
            } else if (!dropoff?.available || dropoff.remaining_capacity < normalizedQuantity) {
                setTimeError(dropoff?.reason ?? 'Kuota harian tidak mencukupi pada tanggal yang dipilih.');
                document.getElementById('manual-date')?.focus();
                return;
            }
            if (anyPickupSupported && form.data.fulfillment_type === 'pickup' && form.data.pickup_address.trim() === '') {
                setTimeError('Alamat penjemputan wajib diisi untuk layanan Jemput & Antar.');
                document.getElementById('manual-pickup-address')?.focus();
                return;
            }
        } else if (!form.data.time) {
            setTimeError(
                config.type === 'space_booking'
                    ? 'Pilih jam sesi yang tersedia terlebih dahulu.'
                    : 'Pilih jam reservasi yang tersedia terlebih dahulu.'
            );
            document.getElementById('manual-date')?.focus();
            return;
        }

        if (
            form.data.initial_payment_status !== 'unpaid' &&
            form.data.payment_method === 'cash' &&
            form.data.received_amount !== '' &&
            Number(form.data.received_amount) < expectedInitialPayAmount
        ) {
            setTimeError('Uang tunai diterima tidak boleh kurang dari nominal yang harus dibayar.');
            document.getElementById('manual-received-amount')?.focus();
            return;
        }

        setTimeError('');
        form.transform((data) => ({
            ...data,
            service_id: activeServiceLines[0]?.service.id ?? data.service_id,
            quantity: isMultiDropoffMode
                ? (activeServiceLines[0]?.quantity ?? 1)
                : Math.max(1, Number(data.quantity || 1)),
            services: isMultiDropoffMode
                ? activeServiceLines.map((line) => ({
                      service_id: line.service.id,
                      quantity: line.quantity,
                  }))
                : undefined,
            addons: selectedAddonLines.map((line) => ({
                service_addon_id: line.addon.id,
                quantity: line.quantity,
            })),
            payment_method: data.initial_payment_status !== 'unpaid' ? data.payment_method : undefined,
            received_amount:
                data.initial_payment_status !== 'unpaid' &&
                data.payment_method === 'cash' &&
                data.received_amount !== ''
                    ? Number(data.received_amount)
                    : null,
            start_in_progress: isDropoff && data.fulfillment_type === 'dropoff' ? Boolean(data.start_in_progress) : false,
            post_action: postActionRef.current,
        }));
        form.post(route('dashboard.bookings.store'), {
            onError: () => scrollToFirstInvalid(formRef.current),
        });
    };

    return (
        <DashboardLayout
            title={`Tambah ${config.bookings.itemSingular} Manual`}
            back={{
                href: route('dashboard.bookings'),
                label: `Kembali ke ${config.bookings.pageTitle}`,
            }}
        >
            <Head title={`Tambah ${config.bookings.itemSingular} Manual`} />


            {services.length === 0 ? (
                <div className="max-w-xl space-y-3 rounded-md bg-bone p-8 text-center">
                    <p className="text-base font-semibold text-ink">Belum ada layanan aktif.</p>
                    <p className="text-sm text-mute">
                        Tambahkan minimal satu layanan aktif sebelum membuat {config.bookings.itemSingular.toLowerCase()} manual.
                    </p>
                    {canManageServices ? (
                        <Button asChild size="sm">
                            <Link href={route('dashboard.services.create')}>Tambah Layanan</Link>
                        </Button>
                    ) : (
                        <p className="text-sm font-semibold text-ink">Minta pemilik bisnis menambahkan layanan.</p>
                    )}
                </div>
            ) : (
                <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
                >
                    <div className="min-w-0 space-y-5 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    {isMultiDropoffMode ? (
                        <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label>{config.services.pageTitle} (Multi-Layanan Drop-off) *</Label>
                                <span className="text-xs text-mute tabular-nums">
                                    {activeServiceLines.length} layanan dipilih
                                </span>
                            </div>
                            <div className="space-y-2">
                                {services.map((s) => {
                                    const cartItem = dropoffCart.find((item) => item.service_id === s.id);
                                    const isSelected = Boolean(cartItem);
                                    const info = multiDropoffMap[s.id];
                                    const svcUnit = s.unit_label ?? 'item';
                                    const maxQty = info?.available ? Math.min(50, info.remaining_capacity) : 50;

                                    return (
                                        <div
                                            key={s.id}
                                            className={cn(
                                                'flex flex-col gap-2.5 rounded-sm border p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between',
                                                isSelected
                                                    ? 'border-ink bg-canvas ring-1 ring-ink'
                                                    : 'border-hairline-soft bg-canvas hover:border-ink/40'
                                            )}
                                        >
                                            <button
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => toggleDropoffCartService(s.id)}
                                                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                            >
                                                <span
                                                    className={cn(
                                                        'inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-xs',
                                                        isSelected
                                                            ? 'border-ink bg-ink text-canvas'
                                                            : 'border-hairline bg-canvas text-transparent'
                                                    )}
                                                >
                                                    <Check className="size-3" aria-hidden="true" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold break-words text-ink">{s.name}</p>
                                                    <p className="mt-0.5 text-xs tabular-nums text-mute">
                                                        {formatRupiah(s.price)} / {svcUnit} ·{' '}
                                                        {formatTurnaroundLabel(s.turnaround_days ?? 1)}
                                                        {isSelected && (
                                                            <span className="ml-1.5 text-ink">
                                                                ·{' '}
                                                                {multiDropoffLoading
                                                                    ? 'Cek kuota…'
                                                                    : info?.available
                                                                      ? `Sisa ${info.remaining_capacity} ${svcUnit}`
                                                                      : info?.reason ?? 'Kuota penuh'}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </button>

                                            {isSelected && cartItem && (
                                                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-divider pt-2 sm:border-t-0 sm:pt-0">
                                                    <button
                                                        type="button"
                                                        aria-label={`Kurangi jumlah ${s.name}`}
                                                        disabled={cartItem.quantity <= 1}
                                                        onClick={() =>
                                                            updateDropoffCartQty(s.id, cartItem.quantity - 1)
                                                        }
                                                        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                                                    >
                                                        <Minus className="size-3.5" aria-hidden="true" />
                                                    </button>
                                                    <span className="min-w-6 text-center font-mono text-xs font-semibold tabular-nums text-ink">
                                                        {cartItem.quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Tambah jumlah ${s.name}`}
                                                        disabled={cartItem.quantity >= maxQty}
                                                        onClick={() =>
                                                            updateDropoffCartQty(s.id, cartItem.quantity + 1)
                                                        }
                                                        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                                                    >
                                                        <Plus className="size-3.5" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="manual-service">{config.services.pageTitle} *</Label>
                            <NativeSelect
                                id="manual-service"
                                value={form.data.service_id}
                                onChange={(e) => {
                                    setTimeError('');
                                    const nextId = e.target.value;
                                    const nextSvc = services.find((s) => String(s.id) === nextId);
                                    form.setData((prev) => ({
                                        ...prev,
                                        service_id: nextId,
                                        fulfillment_type: 'dropoff',
                                        staff_id: '',
                                        time: '',
                                        initial_payment_status:
                                            (nextSvc?.dp_amount ?? 0) === 0 && prev.initial_payment_status === 'dp_verified'
                                                ? 'settled'
                                                : prev.initial_payment_status,
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
                            {isDropoff && !canUseMultiServiceDropoff && (
                                <p className="text-xs text-mute">
                                    Ingin gabung beberapa layanan dalam 1 pesanan?{' '}
                                    {canOpenBilling ? (
                                        <Link
                                            href={route('dashboard.billing')}
                                            className="font-semibold text-electric hover:underline"
                                        >
                                            Tersedia di paket Professional
                                        </Link>
                                    ) : (
                                        <span>Tersedia pada paket Professional &amp; Enterprise.</span>
                                    )}
                                </p>
                            )}
                        </div>
                    )}

                    {applicableAddons.length > 0 && (
                        <div className="space-y-2.5 rounded-sm bg-bone p-3.5 sm:p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="size-4 text-ink" aria-hidden="true" />
                                    <Label className="text-sm font-semibold text-ink">
                                        Add-on Tambahan (Opsional)
                                    </Label>
                                </div>
                                {selectedAddonLines.length > 0 && (
                                    <span className="text-xs font-semibold tabular-nums text-electric">
                                        +{formatRupiah(addonsSubtotal)}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-2">
                                {applicableAddons.map((addon) => {
                                    const qty = addonQuantities[addon.id] ?? 0;
                                    return (
                                        <div
                                            key={addon.id}
                                            className={cn(
                                                'flex flex-col gap-2.5 rounded-xl border bg-canvas px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3',
                                                qty > 0 ? 'border-ink ring-1 ring-ink' : 'border-hairline-soft'
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold break-words text-ink">
                                                    {addon.name}
                                                </p>
                                                <p className="mt-0.5 text-xs tabular-nums text-mute">
                                                    <span>
                                                        {formatRupiah(addon.price)} / {addon.unit_label}
                                                    </span>
                                                    {!isDropoff && addon.duration_minutes > 0 && (
                                                        <span className="ml-1 inline-block whitespace-nowrap">
                                                            · +{addon.duration_minutes} mnt
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-divider pt-2 sm:border-t-0 sm:pt-0">
                                                <button
                                                    type="button"
                                                    aria-label={`Kurangi add-on ${addon.name}`}
                                                    disabled={qty <= 0}
                                                    onClick={() => updateAddonQty(addon.id, qty - 1)}
                                                    className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                                                >
                                                    <Minus className="size-3.5" aria-hidden="true" />
                                                </button>
                                                <span className="min-w-5 text-center font-mono text-xs font-semibold tabular-nums text-ink">
                                                    {qty}
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-label={`Tambah add-on ${addon.name}`}
                                                    disabled={qty >= 50}
                                                    onClick={() => updateAddonQty(addon.id, qty + 1)}
                                                    className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                                                >
                                                    <Plus className="size-3.5" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="manual-date">
                                {isDropoff
                                    ? anyPickupSupported && form.data.fulfillment_type === 'pickup'
                                        ? 'Tanggal Penjemputan *'
                                        : 'Tanggal Drop-off *'
                                    : 'Tanggal *'}
                            </Label>
                            <Input
                                id="manual-date"
                                type="date"
                                className="min-w-0"
                                min={todayString}
                                value={form.data.date}
                                onChange={(e) => form.setData('date', e.target.value)}
                                required
                            />
                        </div>

                        {isDropoff && !isMultiDropoffMode ? (
                            <div className="min-w-0 space-y-1.5">
                                <Label htmlFor="manual-quantity">Jumlah ({unitLabel}) *</Label>
                                <Input
                                    id="manual-quantity"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={50}
                                    className="tabular-nums"
                                    value={form.data.quantity}
                                    onChange={(e) => form.setData('quantity', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.quantity)}
                                    required
                                />
                                {form.errors.quantity && (
                                    <p className="text-xs text-destructive">{form.errors.quantity}</p>
                                )}
                            </div>
                        ) : !isDropoff ? (
                            config.bookings.supportsStaffColumn && selectedService?.assignment_mode === 'staff' && (
                                <div className="min-w-0 space-y-1.5">
                                    <Label htmlFor="manual-staff">Staff</Label>
                                    <NativeSelect
                                        id="manual-staff"
                                        value={form.data.staff_id}
                                        onChange={(e) => form.setData('staff_id', e.target.value)}
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
                        ) : null}
                    </div>

                    {isDropoff ? (
                        <div className="space-y-3">
                            <div className="rounded-sm bg-bone px-4 py-3 text-xs" aria-live="polite">
                                {isMultiDropoffMode ? (
                                    multiDropoffLoading ? (
                                        <p className="text-mute">Memeriksa kuota harian per layanan…</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {activeServiceLines.map((line) => {
                                                const info = multiDropoffMap[line.service.id];
                                                const svcUnit = line.service.unit_label ?? 'item';
                                                const ok = Boolean(info?.available && info.remaining_capacity >= line.quantity);
                                                return (
                                                    <div key={line.service.id} className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="font-medium text-ink">
                                                            {line.service.name} ({line.quantity} {svcUnit})
                                                        </span>
                                                        <span className={cn('tabular-nums', ok ? 'text-mute' : 'font-semibold text-destructive')}>
                                                            {info?.available
                                                                ? `Sisa kuota ${info.remaining_capacity}/${info.total_capacity} ${svcUnit}`
                                                                : info?.reason ?? 'Tidak tersedia'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {multiEstimatedReadyDate && (
                                                <p className="border-t border-divider pt-1.5 font-semibold text-ink">
                                                    Est. selesai: {formatDateShortIndo(multiEstimatedReadyDate)}
                                                </p>
                                            )}
                                        </div>
                                    )
                                ) : showInitialLoading || !hasLoaded ? (
                                    <p className="text-mute">Memeriksa kuota harian…</p>
                                ) : dropoff?.available ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-semibold text-ink tabular-nums">
                                            Sisa kuota: {dropoff.remaining_capacity} / {dropoff.total_capacity} {dropoff.unit_label ?? unitLabel}
                                        </span>
                                        {dropoff.estimated_ready_date && (
                                            <span className="text-mute">
                                                Est. selesai: {formatDateShortIndo(dropoff.estimated_ready_date)}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-destructive">
                                        {dropoff?.reason ?? 'Kuota harian tidak tersedia pada tanggal ini.'}
                                    </p>
                                )}
                            </div>

                            {anyPickupSupported && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="min-w-0 space-y-1.5">
                                        <Label htmlFor="manual-fulfillment">Metode Penyerahan</Label>
                                        <NativeSelect
                                            id="manual-fulfillment"
                                            value={form.data.fulfillment_type}
                                            onChange={(e) =>
                                                form.setData('fulfillment_type', e.target.value as 'dropoff' | 'pickup')
                                            }
                                        >
                                            <option value="dropoff">Antar ke Toko (Drop-off)</option>
                                            <option value="pickup">Jemput &amp; Antar</option>
                                        </NativeSelect>
                                    </div>
                                    {form.data.fulfillment_type === 'pickup' && (
                                        <div className="min-w-0 space-y-1.5">
                                            <Label htmlFor="manual-pickup-session">Sesi Jemput</Label>
                                            <NativeSelect
                                                id="manual-pickup-session"
                                                value={form.data.pickup_session}
                                                onChange={(e) =>
                                                    form.setData(
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

                            {anyPickupSupported && form.data.fulfillment_type === 'pickup' && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="manual-pickup-address">Alamat Penjemputan *</Label>
                                    <Textarea
                                        id="manual-pickup-address"
                                        rows={2}
                                        placeholder="Alamat lengkap penjemputan"
                                        value={form.data.pickup_address}
                                        onChange={(e) => form.setData('pickup_address', e.target.value)}
                                        aria-invalid={Boolean(form.errors.pickup_address)}
                                    />
                                </div>
                            )}

                            {form.data.fulfillment_type === 'dropoff' && (
                                <div className="flex items-center justify-between gap-4 rounded-sm border border-hairline-soft bg-bone/50 px-4 py-3">
                                    <div className="min-w-0 space-y-0.5">
                                        <Label
                                            htmlFor="manual-start-in-progress"
                                            className="cursor-pointer text-sm font-semibold text-ink"
                                        >
                                            Barang sudah diterima di toko
                                        </Label>
                                        <p className="text-xs text-mute">
                                            Langsung masukkan ke tahap Sedang Dikerjakan tanpa perlu klik Terima &amp; Proses lagi.
                                        </p>
                                    </div>
                                    <Switch
                                        id="manual-start-in-progress"
                                        className="shrink-0"
                                        checked={form.data.start_in_progress}
                                        onCheckedChange={(checked) => form.setData('start_in_progress', checked)}
                                    />
                                </div>
                            )}

                            {(timeError || form.errors.date || form.errors.pickup_address) && (
                                <p role="alert" className="text-xs text-destructive">
                                    {timeError || form.errors.date || form.errors.pickup_address}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="min-h-[88px] space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label>Pilih Jam Tersedia *</Label>
                                {showRefreshing && <span className="text-xs font-medium text-mute">Memperbarui…</span>}
                            </div>
                            {showInitialLoading ? (
                                <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:flex sm:flex-wrap">
                                    {Array.from({ length: 8 }).map((_, idx) => (
                                        <div key={idx} className="h-10 rounded-xl bg-bone sm:w-20 sm:rounded-full" />
                                    ))}
                                </div>
                            ) : !hasLoaded ? (
                                <div className="min-h-[56px]" />
                            ) : slots.length === 0 ? (
                                <p className="rounded-sm bg-bone px-4 py-3 text-sm text-mute">
                                    Tidak ada slot tersedia pada tanggal yang dipilih.
                                </p>
                            ) : (
                                <div
                                    className={`grid grid-cols-3 gap-2 transition-opacity duration-150 min-[380px]:grid-cols-4 sm:flex sm:flex-wrap ${
                                        showRefreshing ? 'opacity-60' : ''
                                    }`}
                                    role="group"
                                    aria-label={config.type === 'space_booking' ? 'Pilih jam sesi' : 'Pilih jam reservasi'}
                                >
                                    {slots.map((slot) => {
                                        const selected = form.data.time === slot.time;
                                        return (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => {
                                                    form.setData('time', slot.time);
                                                    setTimeError('');
                                                }}
                                                className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl px-3 py-2 font-mono text-xs font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:rounded-full sm:px-3.5 ${
                                                    selected ? 'bg-ink text-canvas' : 'bg-bone text-ink hover:bg-hairline-soft'
                                                }`}
                                            >
                                                {slot.time}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {(timeError || form.errors.time) && (
                                <p id="manual-time-error" role="alert" className="text-xs text-destructive">
                                    {timeError || form.errors.time}
                                </p>
                            )}
                        </div>
                    )}

                    <div ref={customerLookupRef} className="space-y-2.5">
                        {selectedCustomer && (
                            <div className="flex flex-col gap-2.5 rounded-sm border border-hairline-soft bg-bone p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                                <p className="min-w-0 break-words font-medium text-ink">
                                    Terhubung ke pelanggan terdaftar: <span className="font-semibold">{selectedCustomer.name}</span> (+{selectedCustomer.phone}) · <span className="tabular-nums">{selectedCustomer.bookings_count}x</span> riwayat kunjungan
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full shrink-0 sm:w-auto"
                                    onClick={handleClearSelectedCustomer}
                                >
                                    Ganti / Input Baru
                                </Button>
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="min-w-0 space-y-1.5">
                                <Label htmlFor="manual-customer-name">Nama Pelanggan *</Label>
                                <Input
                                    id="manual-customer-name"
                                    placeholder="Budi Santoso"
                                    autoComplete="off"
                                    value={form.data.customer_name}
                                    onFocus={() => {
                                        if (form.data.customer_name.trim().length >= 2) {
                                            setLookupQuery(form.data.customer_name.trim());
                                            setShowSuggestions(true);
                                        }
                                    }}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        form.setData('customer_name', val);
                                        setLookupQuery(val.trim());
                                        setShowSuggestions(true);
                                    }}
                                    aria-invalid={Boolean(form.errors.customer_name)}
                                    aria-describedby={form.errors.customer_name ? 'manual-name-error' : undefined}
                                    required
                                />
                                {form.errors.customer_name && (
                                    <p id="manual-name-error" className="text-xs text-destructive">
                                        {form.errors.customer_name}
                                    </p>
                                )}
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <Label htmlFor="manual-customer-phone">Nomor WhatsApp *</Label>
                                <Input
                                    id="manual-customer-phone"
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="081234567890"
                                    autoComplete="off"
                                    value={form.data.customer_phone}
                                    onFocus={() => {
                                        if (form.data.customer_phone.trim().length >= 2) {
                                            setLookupQuery(form.data.customer_phone.trim());
                                            setShowSuggestions(true);
                                        }
                                    }}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        form.setData('customer_phone', val);
                                        if (
                                            selectedCustomer &&
                                            normalizePhoneForComparison(val) !==
                                                normalizePhoneForComparison(selectedCustomer.phone)
                                        ) {
                                            setSelectedCustomer(null);
                                        }
                                        setLookupQuery(val.trim());
                                        setShowSuggestions(true);
                                    }}
                                    aria-invalid={Boolean(form.errors.customer_phone)}
                                    aria-describedby={form.errors.customer_phone ? 'manual-phone-error' : undefined}
                                    required
                                />
                                {form.errors.customer_phone && (
                                    <p id="manual-phone-error" className="text-xs text-destructive">
                                        {form.errors.customer_phone}
                                    </p>
                                )}
                            </div>
                        </div>

                        {showSuggestions && suggestions.length > 0 && (
                            <div
                                role="listbox"
                                aria-label="Saran pelanggan terdaftar"
                                className="divide-y divide-hairline-soft overflow-hidden rounded-sm border border-hairline-soft bg-bone/60"
                            >
                                {suggestions.map((c) => {
                                    const aliases = Array.isArray(c.name_aliases) ? c.name_aliases : [];
                                    const tags = Array.isArray(c.tags) ? c.tags : [];
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            role="option"
                                            aria-selected={selectedCustomer?.id === c.id}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleSelectCustomer(c)}
                                            className="flex min-h-11 w-full cursor-pointer flex-col gap-1.5 px-3.5 py-2.5 text-left transition-colors hover:bg-bone focus-visible:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-inset sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="flex flex-wrap items-baseline gap-1.5">
                                                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                                                    {aliases.length > 0 && (
                                                        <span className="text-xs text-mute">
                                                            (Alias: {aliases.join(', ')})
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-mono text-xs text-mute tabular-nums">
                                                    +{c.phone}
                                                    {c.email ? ` · ${c.email}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <Badge variant="secondary">{c.bookings_count}x kunjungan</Badge>
                                                {tags.map((tag) => (
                                                    <Badge
                                                        key={tag}
                                                        variant={tag.toUpperCase() === 'VIP' ? 'default' : 'outline'}
                                                    >
                                                        {tag}
                                                    </Badge>
                                                ))}
                                                {config.bookings.supportsNoShow && c.no_show_count > 0 && (
                                                    <Badge variant="warning">{c.no_show_count}x no-show</Badge>
                                                )}
                                                {c.is_blocked && <Badge variant="danger">Diblokir Online</Badge>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <p className="text-xs text-mute">
                            Ketik nama atau nomor WhatsApp untuk mencari pelanggan lama agar tidak terjadi data pelanggan ganda.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="manual-customer-email">Email (Opsional)</Label>
                            <Input
                                id="manual-customer-email"
                                type="email"
                                placeholder="pelanggan@email.com"
                                value={form.data.customer_email}
                                onChange={(e) => form.setData('customer_email', e.target.value)}
                                aria-invalid={Boolean(form.errors.customer_email)}
                                aria-describedby={form.errors.customer_email ? 'manual-email-error' : undefined}
                            />
                            {form.errors.customer_email && (
                                <p id="manual-email-error" className="text-xs text-destructive">
                                    {form.errors.customer_email}
                                </p>
                            )}
                        </div>
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="manual-payment-status">Status Pembayaran Awal *</Label>
                            <NativeSelect
                                id="manual-payment-status"
                                value={form.data.initial_payment_status}
                                onChange={(e) => form.setData('initial_payment_status', e.target.value)}
                            >
                                {serviceRequiresDp && (
                                    <option value="dp_verified">DP Terverifikasi · Konfirmasi</option>
                                )}
                                <option value="settled">Lunas · Konfirmasi</option>
                                <option value="unpaid">
                                    {serviceRequiresDp
                                        ? 'Belum Bayar · Menunggu'
                                        : isDropoff
                                          ? 'Belum Bayar · Bayar di Toko'
                                          : 'Belum Bayar · Bayar di Tempat'}
                                </option>
                            </NativeSelect>
                        </div>
                    </div>

                    {form.data.initial_payment_status !== 'unpaid' && (
                        <div className="space-y-3 rounded-sm bg-bone p-3.5 sm:p-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-ink">
                                    Metode Pembayaran *
                                </Label>
                                <div
                                    className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap"
                                    role="group"
                                    aria-label="Pilih metode pembayaran awal"
                                >
                                    {PAYMENT_METHODS.map((methodKey) => {
                                        const active = form.data.payment_method === methodKey;
                                        return (
                                            <button
                                                key={methodKey}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => form.setData('payment_method', methodKey)}
                                                className={cn(
                                                    'min-h-10 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                    active
                                                        ? 'bg-ink text-canvas'
                                                        : 'bg-canvas text-ink hover:bg-hairline-soft'
                                                )}
                                            >
                                                {PAYMENT_METHOD_LABELS[methodKey]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {form.data.payment_method === 'cash' && expectedInitialPayAmount > 0 && (
                                <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="manual-received-amount" className="text-xs">
                                            Uang Tunai Diterima (Opsional)
                                        </Label>
                                        <Input
                                            id="manual-received-amount"
                                            type="number"
                                            min={0}
                                            inputMode="numeric"
                                            placeholder={String(expectedInitialPayAmount)}
                                            className="h-10 bg-canvas tabular-nums md:text-sm"
                                            value={form.data.received_amount}
                                            onChange={(e) =>
                                                form.setData('received_amount', parseNumericInput(e.target.value))
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-canvas px-3.5 py-2.5 text-xs">
                                        <span className="text-mute">Kembalian</span>
                                        <span className="font-semibold tabular-nums text-ink">
                                            {form.data.received_amount === ''
                                                ? formatRupiah(0)
                                                : Number(form.data.received_amount) < expectedInitialPayAmount
                                                  ? 'Kurang'
                                                  : formatRupiah(
                                                        Math.max(
                                                            0,
                                                            Number(form.data.received_amount) -
                                                                expectedInitialPayAmount
                                                        )
                                                    )}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="manual-notes">Catatan (Opsional)</Label>
                        <Textarea
                            id="manual-notes"
                            placeholder={
                                config.type === 'dropoff'
                                    ? 'Mis. Ada noda di bagian sol, atau titip langsung di kasir'
                                    : config.type === 'space_booking'
                                      ? 'Mis. Pesan langsung di tempat atau butuh tambahan perlengkapan'
                                      : 'Mis. Walk-in pelanggan tetap'
                            }
                            value={form.data.customer_notes}
                            onChange={(e) => form.setData('customer_notes', e.target.value)}
                        />
                    </div>

                    {Object.keys(form.errors).length > 0 && (
                        <div
                            role="alert"
                            data-form-error="true"
                            className="rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-2.5 text-xs text-destructive"
                        >
                            Periksa kembali data pemesan atau jadwal yang ditandai merah di atas.
                        </div>
                    )}
                    </div>

                    {/* Sticky POS Summary & Submit Column */}
                    <aside className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-5 lg:sticky lg:top-22">
                        <div>
                            <h2 className="text-base font-semibold text-ink">Ringkasan {config.bookings.itemSingular}</h2>
                            <p className="text-xs text-mute">
                                Periksa detail layanan dan pembayaran sebelum menyimpan.
                            </p>
                        </div>

                        <div className="space-y-2 rounded-sm bg-bone p-3.5 text-xs">
                            {activeServiceLines.length > 0 ? (
                                <div className="space-y-1.5">
                                    {activeServiceLines.map((line) => (
                                        <div key={line.service.id} className="flex items-start justify-between gap-2">
                                            <span className="font-medium text-ink">
                                                {line.service.name}
                                                {isDropoff ? ` (${line.quantity} ${line.service.unit_label ?? 'item'})` : ''}
                                            </span>
                                            <span className="shrink-0 font-semibold tabular-nums text-ink">
                                                {formatRupiah(line.service.price * line.quantity)}
                                            </span>
                                        </div>
                                    ))}
                                    {selectedAddonLines.map((line) => (
                                        <div key={line.addon.id} className="flex items-start justify-between gap-2 text-mute">
                                            <span>
                                                + {line.addon.name} ({line.quantity} {line.addon.unit_label})
                                            </span>
                                            <span className="shrink-0 tabular-nums text-ink">
                                                {formatRupiah(line.addon.price * line.quantity)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-mute">Pilih layanan terlebih dahulu.</p>
                            )}

                            <div className="space-y-1 border-t border-divider pt-2 text-mute">
                                <div className="flex items-center justify-between gap-2">
                                    <span>Tanggal</span>
                                    <span className="font-semibold tabular-nums text-ink">
                                        {form.data.date ? formatDateShortIndo(form.data.date) : '—'}
                                    </span>
                                </div>
                                {!isDropoff && (
                                    <div className="flex items-center justify-between gap-2">
                                        <span>Jam</span>
                                        <span className="font-mono font-semibold tabular-nums text-ink">
                                            {form.data.time || 'Belum dipilih'}
                                        </span>
                                    </div>
                                )}
                                {!isDropoff && selectedService && (
                                    <div className="flex items-center justify-between gap-2">
                                        <span>Durasi</span>
                                        <span className="tabular-nums text-ink">
                                            {selectedService.duration_minutes + extraAddonDuration} menit
                                        </span>
                                    </div>
                                )}
                                {form.data.customer_name && (
                                    <div className="flex items-center justify-between gap-2">
                                        <span>Pelanggan</span>
                                        <span className="truncate font-semibold text-ink">{form.data.customer_name}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-baseline justify-between gap-2 border-t border-divider pt-2.5 text-sm">
                                <span className="font-semibold text-ink">Total Biaya</span>
                                <div className="text-right">
                                    <p className="text-base font-semibold tabular-nums text-ink">
                                        {formatRupiah(estimatedTotalPrice)}
                                    </p>
                                    {serviceRequiresDp && (
                                        <p className="text-xs tabular-nums text-electric">
                                            Uang muka: {formatRupiah(estimatedDpAmount)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={form.processing}
                                onClick={() => {
                                    postActionRef.current = 'index';
                                }}
                            >
                                {form.processing && postActionRef.current === 'index'
                                    ? 'Menyimpan…'
                                    : `Simpan ${config.bookings.itemSingular} Manual`}
                            </Button>
                            <Button
                                type="submit"
                                variant="outline"
                                className="w-full"
                                disabled={form.processing}
                                onClick={() => {
                                    postActionRef.current = 'receipt';
                                }}
                            >
                                {form.processing && postActionRef.current === 'receipt'
                                    ? 'Menyimpan…'
                                    : 'Simpan & Cetak Struk'}
                            </Button>
                            <Button asChild type="button" variant="ghost" className="w-full">
                                <Link href={route('dashboard.bookings')}>Batal</Link>
                            </Button>
                        </div>
                    </aside>
                </form>
            )}
        </DashboardLayout>
    );
}
