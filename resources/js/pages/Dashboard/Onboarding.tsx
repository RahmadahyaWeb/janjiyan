import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { FormEvent } from 'react';
import { BusinessTypeSelector } from '@/components/BusinessTypeSelector';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BUSINESS_TYPE_OPTIONS } from '@/lib/businessType';
import type { BusinessType, PageProps } from '@/types';

export default function Onboarding() {
    const { auth } = usePage<PageProps>().props;

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
        form.post(route('onboarding.business.store'));
    };

    return (
        <div className="flex min-h-screen flex-col bg-canvas px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink sm:px-6 sm:py-10">
            <Head title="Setup Profil Bisnis" />

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke form setup bisnis
            </a>

            <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
                <Link
                    href={route('home')}
                    aria-label="Beranda Janjiyan"
                    className="inline-flex min-h-9 items-center rounded-full px-1 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    <JanjiyanLogo />
                </Link>

                <div className="flex items-center gap-3">
                    {auth.user?.email && (
                        <span className="hidden text-xs font-medium text-mute sm:inline">
                            {auth.user.email}
                        </span>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => router.post(route('logout'))}
                    >
                        <LogOut className="size-4" aria-hidden="true" />
                        Keluar
                    </Button>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="mx-auto my-auto w-full max-w-3xl py-8 outline-none">
                <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wider text-electric uppercase">
                        Langkah Terakhir
                    </p>
                    <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
                        Siapkan profil bisnis pertama Anda.
                    </h1>
                    <p className="max-w-2xl text-sm leading-relaxed text-mute">
                        Pilih tipe operasional yang paling sesuai dengan cara bisnis Anda melayani pelanggan. Pengaturan dashboard dan portal pemesanan akan disesuaikan otomatis.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="mt-6 space-y-6 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-8"
                >
                    <BusinessTypeSelector
                        idPrefix="onboarding"
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

                    <div className="grid gap-4 border-t border-divider pt-6 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="onboarding-phone">Nomor WhatsApp Bisnis</Label>
                            <Input
                                id="onboarding-phone"
                                name="phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="081234567890"
                                value={form.data.phone}
                                onChange={(e) => form.setData('phone', e.target.value)}
                                aria-invalid={Boolean(form.errors.phone)}
                                aria-describedby={
                                    form.errors.phone ? 'onboarding-phone-error' : 'onboarding-phone-hint'
                                }
                            />
                            <p id="onboarding-phone-hint" className="text-xs text-mute">
                                Opsional. Ditampilkan ke pelanggan untuk konfirmasi pesanan dan pembayaran.
                            </p>
                            {form.errors.phone && (
                                <p id="onboarding-phone-error" className="text-xs text-destructive">
                                    {form.errors.phone}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="onboarding-address">Alamat Lokasi / Outlet</Label>
                            <Textarea
                                id="onboarding-address"
                                name="address"
                                autoComplete="street-address"
                                placeholder="Jl. Kemang Raya No. 12, Jakarta Selatan"
                                value={form.data.address}
                                onChange={(e) => form.setData('address', e.target.value)}
                                aria-invalid={Boolean(form.errors.address)}
                                aria-describedby={
                                    form.errors.address ? 'onboarding-address-error' : 'onboarding-address-hint'
                                }
                                className="min-h-12"
                            />
                            <p id="onboarding-address-hint" className="text-xs text-mute">
                                Opsional. Dapat dilengkapi atau diubah nanti di Pengaturan.
                            </p>
                            {form.errors.address && (
                                <p id="onboarding-address-error" className="text-xs text-destructive">
                                    {form.errors.address}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-divider pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-relaxed text-mute">
                            Setelah tersimpan, Anda dapat langsung menambahkan layanan dan membagikan link booking.
                        </p>
                        <Button type="submit" className="w-full shrink-0 sm:w-auto" disabled={form.processing}>
                            {form.processing ? 'Menyiapkan Bisnis…' : 'Simpan & Mulai Kelola Bisnis'}
                        </Button>
                    </div>
                </form>
            </main>

            <footer className="mx-auto w-full max-w-3xl pt-4 text-center text-xs text-ash">
                © {new Date().getFullYear()} Janjiyan
            </footer>
        </div>
    );
}
