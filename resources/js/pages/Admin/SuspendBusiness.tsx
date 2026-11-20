import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { FormEvent } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SuspendBusinessProps {
    business: {
        id: number;
        name: string;
        slug: string;
    };
}

export default function AdminSuspendBusiness({ business }: SuspendBusinessProps) {
    const form = useForm({ reason: '' });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('admin.businesses.suspend', business.id));
    };

    return (
        <div className="min-h-screen bg-bone text-ink">
            <Head title="Tangguhkan Bisnis — Admin" />
            <header className="border-b border-divider bg-canvas">
                <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <JanjiyanLogo size="sm" />
                        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-canvas">
                            Superadmin
                        </span>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('admin.index')}>
                            <ArrowLeft className="size-3.5" aria-hidden="true" />
                            Kembali ke Admin
                        </Link>
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
                <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <div>
                        <h1 className="text-xl font-semibold text-ink">Tangguhkan Bisnis</h1>
                        <p className="mt-1 text-sm text-mute">
                            Portal publik <span className="font-mono text-ink">/b/{business.slug}</span> ({business.name}) dan operasional dashboard akan diblokir.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="suspend-reason">Alasan Penangguhan *</Label>
                        <Input
                            id="suspend-reason"
                            placeholder="Mis. Pelanggaran syarat layanan / laporan spam"
                            value={form.data.reason}
                            onChange={(e) => form.setData('reason', e.target.value)}
                            aria-invalid={Boolean(form.errors.reason)}
                            required
                        />
                        {form.errors.reason && (
                            <p className="text-xs text-destructive">{form.errors.reason}</p>
                        )}
                    </div>
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button asChild type="button" variant="outline">
                            <Link href={route('admin.index')}>Batal</Link>
                        </Button>
                        <Button type="submit" variant="destructive" disabled={form.processing}>
                            {form.processing ? 'Memproses…' : 'Konfirmasi Tangguhkan Bisnis'}
                        </Button>
                    </div>
                </form>
            </main>
        </div>
    );
}
