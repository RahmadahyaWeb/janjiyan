import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/AuthLayout';
import type { PageProps } from '@/types';

interface LoginProps {
    googleEnabled: boolean;
}

export default function Login({ googleEnabled }: LoginProps) {
    const { flash } = usePage<PageProps>().props;
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: true,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post(route('login.attempt'));
    };

    return (
        <AuthLayout skipLabel="Lewati ke form login">
            <Head title="Masuk ke Janjiyan" />

            <h1 className="text-3xl font-semibold text-ink">Selamat datang kembali.</h1>
            <p className="mt-2 text-sm text-mute">
                Masuk untuk mengelola jadwal, layanan, dan verifikasi DP bisnis Anda.
            </p>

            {flash.success && (
                <div role="status" className="mt-4 rounded-sm bg-bone px-4 py-3 text-sm font-semibold text-ink">
                    {flash.success}
                </div>
            )}
            {flash.error && (
                <div role="alert" className="mt-4 rounded-sm bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
                    {flash.error}
                </div>
            )}

            {googleEnabled && (
                <>
                    <div className="mt-6">
                        <Button asChild variant="outline" className="w-full">
                            <a href={route('auth.google')}>
                                <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
                                </svg>
                                Lanjutkan dengan Google
                            </a>
                        </Button>
                    </div>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-divider" />
                        <span className="text-xs text-ash">atau email</span>
                        <div className="h-px flex-1 bg-divider" />
                    </div>
                </>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="nama@bisnis.com"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'login-email-error' : undefined}
                        required
                    />
                    {errors.email && (
                        <p id="login-email-error" className="text-xs text-destructive">
                            {errors.email}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="password">Kata Sandi</Label>
                        <Link
                            href={route('password.request')}
                            className="inline-flex min-h-7 items-center rounded-sm text-xs font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            Lupa kata sandi?
                        </Link>
                    </div>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? 'login-password-error' : undefined}
                        required
                    />
                    {errors.password && (
                        <p id="login-password-error" className="text-xs text-destructive">
                            {errors.password}
                        </p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? 'Memproses…' : 'Masuk'}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-mute">
                Belum punya akun?{' '}
                <Link
                    href={route('register')}
                    className="inline-flex min-h-7 items-center rounded-sm font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    Daftar gratis 14 hari
                </Link>
            </p>
        </AuthLayout>
    );
}
