import { Head, Link, router, usePage } from '@inertiajs/react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatRupiah, formatTurnaroundLabel } from '@/lib/format';
import type { PageProps, ServiceUnitLabel } from '@/types';

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
    booking_mode: 'time_slot' | 'dropoff';
    unit_label?: ServiceUnitLabel | string;
    turnaround_days: number;
    supports_pickup: boolean;
    dp_type: 'none' | 'fixed' | 'percentage';
    dp_value: number;
    is_active: boolean;
    staff_ids: number[];
}

interface ServicesIndexProps {
    services: ServiceRow[];
}

export default function ServicesIndex({ services }: ServicesIndexProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingService, setDeletingService] = useState<ServiceRow | null>(null);

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
                unit_label: service.unit_label ?? 'item',
                turnaround_days: service.turnaround_days ?? 1,
                supports_pickup: Boolean(service.supports_pickup),
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

    return (
        <DashboardLayout
            title={config.services.pageTitle}
            actions={
                <Button asChild size="sm" className="h-10 px-4">
                    <Link href={route('dashboard.services.create')}>
                        <Plus className="size-4" aria-hidden="true" />
                        {config.services.createButtonLabel}
                    </Link>
                </Button>
            }
        >
            <Head title={config.services.pageTitle} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                {services.length > 0 ? (
                    <div className="relative flex w-full items-center sm:w-72">
                        <Label htmlFor="services-search" className="sr-only">
                            Cari layanan
                        </Label>
                        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ash" aria-hidden="true" />
                        <Input
                            id="services-search"
                            className="pl-10 pr-11 md:h-10 md:text-sm"
                            placeholder="Cari layanan…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                aria-label="Hapus pencarian layanan"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-1.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-mute hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                ) : null}
            </div>

            {services.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-6 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        Belum ada {config.services.pageTitle.toLowerCase()} tersedia.
                    </p>
                    <p className="text-sm text-mute">
                        Tambahkan item pertama Anda agar pelanggan bisa langsung memesan dari portal publik.
                    </p>
                    <Button asChild size="sm">
                        <Link href={route('dashboard.services.create')}>
                            <Plus className="size-4" aria-hidden="true" />
                            {config.services.createButtonLabel}
                        </Link>
                    </Button>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-6 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        Tidak ada layanan dengan nama &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                        Hapus Pencarian
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredServices.map((s) => (
                        <div
                            key={s.id}
                            className="flex min-w-0 flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
                        >
                            <div className="min-w-0">
                                {s.image_url && (
                                    <img
                                        src={s.image_url}
                                        alt={`Foto layanan ${s.name}`}
                                        className="mb-4 aspect-[16/9] w-full rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10"
                                    />
                                )}
                                <div className="flex flex-col gap-2">
                                    <h2 className="text-lg font-semibold break-words text-ink">{s.name}</h2>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {!s.is_active && <Badge variant="danger">Nonaktif</Badge>}
                                        {config.type === 'dropoff' ? (
                                            <>
                                                <Badge variant="outline" className="max-w-full whitespace-normal tabular-nums">
                                                    Drop-off · Maks {s.capacity} {s.unit_label ?? 'item'}/hari
                                                </Badge>
                                                {s.supports_pickup && (
                                                    <Badge variant="secondary">Jemput-Antar</Badge>
                                                )}
                                            </>
                                        ) : config.type === 'space_booking' ? (
                                            <Badge variant="outline" className="tabular-nums">
                                                Kapasitas {s.capacity} / sesi
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">Per staff</Badge>
                                        )}
                                    </div>
                                </div>
                                {s.description && <p className="mt-2 text-sm break-words text-mute">{s.description}</p>}
                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-mute">
                                    <span className="rounded-full bg-bone px-3 py-1 font-semibold tabular-nums text-ink">
                                        {formatRupiah(s.price)}
                                        {config.type === 'dropoff' ? ` / ${s.unit_label ?? 'item'}` : ''}
                                    </span>
                                    <span className="rounded-full bg-bone px-3 py-1 tabular-nums">
                                        {config.type === 'dropoff'
                                            ? formatTurnaroundLabel(s.turnaround_days)
                                            : s.buffer_minutes > 0
                                              ? `${s.duration_minutes} mnt + ${s.buffer_minutes} mnt jeda`
                                              : `${s.duration_minutes} mnt`}
                                    </span>
                                    {s.dp_type !== 'none' && (
                                        <span className="rounded-full bg-bone px-3 py-1 font-semibold tabular-nums text-electric">
                                            Uang muka {s.dp_type === 'fixed' ? formatRupiah(s.dp_value) : `${s.dp_value}%`}
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
                                    <Button asChild variant="secondary" size="sm">
                                        <Link href={route('dashboard.services.edit', s.id)}>
                                            <Pencil className="size-3.5" aria-hidden="true" />
                                            Edit
                                        </Link>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Hapus layanan ${s.name}`}
                                        className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                        onClick={() => setDeletingService(s)}
                                    >
                                        <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
