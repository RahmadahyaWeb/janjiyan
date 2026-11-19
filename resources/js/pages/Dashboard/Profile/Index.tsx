import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/layouts/DashboardLayout';
import type { PageProps } from '@/types';

interface ProfileIndexProps {
    hasPassword: boolean;
}

export default function ProfileIndex({ hasPassword }: ProfileIndexProps) {
    const { auth } = usePage<PageProps>().props;

    const profileForm = useForm({
        name: auth.user?.name ?? '',
        email: auth.user?.email ?? '',
    });

    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const handleProfileSubmit = (e: FormEvent) => {
        e.preventDefault();
        profileForm.put(route('dashboard.profile.update'));
    };

    const handlePasswordSubmit = (e: FormEvent) => {
        e.preventDefault();
        passwordForm.put(route('dashboard.profile.password'), {
            onSuccess: () => passwordForm.reset(),
        });
    };

    return (
        <DashboardLayout title="Profil & Keamanan Akun">
            <Head title="Profil Akun" />

            <div className="max-w-2xl space-y-6">
                {/* Account Information */}
                <form
                    onSubmit={handleProfileSubmit}
                    className="space-y-4 rounded-[24px] border border-hairline-soft bg-canvas p-6"
                >
                    <div>
                        <h2 className="text-lg font-semibold text-ink">Informasi Akun</h2>
                        <p className="text-xs leading-relaxed text-mute">
                            Jika alamat email diubah, Anda perlu memverifikasi ulang email baru tersebut.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="profile-name">Nama Lengkap</Label>
                        <Input
                            id="profile-name"
                            autoComplete="name"
                            value={profileForm.data.name}
                            onChange={(e) => profileForm.setData('name', e.target.value)}
                            aria-invalid={Boolean(profileForm.errors.name)}
                            aria-describedby={profileForm.errors.name ? 'profile-name-error' : undefined}
                            required
                        />
                        {profileForm.errors.name && (
                            <p id="profile-name-error" className="text-xs text-destructive">
                                {profileForm.errors.name}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="profile-email">Email</Label>
                        <Input
                            id="profile-email"
                            type="email"
                            autoComplete="email"
                            value={profileForm.data.email}
                            onChange={(e) => profileForm.setData('email', e.target.value)}
                            aria-invalid={Boolean(profileForm.errors.email)}
                            aria-describedby={profileForm.errors.email ? 'profile-email-error' : undefined}
                            required
                        />
                        {profileForm.errors.email && (
                            <p id="profile-email-error" className="text-xs text-destructive">
                                {profileForm.errors.email}
                            </p>
                        )}
                    </div>

                    <Button type="submit" disabled={profileForm.processing}>
                        {profileForm.processing ? 'Menyimpan…' : 'Simpan Profil'}
                    </Button>
                </form>

                {/* Change / Set Password */}
                <form
                    onSubmit={handlePasswordSubmit}
                    className="space-y-4 rounded-[24px] border border-hairline-soft bg-canvas p-6"
                >
                    <div>
                        <h2 className="text-lg font-semibold text-ink">
                            {hasPassword ? 'Ubah Kata Sandi' : 'Atur Kata Sandi'}
                        </h2>
                        <p className="text-xs leading-relaxed text-mute">
                            {hasPassword
                                ? 'Pastikan akun Anda menggunakan kata sandi yang kuat.'
                                : 'Akun Anda dibuat melalui Google. Tambahkan kata sandi agar tetap bisa masuk dengan email.'}
                        </p>
                    </div>

                    {hasPassword && (
                        <div className="space-y-1.5">
                            <Label htmlFor="profile-current-password">Kata Sandi Saat Ini</Label>
                            <Input
                                id="profile-current-password"
                                type="password"
                                autoComplete="current-password"
                                value={passwordForm.data.current_password}
                                onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                                aria-invalid={Boolean(passwordForm.errors.current_password)}
                                aria-describedby={
                                    passwordForm.errors.current_password ? 'profile-current-password-error' : undefined
                                }
                                required
                            />
                            {passwordForm.errors.current_password && (
                                <p id="profile-current-password-error" className="text-xs text-destructive">
                                    {passwordForm.errors.current_password}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="profile-new-password">Kata Sandi Baru</Label>
                        <Input
                            id="profile-new-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Minimal 8 karakter"
                            value={passwordForm.data.password}
                            onChange={(e) => passwordForm.setData('password', e.target.value)}
                            aria-invalid={Boolean(passwordForm.errors.password)}
                            aria-describedby={
                                passwordForm.errors.password ? 'profile-new-password-error' : 'profile-new-password-hint'
                            }
                            required
                        />
                        <p id="profile-new-password-hint" className="text-xs text-mute">
                            Gunakan minimal 8 karakter.
                        </p>
                        {passwordForm.errors.password && (
                            <p id="profile-new-password-error" className="text-xs text-destructive">
                                {passwordForm.errors.password}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="profile-confirm-password">Konfirmasi Kata Sandi Baru</Label>
                        <Input
                            id="profile-confirm-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Ulangi kata sandi baru"
                            value={passwordForm.data.password_confirmation}
                            onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                            required
                        />
                    </div>

                    <Button type="submit" disabled={passwordForm.processing}>
                        {passwordForm.processing ? 'Memperbarui…' : 'Perbarui Kata Sandi'}
                    </Button>
                </form>
            </div>
        </DashboardLayout>
    );
}
