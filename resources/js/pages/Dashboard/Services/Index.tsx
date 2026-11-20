import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DashboardLayout from '@/layouts/DashboardLayout';
import { formatRupiah, formatTurnaroundLabel } from '@/lib/format';

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
                assignment_mode: service.assignment_mode,
                booking_mode: service.booking_mode ?? 'time_slot',
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
            title="Daftar Layanan"
            actions={
                <Button asChild size="sm" className="h-10 px-4">
                    <Link href={route('dashboard.services.create')}>
                        <Plus className="size-4" aria-hidden="true" />
                        Tambah Layanan
                    </Link>
                </Button>
            }
        >
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
                ) : null}
            </div>

            {services.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-12 text-center">
                    <p className="text-base font-semibold text-ink">Belum ada layanan tersedia.</p>
                    <p className="text-sm text-mute">
                        Tambahkan layanan pertama Anda untuk mulai menerima booking dari pelanggan.
                    </p>
                    <Button asChild size="sm">
                        <Link href={route('dashboard.services.create')}>
                            <Plus className="size-4" aria-hidden="true" />
                            Tambah Layanan
                        </Link>
                    </Button>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-12 text-center">
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
                            className="flex flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
                        >
                            <div>
                                {s.image_url && (
                                    <img
                                        src={s.image_url}
                                        alt={`Foto layanan ${s.name}`}
                                        className="mb-4 aspect-[16/9] w-full rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10"
                                    />
                                )}
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="min-w-0 text-lg font-semibold text-ink">{s.name}</h2>
                                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                        {!s.is_active && <Badge variant="danger">Nonaktif</Badge>}
                                        {s.booking_mode === 'dropoff' ? (
                                            <>
                                                <Badge variant="outline" className="tabular-nums">
                                                    Drop-off · Kuota {s.capacity}/hr
                                                </Badge>
                                                {s.supports_pickup && (
                                                    <Badge variant="secondary">Jemput-Antar</Badge>
                                                )}
                                            </>
                                        ) : (
                                            <Badge variant={s.assignment_mode === 'staff' ? 'secondary' : 'outline'}>
                                                {s.assignment_mode === 'staff' ? 'Staff' : `Kapasitas ${s.capacity}`}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {s.description && <p className="mt-2 text-sm text-mute">{s.description}</p>}
                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-mute">
                                    <span className="rounded-full bg-bone px-3 py-1 font-semibold tabular-nums text-ink">
                                        {formatRupiah(s.price)}
                                    </span>
                                    <span className="rounded-full bg-bone px-3 py-1 tabular-nums">
                                        {s.booking_mode === 'dropoff'
                                            ? formatTurnaroundLabel(s.turnaround_days)
                                            : `${s.duration_minutes} mnt (+${s.buffer_minutes} mnt buffer)`}
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
                                    <Button asChild variant="secondary" size="sm">
                                        <Link href={route('dashboard.services.edit', s.id)}>
                                            <Pencil className="size-3.5" aria-hidden="true" />
                                            Edit
                                        </Link>
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
