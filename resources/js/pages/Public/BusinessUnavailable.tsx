import { Head, Link } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';

interface BusinessUnavailableProps {
    businessName: string;
    reason?: string | null;
}

export default function BusinessUnavailable({ businessName, reason }: BusinessUnavailableProps) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12 text-ink">
            <Head title={`${businessName} Tidak Tersedia`} />

            <main className="w-full max-w-md space-y-6 rounded-[24px] border border-hairline-soft bg-canvas p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
                    <ShieldAlert className="size-6" aria-hidden="true" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-xl font-semibold text-ink">Portal Reservasi Ditangguhkan</h1>
                    <p className="text-sm text-mute">
                        Portal reservasi untuk <span className="font-semibold text-ink">{businessName}</span> saat ini tidak tersedia.
                    </p>
                    {reason && (
                        <p className="rounded-[12px] bg-bone px-3 py-2 text-xs text-body">
                            Keterangan: {reason}
                        </p>
                    )}
                </div>

                <Button asChild variant="outline" className="w-full">
                    <Link href={route('home')}>Kembali ke Beranda Janjiyan</Link>
                </Button>
            </main>

            <p className="mt-6 text-xs text-ash">
                <span className="inline-flex items-center gap-1.5">
                    Ditenagai oleh <JanjiyanLogo size="sm" />
                </span>
            </p>
        </div>
    );
}
