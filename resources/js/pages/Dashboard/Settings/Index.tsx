import { Head, router, useForm } from '@inertiajs/react';
import { BellRing, ImagePlus, MessageCircle, Plus, QrCode, RotateCcw, Send, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HorizontalScrollContainer } from '@/components/HorizontalScrollContainer';
import { QrPosterDialog } from '@/components/QrPosterDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';
import {
    interpolateWhatsappTemplate,
    WHATSAPP_PLACEHOLDERS,
    WHATSAPP_TEMPLATE_META,
    type WhatsappTemplateKey,
    type WhatsappTemplatesMap,
} from '@/lib/whatsappTemplates';

const SECTION_LINKS = [
    { id: 'profil', label: 'Profil' },
    { id: 'aturan', label: 'Aturan Booking' },
    { id: 'whatsapp', label: 'Template WA' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'rekening', label: 'Rekening' },
    { id: 'galeri', label: 'Galeri' },
];

interface BankAccount {
    [key: string]: string;
    bank_name: string;
    account_number: string;
    account_holder: string;
}

interface GalleryItem {
    id: number;
    image_url: string;
    caption: string | null;
}

interface SettingsIndexProps {
    business: {
        id: number;
        name: string;
        slug: string;
        category: string;
        description: string | null;
        qr_poster_subtitle?: string | null;
        phone: string | null;
        address: string | null;
        timezone: string;
        dp_expiry_minutes: number;
        min_booking_lead_minutes: number;
        max_booking_advance_days: number;
        reminder_h1_enabled: boolean;
        reminder_h2_enabled: boolean;
        whatsapp_templates: WhatsappTemplatesMap;
        default_whatsapp_templates: WhatsappTemplatesMap;
        telegram_notifications_enabled: boolean;
        telegram_chat_id: string;
        has_telegram_bot_token: boolean;
        telegram_bot_token_hint: string | null;
        no_show_require_full_dp: boolean;
        no_show_dp_threshold: number;
        is_active: boolean;
        is_owner: boolean;
        bank_accounts: BankAccount[];
        qris_url: string | null;
        logo_url: string | null;
    } | null;
    galleries: GalleryItem[];
}

export default function SettingsIndex({ business, galleries }: SettingsIndexProps) {
    const [deletingGallery, setDeletingGallery] = useState<GalleryItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [qrPosterOpen, setQrPosterOpen] = useState(false);
    const [activeWaTab, setActiveWaTab] = useState<WhatsappTemplateKey>('reminder');
    const [testingTelegram, setTestingTelegram] = useState(false);

    const form = useForm({
        name: business?.name ?? '',
        slug: business?.slug ?? '',
        category: business?.category ?? '',
        description: business?.description ?? '',
        phone: business?.phone ?? '',
        address: business?.address ?? '',
        timezone: business?.timezone ?? 'Asia/Jakarta',
        dp_expiry_minutes: (business?.dp_expiry_minutes ?? 120) as number | '',
        min_booking_lead_minutes: (business?.min_booking_lead_minutes ?? 15) as number | '',
        max_booking_advance_days: (business?.max_booking_advance_days ?? 60) as number | '',
        reminder_h1_enabled: business?.reminder_h1_enabled ?? true,
        reminder_h2_enabled: business?.reminder_h2_enabled ?? true,
        whatsapp_templates: (business?.whatsapp_templates ?? {
            reminder: '',
            dp_verified: '',
            confirmed: '',
            ready_for_pickup: '',
            follow_up: '',
        }) as WhatsappTemplatesMap,
        telegram_notifications_enabled: business?.telegram_notifications_enabled ?? false,
        telegram_bot_token: '',
        clear_telegram_token: false,
        telegram_chat_id: business?.telegram_chat_id ?? '',
        no_show_require_full_dp: business?.no_show_require_full_dp ?? false,
        no_show_dp_threshold: (business?.no_show_dp_threshold ?? 2) as number | '',
        is_active: business?.is_active ?? true,
        bank_accounts: (business?.bank_accounts ?? []) as BankAccount[],
        qris_image: null as File | null,
        remove_qris: false,
        logo_image: null as File | null,
        remove_logo: false,
    });

    const deleteForm = useForm({
        confirm_name: '',
    });

    const galleryForm = useForm({
        image: null as File | null,
        caption: '',
    });

    if (!business) {
        return (
            <DashboardLayout title="Pengaturan Bisnis">
                <p className="text-sm text-mute">Pilih atau buat bisnis terlebih dahulu.</p>
            </DashboardLayout>
        );
    }

    const addBank = () => {
        form.setData('bank_accounts', [
            ...form.data.bank_accounts,
            { bank_name: '', account_number: '', account_holder: '' },
        ]);
    };

    const updateBank = (idx: number, field: keyof BankAccount, value: string) => {
        const next = [...form.data.bank_accounts];
        next[idx] = { ...next[idx], [field]: value };
        form.setData('bank_accounts', next);
    };

    const removeBank = (idx: number) => {
        form.setData(
            'bank_accounts',
            form.data.bank_accounts.filter((_, i) => i !== idx)
        );
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            dp_expiry_minutes: Number(data.dp_expiry_minutes || 15),
            min_booking_lead_minutes: Number(data.min_booking_lead_minutes || 0),
            max_booking_advance_days: Number(data.max_booking_advance_days || 1),
            no_show_dp_threshold: Math.max(1, Number(data.no_show_dp_threshold || 1)),
        }));
        form.post(route('dashboard.settings.update'), {
            forceFormData: true,
            onSuccess: () => {
                form.setData((prev) => ({
                    ...prev,
                    telegram_bot_token: '',
                    clear_telegram_token: false,
                }));
            },
            onError: () => scrollToFirstInvalid(),
        });
    };

    const handleTestTelegram = () => {
        setTestingTelegram(true);
        router.post(
            route('dashboard.settings.telegram.test'),
            {},
            {
                preserveScroll: true,
                onFinish: () => setTestingTelegram(false),
            }
        );
    };

    const updateWhatsappTemplate = (key: WhatsappTemplateKey, value: string) => {
        form.setData('whatsapp_templates', {
            ...form.data.whatsapp_templates,
            [key]: value,
        });
    };

    const insertPlaceholder = (token: string) => {
        const current = form.data.whatsapp_templates[activeWaTab] ?? '';
        updateWhatsappTemplate(activeWaTab, `${current}${current.endsWith(' ') || current === '' ? '' : ' '}${token}`);
    };

    const resetActiveTemplate = () => {
        const defaultVal = business.default_whatsapp_templates?.[activeWaTab] ?? '';
        updateWhatsappTemplate(activeWaTab, defaultVal);
    };

    const handleAddGallery = (e: FormEvent) => {
        e.preventDefault();
        if (!galleryForm.data.image) return;

        galleryForm.post(route('dashboard.settings.gallery.store'), {
            forceFormData: true,
            onSuccess: () => {
                galleryForm.reset();
            },
        });
    };

    const handleDeleteBusiness = (e: FormEvent) => {
        e.preventDefault();
        deleteForm.delete(route('dashboard.businesses.destroy', business.id), {
            onSuccess: () => {
                setShowDeleteConfirm(false);
                deleteForm.reset();
            },
        });
    };

    return (
        <DashboardLayout title="Pengaturan Bisnis & Rekening">
            <Head title="Pengaturan" />

            <div className="max-w-3xl space-y-8">
                <HorizontalScrollContainer
                    as="div"
                    ariaLabel="Lompat ke bagian pengaturan"
                    wrapperClassName="sticky top-16 z-30 -mx-4 bg-canvas/95 py-2 backdrop-blur-xs sm:mx-0"
                    className="flex gap-1.5 px-4 sm:px-0"
                >
                    {SECTION_LINKS.map((s) => (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            className="inline-flex h-9 shrink-0 items-center rounded-full border border-hairline-soft bg-canvas px-3.5 text-xs font-semibold text-mute transition-colors hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                        >
                            {s.label}
                        </a>
                    ))}
                </HorizontalScrollContainer>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div id="profil" className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg font-semibold text-ink">Profil & Link Publik</h2>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setQrPosterOpen(true)}
                                className="rounded-full"
                            >
                                <QrCode className="mr-1.5 size-4" aria-hidden="true" />
                                QR Poster Siap Cetak
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="settings-logo-upload">Logo Bisnis (Opsional)</Label>
                            {business.logo_url && !form.data.remove_logo && !form.data.logo_image && (
                                <div className="flex items-center gap-3">
                                    <img
                                        src={business.logo_url}
                                        alt={`Logo ${business.name}`}
                                        className="size-16 rounded-[30%] object-cover outline-1 -outline-offset-1 outline-black/10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                        onClick={() => form.setData('remove_logo', true)}
                                    >
                                        Hapus Logo
                                    </Button>
                                </div>
                            )}
                            <label
                                htmlFor="settings-logo-upload"
                                className="flex cursor-pointer items-center gap-2 rounded-sm border border-dashed border-control-border bg-field px-4 py-3 text-sm text-ink transition-colors hover:bg-bone focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
                            >
                                <Upload className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                <span className="break-words">
                                    {form.data.logo_image ? form.data.logo_image.name : 'Unggah logo bisnis (JPG/PNG/WebP, maks 2MB)'}
                                </span>
                                <input
                                    id="settings-logo-upload"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="sr-only"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        form.setData((prev) => ({
                                            ...prev,
                                            logo_image: file,
                                            remove_logo: false,
                                        }));
                                    }}
                                />
                            </label>
                            {form.errors.logo_image && (
                                <p className="text-xs text-destructive">{form.errors.logo_image}</p>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-name">Nama Bisnis</Label>
                                <Input
                                    id="settings-name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    aria-invalid={Boolean(form.errors.name)}
                                    required
                                />
                                {form.errors.name && <p className="text-xs text-destructive">{form.errors.name}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-slug">Slug URL (/b/{form.data.slug})</Label>
                                <Input
                                    id="settings-slug"
                                    value={form.data.slug}
                                    onChange={(e) => form.setData('slug', e.target.value)}
                                    aria-invalid={Boolean(form.errors.slug)}
                                    required
                                />
                                {form.errors.slug && <p className="text-xs text-destructive">{form.errors.slug}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-category">Kategori</Label>
                                <Input
                                    id="settings-category"
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    aria-invalid={Boolean(form.errors.category)}
                                    required
                                />
                                {form.errors.category && <p className="text-xs text-destructive">{form.errors.category}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-phone">Nomor WhatsApp Bisnis</Label>
                                <Input
                                    id="settings-phone"
                                    type="tel"
                                    inputMode="tel"
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    placeholder="628123456789"
                                    aria-invalid={Boolean(form.errors.phone)}
                                />
                                {form.errors.phone && <p className="text-xs text-destructive">{form.errors.phone}</p>}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="settings-address">Alamat</Label>
                            <Input id="settings-address" value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="settings-description">Deskripsi Singkat</Label>
                            <Textarea
                                id="settings-description"
                                value={form.data.description}
                                onChange={(e) => form.setData('description', e.target.value)}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-timezone">Zona Waktu</Label>
                                <NativeSelect
                                    id="settings-timezone"
                                    value={form.data.timezone}
                                    onChange={(e) => form.setData('timezone', e.target.value)}
                                >
                                    <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                                    <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                                    <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                                </NativeSelect>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-dp-expiry">Batas Waktu Bayar DP Nanti (Menit)</Label>
                                <Input
                                    id="settings-dp-expiry"
                                    type="number"
                                    min={15}
                                    max={1440}
                                    value={form.data.dp_expiry_minutes}
                                    onChange={(e) => form.setData('dp_expiry_minutes', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.dp_expiry_minutes)}
                                    required
                                />
                                {form.errors.dp_expiry_minutes && (
                                    <p className="text-xs text-destructive">{form.errors.dp_expiry_minutes}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-4">
                            <div>
                                <Label htmlFor="settings-is-active" className="text-sm font-semibold text-ink">
                                    Portal Booking Publik Aktif
                                </Label>
                                <p className="mt-0.5 text-xs text-mute">
                                    Jika dinonaktifkan, link /b/{form.data.slug} tidak dapat diakses pelanggan sementara.
                                </p>
                            </div>
                            <Switch
                                id="settings-is-active"
                                checked={form.data.is_active}
                                onCheckedChange={(val) => form.setData('is_active', val)}
                            />
                        </div>
                    </div>

                    {/* Booking Window & Automated Reminders */}
                    <div id="aturan" className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div>
                            <h2 className="text-lg font-semibold text-ink">Aturan Booking & Pengingat Otomatis</h2>
                            <p className="text-xs text-mute">
                                Batasi jarak waktu pemesanan pelanggan dan aktifkan email pengingat otomatis untuk menekan no-show.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-lead-minutes">Jeda Minimum Sebelum Jadwal (Menit)</Label>
                                <Input
                                    id="settings-lead-minutes"
                                    type="number"
                                    min={0}
                                    max={10080}
                                    value={form.data.min_booking_lead_minutes}
                                    onChange={(e) => form.setData('min_booking_lead_minutes', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.min_booking_lead_minutes)}
                                    required
                                />
                                <p className="text-xs text-mute">
                                    Contoh: 60 menit artinya pelanggan tidak bisa memesan kurang dari 1 jam sebelum jam mulai.
                                </p>
                                {form.errors.min_booking_lead_minutes && (
                                    <p className="text-xs text-destructive">{form.errors.min_booking_lead_minutes}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-max-advance">Batas Maksimal Pemesanan (Hari ke Depan)</Label>
                                <Input
                                    id="settings-max-advance"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={form.data.max_booking_advance_days}
                                    onChange={(e) => form.setData('max_booking_advance_days', parseNumericInput(e.target.value))}
                                    aria-invalid={Boolean(form.errors.max_booking_advance_days)}
                                    required
                                />
                                <p className="text-xs text-mute">
                                    Contoh: 60 hari membatasi kalender publik hingga 2 bulan ke depan.
                                </p>
                                {form.errors.max_booking_advance_days && (
                                    <p className="text-xs text-destructive">{form.errors.max_booking_advance_days}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-4">
                                <div>
                                    <Label htmlFor="settings-reminder-h1" className="text-sm font-semibold text-ink">
                                        Email Pengingat H-1 Hari (24 Jam Sebelumnya)
                                    </Label>
                                    <p className="mt-0.5 text-xs text-mute">
                                        Kirim pengingat otomatis ke email pelanggan yang sudah dikonfirmasi 1 hari sebelum jadwal.
                                    </p>
                                </div>
                                <Switch
                                    id="settings-reminder-h1"
                                    checked={form.data.reminder_h1_enabled}
                                    onCheckedChange={(val) => form.setData('reminder_h1_enabled', val)}
                                />
                            </div>

                            <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-4">
                                <div>
                                    <Label htmlFor="settings-reminder-h2" className="text-sm font-semibold text-ink">
                                        Email Pengingat H-2 Jam
                                    </Label>
                                    <p className="mt-0.5 text-xs text-mute">
                                        Kirim pengingat terakhir 2 jam sebelum jadwal dimulai agar pelanggan datang tepat waktu.
                                    </p>
                                </div>
                                <Switch
                                    id="settings-reminder-h2"
                                    checked={form.data.reminder_h2_enabled}
                                    onCheckedChange={(val) => form.setData('reminder_h2_enabled', val)}
                                />
                            </div>

                            <div className="space-y-3 rounded-sm border border-hairline-soft bg-bone/70 p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <Label
                                            htmlFor="settings-noshow-dp"
                                            className="flex items-center gap-1.5 text-sm font-semibold text-ink"
                                        >
                                            <ShieldAlert className="size-4 text-ink" aria-hidden="true" />
                                            Proteksi No-Show Otomatis (Wajib DP 100%)
                                        </Label>
                                        <p className="mt-0.5 text-xs text-mute">
                                            Jika pelanggan pernah tidak hadir (no-show) mencapai batas tertentu, sistem otomatis mewajibkan DP 100% pada reservasi online berikutnya.
                                        </p>
                                    </div>
                                    <Switch
                                        id="settings-noshow-dp"
                                        checked={form.data.no_show_require_full_dp}
                                        onCheckedChange={(val) => form.setData('no_show_require_full_dp', val)}
                                    />
                                </div>
                                {form.data.no_show_require_full_dp && (
                                    <div className="flex flex-wrap items-center gap-3 pt-1">
                                        <Label htmlFor="settings-noshow-threshold" className="text-xs text-ink">
                                            Berlaku mulai riwayat no-show:
                                        </Label>
                                        <Input
                                            id="settings-noshow-threshold"
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={form.data.no_show_dp_threshold}
                                            onChange={(e) =>
                                                form.setData('no_show_dp_threshold', parseNumericInput(e.target.value))
                                            }
                                            required
                                            className="h-9 w-20 rounded-full bg-canvas text-center font-mono text-sm"
                                        />
                                        <span className="text-xs text-mute">kali tidak hadir</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Template Pesan WhatsApp 1-Klik */}
                    <div id="whatsapp" className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                                    <MessageCircle className="size-5 text-ink" aria-hidden="true" />
                                    Template Pesan WhatsApp 1-Klik
                                </h2>
                                <p className="mt-0.5 text-xs text-mute">
                                    Kustomisasi pesan yang otomatis terisi saat Anda klik tombol WhatsApp di halaman Reservasi.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={resetActiveTemplate}
                                className="rounded-full text-xs"
                            >
                                <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                                Reset Default
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pilih jenis template WhatsApp">
                            {WHATSAPP_TEMPLATE_META.map((item) => {
                                const active = activeWaTab === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setActiveWaTab(item.key)}
                                        className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                                            active
                                                ? 'bg-ink text-canvas'
                                                : 'bg-bone text-ink hover:bg-hairline-soft'
                                        }`}
                                    >
                                        {item.shortLabel}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="wa-template-editor" className="text-xs text-mute">
                                {WHATSAPP_TEMPLATE_META.find((m) => m.key === activeWaTab)?.description}
                            </Label>
                            <Textarea
                                id="wa-template-editor"
                                rows={5}
                                value={form.data.whatsapp_templates[activeWaTab] ?? ''}
                                onChange={(e) => updateWhatsappTemplate(activeWaTab, e.target.value)}
                                className="font-sans text-base md:text-sm"
                            />
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-xs font-medium text-mute">Sisipkan variabel:</span>
                                {WHATSAPP_PLACEHOLDERS.map((p) => (
                                    <button
                                        key={p.token}
                                        type="button"
                                        onClick={() => insertPlaceholder(p.token)}
                                        className="min-h-8 cursor-pointer rounded-full border border-hairline-soft bg-bone px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                        title={p.label}
                                    >
                                        {p.token}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-sm bg-bone p-4">
                            <p className="text-xs font-semibold tracking-wider text-mute uppercase">
                                Pratinjau Pesan
                            </p>
                            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink">
                                {interpolateWhatsappTemplate(form.data.whatsapp_templates[activeWaTab] ?? '', {
                                    customer_name: 'Budi Santoso',
                                    business_name: form.data.name || business.name,
                                    service_name: 'Deep Clean Sepatu',
                                    quantity: 2,
                                    staff_name: 'Raka',
                                    date: 'Sabtu, 21 Nov 2026',
                                    time: 'Drop-off (Jam Buka)',
                                    estimated_ready_date: 'Senin, 23 Nov 2026',
                                    booking_code: 'JNJ-8A2F1C',
                                    dp_amount: 25000,
                                    total_price: 75000,
                                    invoice_url: `https://janjiyan.id/b/${form.data.slug || business.slug}/invoice/contoh`,
                                    business_address: form.data.address || 'Jl. Kemang Raya No. 12',
                                })}
                            </p>
                        </div>
                    </div>

                    {/* Notifikasi Instan Telegram Bot */}
                    <div id="telegram" className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                                    <BellRing className="size-5 text-ink" aria-hidden="true" />
                                    Notifikasi Instan Telegram Bot
                                </h2>
                                <p className="mt-0.5 text-xs text-mute">
                                    Terima notifikasi real-time gratis di HP Anda setiap kali ada reservasi baru atau bukti DP diunggah.
                                </p>
                            </div>
                            <Switch
                                id="settings-telegram-enabled"
                                aria-label="Aktifkan notifikasi Telegram"
                                checked={form.data.telegram_notifications_enabled}
                                onCheckedChange={(val) => form.setData('telegram_notifications_enabled', val)}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="settings-telegram-token">Bot Token (dari @BotFather)</Label>
                                    {business.has_telegram_bot_token && !form.data.clear_telegram_token && (
                                        <Badge variant="success" className="font-mono">
                                            Tersimpan ({business.telegram_bot_token_hint})
                                        </Badge>
                                    )}
                                </div>
                                <Input
                                    id="settings-telegram-token"
                                    type="password"
                                    autoComplete="off"
                                    placeholder={
                                        business.has_telegram_bot_token
                                            ? 'Kosongkan jika tidak ingin mengganti token'
                                            : '123456789:ABCdefGHI...'
                                    }
                                    value={form.data.telegram_bot_token}
                                    onChange={(e) => {
                                        form.setData('telegram_bot_token', e.target.value);
                                        if (e.target.value) form.setData('clear_telegram_token', false);
                                    }}
                                />
                                {form.errors.telegram_bot_token && (
                                    <p className="text-xs text-destructive">{form.errors.telegram_bot_token}</p>
                                )}
                                {business.has_telegram_bot_token && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            form.setData('clear_telegram_token', !form.data.clear_telegram_token)
                                        }
                                        className="cursor-pointer text-xs text-destructive hover:underline"
                                    >
                                        {form.data.clear_telegram_token
                                            ? 'Batal hapus token'
                                            : 'Hapus token tersimpan saat simpan'}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="settings-telegram-chat-id">Chat ID / Group ID</Label>
                                <Input
                                    id="settings-telegram-chat-id"
                                    placeholder="Contoh: 123456789 atau -1001234567890"
                                    value={form.data.telegram_chat_id}
                                    onChange={(e) => form.setData('telegram_chat_id', e.target.value)}
                                />
                                {form.errors.telegram_chat_id && (
                                    <p className="text-xs text-destructive">{form.errors.telegram_chat_id}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-bone p-3.5 text-xs text-mute">
                            <span>
                                Cara cepat: buat bot di <strong className="text-ink">@BotFather</strong> → mulai chat dengan bot Anda → cek Chat ID via <strong className="text-ink">@userinfobot</strong>, lalu simpan pengaturan sebelum tes.
                            </span>
                            {business.has_telegram_bot_token && business.telegram_chat_id && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={testingTelegram}
                                    onClick={handleTestTelegram}
                                    className="shrink-0 rounded-full bg-canvas"
                                >
                                    <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                                    {testingTelegram ? 'Mengirim…' : 'Kirim Pesan Tes'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Bank & QRIS */}
                    <div id="rekening" className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-ink">Rekening Bank & QRIS</h2>
                                <p className="text-xs text-mute">Ditampilkan ke pelanggan saat melakukan DP (0% fee).</p>
                            </div>
                            <Button type="button" variant="secondary" size="sm" onClick={addBank}>
                                <Plus className="size-3.5" aria-hidden="true" />
                                Tambah Bank
                            </Button>
                        </div>

                        {form.data.bank_accounts.map((bank, idx) => (
                            <div key={idx} className="grid items-center gap-2 rounded-md bg-bone p-3 sm:grid-cols-[1fr_1.3fr_1.3fr_auto]">
                                <Input
                                    aria-label={`Nama bank rekening ${idx + 1}`}
                                    className="h-10 rounded-xs bg-canvas text-base md:text-sm"
                                    placeholder="Bank (BCA)"
                                    value={bank.bank_name}
                                    onChange={(e) => updateBank(idx, 'bank_name', e.target.value)}
                                    required
                                />
                                <Input
                                    aria-label={`Nomor rekening ${idx + 1}`}
                                    className="h-10 rounded-xs bg-canvas font-mono text-base md:text-sm"
                                    placeholder="No. Rekening"
                                    value={bank.account_number}
                                    onChange={(e) => updateBank(idx, 'account_number', e.target.value)}
                                    required
                                />
                                <Input
                                    aria-label={`Atas nama rekening ${idx + 1}`}
                                    className="h-10 rounded-xs bg-canvas text-base md:text-sm"
                                    placeholder="Atas Nama"
                                    value={bank.account_holder}
                                    onChange={(e) => updateBank(idx, 'account_holder', e.target.value)}
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Hapus rekening ${bank.bank_name || idx + 1}`}
                                    className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                    onClick={() => removeBank(idx)}
                                >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                            </div>
                        ))}

                        <div className="space-y-2 pt-2">
                            <Label htmlFor="settings-qris-upload">Gambar QRIS Statis (Opsional)</Label>
                            {business.qris_url && !form.data.remove_qris && !form.data.qris_image && (
                                <div className="flex items-center gap-3">
                                    <img
                                        src={business.qris_url}
                                        alt={`QRIS ${business.name}`}
                                        className="size-32 rounded-sm object-cover outline-1 -outline-offset-1 outline-black/10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                        onClick={() => form.setData('remove_qris', true)}
                                    >
                                        Hapus QRIS
                                    </Button>
                                </div>
                            )}
                            <label
                                htmlFor="settings-qris-upload"
                                className="flex cursor-pointer items-center gap-2 rounded-sm border border-dashed border-control-border bg-field px-4 py-3 text-sm text-ink transition-colors hover:bg-bone focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
                            >
                                <Upload className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                <span className="break-words">{form.data.qris_image ? form.data.qris_image.name : 'Unggah gambar QRIS (JPG/PNG)'}</span>
                                <input
                                    id="settings-qris-upload"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="sr-only"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        form.setData((prev) => ({
                                            ...prev,
                                            qris_image: file,
                                            remove_qris: false,
                                        }));
                                    }}
                                />
                            </label>
                            {form.errors.qris_image && (
                                <p className="text-xs text-destructive">{form.errors.qris_image}</p>
                            )}
                        </div>
                    </div>

                    {Object.keys(form.errors).length > 0 && (
                        <div
                            role="alert"
                            data-form-error="true"
                            className="rounded-sm border border-destructive/30 bg-destructive-soft px-4 py-3 text-xs text-destructive"
                        >
                            Terdapat isian pengaturan yang belum valid. Periksa bagian yang ditandai merah di atas.
                        </div>
                    )}

                    {/* Sticky so the single save button is reachable from any of the 5 sections above */}
                    <div className="sticky bottom-20 z-30 flex justify-end lg:bottom-4">
                        <Button type="submit" size="lg" disabled={form.processing} className="shadow-lg">
                            {form.processing ? 'Menyimpan…' : 'Simpan Pengaturan'}
                        </Button>
                    </div>
                </form>

                {/* Portfolio / Business Gallery */}
                <section id="galeri" aria-labelledby="gallery-section-heading" className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <div>
                        <h2 id="gallery-section-heading" className="text-lg font-semibold text-ink">
                            Portofolio & Galeri Usaha
                        </h2>
                        <p className="text-xs text-mute">
                            Tampilkan hasil kerja atau suasana tempat di portal booking publik (maksimal 12 foto).
                        </p>
                    </div>

                    <form onSubmit={handleAddGallery} className="space-y-3 rounded-md bg-bone p-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="gallery-image-upload">Foto Portofolio</Label>
                            <label
                                htmlFor="gallery-image-upload"
                                className="flex cursor-pointer items-center gap-2 rounded-sm border border-dashed border-control-border bg-canvas px-4 py-3 text-sm text-ink transition-colors hover:bg-hairline-soft focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
                            >
                                <ImagePlus className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                <span className="break-words">
                                    {galleryForm.data.image
                                        ? galleryForm.data.image.name
                                        : 'Pilih foto portofolio (JPG/PNG/WebP, maks 3MB)'}
                                </span>
                                <input
                                    id="gallery-image-upload"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="sr-only"
                                    onChange={(e) => galleryForm.setData('image', e.target.files?.[0] ?? null)}
                                />
                            </label>
                            {galleryForm.errors.image && (
                                <p className="text-xs text-destructive">{galleryForm.errors.image}</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex-1 space-y-1.5">
                                <Label htmlFor="gallery-caption">Keterangan Foto (Opsional)</Label>
                                <Input
                                    id="gallery-caption"
                                    className="bg-canvas"
                                    placeholder="Mis. Low Fade & Styling — oleh Dimas"
                                    value={galleryForm.data.caption}
                                    onChange={(e) => galleryForm.setData('caption', e.target.value)}
                                    maxLength={160}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={galleryForm.processing || !galleryForm.data.image}
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                {galleryForm.processing ? 'Mengunggah…' : 'Tambah Foto'}
                            </Button>
                        </div>
                    </form>

                    {galleries.length === 0 ? (
                        <p className="rounded-sm bg-bone p-6 text-center text-sm text-mute">
                            Belum ada foto portofolio yang diunggah.
                        </p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {galleries.map((item) => (
                                <div key={item.id} className="flex flex-col justify-between rounded-sm bg-bone p-2.5">
                                    <div>
                                        <img
                                            src={item.image_url}
                                            alt={item.caption || 'Foto portofolio bisnis'}
                                            className="aspect-[4/3] w-full rounded-xs object-cover outline-1 -outline-offset-1 outline-black/10"
                                        />
                                        {item.caption && (
                                            <p className="mt-2 px-1 text-xs font-medium text-ink line-clamp-2">
                                                {item.caption}
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            aria-label={`Hapus foto ${item.caption || 'portofolio'}`}
                                            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                            onClick={() => setDeletingGallery(item)}
                                        >
                                            <Trash2 className="size-3.5" aria-hidden="true" />
                                            Hapus
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {business.is_owner && (
                    <section
                        aria-labelledby="danger-zone-heading"
                        className="space-y-4 rounded-md border border-destructive/30 bg-destructive-soft p-4 sm:p-6"
                    >
                        <div>
                            <h2 id="danger-zone-heading" className="text-lg font-semibold text-destructive">
                                Hapus Bisnis
                            </h2>
                            <p className="mt-1 text-sm leading-relaxed text-body">
                                Menghapus bisnis akan menghapus permanen seluruh layanan, staff, jadwal, pelanggan, dan riwayat reservasi yang terhubung. Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </div>

                        {!showDeleteConfirm ? (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    deleteForm.reset();
                                    deleteForm.clearErrors();
                                    setShowDeleteConfirm(true);
                                }}
                            >
                                <Trash2 className="size-4" aria-hidden="true" />
                                Hapus Bisnis Permanen
                            </Button>
                        ) : (
                            <form
                                onSubmit={handleDeleteBusiness}
                                className="space-y-4 rounded-sm border border-destructive/30 bg-canvas p-4"
                            >
                                <p className="text-sm leading-relaxed text-mute">
                                    Ketik{' '}
                                    <strong className="font-semibold text-ink">{business.name}</strong> untuk mengonfirmasi penghapusan permanen.
                                </p>
                                <div className="space-y-1.5">
                                    <Label htmlFor="delete-business-confirm">Konfirmasi Nama Bisnis</Label>
                                    <Input
                                        id="delete-business-confirm"
                                        autoComplete="off"
                                        placeholder={business.name}
                                        value={deleteForm.data.confirm_name}
                                        onChange={(e) => deleteForm.setData('confirm_name', e.target.value)}
                                        aria-invalid={Boolean(deleteForm.errors.confirm_name)}
                                        aria-describedby={deleteForm.errors.confirm_name ? 'delete-business-error' : undefined}
                                        required
                                    />
                                    {deleteForm.errors.confirm_name && (
                                        <p id="delete-business-error" className="text-xs text-destructive">
                                            {deleteForm.errors.confirm_name}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                                        Batal
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={deleteForm.processing || deleteForm.data.confirm_name.trim() !== business.name}
                                    >
                                        {deleteForm.processing ? 'Menghapus…' : 'Hapus Bisnis Permanen'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </section>
                )}
            </div>

            <ConfirmDialog
                open={deletingGallery !== null}
                onOpenChange={(open) => !open && setDeletingGallery(null)}
                title="Hapus foto portofolio?"
                description="Foto ini akan dihapus dari halaman booking publik Anda."
                confirmLabel="Hapus Foto"
                onConfirm={() => {
                    if (!deletingGallery) return;
                    router.delete(route('dashboard.settings.gallery.destroy', deletingGallery.id), {
                        onFinish: () => setDeletingGallery(null),
                    });
                }}
            />
            <QrPosterDialog
                open={qrPosterOpen}
                onOpenChange={setQrPosterOpen}
                businessName={form.data.name || business.name}
                businessCategory={form.data.category || business.category}
                businessSlug={form.data.slug || business.slug}
                businessAddress={form.data.address || business.address}
                qrSubtitle={business.qr_poster_subtitle}
                canSaveSubtitle
            />
        </DashboardLayout>
    );
}
