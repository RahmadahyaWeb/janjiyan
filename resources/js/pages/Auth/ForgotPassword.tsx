import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/AuthLayout';

interface ForgotPasswordProps {
    status?: string | null;
}

export default function ForgotPassword({ status }: ForgotPasswordProps) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <AuthLayout skipLabel="Lewati ke form reset kata sandi">
            <Head title="Lupa Kata Sandi" />

            <h1 className="text-3xl font-semibold text-ink">Lupa kata sandi?</h1>
            <p className="mt-2 text-sm leading-relaxed text-mute">
                Masukkan email yang terdaftar dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
            </p>

            <div
                role="status"
                aria-live="polite"
                className={status ? 'mt-4 rounded-sm bg-bone px-4 py-3 text-sm font-semibold text-ink' : 'sr-only'}
            >
                {status ?? ''}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        placeholder="nama@bisnis.com"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                        required
                    />
                    {errors.email && (
                        <p id="forgot-email-error" className="text-xs text-destructive">
                            {errors.email}
                        </p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? 'Mengirim Tautan…' : 'Kirim Tautan Reset'}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-mute">
                Ingat kata sandi Anda?{' '}
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
