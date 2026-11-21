import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Lock, Upload } from 'lucide-react';
import { FormEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig, getBusinessTypeOption, UNIT_LABEL_OPTIONS } from '@/lib/businessType';
import { parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';
import type { PageProps, ServiceUnitLabel } from '@/types';

interface ServiceData {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    duration_minutes: number;
    buffer_minutes: number;
    capacity: number;
    assignment_mode: 'staff' | 'capacity';
    booking_mode: 'time_slot' | 'dropoff';
    unit_label?: ServiceUnitLabel;
    turnaround_days: number;
    supports_pickup: boolean;
    dp_type: 'none' | 'fixed' | 'percentage';
    dp_value: number;
    is_active: boolean;
    staff_ids: number[];
}

interface StaffOption {
    id: number;
    name: string;
    title: string | null;
}

interface ServiceFormProps {
    service: ServiceData | null;
    staffList: StaffOption[];
}

export default function ServiceForm({ service, staffList }: ServiceFormProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const typeOption = getBusinessTypeOption(activeBusiness?.business_type);
    const isDropoff = config.services.usesDropoffFields;
    const isEditing = service !== null;
    const formRef = useRef<HTMLFormElement>(null);

    const form = useForm({
        name: service?.name ?? '',
        description: service?.description ?? '',
        image: null as File | null,
        remove_image: false,
        price: (service?.price ?? 100000) as number | '',
        duration_minutes: (service?.duration_minutes ?? 60) as number | '',
        buffer_minutes: (service?.buffer_minutes ?? 0) as number | '',
        capacity: (service?.capacity ?? (isDropoff ? 10 : 1)) as number | '',
        unit_label: (service?.unit_label ?? 'item') as ServiceUnitLabel,
        turnaround_days: (service?.turnaround_days ?? 2) as number | '',
        supports_pickup: Boolean(service?.supports_pickup ?? false),
        dp_type: (service?.dp_type ?? 'none') as 'none' | 'fixed' | 'percentage',
        dp_value: (service?.dp_value ?? 0) as number | '',
        is_active: service?.is_active ?? true,
        staff_ids: service?.staff_ids ?? ([] as number[]),
    });

    const selectedUnitOption =
        UNIT_LABEL_OPTIONS.find((u) => u.value === form.data.unit_label) ?? UNIT_LABEL_OPTIONS[0];

    const toggleStaff = (id: number) => {
        const exists = form.data.staff_ids.includes(id);
        form.setData(
            'staff_ids',
            exists ? form.data.staff_ids.filter((s) => s !== id) : [...form.data.staff_ids, id]
        );
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        const normalizePayload = (data: typeof form.data) => ({
            ...data,
            price: Number(data.price || 0),
            duration_minutes: Number(data.duration_minutes || 0),
            buffer_minutes: Number(data.buffer_minutes || 0),
            capacity: Number(data.capacity || 0),
            turnaround_days: Number(data.turnaround_days || 0),
            dp_value: Number(data.dp_value || 0),
        });

        if (isEditing) {
            form.transform((data) => ({ ...normalizePayload(data), _method: 'put' }));
            form.post(route('dashboard.services.update', service.id), {
                forceFormData: true,
                onError: () => scrollToFirstInvalid(formRef.current),
            });
        } else {
            form.transform(normalizePayload);
            form.post(route('dashboard.services.store'), {
                forceFormData: true,
                onError: () => scrollToFirstInvalid(formRef.current),
            });
        }
    };

    const pageTitle = isEditing ? config.services.formTitleEdit : config.services.formTitleCreate;

    return (
        <DashboardLayout
            title={pageTitle}
            back={{ href: route('dashboard.services'), label: `Kembali ke ${config.services.pageTitle}` }}
        >
            <Head title={pageTitle} />

            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="max-w-2xl space-y-5 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6"
            >
                <div className="flex items-start gap-3 rounded-sm border border-hairline-soft bg-bone/70 px-4 py-3 text-xs">
                    <Lock className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                    <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-ink">
                            Mode Operasional: {config.label}
                        </p>
                        <p className="leading-relaxed text-mute">
                            {typeOption.tagline}
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="service-name">
                        {config.type === 'space_booking' ? 'Nama Fasilitas / Paket *' : 'Nama Layanan *'}
                    </Label>
                    <Input
                        id="service-name"
                        placeholder={config.services.namePlaceholder}
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        aria-invalid={Boolean(form.errors.name)}
                        aria-describedby={form.errors.name ? 'service-name-error' : undefined}
                        required
                    />
                    {form.errors.name && (
                        <p id="service-name-error" className="text-xs text-destructive">
                            {form.errors.name}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="service-description">Deskripsi</Label>
                    <Textarea
                        id="service-description"
                        value={form.data.description}
                        onChange={(e) => form.setData('description', e.target.value)}
                        aria-invalid={Boolean(form.errors.description)}
                    />
                    {form.errors.description && (
                        <p className="text-xs text-destructive">{form.errors.description}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="service-image-upload">Foto Layanan (Opsional)</Label>
                    {service?.image_url && !form.data.remove_image && !form.data.image && (
                        <div className="flex items-center gap-3">
                            <img
                                src={service.image_url}
                                alt="Preview foto layanan"
                                className="size-16 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                onClick={() => form.setData('remove_image', true)}
                            >
                                Hapus Foto
                            </Button>
                        </div>
                    )}
                    <label
                        htmlFor="service-image-upload"
                        className="flex cursor-pointer items-center gap-2 rounded-sm border border-dashed border-control-border bg-field px-4 py-3 text-sm text-ink transition-colors hover:bg-bone focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
                    >
                        <Upload className="size-4 shrink-0 text-mute" aria-hidden="true" />
                        <span className="break-words">
                            {form.data.image
                                ? form.data.image.name
                                : 'Unggah thumbnail layanan (JPG/PNG/WebP, maks 3MB)'}
                        </span>
                        <input
                            id="service-image-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                form.setData((prev) => ({
                                    ...prev,
                                    image: file,
                                    remove_image: false,
                                }));
                            }}
                        />
                    </label>
                    {form.errors.image && (
                        <p className="text-xs text-destructive">{form.errors.image}</p>
                    )}
                </div>

                {isDropoff ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-unit-label">Satuan Hitung *</Label>
                                <NativeSelect
                                    id="service-unit-label"
                                    value={form.data.unit_label}
                                    onChange={(e) =>
                                        form.setData('unit_label', e.target.value as ServiceUnitLabel)
                                    }
                                    aria-invalid={Boolean(form.errors.unit_label)}
                                >
                                    {UNIT_LABEL_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label} — {opt.hint}
                                        </option>
                                    ))}
                                </NativeSelect>
                                <p className="text-xs text-mute">{selectedUnitOption.hint}.</p>
                                {form.errors.unit_label && (
                                    <p className="text-xs text-destructive">{form.errors.unit_label}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="service-price">
                                    Harga per {form.data.unit_label} (Rp) *
                                </Label>
                                <Input
                                    id="service-price"
                                    type="number"
                                    min={0}
                                    value={form.data.price}
                                    onChange={(e) => form.setData('price', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.price)}
                                    required
                                />
                                {form.errors.price && (
                                    <p className="text-xs text-destructive">{form.errors.price}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-turnaround">Estimasi Selesai (hari) *</Label>
                                <Input
                                    id="service-turnaround"
                                    type="number"
                                    min={0}
                                    max={90}
                                    value={form.data.turnaround_days}
                                    onChange={(e) =>
                                        form.setData('turnaround_days', parseNumericInput(e.target.value))
                                    }
                                    aria-invalid={Boolean(form.errors.turnaround_days)}
                                    required
                                />
                                <p className="text-xs text-mute">0 = selesai di hari yang sama</p>
                                {form.errors.turnaround_days && (
                                    <p className="text-xs text-destructive">{form.errors.turnaround_days}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="service-daily-capacity">
                                    Maks. {form.data.unit_label} per Hari *
                                </Label>
                                <Input
                                    id="service-daily-capacity"
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={form.data.capacity}
                                    onChange={(e) => form.setData('capacity', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.capacity)}
                                    required
                                />
                                <p className="text-xs text-mute">
                                    Pesanan baru ditolak jika kuota {form.data.unit_label} hari tersebut sudah penuh.
                                </p>
                                {form.errors.capacity && (
                                    <p className="text-xs text-destructive">{form.errors.capacity}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-sm bg-bone px-4 py-3">
                            <div>
                                <Label htmlFor="service-supports-pickup" className="cursor-pointer text-sm font-semibold text-ink">
                                    Sediakan opsi Jemput &amp; Antar
                                </Label>
                                <p className="text-xs text-mute">
                                    Pelanggan dapat memilih kurir jemput (beserta sesi waktu &amp; alamat) selain antar ke toko.
                                </p>
                            </div>
                            <Switch
                                id="service-supports-pickup"
                                checked={form.data.supports_pickup}
                                onCheckedChange={(checked) => form.setData('supports_pickup', checked)}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-price">{config.services.priceLabel} (Rp) *</Label>
                                <Input
                                    id="service-price"
                                    type="number"
                                    min={0}
                                    value={form.data.price}
                                    onChange={(e) => form.setData('price', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.price)}
                                    required
                                />
                                {form.errors.price && (
                                    <p className="text-xs text-destructive">{form.errors.price}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="service-duration">Durasi (menit) *</Label>
                                <Input
                                    id="service-duration"
                                    type="number"
                                    min={15}
                                    max={480}
                                    value={form.data.duration_minutes}
                                    onChange={(e) =>
                                        form.setData('duration_minutes', parseNumericInput(e.target.value))
                                    }
                                    aria-invalid={Boolean(form.errors.duration_minutes)}
                                    required
                                />
                                {form.errors.duration_minutes && (
                                    <p className="text-xs text-destructive">{form.errors.duration_minutes}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="service-buffer">Jeda (menit) *</Label>
                                <Input
                                    id="service-buffer"
                                    type="number"
                                    min={0}
                                    max={120}
                                    value={form.data.buffer_minutes}
                                    onChange={(e) =>
                                        form.setData('buffer_minutes', parseNumericInput(e.target.value))
                                    }
                                    aria-invalid={Boolean(form.errors.buffer_minutes)}
                                    required
                                />
                                <p className="text-xs text-mute">Waktu persiapan sebelum sesi berikutnya</p>
                                {form.errors.buffer_minutes && (
                                    <p className="text-xs text-destructive">{form.errors.buffer_minutes}</p>
                                )}
                            </div>
                        </div>

                        {config.services.usesCapacity && (
                            <div className="space-y-1.5">
                                <Label htmlFor="service-capacity">{config.services.capacityLabel} *</Label>
                                <Input
                                    id="service-capacity"
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={form.data.capacity}
                                    onChange={(e) =>
                                        form.setData('capacity', parseNumericInput(e.target.value))
                                    }
                                    aria-invalid={Boolean(form.errors.capacity)}
                                    required
                                />
                                <p className="text-xs text-mute">{config.services.capacityHint}</p>
                                {form.errors.capacity && (
                                    <p className="text-xs text-destructive">{form.errors.capacity}</p>
                                )}
                            </div>
                        )}

                        {config.services.usesStaffAssignment && (
                            <div className="space-y-2">
                                <Label>Staff yang Melayani</Label>
                                {staffList.length > 0 ? (
                                    <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih staff yang melayani">
                                        {staffList.map((st) => {
                                            const checked = form.data.staff_ids.includes(st.id);
                                            return (
                                                <button
                                                    key={st.id}
                                                    type="button"
                                                    aria-pressed={checked}
                                                    onClick={() => toggleStaff(st.id)}
                                                    className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                                        checked ? 'bg-ink text-canvas' : 'bg-bone text-ink'
                                                    }`}
                                                >
                                                    {st.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="rounded-sm bg-bone px-4 py-3 text-xs text-mute">
                                        Belum ada staff aktif. Tambahkan staff di menu{' '}
                                        <Link href={route('dashboard.staff')} className="font-semibold text-electric hover:underline">
                                            Tim &amp; Staff
                                        </Link>{' '}
                                        agar jadwal bisa dipesan pelanggan.
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="service-dp-type">Uang Muka (DP)</Label>
                        <NativeSelect
                            id="service-dp-type"
                            value={form.data.dp_type}
                            onChange={(e) =>
                                form.setData('dp_type', e.target.value as 'none' | 'fixed' | 'percentage')
                            }
                        >
                            <option value="none">Tanpa DP</option>
                            <option value="fixed">Nominal Tetap (Rp)</option>
                            <option value="percentage">Persentase (%)</option>
                        </NativeSelect>
                    </div>
                    {form.data.dp_type !== 'none' && (
                        <div className="space-y-1.5">
                            <Label htmlFor="service-dp-value">
                                {form.data.dp_type === 'fixed' ? 'Nominal DP (Rp)' : 'Persen DP (%)'}
                            </Label>
                            <Input
                                id="service-dp-value"
                                type="number"
                                min={1}
                                max={form.data.dp_type === 'percentage' ? 100 : undefined}
                                value={form.data.dp_value}
                                onChange={(e) => form.setData('dp_value', parseNumericInput(e.target.value))}
                                aria-invalid={Boolean(form.errors.dp_value)}
                                required
                            />
                            {form.errors.dp_value && (
                                <p className="text-xs text-destructive">{form.errors.dp_value}</p>
                            )}
                        </div>
                    )}
                </div>

                {isEditing && (
                    <div className="flex items-center justify-between rounded-sm bg-bone px-4 py-3">
                        <div>
                            <Label htmlFor="service-edit-active" className="cursor-pointer text-sm font-semibold text-ink">
                                Tampilkan di portal booking
                            </Label>
                            <p className="text-xs text-mute">Nonaktifkan sementara bila layanan tidak tersedia.</p>
                        </div>
                        <Switch
                            id="service-edit-active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) => form.setData('is_active', checked)}
                        />
                    </div>
                )}

                {Object.keys(form.errors).length > 0 && (
                    <div
                        role="alert"
                        data-form-error="true"
                        className="rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-2.5 text-xs text-destructive"
                    >
                        Periksa kembali isian yang ditandai merah di atas sebelum menyimpan.
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    <Button asChild type="button" variant="outline">
                        <Link href={route('dashboard.services')}>Batal</Link>
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Menyimpan…' : 'Simpan Layanan'}
                    </Button>
                </div>
            </form>
        </DashboardLayout>
    );
}
