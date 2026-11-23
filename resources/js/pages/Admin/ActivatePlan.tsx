import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { FormEvent } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select';
import { formatRupiah } from '@/lib/format';

interface ActivatePlanProps {
    merchant: {
        id: number;
        name: string;
        email: string;
        current_plan_slug: string | null;
    };
    plans: Array<{
        id: number;
        slug: string;
        name: string;
        price_monthly: number;
        price_yearly: number;
    }>;
}

export default function AdminActivatePlan({ merchant, plans }: ActivatePlanProps) {
    const form = useForm({
        plan_slug: merchant.current_plan_slug ?? plans[1]?.slug ?? plans[0]?.slug ?? 'professional',
        billing_cycle: 'monthly' as 'monthly' | 'yearly',
        notes: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('admin.users.activate-plan', merchant.id));
    };

    return (
        <div className="min-h-screen bg-bone text-ink">
            <Head title="Aktivasi Paket Manual — Admin" />
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
                        <h1 className="text-xl font-semibold text-ink">Aktivasi Paket Manual</h1>
                        <p className="mt-1 text-sm text-mute [overflow-wrap:anywhere]">
                            Merchant: <span className="font-semibold text-ink">{merchant.name}</span> ({merchant.email})
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="admin-plan-slug">Pilih Paket</Label>
                        <SelectField
                            id="admin-plan-slug"
                            value={form.data.plan_slug}
                            onValueChange={(val) => form.setData('plan_slug', val)}
                            options={plans.map((p) => ({
                                value: p.slug,
                                label: `${p.name} (${formatRupiah(p.price_monthly)}/bln)`,
                            }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="admin-billing-cycle">Siklus</Label>
                        <SelectField
                            id="admin-billing-cycle"
                            value={form.data.billing_cycle}
                            onValueChange={(val) => form.setData('billing_cycle', val as 'monthly' | 'yearly')}
                            options={[
                                { value: 'monthly', label: 'Bulanan (+1 Bulan)' },
                                { value: 'yearly', label: 'Tahunan (+1 Tahun)' },
                            ]}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="admin-plan-notes">Catatan Audit (Opsional)</Label>
                        <Input
                            id="admin-plan-notes"
                            placeholder="Mis. Transfer manual BCA / kompensasi"
                            value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)}
                        />
                        {form.errors.notes && (
                            <p className="text-xs text-destructive">{form.errors.notes}</p>
                        )}
                    </div>
                    {Object.keys(form.errors).length > 0 && (
                        <p role="alert" className="text-xs text-destructive">
                            {Object.values(form.errors)[0]}
                        </p>
                    )}
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                            <Link href={route('admin.index')}>Batal</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing} className="w-full sm:w-auto">
                            <ShieldCheck className="size-4" aria-hidden="true" />
                            {form.processing ? 'Memproses…' : 'Aktifkan Paket Sekarang'}
                        </Button>
                    </div>
                </form>
            </main>
        </div>
    );
}
