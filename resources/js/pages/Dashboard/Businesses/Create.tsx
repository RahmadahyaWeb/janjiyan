import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { BusinessTypeSelector } from '@/components/BusinessTypeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { BUSINESS_TYPE_OPTIONS } from '@/lib/businessType';
import type { BusinessType } from '@/types';

interface BusinessCreateProps {
    canCreateBusiness?: boolean;
}

export default function BusinessCreate({ canCreateBusiness = true }: BusinessCreateProps) {
    const form = useForm<{
        business_type: BusinessType;
        name: string;
        category: string;
        phone: string;
        address: string;
    }>({
        business_type: 'staff_appointment',
        name: '',
        category: BUSINESS_TYPE_OPTIONS[0].categoryPresets[0],
        phone: '',
        address: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('dashboard.businesses.store'));
    };

    return (
        <DashboardLayout title="Tambah Bisnis Baru" back={{ href: route('dashboard'), label: 'Kembali ke Ringkasan' }}>
            <Head title="Tambah Bisnis Baru" />

            {!canCreateBusiness && (
                <div
                    role="note"
                    className="flex flex-col justify-between gap-3 rounded-md border border-warning-border bg-warning-soft px-5 py-4 text-sm text-warning sm:flex-row sm:items-center"
                >
                    <div>
                        <p className="font-semibold">Batas jumlah bisnis pada paket Anda sudah tercapai.</p>
                        <p className="mt-0.5 text-xs text-warning/90">
                            Upgrade paket di halaman Paket &amp; Billing untuk membuka kapasitas bisnis tambahan.
                        </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0 bg-canvas text-ink">
                        <Link href={route('dashboard.billing')}>Lihat Paket &amp; Billing</Link>
                    </Button>
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="max-w-3xl space-y-6 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6"
            >
                <BusinessTypeSelector
                    idPrefix="create-business"
                    businessType={form.data.business_type}
                    onBusinessTypeChange={(value) => form.setData('business_type', value)}
                    businessName={form.data.name}
                    onBusinessNameChange={(value) => form.setData('name', value)}
                    category={form.data.category}
                    onCategoryChange={(value) => form.setData('category', value)}
                    errors={{
                        business_type: form.errors.business_type,
                        name: form.errors.name,
                        category: form.errors.category,
                    }}
                />

                <div className="grid gap-4 border-t border-divider pt-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="create-business-phone">Nomor WhatsApp</Label>
                        <Input
                            id="create-business-phone"
                            name="phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="081234567890"
                            value={form.data.phone}
                            onChange={(e) => form.setData('phone', e.target.value)}
                            aria-invalid={Boolean(form.errors.phone)}
                            aria-describedby={form.errors.phone ? 'create-business-phone-error' : undefined}
                        />
                        {form.errors.phone && (
                            <p id="create-business-phone-error" className="text-xs text-destructive">
                                {form.errors.phone}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="create-business-address">Alamat Lokasi / Outlet</Label>
                        <Textarea
                            id="create-business-address"
                            name="address"
                            autoComplete="street-address"
                            placeholder="Jl. Kemang Raya No. 12, Jakarta Selatan"
                            value={form.data.address}
                            onChange={(e) => form.setData('address', e.target.value)}
                            aria-invalid={Boolean(form.errors.address)}
                            aria-describedby={form.errors.address ? 'create-business-address-error' : undefined}
                            className="min-h-12"
                        />
                        {form.errors.address && (
                            <p id="create-business-address-error" className="text-xs text-destructive">
                                {form.errors.address}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-divider pt-4 sm:flex-row sm:justify-end">
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
