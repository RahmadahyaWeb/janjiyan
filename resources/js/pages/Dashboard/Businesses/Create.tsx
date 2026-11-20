import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/layouts/DashboardLayout';

export default function BusinessCreate() {
    const form = useForm({
        name: '',
        category: 'Barbershop & Salon',
        phone: '',
        address: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('dashboard.businesses.store'));
    };

    return (
        <DashboardLayout title="Tambah Bisnis Baru">
            <Head title="Tambah Bisnis Baru" />

            <div>
                <Button asChild variant="ghost" size="sm" className="-ml-2 text-mute hover:text-ink">
                    <Link href={route('dashboard')}>
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Kembali ke Ringkasan
                    </Link>
                </Button>
            </div>

            <form
                onSubmit={handleSubmit}
                className="max-w-xl space-y-5 rounded-[24px] border border-hairline-soft bg-canvas p-5 sm:p-6"
            >
                <div className="space-y-1.5">
                    <Label htmlFor="create-business-name">Nama Bisnis *</Label>
                    <Input
                        id="create-business-name"
                        placeholder="Cabang Kemang"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        aria-invalid={Boolean(form.errors.name)}
                        required
                    />
                    {form.errors.name && (
                        <p className="text-xs text-destructive">{form.errors.name}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="create-business-category">Kategori *</Label>
                    <Input
                        id="create-business-category"
                        placeholder="Barbershop & Salon"
                        value={form.data.category}
                        onChange={(e) => form.setData('category', e.target.value)}
                        aria-invalid={Boolean(form.errors.category)}
                        required
                    />
                    {form.errors.category && (
                        <p className="text-xs text-destructive">{form.errors.category}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="create-business-phone">Nomor WhatsApp</Label>
                    <Input
                        id="create-business-phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="08123456789"
                        value={form.data.phone}
                        onChange={(e) => form.setData('phone', e.target.value)}
                        aria-invalid={Boolean(form.errors.phone)}
                    />
                    {form.errors.phone && (
                        <p className="text-xs text-destructive">{form.errors.phone}</p>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    <Button asChild type="button" variant="outline">
                        <Link href={route('dashboard')}>Batal</Link>
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Menyimpan…' : 'Buat Bisnis'}
                    </Button>
                </div>
            </form>
        </DashboardLayout>
    );
}
