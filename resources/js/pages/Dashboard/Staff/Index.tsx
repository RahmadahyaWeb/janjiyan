import { Head, Link, router } from '@inertiajs/react';
import { CalendarClock, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import { formatRupiah, STAFF_ROLE_LABELS } from '@/lib/format';

interface StaffMember {
    id: number;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    commission_type?: 'none' | 'percentage' | 'fixed';
    commission_value?: number;
    has_login: boolean;
    has_custom_schedule?: boolean;
    upcoming_time_offs_count?: number;
    role: string | null;
    permissions: string[];
}

interface StaffIndexProps {
    staffMembers: StaffMember[];
}

export default function StaffIndex({ staffMembers }: StaffIndexProps) {
    const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);

    return (
        <DashboardLayout
            title="Tim & Staff"
            actions={
                <Button asChild size="sm" className="h-10 px-4">
                    <Link href={route('dashboard.staff.create')}>
                        <Plus className="size-4" aria-hidden="true" />
                        Tambah Staff
                    </Link>
                </Button>
            }
        >
            <Head title="Tim & Staff" />

            {staffMembers.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-12 text-center">
                    <p className="text-base font-semibold text-ink">Belum ada staff terdaftar.</p>
                    <p className="text-sm text-mute">
                        Tambahkan anggota tim agar pelanggan dapat memilih staff saat membuat reservasi.
                    </p>
                    <Button asChild size="sm">
                        <Link href={route('dashboard.staff.create')}>
                            <Plus className="size-4" aria-hidden="true" />
                            Tambah Staff
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {staffMembers.map((st) => (
                        <div
                            key={st.id}
                            className="flex flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
                        >
                            <div>
                                <div className="flex flex-col gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold break-words text-ink">{st.name}</h2>
                                        {st.title && <p className="text-sm text-mute">{st.title}</p>}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {!st.is_active && <Badge variant="danger">Nonaktif</Badge>}
                                        {st.has_custom_schedule && <Badge variant="outline">Shift Khusus</Badge>}
                                        {(st.upcoming_time_offs_count ?? 0) > 0 && (
                                            <Badge variant="warning">{st.upcoming_time_offs_count} Cuti</Badge>
                                        )}
                                        {st.has_login ? (
                                            <Badge variant="popular">{STAFF_ROLE_LABELS[st.role ?? ''] ?? st.role}</Badge>
                                        ) : (
                                            <Badge variant="secondary">Tanpa Login</Badge>
                                        )}
                                    </div>
                                </div>
                                {st.email && <p className="mt-3 text-xs text-mute">{st.email}</p>}
                                {st.phone && <p className="text-xs text-mute">{st.phone}</p>}
                                {st.commission_type && st.commission_type !== 'none' && (
                                    <p className="mt-2 inline-flex items-center rounded-full bg-bone px-2.5 py-0.5 font-mono text-xs font-medium text-ink">
                                        Komisi:{' '}
                                        {st.commission_type === 'percentage'
                                            ? `${st.commission_value ?? 0}%`
                                            : `${formatRupiah(st.commission_value ?? 0)} / sesi`}
                                    </p>
                                )}
                            </div>

                            <div className="mt-4 flex flex-wrap justify-end gap-1.5 border-t border-divider pt-3">
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Unduh kalender .ics ${st.name}`}
                                >
                                    <a href={route('dashboard.staff.calendar.ics', st.id)}>
                                        <Download className="size-3.5" aria-hidden="true" />
                                        .ics
                                    </a>
                                </Button>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Jadwal dan cuti ${st.name}`}
                                >
                                    <Link href={route('dashboard.staff.schedule.edit', st.id)}>
                                        <CalendarClock className="size-3.5" aria-hidden="true" />
                                        Jadwal &amp; Cuti
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Edit staff ${st.name}`}
                                >
                                    <Link href={route('dashboard.staff.edit', st.id)}>
                                        <Pencil className="size-3.5" aria-hidden="true" />
                                        Edit
                                    </Link>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Hapus staff ${st.name}`}
                                    className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                    onClick={() => setDeletingStaff(st)}
                                >
                                    <Trash2 className="size-3.5" aria-hidden="true" />
                                    Hapus
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deletingStaff !== null}
                onOpenChange={(open) => !open && setDeletingStaff(null)}
                title={`Hapus staff "${deletingStaff?.name ?? ''}"?`}
                description="Staff yang dihapus tidak lagi tersedia untuk pilihan reservasi dan akses dashboard-nya akan dicabut."
                confirmLabel="Hapus Staff"
                onConfirm={() => {
                    if (!deletingStaff) return;
                    router.delete(route('dashboard.staff.destroy', deletingStaff.id), {
                        onFinish: () => setDeletingStaff(null),
                    });
                }}
            />
        </DashboardLayout>
    );
}
