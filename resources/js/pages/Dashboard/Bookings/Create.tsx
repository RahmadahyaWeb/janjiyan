import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import {
    formatDateShortIndo,
    formatRupiah,
    formatTurnaroundLabel,
    PICKUP_SESSION_LABELS,
} from '@/lib/format';
import { parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';
import type { PageProps } from '@/types';

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
}

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

export default function BookingCreate({ services }: BookingCreateProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const canManageServices = activeBusiness?.can?.manage_services ?? true;
    const isDropoffBusiness = config.type === 'dropoff';
    const [timeError, setTimeError] = useState('');
    const [lookupQuery, setLookupQuery] = useState('');
    const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerSuggestion | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const customerLookupRef = useRef<HTMLDivElement>(null);
    const todayString = new Date().toISOString().slice(0, 10);

    const form = useForm({
        service_id: services[0]?.id ? String(services[0].id) : '',
        date: todayString,
        time: '',
        quantity: 1 as number | '',
        fulfillment_type: 'dropoff' as 'dropoff' | 'pickup',
        pickup_session: 'anytime' as 'morning' | 'afternoon' | 'evening' | 'anytime',
        pickup_address: '',
        start_in_progress: true as boolean,
        staff_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_notes: '',
        initial_payment_status: 'dp_verified',
    });

    const selectedService = services.find((s) => String(s.id) === form.data.service_id) ?? null;
    const isDropoff = isDropoffBusiness || selectedService?.booking_mode === 'dropoff';
    const unitLabel = selectedService?.unit_label ?? 'item';

    const slotUrl = useMemo(() => {
        if (!form.data.service_id || !form.data.date) {
            return null;
        }
        const params = new URLSearchParams({
            service_id: form.data.service_id,
            date: form.data.date,
        });
        if (!isDropoff && form.data.staff_id) {
            params.set('staff_id', form.data.staff_id);
        }
        return `${route('dashboard.bookings.slots')}?${params.toString()}`;
    }, [form.data.service_id, form.data.date, form.data.staff_id, isDropoff]);

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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const normalizedQuantity = Math.max(1, Number(form.data.quantity || 1));

        if (isDropoff) {
            if (!dropoff?.available || dropoff.remaining_capacity < normalizedQuantity) {
                setTimeError(dropoff?.reason ?? 'Kuota harian tidak mencukupi pada tanggal yang dipilih.');
                document.getElementById('manual-date')?.focus();
                return;
            }
            if (selectedService?.supports_pickup && form.data.fulfillment_type === 'pickup' && form.data.pickup_address.trim() === '') {
                setTimeError('Alamat penjemputan wajib diisi untuk layanan Jemput & Antar.');
                document.getElementById('manual-pickup-address')?.focus();
                return;
            }
        } else if (!form.data.time) {
            setTimeError('Pilih jam reservasi yang tersedia terlebih dahulu.');
            document.getElementById('manual-date')?.focus();
            return;
        }

        setTimeError('');
        form.transform((data) => ({
            ...data,
            quantity: Math.max(1, Number(data.quantity || 1)),
            start_in_progress: isDropoff && data.fulfillment_type === 'dropoff' ? Boolean(data.start_in_progress) : false,
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
                    <p className="text-sm text-mute">Tambahkan minimal satu layanan aktif sebelum membuat booking manual.</p>
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
                    className="max-w-2xl space-y-5 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6"
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="manual-service">{config.services.pageTitle} *</Label>
                        <NativeSelect
                            id="manual-service"
                            value={form.data.service_id}
                            onChange={(e) => {
                                setTimeError('');
                                form.setData((prev) => ({
                                    ...prev,
                                    service_id: e.target.value,
                                    fulfillment_type: 'dropoff',
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
                            <Label htmlFor="manual-date">{isDropoff ? 'Tanggal Drop-off *' : 'Tanggal *'}</Label>
                            <Input
                                id="manual-date"
                                type="date"
                                min={todayString}
                                value={form.data.date}
                                onChange={(e) => form.setData('date', e.target.value)}
                                required
                            />
                        </div>

                        {isDropoff ? (
                            <div className="space-y-1.5">
                                <Label htmlFor="manual-quantity">Jumlah ({unitLabel}) *</Label>
                                <Input
                                    id="manual-quantity"
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={form.data.quantity}
                                    onChange={(e) => form.setData('quantity', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.quantity)}
                                    required
                                />
                                {form.errors.quantity && (
                                    <p className="text-xs text-destructive">{form.errors.quantity}</p>
                                )}
                            </div>
                        ) : (
                            config.bookings.supportsStaffColumn && selectedService?.assignment_mode === 'staff' && (
                                <div className="space-y-1.5">
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
                        )}
                    </div>

                    {isDropoff ? (
                        <div className="space-y-3">
                            <div className="rounded-sm bg-bone px-4 py-3 text-xs" aria-live="polite">
                                {showInitialLoading || !hasLoaded ? (
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

                            {selectedService?.supports_pickup && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
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
                                        <div className="space-y-1.5">
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

                            {selectedService?.supports_pickup && form.data.fulfillment_type === 'pickup' && (
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
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 6 }).map((_, idx) => (
                                        <div key={idx} className="h-8 w-16 rounded-full bg-bone" />
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
                                    className={`flex flex-wrap gap-2 transition-opacity duration-150 ${
                                        showRefreshing ? 'opacity-60' : ''
                                    }`}
                                    role="group"
                                    aria-label="Pilih jam reservasi"
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
                            {(timeError || form.errors.time) && (
                                <p id="manual-time-error" role="alert" className="text-xs text-destructive">
                                    {timeError || form.errors.time}
                                </p>
                            )}
                        </div>
                    )}

                    <div ref={customerLookupRef} className="space-y-2.5">
                        {selectedCustomer && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-hairline-soft bg-bone px-3.5 py-2.5 text-xs">
                                <p className="font-medium text-ink">
                                    Terhubung ke pelanggan terdaftar: <span className="font-semibold">{selectedCustomer.name}</span> (+{selectedCustomer.phone}) · {selectedCustomer.bookings_count}x riwayat kunjungan
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearSelectedCustomer}
                                >
                                    Ganti / Input Baru
                                </Button>
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
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
                            <div className="space-y-1.5">
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
                                            className="flex w-full cursor-pointer flex-col gap-1.5 px-3.5 py-2.5 text-left transition-colors hover:bg-bone focus-visible:bg-bone focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
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
                                                {c.no_show_count > 0 && (
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
                        <div className="space-y-1.5">
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
                        <div className="space-y-1.5">
                            <Label htmlFor="manual-payment-status">Status Pembayaran Awal *</Label>
                            <NativeSelect
                                id="manual-payment-status"
                                value={form.data.initial_payment_status}
                                onChange={(e) => form.setData('initial_payment_status', e.target.value)}
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

                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button asChild type="button" variant="outline">
                            <Link href={route('dashboard.bookings')}>Batal</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing
                                ? 'Menyimpan…'
                                : `Simpan ${config.bookings.itemSingular} Manual`}
                        </Button>
                    </div>
                </form>
            )}
        </DashboardLayout>
    );
}
