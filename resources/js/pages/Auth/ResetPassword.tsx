import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/AuthLayout';

interface ResetPasswordProps {
    token: string;
    email: string;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const { data, setData, post, processing, errors } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.update'));
    };

    return (
        <AuthLayout skipLabel="Lewati ke form kata sandi baru">
            <Head title="Atur Ulang Kata Sandi" />

            <h1 className="text-3xl font-semibold text-ink">Buat kata sandi baru.</h1>
            <p className="mt-2 text-sm leading-relaxed text-mute">
                Masukkan kata sandi baru untuk akun Janjiyan Anda.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'reset-email-error' : undefined}
                        required
                    />
                    {errors.email && (
                        <p id="reset-email-error" className="text-xs text-destructive">
                            {errors.email}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="reset-password">Kata Sandi Baru</Label>
                    <Input
                        id="reset-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Minimal 8 karakter"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? 'reset-password-error' : 'reset-password-hint'}
                        required
                    />
                    <p id="reset-password-hint" className="text-xs text-mute">
                        Gunakan minimal 8 karakter.
                    </p>
                    {errors.password && (
                        <p id="reset-password-error" className="text-xs text-destructive">
                            {errors.password}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="reset-password-confirmation">Konfirmasi Kata Sandi Baru</Label>
                    <Input
                        id="reset-password-confirmation"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Ulangi kata sandi"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        required
                    />
                </div>

                <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-mute">
                <Link
                    href={route('login')}
                    className="inline-flex min-h-7 items-center rounded-sm font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    Kembali ke halaman masuk
                </Link>
            </p>
        </AuthLayout>
    );
}
