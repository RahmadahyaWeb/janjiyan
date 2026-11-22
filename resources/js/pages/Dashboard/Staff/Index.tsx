import { Head, Link, router, usePage } from '@inertiajs/react';
import { CalendarClock, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatRupiah, STAFF_ROLE_LABELS } from '@/lib/format';
import type { PageProps } from '@/types';

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
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const isStaffAppointment = config.type === 'staff_appointment';
    const addLabel = isStaffAppointment ? 'Tambah Staff' : 'Tambah Anggota Tim';
    const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);

    return (
        <DashboardLayout
            title={config.nav.teamLabel}
            actions={
                <Button asChild size="sm" className="h-10 px-4">
                    <Link href={route('dashboard.staff.create')}>
                        <Plus className="size-4" aria-hidden="true" />
                        {addLabel}
                    </Link>
                </Button>
            }
        >
            <Head title={config.nav.teamLabel} />

            <p className="max-w-2xl text-sm text-mute">
                {isStaffAppointment
                    ? 'Staff di sini bisa dipilih pelanggan saat booking. Akun login dashboard bersifat opsional, cukup untuk staff yang perlu membuka jadwal dan reservasi.'
                    : 'Tambahkan anggota tim, kasir, atau admin untuk membantu mengelola operasional dashboard, memverifikasi DP, dan memproses transaksi.'}
            </p>

            {staffMembers.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-6 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        {isStaffAppointment ? 'Belum ada staff terdaftar.' : 'Belum ada anggota tim terdaftar.'}
                    </p>
                    <p className="text-sm text-mute">
                        {isStaffAppointment
                            ? 'Tambahkan anggota tim agar pelanggan dapat memilih staff saat membuat reservasi.'
                            : 'Tambahkan admin atau kasir yang perlu mengakses dashboard bisnis Anda.'}
                    </p>
                    <Button asChild size="sm">
                        <Link href={route('dashboard.staff.create')}>
                            <Plus className="size-4" aria-hidden="true" />
                            {addLabel}
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {staffMembers.map((st) => (
                        <div
                            key={st.id}
                            className="flex min-w-0 flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-col gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold break-words text-ink">{st.name}</h2>
                                        {st.title && <p className="text-sm break-words text-mute">{st.title}</p>}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {!st.is_active && <Badge variant="danger">Nonaktif</Badge>}
                                        {isStaffAppointment && st.has_custom_schedule && (
                                            <Badge variant="outline">Jam kerja khusus</Badge>
                                        )}
                                        {isStaffAppointment && (st.upcoming_time_offs_count ?? 0) > 0 && (
                                            <Badge variant="warning">{st.upcoming_time_offs_count} cuti terjadwal</Badge>
                                        )}
                                        {st.has_login ? (
                                            <Badge variant="popular">Login: {STAFF_ROLE_LABELS[st.role ?? ''] ?? st.role}</Badge>
                                        ) : (
                                            <Badge variant="secondary">Tanpa akun login</Badge>
                                        )}
                                    </div>
                                </div>
                                {st.email && <p className="mt-3 text-xs break-all text-mute">{st.email}</p>}
                                {st.phone && <p className="font-mono text-xs tabular-nums text-mute">{st.phone}</p>}
                                {isStaffAppointment && st.commission_type && st.commission_type !== 'none' && (
                                    <p className="mt-2 inline-flex items-center rounded-full bg-bone px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums text-ink">
                                        Komisi:{' '}
                                        {st.commission_type === 'percentage'
                                            ? `${st.commission_value ?? 0}%`
                                            : `${formatRupiah(st.commission_value ?? 0)} / sesi`}
                                    </p>
                                )}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-1.5 border-t border-divider pt-3 sm:flex sm:flex-wrap sm:justify-end">
                                {isStaffAppointment && (
                                    <>
                                        <Button
                                            asChild
                                            variant="secondary"
                                            size="sm"
                                            className="w-full px-2.5 text-xs sm:w-auto sm:bg-transparent sm:px-3 sm:text-sm sm:hover:bg-bone"
                                            aria-label={`Simpan jadwal ${st.name} ke kalender HP (file .ics)`}
                                        >
                                            <a
                                                href={route('dashboard.staff.calendar.ics', st.id)}
                                                title="Unduh jadwal reservasi staff ini untuk Google Calendar atau Kalender iPhone"
                                            >
                                                <Download className="size-3.5" aria-hidden="true" />
                                                Ke Kalender HP
                                            </a>
                                        </Button>
                                        <Button
                                            asChild
                                            variant="secondary"
                                            size="sm"
                                            className="w-full px-2.5 text-xs sm:w-auto sm:bg-transparent sm:px-3 sm:text-sm sm:hover:bg-bone"
                                            aria-label={`Jadwal dan cuti ${st.name}`}
                                        >
                                            <Link href={route('dashboard.staff.schedule.edit', st.id)}>
                                                <CalendarClock className="size-3.5" aria-hidden="true" />
                                                Jadwal &amp; Cuti
                                            </Link>
                                        </Button>
                                    </>
                                )}
                                <Button
                                    asChild
                                    variant="secondary"
                                    size="sm"
                                    className="w-full px-2.5 text-xs sm:w-auto sm:bg-transparent sm:px-3 sm:text-sm sm:hover:bg-bone"
                                    aria-label={`Edit ${isStaffAppointment ? 'staff' : 'anggota tim'} ${st.name}`}
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
                                    aria-label={`Hapus ${isStaffAppointment ? 'staff' : 'anggota tim'} ${st.name}`}
                                    className="w-full px-2.5 text-xs text-destructive hover:bg-destructive-soft hover:text-destructive sm:w-auto sm:px-3 sm:text-sm"
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
                title={`Hapus ${isStaffAppointment ? 'staff' : 'anggota tim'} "${deletingStaff?.name ?? ''}"?`}
                description={
                    isStaffAppointment
                        ? 'Staff yang dihapus tidak lagi tersedia untuk pilihan reservasi dan akses dashboard-nya akan dicabut.'
                        : 'Anggota tim yang dihapus akan dicabut akses dashboard-nya secara permanen.'
                }
                confirmLabel={isStaffAppointment ? 'Hapus Staff' : 'Hapus Anggota Tim'}
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
