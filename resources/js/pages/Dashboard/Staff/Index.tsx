import { Head, router, useForm } from '@inertiajs/react';
import { CalendarClock, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StaffScheduleDialog } from '@/components/StaffScheduleDialog';
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
import DashboardLayout from '@/layouts/DashboardLayout';
import { formatRupiah, STAFF_ROLE_LABELS } from '@/lib/format';
import { parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';

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

const ALL_PERMISSIONS = [
    { key: 'manage_bookings', label: 'Kelola Reservasi' },
    { key: 'verify_payments', label: 'Verifikasi DP' },
    { key: 'manage_services', label: 'Kelola Layanan' },
    { key: 'manage_staff', label: 'Kelola Staff' },
    { key: 'manage_settings', label: 'Pengaturan Bisnis' },
];

export default function StaffIndex({ staffMembers }: StaffIndexProps) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);
    const [scheduleStaff, setScheduleStaff] = useState<StaffMember | null>(null);
    const createFormRef = useRef<HTMLFormElement>(null);
    const editFormRef = useRef<HTMLFormElement>(null);

    const createForm = useForm({
        name: '',
        title: '',
        email: '',
        phone: '',
        commission_type: 'none' as 'none' | 'percentage' | 'fixed',
        commission_value: 0 as number | '',
        grant_login: false,
        password: '',
        role: 'staff' as 'admin' | 'staff',
        permissions: ['manage_bookings', 'verify_payments'] as string[],
    });

    const editForm = useForm({
        name: '',
        title: '',
        phone: '',
        is_active: true,
        commission_type: 'none' as 'none' | 'percentage' | 'fixed',
        commission_value: 0 as number | '',
        role: 'staff' as 'admin' | 'staff',
        permissions: ['manage_bookings', 'verify_payments'] as string[],
    });

    const toggleCreatePermission = (key: string) => {
        const exists = createForm.data.permissions.includes(key);
        createForm.setData(
            'permissions',
            exists ? createForm.data.permissions.filter((p) => p !== key) : [...createForm.data.permissions, key]
        );
    };

    const toggleEditPermission = (key: string) => {
        const exists = editForm.data.permissions.includes(key);
        editForm.setData(
            'permissions',
            exists ? editForm.data.permissions.filter((p) => p !== key) : [...editForm.data.permissions, key]
        );
    };

    const openEdit = (staff: StaffMember) => {
        editForm.clearErrors();
        setEditingStaff(staff);
        editForm.setData({
            name: staff.name,
            title: staff.title ?? '',
            phone: staff.phone ?? '',
            is_active: staff.is_active,
            commission_type: staff.commission_type ?? 'none',
            commission_value: staff.commission_value ?? 0,
            role: staff.role === 'admin' ? 'admin' : 'staff',
            permissions: staff.permissions.length > 0 ? staff.permissions : ['manage_bookings', 'verify_payments'],
        });
    };

    const handleCreateSubmit = (e: FormEvent) => {
        e.preventDefault();
        createForm.transform((data) => ({
            ...data,
            commission_value: Number(data.commission_value || 0),
        }));
        createForm.post(route('dashboard.staff.store'), {
            onSuccess: () => {
                setCreateOpen(false);
                createForm.reset();
            },
            onError: () => scrollToFirstInvalid(createFormRef.current),
        });
    };

    const handleEditSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!editingStaff) return;

        editForm.transform((data) => ({
            ...data,
            commission_value: Number(data.commission_value || 0),
        }));
        editForm.put(route('dashboard.staff.update', editingStaff.id), {
            onSuccess: () => {
                setEditingStaff(null);
            },
            onError: () => scrollToFirstInvalid(editFormRef.current),
        });
    };

    return (
        <DashboardLayout title="Tim & Staff">
            <Head title="Tim & Staff" />

            <div className="flex justify-end">
                <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" aria-hidden="true" />
                    Tambah Staff
                </Button>
            </div>

            {staffMembers.length === 0 ? (
                <div className="space-y-3 rounded-[24px] bg-bone p-12 text-center">
                    <p className="text-base font-semibold text-ink">Belum ada staff terdaftar.</p>
                    <p className="text-sm text-mute">
                        Tambahkan anggota tim agar pelanggan dapat memilih staff saat membuat reservasi.
                    </p>
                    <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="size-4" aria-hidden="true" />
                        Tambah Staff
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {staffMembers.map((st) => (
                        <div
                            key={st.id}
                            className="flex flex-col justify-between rounded-[24px] border border-hairline-soft bg-canvas p-5"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h2 className="truncate text-base font-semibold text-ink">{st.name}</h2>
                                        {st.title && <p className="truncate text-xs text-mute">{st.title}</p>}
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-1.5">
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
                                    <p className="mt-2 inline-flex items-center rounded-full bg-bone px-2.5 py-0.5 font-mono text-[11px] font-medium text-ink">
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
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Jadwal dan cuti ${st.name}`}
                                    onClick={() => setScheduleStaff(st)}
                                >
                                    <CalendarClock className="size-3.5" aria-hidden="true" />
                                    Jadwal & Cuti
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Edit staff ${st.name}`}
                                    onClick={() => openEdit(st)}
                                >
                                    <Pencil className="size-3.5" aria-hidden="true" />
                                    Edit
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

            {/* Create Staff Dialog */}
            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    if (open) createForm.clearErrors();
                    setCreateOpen(open);
                }}
            >
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-ink">Tambah Staff</DialogTitle>
                    </DialogHeader>

                    <form ref={createFormRef} onSubmit={handleCreateSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="staff-name">Nama Lengkap *</Label>
                            <Input
                                id="staff-name"
                                value={createForm.data.name}
                                onChange={(e) => createForm.setData('name', e.target.value)}
                                aria-invalid={Boolean(createForm.errors.name)}
                                aria-describedby={createForm.errors.name ? 'staff-name-error' : undefined}
                                required
                            />
                            {createForm.errors.name && (
                                <p id="staff-name-error" className="text-xs text-destructive">
                                    {createForm.errors.name}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="staff-title">Jabatan / Spesialisasi</Label>
                            <Input
                                id="staff-title"
                                placeholder="Senior Barber"
                                value={createForm.data.title}
                                onChange={(e) => createForm.setData('title', e.target.value)}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="staff-email">Email {createForm.data.grant_login ? '*' : ''}</Label>
                                <Input
                                    id="staff-email"
                                    type="email"
                                    value={createForm.data.email}
                                    onChange={(e) => createForm.setData('email', e.target.value)}
                                    aria-invalid={Boolean(createForm.errors.email)}
                                    aria-describedby={createForm.errors.email ? 'staff-email-error' : undefined}
                                    required={createForm.data.grant_login}
                                />
                                {createForm.errors.email && (
                                    <p id="staff-email-error" className="text-xs text-destructive">
                                        {createForm.errors.email}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="staff-phone">WhatsApp</Label>
                                <Input
                                    id="staff-phone"
                                    type="tel"
                                    inputMode="tel"
                                    value={createForm.data.phone}
                                    onChange={(e) => createForm.setData('phone', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 rounded-[16px] border border-hairline-soft p-3.5">
                            <div className="space-y-1.5">
                                <Label htmlFor="staff-commission-type">Skema Komisi Default</Label>
                                <NativeSelect
                                    id="staff-commission-type"
                                    value={createForm.data.commission_type}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'commission_type',
                                            e.target.value as 'none' | 'percentage' | 'fixed'
                                        )
                                    }
                                >
                                    <option value="none">Tidak Ada Komisi</option>
                                    <option value="percentage">Persentase dari Harga Layanan (%)</option>
                                    <option value="fixed">Nominal Tetap per Reservasi (Rp)</option>
                                </NativeSelect>
                            </div>
                            {createForm.data.commission_type !== 'none' && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="staff-commission-value">
                                        {createForm.data.commission_type === 'percentage'
                                            ? 'Persentase Komisi (%)'
                                            : 'Nominal Komisi per Sesi (Rp)'}
                                    </Label>
                                    <Input
                                        id="staff-commission-value"
                                        type="number"
                                        min={0}
                                        max={createForm.data.commission_type === 'percentage' ? 100 : 100000000}
                                        value={createForm.data.commission_value}
                                        onChange={(e) =>
                                            createForm.setData('commission_value', parseNumericInput(e.target.value))
                                        }
                                        aria-invalid={Boolean(createForm.errors.commission_value)}
                                    />
                                    {createForm.errors.commission_value && (
                                        <p className="text-xs text-destructive">{createForm.errors.commission_value}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-[16px] bg-bone p-3.5">
                            <div>
                                <Label htmlFor="staff-grant-login" className="text-sm font-semibold text-ink">
                                    Berikan Akses Login Dashboard
                                </Label>
                                <p className="mt-0.5 text-xs text-mute">Wajib isi email staff di atas.</p>
                            </div>
                            <Switch
                                id="staff-grant-login"
                                checked={createForm.data.grant_login}
                                onCheckedChange={(val) => createForm.setData('grant_login', val)}
                            />
                        </div>

                        {createForm.data.grant_login && (
                            <div className="space-y-3 rounded-[16px] border border-hairline-soft p-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="staff-role">Role</Label>
                                    <NativeSelect
                                        id="staff-role"
                                        value={createForm.data.role}
                                        onChange={(e) => createForm.setData('role', e.target.value as 'admin' | 'staff')}
                                    >
                                        <option value="staff">Staff (Permission Terbatas)</option>
                                        <option value="admin">Admin (Akses Penuh Operasional)</option>
                                    </NativeSelect>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="staff-password">Kata Sandi Awal *</Label>
                                    <Input
                                        id="staff-password"
                                        type="password"
                                        placeholder="Min. 8 karakter"
                                        value={createForm.data.password}
                                        onChange={(e) => createForm.setData('password', e.target.value)}
                                        aria-invalid={Boolean(createForm.errors.password)}
                                        aria-describedby={createForm.errors.password ? 'staff-password-error' : undefined}
                                        required
                                    />
                                    {createForm.errors.password && (
                                        <p id="staff-password-error" className="text-xs text-destructive">
                                            {createForm.errors.password}
                                        </p>
                                    )}
                                </div>
                                {createForm.data.role === 'staff' && (
                                    <div className="space-y-2">
                                        <Label>Izin Akses</Label>
                                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih izin akses staff">
                                            {ALL_PERMISSIONS.map((perm) => {
                                                const active = createForm.data.permissions.includes(perm.key);
                                                return (
                                                    <button
                                                        key={perm.key}
                                                        type="button"
                                                        aria-pressed={active}
                                                        onClick={() => toggleCreatePermission(perm.key)}
                                                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                                            active ? 'bg-ink text-canvas' : 'bg-bone text-ink'
                                                        }`}
                                                    >
                                                        {perm.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {Object.keys(createForm.errors).length > 0 && (
                            <div
                                role="alert"
                                data-form-error="true"
                                className="rounded-[14px] border border-destructive/30 bg-destructive-soft px-3.5 py-2.5 text-xs text-destructive"
                            >
                                Periksa kembali isian yang ditandai merah di atas sebelum menyimpan.
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={createForm.processing}>
                            {createForm.processing ? 'Menyimpan…' : 'Simpan Staff'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Staff Dialog */}
            <Dialog open={editingStaff !== null} onOpenChange={(open) => !open && setEditingStaff(null)}>
                <DialogContent className="rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-ink">Edit Staff</DialogTitle>
                    </DialogHeader>

                    <form ref={editFormRef} onSubmit={handleEditSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-staff-name">Nama Lengkap *</Label>
                            <Input
                                id="edit-staff-name"
                                value={editForm.data.name}
                                onChange={(e) => editForm.setData('name', e.target.value)}
                                aria-invalid={Boolean(editForm.errors.name)}
                                aria-describedby={editForm.errors.name ? 'edit-staff-name-error' : undefined}
                                required
                            />
                            {editForm.errors.name && (
                                <p id="edit-staff-name-error" className="text-xs text-destructive">
                                    {editForm.errors.name}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-staff-title">Jabatan / Spesialisasi</Label>
                                <Input
                                    id="edit-staff-title"
                                    value={editForm.data.title}
                                    onChange={(e) => editForm.setData('title', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-staff-phone">WhatsApp</Label>
                                <Input
                                    id="edit-staff-phone"
                                    type="tel"
                                    inputMode="tel"
                                    value={editForm.data.phone}
                                    onChange={(e) => editForm.setData('phone', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 rounded-[16px] border border-hairline-soft p-3.5">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-staff-commission-type">Skema Komisi Default</Label>
                                <NativeSelect
                                    id="edit-staff-commission-type"
                                    value={editForm.data.commission_type}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'commission_type',
                                            e.target.value as 'none' | 'percentage' | 'fixed'
                                        )
                                    }
                                >
                                    <option value="none">Tidak Ada Komisi</option>
                                    <option value="percentage">Persentase dari Harga Layanan (%)</option>
                                    <option value="fixed">Nominal Tetap per Reservasi (Rp)</option>
                                </NativeSelect>
                            </div>
                            {editForm.data.commission_type !== 'none' && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-staff-commission-value">
                                        {editForm.data.commission_type === 'percentage'
                                            ? 'Persentase Komisi (%)'
                                            : 'Nominal Komisi per Sesi (Rp)'}
                                    </Label>
                                    <Input
                                        id="edit-staff-commission-value"
                                        type="number"
                                        min={0}
                                        max={editForm.data.commission_type === 'percentage' ? 100 : 100000000}
                                        value={editForm.data.commission_value}
                                        onChange={(e) =>
                                            editForm.setData('commission_value', parseNumericInput(e.target.value))
                                        }
                                        aria-invalid={Boolean(editForm.errors.commission_value)}
                                    />
                                    {editForm.errors.commission_value && (
                                        <p className="text-xs text-destructive">{editForm.errors.commission_value}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-[16px] bg-bone p-3.5">
                            <div>
                                <Label htmlFor="edit-staff-active" className="text-sm font-semibold text-ink">
                                    Staff Aktif untuk Reservasi
                                </Label>
                                <p className="mt-0.5 text-xs text-mute">
                                    Nonaktifkan sementara jika staff sedang cuti atau tidak bertugas.
                                </p>
                            </div>
                            <Switch
                                id="edit-staff-active"
                                checked={editForm.data.is_active}
                                onCheckedChange={(val) => editForm.setData('is_active', val)}
                            />
                        </div>

                        {editingStaff?.has_login && editingStaff.role !== 'owner' && (
                            <div className="space-y-3 rounded-[16px] border border-hairline-soft p-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-staff-role">Role</Label>
                                    <NativeSelect
                                        id="edit-staff-role"
                                        value={editForm.data.role}
                                        onChange={(e) => editForm.setData('role', e.target.value as 'admin' | 'staff')}
                                    >
                                        <option value="staff">Staff (Permission Terbatas)</option>
                                        <option value="admin">Admin (Akses Penuh Operasional)</option>
                                    </NativeSelect>
                                </div>
                                {editForm.data.role === 'staff' && (
                                    <div className="space-y-2">
                                        <Label>Izin Akses</Label>
                                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih izin akses staff">
                                            {ALL_PERMISSIONS.map((perm) => {
                                                const active = editForm.data.permissions.includes(perm.key);
                                                return (
                                                    <button
                                                        key={perm.key}
                                                        type="button"
                                                        aria-pressed={active}
                                                        onClick={() => toggleEditPermission(perm.key)}
                                                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                                            active ? 'bg-ink text-canvas' : 'bg-bone text-ink'
                                                        }`}
                                                    >
                                                        {perm.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {Object.keys(editForm.errors).length > 0 && (
                            <div
                                role="alert"
                                data-form-error="true"
                                className="rounded-[14px] border border-destructive/30 bg-destructive-soft px-3.5 py-2.5 text-xs text-destructive"
                            >
                                Periksa kembali isian yang ditandai merah di atas sebelum menyimpan.
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={editForm.processing}>
                            {editForm.processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

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
            <StaffScheduleDialog
                staffId={scheduleStaff?.id ?? null}
                staffName={scheduleStaff?.name ?? ''}
                onClose={() => setScheduleStaff(null)}
            />
        </DashboardLayout>
    );
}
