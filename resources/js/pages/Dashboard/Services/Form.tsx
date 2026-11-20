import { Head, Link, useForm } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { FormEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';

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
        capacity: (service?.capacity ?? 1) as number | '',
        assignment_mode: (service?.assignment_mode ?? 'staff') as 'staff' | 'capacity',
        booking_mode: (service?.booking_mode ?? 'time_slot') as 'time_slot' | 'dropoff',
        turnaround_days: (service?.turnaround_days ?? 2) as number | '',
        supports_pickup: Boolean(service?.supports_pickup ?? false),
        dp_type: (service?.dp_type ?? 'none') as 'none' | 'fixed' | 'percentage',
        dp_value: (service?.dp_value ?? 0) as number | '',
        is_active: service?.is_active ?? true,
        staff_ids: service?.staff_ids ?? ([] as number[]),
    });

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

    const pageTitle = isEditing ? 'Edit Layanan' : 'Tambah Layanan Baru';

    return (
        <DashboardLayout title={pageTitle} back={{ href: route('dashboard.services'), label: 'Kembali ke Daftar Layanan' }}>
            <Head title={pageTitle} />


            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="max-w-2xl space-y-5 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6"
            >
                <div className="space-y-1.5">
                    <Label htmlFor="service-name">Nama Layanan *</Label>
                    <Input
                        id="service-name"
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

                <div className="space-y-1.5">
                    <Label>Tipe Penjadwalan Layanan</Label>
                    <div
                        className="grid grid-cols-2 rounded-sm bg-bone p-1"
                        role="group"
                        aria-label="Pilih tipe penjadwalan layanan"
                    >
                        <button
                            type="button"
                            aria-pressed={form.data.booking_mode === 'time_slot'}
                            onClick={() => form.setData('booking_mode', 'time_slot')}
                            className={`min-h-10 cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                form.data.booking_mode === 'time_slot'
                                    ? 'bg-canvas text-ink'
                                    : 'text-mute hover:text-ink'
                            }`}
                        >
                            Janji Temu (Pilih Jam)
                        </button>
                        <button
                            type="button"
                            aria-pressed={form.data.booking_mode === 'dropoff'}
                            onClick={() =>
                                form.setData((prev) => ({
                                    ...prev,
                                    booking_mode: 'dropoff',
                                    assignment_mode: 'capacity',
                                    capacity: Math.max(Number(prev.capacity || 0), 10),
                                }))
                            }
                            className={`min-h-10 cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                form.data.booking_mode === 'dropoff'
                                    ? 'bg-canvas text-ink'
                                    : 'text-mute hover:text-ink'
                            }`}
                        >
                            Drop-off (Tanpa Jam)
                        </button>
                    </div>
                    <p className="text-xs text-mute">
                        {form.data.booking_mode === 'dropoff'
                            ? 'Cocok untuk cuci sepatu, laundry, atau servis: pelanggan cukup pilih tanggal & jumlah tanpa slot jam.'
                            : 'Cocok untuk barbershop, klinik, atau studio: pelanggan memilih jam kedatangan yang tersedia.'}
                    </p>
                </div>

                {form.data.booking_mode === 'dropoff' ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-price">Harga per Item (Rp)</Label>
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
                                <Label htmlFor="service-turnaround">Estimasi (hari)</Label>
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
                                <p className="text-xs text-mute">0 = selesai hari ini</p>
                                {form.errors.turnaround_days && (
                                    <p className="text-xs text-destructive">{form.errors.turnaround_days}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="service-daily-capacity">Kuota Harian</Label>
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
                                <p className="text-xs text-mute">Maks item/hari</p>
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
                                <Label htmlFor="service-price">Harga (Rp)</Label>
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
                                <Label htmlFor="service-duration">Durasi (mnt)</Label>
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
                                <Label htmlFor="service-buffer">Buffer (mnt)</Label>
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
                                {form.errors.buffer_minutes && (
                                    <p className="text-xs text-destructive">{form.errors.buffer_minutes}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-assignment-mode">Mode Penugasan</Label>
                                <NativeSelect
                                    id="service-assignment-mode"
                                    value={form.data.assignment_mode}
                                    onChange={(e) =>
                                        form.setData('assignment_mode', e.target.value as 'staff' | 'capacity')
                                    }
                                >
                                    <option value="staff">Staff Tertentu</option>
                                    <option value="capacity">Kapasitas Ruangan / Kelas</option>
                                </NativeSelect>
                            </div>

                            {form.data.assignment_mode === 'capacity' && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="service-capacity">Kapasitas per Slot</Label>
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
                                    {form.errors.capacity && (
                                        <p className="text-xs text-destructive">{form.errors.capacity}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {form.data.assignment_mode === 'staff' && staffList.length > 0 && (
                            <div className="space-y-2">
                                <Label>Staff yang Melayani</Label>
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
                            </div>
                        )}
                    </>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="service-dp-type">Kebijakan DP</Label>
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
