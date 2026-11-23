import { Link, router, useForm, usePage } from '@inertiajs/react';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getBusinessTypeConfig, UNIT_LABEL_OPTIONS } from '@/lib/businessType';
import { formatRupiah } from '@/lib/format';
import { cn, parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';
import type { PageProps, ServiceAddon, ServiceUnitLabel } from '@/types';

export interface ServiceAddonTargetService {
    id: number;
    name: string;
    is_active?: boolean;
}

interface ServiceAddonsPanelProps {
    addons: ServiceAddon[];
    services: ServiceAddonTargetService[];
    canCreateAddon: boolean;
    maxAddonsPerBusiness: number | null;
    canOpenBilling?: boolean;
}

interface AddonFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingAddon: ServiceAddon | null;
    services: ServiceAddonTargetService[];
    isDropoff: boolean;
    supportsCommissions: boolean;
}

function AddonFormModal({
    open,
    onOpenChange,
    editingAddon,
    services,
    isDropoff,
    supportsCommissions,
}: AddonFormModalProps) {
    const isEditing = editingAddon !== null;
    const formRef = useRef<HTMLFormElement>(null);

    const form = useForm({
        name: editingAddon?.name ?? '',
        description: editingAddon?.description ?? '',
        price: (editingAddon?.price ?? 15000) as number | '',
        unit_label: (editingAddon?.unit_label ?? 'item') as ServiceUnitLabel,
        duration_minutes: (editingAddon?.duration_minutes ?? 0) as number | '',
        is_commissionable: editingAddon?.is_commissionable ?? false,
        applies_to_all_services: editingAddon?.applies_to_all_services ?? true,
        service_ids: editingAddon?.service_ids ?? ([] as number[]),
        is_active: editingAddon?.is_active ?? true,
        sort_order: (editingAddon?.sort_order ?? 0) as number | '',
    });

    const toggleServiceId = (serviceId: number) => {
        const exists = form.data.service_ids.includes(serviceId);
        form.setData(
            'service_ids',
            exists
                ? form.data.service_ids.filter((id) => id !== serviceId)
                : [...form.data.service_ids, serviceId]
        );
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        const normalizePayload = (data: typeof form.data) => ({
            name: data.name.trim(),
            description: data.description.trim() || null,
            price: Math.max(0, Number(data.price || 0)),
            unit_label: data.unit_label,
            duration_minutes: isDropoff ? 0 : Math.max(0, Number(data.duration_minutes || 0)),
            is_commissionable: supportsCommissions ? Boolean(data.is_commissionable) : false,
            applies_to_all_services: Boolean(data.applies_to_all_services),
            service_ids: data.applies_to_all_services ? [] : data.service_ids,
            is_active: Boolean(data.is_active),
            sort_order: Math.max(0, Number(data.sort_order || 0)),
        });

        form.transform(normalizePayload);

        if (isEditing && editingAddon) {
            form.put(route('dashboard.addons.update', editingAddon.id), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
                onError: () => scrollToFirstInvalid(formRef.current),
            });
            return;
        }

        form.post(route('dashboard.addons.store'), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
            onError: () => scrollToFirstInvalid(formRef.current),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-lg sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-ink">
                        {isEditing ? 'Edit Add-on Layanan' : 'Tambah Add-on Layanan'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-mute">
                        Add-on muncul sebagai opsi tambahan saat pelanggan checkout maupun di kasir POS.
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="addon-name">Nama Add-on *</Label>
                        <Input
                            id="addon-name"
                            maxLength={120}
                            placeholder={
                                isDropoff
                                    ? 'Contoh: Whitening Midsole / Express 24 Jam'
                                    : 'Contoh: Hair Tonic / Sewa Raket Padel'
                            }
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            aria-invalid={Boolean(form.errors.name)}
                            aria-describedby={form.errors.name ? 'addon-name-error' : undefined}
                            required
                        />
                        {form.errors.name && (
                            <p id="addon-name-error" className="text-xs text-destructive">{form.errors.name}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="addon-description">Deskripsi (Opsional)</Label>
                        <Textarea
                            id="addon-description"
                            rows={2}
                            maxLength={500}
                            placeholder="Penjelasan singkat tentang add-on ini"
                            value={form.data.description}
                            onChange={(e) => form.setData('description', e.target.value)}
                            aria-invalid={Boolean(form.errors.description)}
                            aria-describedby={form.errors.description ? 'addon-description-error' : undefined}
                        />
                        {form.errors.description && (
                            <p id="addon-description-error" className="text-xs text-destructive">{form.errors.description}</p>
                        )}
                    </div>

                    <div className={cn('grid gap-3', isDropoff ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
                        <div className="space-y-1.5">
                            <Label htmlFor="addon-price">Harga (Rp) *</Label>
                            <Input
                                id="addon-price"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                className="tabular-nums"
                                value={form.data.price}
                                onChange={(e) => form.setData('price', parseNumericInput(e.target.value))}
                                aria-invalid={Boolean(form.errors.price)}
                                aria-describedby={form.errors.price ? 'addon-price-error' : undefined}
                                required
                            />
                            {form.errors.price && (
                                <p id="addon-price-error" className="text-xs text-destructive">{form.errors.price}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="addon-unit">Satuan *</Label>
                            <NativeSelect
                                id="addon-unit"
                                value={form.data.unit_label}
                                onChange={(e) =>
                                    form.setData('unit_label', e.target.value as ServiceUnitLabel)
                                }
                                aria-invalid={Boolean(form.errors.unit_label)}
                                aria-describedby={form.errors.unit_label ? 'addon-unit-error' : undefined}
                            >
                                {UNIT_LABEL_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </NativeSelect>
                            {form.errors.unit_label && (
                                <p id="addon-unit-error" className="text-xs text-destructive">{form.errors.unit_label}</p>
                            )}
                        </div>

                        {!isDropoff && (
                            <div className="space-y-1.5">
                                <Label htmlFor="addon-duration">Tambahan Durasi (mnt)</Label>
                                <Input
                                    id="addon-duration"
                                    type="number"
                                    min={0}
                                    max={240}
                                    inputMode="numeric"
                                    className="tabular-nums"
                                    value={form.data.duration_minutes}
                                    onChange={(e) =>
                                        form.setData('duration_minutes', parseNumericInput(e.target.value))
                                    }
                                    aria-invalid={Boolean(form.errors.duration_minutes)}
                                    aria-describedby={form.errors.duration_minutes ? 'addon-duration-error' : undefined}
                                />
                                {form.errors.duration_minutes && (
                                    <p id="addon-duration-error" className="text-xs text-destructive">{form.errors.duration_minutes}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {!isDropoff && (
                        <p className="text-xs text-mute">
                            Isi <span className="font-semibold text-ink">0 menit</span> jika add-on tidak memengaruhi durasi slot jadwal.
                        </p>
                    )}

                    <div className="space-y-3 rounded-sm bg-bone p-3.5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <Label htmlFor="addon-all-services" className="cursor-pointer text-sm font-semibold text-ink">
                                    Berlaku untuk semua layanan
                                </Label>
                                <p className="text-xs text-mute">
                                    Nonaktifkan untuk membatasi add-on hanya ke layanan tertentu.
                                </p>
                            </div>
                            <Switch
                                id="addon-all-services"
                                className="shrink-0"
                                checked={form.data.applies_to_all_services}
                                onCheckedChange={(checked) => form.setData('applies_to_all_services', checked)}
                            />
                        </div>

                        {!form.data.applies_to_all_services && (
                            <div className="space-y-2 border-t border-divider pt-3">
                                <Label className="text-xs font-semibold text-ink">
                                    Pilih Layanan Target *
                                </Label>
                                {services.length === 0 ? (
                                    <p className="text-xs text-mute">Belum ada layanan tersedia.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih layanan target add-on">
                                        {services.map((svc) => {
                                            const active = form.data.service_ids.includes(svc.id);
                                            return (
                                                <button
                                                    key={svc.id}
                                                    type="button"
                                                    aria-pressed={active}
                                                    onClick={() => toggleServiceId(svc.id)}
                                                    className={cn(
                                                        'min-h-9 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                        active
                                                            ? 'bg-ink text-canvas'
                                                            : 'border border-hairline bg-canvas text-ink hover:bg-hairline-soft'
                                                    )}
                                                >
                                                    {svc.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {form.data.service_ids.length === 0 && (
                                    <p className="text-xs text-warning">
                                        Pilih minimal 1 layanan agar add-on muncul saat checkout.
                                    </p>
                                )}
                                {form.errors.service_ids && (
                                    <p className="text-xs text-destructive">{form.errors.service_ids}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {supportsCommissions && (
                        <div className="flex items-center justify-between gap-3 rounded-sm bg-bone px-3.5 py-3">
                            <div className="min-w-0">
                                <Label htmlFor="addon-commissionable" className="cursor-pointer text-sm font-semibold text-ink">
                                    Masuk hitungan komisi staff
                                </Label>
                                <p className="text-xs text-mute">
                                    Aktifkan bila omzet add-on ini dihitung sebagai komisi staff.
                                </p>
                            </div>
                            <Switch
                                id="addon-commissionable"
                                className="shrink-0"
                                checked={form.data.is_commissionable}
                                onCheckedChange={(checked) => form.setData('is_commissionable', checked)}
                            />
                        </div>
                    )}

                    <div className={cn('grid gap-3', isEditing ? 'sm:grid-cols-2' : 'grid-cols-1')}>
                        <div className="space-y-1.5">
                            <Label htmlFor="addon-sort-order">Urutan Tampil</Label>
                            <Input
                                id="addon-sort-order"
                                type="number"
                                min={0}
                                max={999}
                                inputMode="numeric"
                                className="tabular-nums"
                                value={form.data.sort_order}
                                onChange={(e) => form.setData('sort_order', parseNumericInput(e.target.value))}
                            />
                        </div>

                        {isEditing && (
                            <div className="flex items-center justify-between gap-3 rounded-sm bg-bone px-3.5 py-2.5">
                                <Label htmlFor="addon-is-active" className="cursor-pointer text-sm font-semibold text-ink">
                                    Aktif di checkout
                                </Label>
                                <Switch
                                    id="addon-is-active"
                                    className="shrink-0"
                                    checked={form.data.is_active}
                                    onCheckedChange={(checked) => form.setData('is_active', checked)}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={form.processing}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing
                                ? 'Menyimpan…'
                                : isEditing
                                  ? 'Simpan Perubahan'
                                  : 'Simpan Add-on'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function ServiceAddonsPanel({
    addons,
    services,
    canCreateAddon,
    maxAddonsPerBusiness,
    canOpenBilling = false,
}: ServiceAddonsPanelProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const isDropoff = config.type === 'dropoff';
    const supportsCommissions = config.nav.showCommissions;

    const [formOpen, setFormOpen] = useState(false);
    const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
    const [deletingAddon, setDeletingAddon] = useState<ServiceAddon | null>(null);
    const [modalInstanceKey, setModalInstanceKey] = useState(0);

    const serviceNameById = useMemo(() => {
        const map = new Map<number, string>();
        for (const s of services) {
            map.set(s.id, s.name);
        }
        return map;
    }, [services]);

    const openCreateModal = () => {
        setEditingAddon(null);
        setModalInstanceKey((k) => k + 1);
        setFormOpen(true);
    };

    const openEditModal = (addon: ServiceAddon) => {
        setEditingAddon(addon);
        setModalInstanceKey((k) => k + 1);
        setFormOpen(true);
    };

    const toggleAddonActive = (addon: ServiceAddon, nextActive: boolean) => {
        router.put(
            route('dashboard.addons.update', addon.id),
            {
                name: addon.name,
                description: addon.description,
                price: addon.price,
                unit_label: addon.unit_label,
                duration_minutes: isDropoff ? 0 : addon.duration_minutes,
                is_commissionable: supportsCommissions ? addon.is_commissionable : false,
                applies_to_all_services: addon.applies_to_all_services,
                service_ids: addon.applies_to_all_services ? [] : addon.service_ids,
                is_active: nextActive,
                sort_order: addon.sort_order,
            },
            { preserveScroll: true }
        );
    };

    return (
        <section aria-labelledby="addons-section-heading" className="space-y-4 border-t border-divider pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 id="addons-section-heading" className="text-xl font-semibold text-ink">
                            Add-on Layanan
                        </h2>
                        {maxAddonsPerBusiness !== null && (
                            <Badge variant="secondary" className="tabular-nums">
                                {addons.length} / {maxAddonsPerBusiness} add-on
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-mute">
                        Opsi tambahan berbayar yang bisa dipilih pelanggan saat checkout atau ditambahkan kasir saat transaksi.
                    </p>
                </div>

                {canCreateAddon ? (
                    <Button type="button" size="sm" className="h-10 px-4" onClick={openCreateModal}>
                        <Plus className="size-4" aria-hidden="true" />
                        Tambah Add-on
                    </Button>
                ) : canOpenBilling ? (
                    <Button asChild variant="outline" size="sm" className="h-auto min-h-10 max-w-full whitespace-normal px-4 py-2 text-center text-mute">
                        <Link href={route('dashboard.billing')}>
                            Batas Add-on Tercapai · Upgrade Paket
                        </Link>
                    </Button>
                ) : (
                    <Button type="button" variant="outline" size="sm" disabled className="h-10 px-4">
                        Batas Add-on Tercapai
                    </Button>
                )}
            </div>

            {addons.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-6 text-center sm:p-10">
                    <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-canvas text-ink">
                        <Sparkles className="size-5" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-base font-semibold text-ink">Belum ada add-on layanan.</p>
                        <p className="text-sm text-mute">
                            {isDropoff
                                ? 'Tambahkan opsi seperti express, pewangi premium, atau perawatan ekstra.'
                                : 'Tambahkan opsi seperti perawatan ekstra, durasi tambahan, atau sewa perlengkapan.'}
                        </p>
                    </div>
                    {canCreateAddon && (
                        <Button type="button" size="sm" onClick={openCreateModal}>
                            <Plus className="size-4" aria-hidden="true" />
                            Tambah Add-on Pertama
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {addons.map((addon) => {
                        const assignedNames = addon.service_ids
                            .map((id) => serviceNameById.get(id))
                            .filter((n): n is string => Boolean(n));

                        return (
                            <div
                                key={addon.id}
                                className="flex min-w-0 flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-4 sm:p-5"
                            >
                                <div className="min-w-0 space-y-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <h3 className="min-w-0 flex-1 text-base font-semibold break-words text-ink">
                                            {addon.name}
                                        </h3>
                                        {!addon.is_active && <Badge variant="danger">Nonaktif</Badge>}
                                    </div>

                                    {addon.description && (
                                        <p className="text-sm break-words text-mute">{addon.description}</p>
                                    )}

                                    <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                                        <span className="rounded-full bg-bone px-3 py-1 font-semibold tabular-nums text-ink">
                                            {formatRupiah(addon.price)} / {addon.unit_label}
                                        </span>
                                        {!isDropoff && addon.duration_minutes > 0 && (
                                            <span className="rounded-full bg-bone px-3 py-1 tabular-nums text-mute">
                                                +{addon.duration_minutes} mnt
                                            </span>
                                        )}
                                        {supportsCommissions && addon.is_commissionable && (
                                            <span className="rounded-full bg-bone px-3 py-1 font-medium text-ink">
                                                Komisi staff
                                            </span>
                                        )}
                                        <span className="rounded-full bg-bone px-3 py-1 text-mute">
                                            {addon.applies_to_all_services
                                                ? 'Semua layanan'
                                                : assignedNames.length > 0
                                                  ? assignedNames.slice(0, 2).join(', ') +
                                                    (assignedNames.length > 2
                                                        ? ` +${assignedNames.length - 2}`
                                                        : '')
                                                  : 'Belum ada layanan target'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-3.5">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id={`addon-active-${addon.id}`}
                                            checked={addon.is_active}
                                            onCheckedChange={(checked) => toggleAddonActive(addon, checked)}
                                            aria-label={`Aktifkan add-on ${addon.name}`}
                                        />
                                        <Label
                                            htmlFor={`addon-active-${addon.id}`}
                                            className="cursor-pointer text-xs text-mute"
                                        >
                                            {addon.is_active ? 'Aktif' : 'Nonaktif'}
                                        </Label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => openEditModal(addon)}
                                        >
                                            <Pencil className="size-3.5" aria-hidden="true" />
                                            Edit
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Hapus add-on ${addon.name}`}
                                            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                            onClick={() => setDeletingAddon(addon)}
                                        >
                                            <Trash2 className="size-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <AddonFormModal
                key={modalInstanceKey}
                open={formOpen}
                onOpenChange={setFormOpen}
                editingAddon={editingAddon}
                services={services}
                isDropoff={isDropoff}
                supportsCommissions={supportsCommissions}
            />

            <ConfirmDialog
                open={deletingAddon !== null}
                onOpenChange={(open) => !open && setDeletingAddon(null)}
                title={`Hapus add-on "${deletingAddon?.name ?? ''}"?`}
                description="Jika add-on sudah pernah dipakai pada transaksi sebelumnya, sistem akan menonaktifkannya agar riwayat invoice tetap utuh."
                confirmLabel="Hapus Add-on"
                onConfirm={() => {
                    if (!deletingAddon) return;
                    router.delete(route('dashboard.addons.destroy', deletingAddon.id), {
                        preserveScroll: true,
                        onFinish: () => setDeletingAddon(null),
                    });
                }}
            />
        </section>
    );
}
