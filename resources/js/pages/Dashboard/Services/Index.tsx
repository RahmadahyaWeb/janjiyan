import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { formatRupiah } from '@/lib/format';

interface ServiceRow {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number;
    duration_minutes: number;
    buffer_minutes: number;
    capacity: number;
    assignment_mode: 'staff' | 'capacity';
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

interface ServicesIndexProps {
    services: ServiceRow[];
    staffList: StaffOption[];
}

export default function ServicesIndex({ services, staffList }: ServicesIndexProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deletingService, setDeletingService] = useState<ServiceRow | null>(null);

    const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

    const form = useForm({
        name: '',
        description: '',
        image: null as File | null,
        remove_image: false,
        price: 100000,
        duration_minutes: 60,
        buffer_minutes: 0,
        capacity: 1,
        assignment_mode: 'staff' as 'staff' | 'capacity',
        dp_type: 'none' as 'none' | 'fixed' | 'percentage',
        dp_value: 0,
        is_active: true,
        staff_ids: [] as number[],
    });

    const openCreate = () => {
        setEditingId(null);
        setEditingImageUrl(null);
        form.reset();
        setModalOpen(true);
    };

    const openEdit = (service: ServiceRow) => {
        setEditingId(service.id);
        setEditingImageUrl(service.image_url);
        form.setData({
            name: service.name,
            description: service.description ?? '',
            image: null,
            remove_image: false,
            price: service.price,
            duration_minutes: service.duration_minutes,
            buffer_minutes: service.buffer_minutes,
            capacity: service.capacity,
            assignment_mode: service.assignment_mode,
            dp_type: service.dp_type,
            dp_value: service.dp_value,
            is_active: service.is_active,
            staff_ids: service.staff_ids,
        });
        setModalOpen(true);
    };

    const toggleServiceActive = (service: ServiceRow, nextActive: boolean) => {
        router.put(
            route('dashboard.services.update', service.id),
            {
                name: service.name,
                description: service.description ?? '',
                price: service.price,
                duration_minutes: service.duration_minutes,
                buffer_minutes: service.buffer_minutes,
                capacity: service.capacity,
                assignment_mode: service.assignment_mode,
                dp_type: service.dp_type,
                dp_value: service.dp_value,
                is_active: nextActive,
                staff_ids: service.staff_ids,
            },
            { preserveScroll: true }
        );
    };

    const filteredServices = services.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (editingId) {
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(route('dashboard.services.update', editingId), {
                forceFormData: true,
                onSuccess: () => setModalOpen(false),
            });
        } else {
            form.transform((data) => data);
            form.post(route('dashboard.services.store'), {
                forceFormData: true,
                onSuccess: () => setModalOpen(false),
            });
        }
    };

    const toggleStaff = (id: number) => {
        const exists = form.data.staff_ids.includes(id);
        form.setData(
            'staff_ids',
            exists ? form.data.staff_ids.filter((s) => s !== id) : [...form.data.staff_ids, id]
        );
    };

    return (
        <DashboardLayout title="Daftar Layanan">
            <Head title="Layanan" />

            <div className="flex flex-wrap items-center justify-between gap-3">
                {services.length > 0 ? (
                    <div className="relative flex w-full items-center sm:w-72">
                        <Label htmlFor="services-search" className="sr-only">
                            Cari layanan
                        </Label>
                        <Search className="pointer-events-none absolute top-4 left-4 size-4 text-ash" aria-hidden="true" />
                        <Input
                            id="services-search"
                            className="pl-10 pr-10"
                            placeholder="Cari layanan…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                aria-label="Hapus pencarian layanan"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-mute hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div />
                )}

                <Button type="button" onClick={openCreate}>
                    <Plus className="size-4" aria-hidden="true" />
                    Tambah Layanan
                </Button>
            </div>

            {services.length === 0 ? (
                <div className="space-y-3 rounded-[24px] bg-bone p-12 text-center">
                    <p className="text-base font-semibold text-ink">Belum ada layanan tersedia.</p>
                    <p className="text-sm text-mute">
                        Tambahkan layanan pertama Anda untuk mulai menerima booking dari pelanggan.
                    </p>
                    <Button type="button" size="sm" onClick={openCreate}>
                        <Plus className="size-4" aria-hidden="true" />
                        Tambah Layanan
                    </Button>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="space-y-3 rounded-[24px] bg-bone p-12 text-center">
                    <p className="text-base font-semibold text-ink">
                        Tidak ada layanan dengan nama &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                        Hapus Pencarian
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {filteredServices.map((s) => (
                        <div
                            key={s.id}
                            className="flex flex-col justify-between rounded-[24px] border border-hairline-soft bg-canvas p-6"
                        >
                            <div>
                                {s.image_url && (
                                    <img
                                        src={s.image_url}
                                        alt={`Foto layanan ${s.name}`}
                                        className="mb-4 aspect-[16/9] w-full rounded-[14px] object-cover outline-1 -outline-offset-1 outline-black/10"
                                    />
                                )}
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="min-w-0 text-lg font-semibold text-ink">{s.name}</h2>
                                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                        {!s.is_active && <Badge variant="danger">Nonaktif</Badge>}
                                        <Badge variant={s.assignment_mode === 'staff' ? 'secondary' : 'outline'}>
                                            {s.assignment_mode === 'staff' ? 'Staff' : `Kapasitas ${s.capacity}`}
                                        </Badge>
                                    </div>
                                </div>
                                {s.description && <p className="mt-2 text-sm text-mute">{s.description}</p>}
                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-mute">
                                    <span className="rounded-full bg-bone px-3 py-1 font-semibold tabular-nums text-ink">
                                        {formatRupiah(s.price)}
                                    </span>
                                    <span className="rounded-full bg-bone px-3 py-1 tabular-nums">
                                        {s.duration_minutes} mnt (+{s.buffer_minutes} mnt buffer)
                                    </span>
                                    {s.dp_type !== 'none' && (
                                        <span className="rounded-full bg-bone px-3 py-1 font-semibold tabular-nums text-electric">
                                            DP {s.dp_type === 'fixed' ? formatRupiah(s.dp_value) : `${s.dp_value}%`}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id={`service-active-${s.id}`}
                                        checked={s.is_active}
                                        onCheckedChange={(checked) => toggleServiceActive(s, checked)}
                                        aria-label={`Aktifkan layanan ${s.name} di portal booking`}
                                    />
                                    <Label htmlFor={`service-active-${s.id}`} className="cursor-pointer text-xs text-mute">
                                        {s.is_active ? 'Tampil di portal' : 'Disembunyikan'}
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(s)}>
                                        <Pencil className="size-3.5" aria-hidden="true" />
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label={`Hapus layanan ${s.name}`}
                                        className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                        onClick={() => setDeletingService(s)}
                                    >
                                        <Trash2 className="size-3.5" aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-ink">
                            {editingId ? 'Edit Layanan' : 'Tambah Layanan Baru'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="service-name">Nama Layanan</Label>
                            <Input
                                id="service-name"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                aria-invalid={Boolean(form.errors.name)}
                                aria-describedby={form.errors.name ? 'service-name-error' : undefined}
                                required
                            />
                            {form.errors.name && (
                                <p id="service-name-error" className="text-xs text-destructive">{form.errors.name}</p>
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
                            {editingImageUrl && !form.data.remove_image && !form.data.image && (
                                <div className="flex items-center gap-3">
                                    <img
                                        src={editingImageUrl}
                                        alt="Preview foto layanan"
                                        className="size-16 rounded-[12px] object-cover outline-1 -outline-offset-1 outline-black/10"
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
                                className="flex cursor-pointer items-center gap-2 rounded-[16px] border border-dashed border-control-border bg-field px-4 py-3 text-sm text-ink transition-colors hover:bg-bone focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
                            >
                                <Upload className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                <span className="break-words">
                                    {form.data.image ? form.data.image.name : 'Unggah thumbnail layanan (JPG/PNG/WebP, maks 3MB)'}
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

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-price">Harga (Rp)</Label>
                                <Input
                                    id="service-price"
                                    type="number"
                                    min={0}
                                    value={form.data.price}
                                    onChange={(e) => form.setData('price', Number(e.target.value))}
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
                                    value={form.data.duration_minutes}
                                    onChange={(e) => form.setData('duration_minutes', Number(e.target.value))}
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
                                    value={form.data.buffer_minutes}
                                    onChange={(e) => form.setData('buffer_minutes', Number(e.target.value))}
                                    aria-invalid={Boolean(form.errors.buffer_minutes)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-assignment-mode">Mode Penugasan</Label>
                                <NativeSelect
                                    id="service-assignment-mode"
                                    value={form.data.assignment_mode}
                                    onChange={(e) => form.setData('assignment_mode', e.target.value as 'staff' | 'capacity')}
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
                                        value={form.data.capacity}
                                        onChange={(e) => form.setData('capacity', Number(e.target.value))}
                                    />
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

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="service-dp-type">Kebijakan DP</Label>
                                <NativeSelect
                                    id="service-dp-type"
                                    value={form.data.dp_type}
                                    onChange={(e) => form.setData('dp_type', e.target.value as 'none' | 'fixed' | 'percentage')}
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
                                        value={form.data.dp_value}
                                        onChange={(e) => form.setData('dp_value', Number(e.target.value))}
                                    />
                                </div>
                            )}
                        </div>

                        {editingId !== null && (
                            <div className="flex items-center justify-between rounded-[16px] bg-bone px-4 py-3">
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

                        <Button type="submit" className="w-full" disabled={form.processing}>
                            {form.processing ? 'Menyimpan…' : 'Simpan Layanan'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deletingService !== null}
                onOpenChange={(open) => !open && setDeletingService(null)}
                title={`Hapus layanan "${deletingService?.name ?? ''}"?`}
                description="Layanan yang dihapus tidak lagi muncul di halaman booking publik. Tindakan ini tidak dapat dibatalkan."
                confirmLabel="Hapus Layanan"
                onConfirm={() => {
                    if (!deletingService) return;
                    router.delete(route('dashboard.services.destroy', deletingService.id), {
                        onFinish: () => setDeletingService(null),
                    });
                }}
            />
        </DashboardLayout>
    );
}
