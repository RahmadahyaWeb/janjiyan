import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';
import type { PageProps } from '@/types';

interface StaffData {
    id: number;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    commission_type?: 'none' | 'percentage' | 'fixed';
    commission_value?: number;
    has_login: boolean;
    role: string | null;
    permissions: string[];
}

interface StaffFormProps {
    staffMember: StaffData | null;
}

export default function StaffForm({ staffMember }: StaffFormProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const isStaffAppointment = config.type === 'staff_appointment';
    const isEditing = staffMember !== null;
    const formRef = useRef<HTMLFormElement>(null);

    const permissionOptions = [
        {
            key: 'manage_bookings',
            label: `Kelola ${config.bookings.pageTitle}`,
            hint: `${config.bookings.pageTitle} & Pelanggan`,
        },
        {
            key: 'verify_payments',
            label: 'Verifikasi Uang Muka',
            hint: 'Cek bukti uang muka, tandai lunas',
        },
        {
            key: 'manage_services',
            label: `Kelola ${config.services.pageTitle}`,
            hint: `Menu ${config.services.pageTitle}`,
        },
        {
            key: 'manage_staff',
            label: `Kelola ${config.nav.teamLabel}`,
            hint: isStaffAppointment
                ? 'Tim, jadwal staff, komisi & omzet per staff'
                : 'Daftar tim admin & hak akses dashboard',
        },
        {
            key: 'manage_settings',
            label: 'Pengaturan Bisnis',
            hint: 'Pengaturan, jam operasional, omzet, billing',
        },
    ];

    const form = useForm({
        name: staffMember?.name ?? '',
        title: staffMember?.title ?? '',
        email: staffMember?.email ?? '',
        phone: staffMember?.phone ?? '',
        commission_type: (staffMember?.commission_type ?? 'none') as 'none' | 'percentage' | 'fixed',
        commission_value: (staffMember?.commission_value ?? 0) as number | '',
        grant_login: false,
        password: '',
        is_active: staffMember?.is_active ?? true,
        role: (staffMember?.role === 'admin' ? 'admin' : 'staff') as 'admin' | 'staff',
        permissions:
            staffMember && staffMember.permissions.length > 0
                ? staffMember.permissions
                : ['manage_bookings', 'verify_payments'],
    });

    const togglePermission = (key: string) => {
        const exists = form.data.permissions.includes(key);
        form.setData(
            'permissions',
            exists ? form.data.permissions.filter((p) => p !== key) : [...form.data.permissions, key]
        );
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            commission_type: isStaffAppointment ? data.commission_type : 'none',
            commission_value: isStaffAppointment ? Number(data.commission_value || 0) : 0,
        }));

        if (isEditing) {
            form.put(route('dashboard.staff.update', staffMember.id), {
                onError: () => scrollToFirstInvalid(formRef.current),
            });
        } else {
            form.post(route('dashboard.staff.store'), {
                onError: () => scrollToFirstInvalid(formRef.current),
            });
        }
    };

    const pageTitle = isEditing
        ? isStaffAppointment
            ? 'Edit Staff'
            : 'Edit Anggota Tim'
        : isStaffAppointment
          ? 'Tambah Staff'
          : 'Tambah Anggota Tim';
    const showPermissionFields = isEditing
        ? staffMember.has_login && staffMember.role !== 'owner'
        : form.data.grant_login;

    return (
        <DashboardLayout
            title={pageTitle}
            back={{ href: route('dashboard.staff'), label: `Kembali ke ${config.nav.teamLabel}` }}
        >
            <Head title={pageTitle} />

            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="max-w-xl space-y-5 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6"
            >
                <div className="space-y-1.5">
                    <Label htmlFor="staff-name">Nama Lengkap *</Label>
                    <Input
                        id="staff-name"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        aria-invalid={Boolean(form.errors.name)}
                        aria-describedby={form.errors.name ? 'staff-name-error' : undefined}
                        required
                    />
                    {form.errors.name && (
                        <p id="staff-name-error" className="text-xs text-destructive">
                            {form.errors.name}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="staff-title">
                        {isStaffAppointment ? 'Jabatan / Spesialisasi' : 'Jabatan / Peran'}
                    </Label>
                    <Input
                        id="staff-title"
                        placeholder={isStaffAppointment ? 'Senior Barber' : 'Kasir / Admin Operasional'}
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {!isEditing && (
                        <div className="space-y-1.5">
                            <Label htmlFor="staff-email">Email {form.data.grant_login ? '*' : ''}</Label>
                            <Input
                                id="staff-email"
                                type="email"
                                value={form.data.email}
                                onChange={(e) => form.setData('email', e.target.value)}
                                aria-invalid={Boolean(form.errors.email)}
                                aria-describedby={form.errors.email ? 'staff-email-error' : undefined}
                                required={form.data.grant_login}
                            />
                            {form.errors.email && (
                                <p id="staff-email-error" className="text-xs text-destructive">
                                    {form.errors.email}
                                </p>
                            )}
                        </div>
                    )}
                    <div className={`space-y-1.5 ${isEditing ? 'sm:col-span-2' : ''}`}>
                        <Label htmlFor="staff-phone">WhatsApp</Label>
                        <Input
                            id="staff-phone"
                            type="tel"
                            inputMode="tel"
                            value={form.data.phone}
                            onChange={(e) => form.setData('phone', e.target.value)}
                        />
                    </div>
                </div>

                {isStaffAppointment && (
                    <div className="space-y-3 rounded-sm border border-hairline-soft p-3.5">
                        <div className="space-y-1.5">
                            <Label htmlFor="staff-commission-type">Komisi Staff</Label>
                            <p className="text-xs text-mute">
                                Dihitung otomatis tiap reservasi staff ini. Rekapnya ada di menu Komisi Staff.
                            </p>
                            <SelectField
                                id="staff-commission-type"
                                value={form.data.commission_type}
                                onValueChange={(val) =>
                                    form.setData(
                                        'commission_type',
                                        val as 'none' | 'percentage' | 'fixed'
                                    )
                                }
                                options={[
                                    { value: 'none', label: 'Tidak Ada Komisi' },
                                    { value: 'percentage', label: 'Persentase dari Harga Layanan (%)' },
                                    { value: 'fixed', label: 'Nominal Tetap per Reservasi (Rp)' },
                                ]}
                            />
                        </div>
                        {form.data.commission_type !== 'none' && (
                            <div className="space-y-1.5">
                                <Label htmlFor="staff-commission-value">
                                    {form.data.commission_type === 'percentage'
                                        ? 'Persentase Komisi (%)'
                                        : 'Nominal Komisi per Sesi (Rp)'}
                                </Label>
                                {form.data.commission_type === 'fixed' ? (
                                    <CurrencyInput
                                        id="staff-commission-value"
                                        min={0}
                                        max={100000000}
                                        value={form.data.commission_value}
                                        onValueChange={(val) => form.setData('commission_value', val)}
                                        aria-invalid={Boolean(form.errors.commission_value)}
                                    />
                                ) : (
                                    <Input
                                        id="staff-commission-value"
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={form.data.commission_value}
                                        onChange={(e) => form.setData('commission_value', parseNumericInput(e.target.value))}
                                        aria-invalid={Boolean(form.errors.commission_value)}
                                    />
                                )}
                                {form.errors.commission_value && (
                                    <p className="text-xs text-destructive">{form.errors.commission_value}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {isEditing ? (
                    <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-3.5">
                        <div className="min-w-0">
                            <Label htmlFor="edit-staff-active" className="text-sm font-semibold text-ink">
                                {isStaffAppointment ? 'Staff Aktif untuk Reservasi' : 'Anggota Tim Aktif'}
                            </Label>
                            <p className="mt-0.5 text-xs text-mute">
                                {isStaffAppointment
                                    ? 'Nonaktifkan sementara jika staff sedang cuti atau tidak bertugas.'
                                    : 'Nonaktifkan sementara jika anggota tim sedang tidak bertugas.'}
                            </p>
                        </div>
                        <Switch
                            id="edit-staff-active"
                            className="shrink-0"
                            checked={form.data.is_active}
                            onCheckedChange={(val) => form.setData('is_active', val)}
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-3.5">
                        <div className="min-w-0">
                            <Label htmlFor="staff-grant-login" className="text-sm font-semibold text-ink">
                                Buatkan Akun Login Dashboard (opsional)
                            </Label>
                            <p className="mt-0.5 text-xs text-mute">
                                {isStaffAppointment
                                    ? 'Tanpa akun pun staff tetap bisa dipilih pelanggan. Aktifkan hanya kalau staff perlu membuka dashboard. Wajib isi email di atas.'
                                    : 'Aktifkan agar anggota tim ini dapat masuk ke dashboard sesuai izin menu yang dipilih. Wajib isi email di atas.'}
                            </p>
                        </div>
                        <Switch
                            id="staff-grant-login"
                            className="shrink-0"
                            checked={form.data.grant_login}
                            onCheckedChange={(val) => form.setData('grant_login', val)}
                        />
                    </div>
                )}

                {showPermissionFields && (
                    <div className="space-y-3 rounded-sm border border-hairline-soft p-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="staff-role">Tingkat Akses</Label>
                            <SelectField
                                id="staff-role"
                                value={form.data.role}
                                onValueChange={(val) => form.setData('role', val as 'admin' | 'staff')}
                                options={[
                                    { value: 'staff', label: 'Staff / Kasir (pilih menu)' },
                                    { value: 'admin', label: 'Admin (semua menu)' },
                                ]}
                            />
                            <p className="text-xs text-mute">
                                {form.data.role === 'admin'
                                    ? 'Admin bisa membuka semua menu, sama seperti pemilik.'
                                    : 'Anggota tim hanya bisa membuka menu yang dipilih di bawah.'}
                            </p>
                        </div>

                        {!isEditing && (
                            <div className="space-y-1.5">
                                <Label htmlFor="staff-password">Kata Sandi Awal *</Label>
                                <Input
                                    id="staff-password"
                                    type="password"
                                    placeholder="Min. 8 karakter"
                                    value={form.data.password}
                                    onChange={(e) => form.setData('password', e.target.value)}
                                    aria-invalid={Boolean(form.errors.password)}
                                    aria-describedby={form.errors.password ? 'staff-password-error' : undefined}
                                    required
                                />
                                {form.errors.password && (
                                    <p id="staff-password-error" className="text-xs text-destructive">
                                        {form.errors.password}
                                    </p>
                                )}
                            </div>
                        )}

                        {form.data.role === 'staff' && (
                            <div className="space-y-2">
                                <Label>Menu yang Boleh Dibuka</Label>
                                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Pilih izin akses tim">
                                    {permissionOptions.map((perm) => {
                                        const active = form.data.permissions.includes(perm.key);
                                        return (
                                            <button
                                                key={perm.key}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => togglePermission(perm.key)}
                                                className={`min-h-11 cursor-pointer rounded-xl px-3.5 py-2.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                                    active ? 'bg-ink text-canvas' : 'bg-bone text-ink hover:bg-hairline-soft'
                                                }`}
                                            >
                                                <span className="block font-semibold">{perm.label}</span>
                                                <span className={`mt-0.5 block leading-snug font-normal ${active ? 'text-canvas/75' : 'text-mute'}`}>
                                                    {perm.hint}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                    <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                        <Link href={route('dashboard.staff')}>Batal</Link>
                    </Button>
                    <Button type="submit" disabled={form.processing} className="w-full sm:w-auto">
                        {form.processing
                            ? 'Menyimpan…'
                            : isEditing
                              ? 'Simpan Perubahan'
                              : isStaffAppointment
                                ? 'Simpan Staff'
                                : 'Simpan Anggota Tim'}
                    </Button>
                </div>
            </form>
        </DashboardLayout>
    );
}
