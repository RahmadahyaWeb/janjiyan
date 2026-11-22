import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { FormEvent } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseNumericInput } from '@/lib/utils';

interface ExtendTrialProps {
    merchant: {
        id: number;
        name: string;
        email: string;
    };
}

export default function AdminExtendTrial({ merchant }: ExtendTrialProps) {
    const form = useForm({
        days: 14 as number | '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, days: Math.max(1, Number(data.days || 1)) }));
        form.post(route('admin.users.extend-trial', merchant.id));
    };

    return (
        <div className="min-h-screen bg-bone text-ink">
            <Head title="Perpanjang Trial Merchant — Admin" />
            <header className="border-b border-divider bg-canvas">
                <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <JanjiyanLogo size="sm" />
                        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-canvas">
                            Superadmin
                        </span>
                    </div>
                    <Button asChild variant="outline" size="icon" className="sm:w-auto sm:px-4">
                        <Link href={route('admin.index')}>
                            <ArrowLeft className="size-4 sm:size-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Kembali ke Admin</span>
                            <span className="sr-only sm:hidden">Kembali ke Admin</span>
                        </Link>
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
                <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <div>
                        <h1 className="text-xl font-semibold text-ink">Perpanjang Trial Merchant</h1>
                        <p className="mt-1 text-sm text-mute [overflow-wrap:anywhere]">
                            Merchant: <span className="font-semibold text-ink">{merchant.name}</span> ({merchant.email})
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="extend-trial-days">Tambah Hari Trial *</Label>
                        <Input
                            id="extend-trial-days"
                            type="number"
                            min={1}
                            max={365}
                            value={form.data.days}
                            onChange={(e) => form.setData('days', parseNumericInput(e.target.value))}
                            aria-invalid={Boolean(form.errors.days)}
                            required
                        />
                        {form.errors.days && (
                            <p className="text-xs text-destructive">{form.errors.days}</p>
                        )}
                    </div>
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                            <Link href={route('admin.index')}>Batal</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing} className="w-full sm:w-auto">
                            {form.processing ? 'Menyimpan…' : 'Simpan Perpanjangan Trial'}
                        </Button>
                    </div>
                </form>
            </main>
        </div>
    );
}
