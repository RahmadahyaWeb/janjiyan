import { Head, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/AuthLayout';
import type { PageProps } from '@/types';

interface VerifyEmailProps {
    status?: string | null;
}

export default function VerifyEmail({ status }: VerifyEmailProps) {
    const { auth, flash } = usePage<PageProps>().props;
    const { post, processing } = useForm({});

    const handleResend = (e: FormEvent) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    return (
        <AuthLayout skipLabel="Lewati ke instruksi verifikasi">
            <Head title="Verifikasi Email" />

            <h1 className="text-3xl font-semibold text-ink">Verifikasi email Anda.</h1>
            <p className="mt-2 text-sm leading-relaxed text-mute">
                Kami telah mengirim tautan verifikasi ke <strong className="font-semibold text-ink">{auth.user?.email}</strong>. Buka email tersebut dan klik tautannya sebelum masuk ke dashboard.
            </p>

            <div
                role="status"
                aria-live="polite"
                className={
                    status || flash.success
                        ? 'mt-4 rounded-[16px] bg-bone px-4 py-3 text-sm font-semibold text-ink'
                        : 'sr-only'
                }
            >
                {status || flash.success || ''}
            </div>

            <form onSubmit={handleResend} className="mt-6 space-y-3">
                <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? 'Mengirim Ulang…' : 'Kirim Ulang Email Verifikasi'}
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.post(route('logout'))}
                >
                    Keluar dari Akun
                </Button>
            </form>
        </AuthLayout>
    );
}
