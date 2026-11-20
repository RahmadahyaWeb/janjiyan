import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import AuthLayout from '@/layouts/AuthLayout';

interface RegisterProps {
    googleEnabled: boolean;
}

export default function Register({ googleEnabled }: RegisterProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        business_name: '',
        business_category: 'Barbershop & Salon',
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post(route('register.store'));
    };

    return (
        <AuthLayout skipLabel="Lewati ke form pendaftaran">
            <Head title="Daftar Trial 14 Hari" />

            <h1 className="text-3xl font-semibold text-ink">Mulai trial 14 hari gratis.</h1>
            <p className="mt-2 text-sm text-mute">
                Siapkan link booking online bisnis Anda dalam kurang dari lima menit.
            </p>

            {googleEnabled && (
                <>
                    <div className="mt-6">
                        <Button asChild variant="outline" className="w-full">
                            <a href={route('auth.google')}>
                                <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
                                </svg>
                                Daftar dengan Google
                            </a>
                        </Button>
                    </div>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-divider" />
                        <span className="text-xs text-ash">atau daftar dengan email</span>
                        <div className="h-px flex-1 bg-divider" />
                    </div>
                </>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="name">Nama Lengkap</Label>
                    <Input
                        id="name"
                        autoComplete="name"
                        placeholder="Raka Pratama"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? 'reg-name-error' : undefined}
                        required
                    />
                    {errors.name && (
                        <p id="reg-name-error" className="text-xs text-destructive">
                            {errors.name}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="business_name">Nama Bisnis Pertama</Label>
                    <Input
                        id="business_name"
                        autoComplete="organization"
                        placeholder="Barber Rapi Studio"
                        value={data.business_name}
                        onChange={(e) => setData('business_name', e.target.value)}
                        aria-invalid={Boolean(errors.business_name)}
                        aria-describedby={errors.business_name ? 'reg-business-error' : undefined}
                        required
                    />
                    {errors.business_name && (
                        <p id="reg-business-error" className="text-xs text-destructive">
                            {errors.business_name}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="business_category">Kategori Bisnis</Label>
                    <NativeSelect
                        id="business_category"
                        value={data.business_category}
                        onChange={(e) => setData('business_category', e.target.value)}
                        className="font-normal"
                    >
                        <option value="Barbershop & Salon">Barbershop & Salon</option>
                        <option value="Klinik & Kesehatan">Klinik & Kesehatan</option>
                        <option value="Fitness & Olahraga">Fitness & Olahraga</option>
                        <option value="Studio Foto & Kreatif">Studio Foto & Kreatif</option>
                        <option value="Otomotif & Bengkel">Otomotif & Bengkel</option>
                        <option value="Jasa & Layanan">Jasa & Layanan Lainnya</option>
                    </NativeSelect>
                </div>

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
                        aria-describedby={errors.email ? 'reg-email-error' : undefined}
                        required
                    />
                    {errors.email && (
                        <p id="reg-email-error" className="text-xs text-destructive">
                            {errors.email}
                        </p>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="password">Kata Sandi</Label>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Min. 8 karakter"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'reg-password-error' : undefined}
                            required
                        />
                        {errors.password && (
                            <p id="reg-password-error" className="text-xs text-destructive">
                                {errors.password}
                            </p>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="password_confirmation">Konfirmasi</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Ulangi sandi"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            required
                        />
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? 'Menyiapkan Akun…' : 'Buat Akun & Mulai Trial'}
                </Button>

                <p className="text-center text-xs leading-6 text-mute">
                    Dengan mendaftar, Anda menyetujui{' '}
                    <Link
                        href={route('legal.terms')}
                        className="inline rounded-sm py-1 font-semibold text-ink underline underline-offset-2 hover:text-electric focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                    >
                        Syarat &amp; Ketentuan
                    </Link>{' '}
                    serta{' '}
                    <Link
                        href={route('legal.privacy')}
                        className="inline rounded-sm py-1 font-semibold text-ink underline underline-offset-2 hover:text-electric focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                    >
                        Kebijakan Privasi
                    </Link>
                    .
                </p>
            </form>

            <p className="mt-6 text-center text-sm text-mute">
                Sudah punya akun?{' '}
                <Link
                    href={route('login')}
                    className="inline-flex min-h-7 items-center rounded-sm font-semibold text-electric hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    Masuk di sini
                </Link>
            </p>
        </AuthLayout>
    );
}
