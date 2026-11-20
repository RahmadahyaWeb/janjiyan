import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
    formatDateShortIndo,
    formatRupiah,
    formatTurnaroundLabel,
    PICKUP_SESSION_LABELS,
} from '@/lib/format';
import { parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';

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
    staff: Array<{ id: number; name: string; title: string | null }>;
}

interface BookingCreateProps {
    services: ServiceOption[];
}

export default function BookingCreate({ services }: BookingCreateProps) {
    const [timeError, setTimeError] = useState('');
    const formRef = useRef<HTMLFormElement>(null);
    const todayString = new Date().toISOString().slice(0, 10);

    const form = useForm({
        service_id: services[0]?.id ? String(services[0].id) : '',
        date: todayString,
        time: '',
        quantity: 1 as number | '',
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

    const selectedService = services.find((s) => String(s.id) === form.data.service_id) ?? null;
    const isDropoff = selectedService?.booking_mode === 'dropoff';

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
        }));
        form.post(route('dashboard.bookings.store'), {
            onError: () => scrollToFirstInvalid(formRef.current),
        });
    };

    return (
        <DashboardLayout title="Tambah Booking Manual" back={{ href: route('dashboard.bookings'), label: 'Kembali ke Daftar Reservasi' }}>
            <Head title="Tambah Booking Manual" />


            {services.length === 0 ? (
                <div className="max-w-xl space-y-3 rounded-md bg-bone p-8 text-center">
                    <p className="text-base font-semibold text-ink">Belum ada layanan aktif.</p>
                    <p className="text-sm text-mute">Tambahkan minimal satu layanan aktif sebelum membuat booking manual.</p>
                    <Button asChild size="sm">
                        <Link href={route('dashboard.services.create')}>Tambah Layanan</Link>
                    </Button>
                </div>
            ) : (
                <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="max-w-2xl space-y-5 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6"
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="manual-service">Layanan *</Label>
                        <NativeSelect
                            id="manual-service"
                            value={form.data.service_id}
                            onChange={(e) => {
                                setTimeError('');
                                form.setData((prev) => ({
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
                                <Label htmlFor="manual-quantity">Jumlah Item *</Label>
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
                            selectedService?.assignment_mode === 'staff' && (
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
                                            Sisa kuota: {dropoff.remaining_capacity} / {dropoff.total_capacity} item
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

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="manual-customer-name">Nama Pelanggan *</Label>
                            <Input
                                id="manual-customer-name"
                                placeholder="Budi Santoso"
                                value={form.data.customer_name}
                                onChange={(e) => form.setData('customer_name', e.target.value)}
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
                                value={form.data.customer_phone}
                                onChange={(e) => form.setData('customer_phone', e.target.value)}
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
                            {form.processing ? 'Menyimpan…' : 'Simpan Reservasi Manual'}
                        </Button>
                    </div>
                </form>
            )}
        </DashboardLayout>
    );
}
