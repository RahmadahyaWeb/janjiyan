import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { BellRing, Check, Lock, MessageCircle, Plus, QrCode, RotateCcw, Send, ShieldAlert, Star, Tag, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { BusinessMark } from '@/components/BusinessMark';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HorizontalScrollContainer } from '@/components/HorizontalScrollContainer';
import { QrPosterDialog } from '@/components/QrPosterDialog';
import { QrReviewStickerDialog } from '@/components/QrReviewStickerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColorInput } from '@/components/ui/color-input';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DashboardLayout from '@/layouts/DashboardLayout';
import { BRAND_PRESETS, brandVars, isHex, onBrand } from '@/lib/brand';
import { BUSINESS_TYPE_LOCK_NOTICE, getBusinessTypeConfig, getBusinessTypeOption } from '@/lib/businessType';
import { cn, parseNumericInput, scrollToFirstInvalid } from '@/lib/utils';
import {
    getWhatsappPlaceholdersForBusiness,
    getWhatsappTemplateMetaForBusiness,
    interpolateWhatsappTemplate,
    type WhatsappTemplateKey,
    type WhatsappTemplatesMap,
} from '@/lib/whatsappTemplates';
import type { BusinessType, PageProps } from '@/types';

const SETTINGS_TABS = [
    { id: 'profil', label: 'Profil Toko' },
    { id: 'tampilan', label: 'Tampilan' },
    { id: 'aturan', label: 'Aturan Booking' },
    { id: 'notifikasi', label: 'Notifikasi' },
    { id: 'pembayaran', label: 'Pembayaran' },
    { id: 'ulasan', label: 'Ulasan Google' },
    { id: 'galeri', label: 'Portofolio' },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]['id'];

/** Which tab holds a form field, so a validation error can open it. */
function tabForField(field: string): SettingsTab {
    if (/^(brand_color|cover_image|remove_cover)/.test(field)) return 'tampilan';
    if (/^(min_booking|max_booking|reminder_|no_show_)/.test(field)) return 'aturan';
    if (/^(whatsapp_templates|telegram_|clear_telegram)/.test(field)) return 'notifikasi';
    if (/^(bank_accounts|qris_image|remove_qris)/.test(field)) return 'pembayaran';
    if (/^(google_review|review_)/.test(field)) return 'ulasan';
    return 'profil';
}

function initialTab(): SettingsTab {
    if (typeof window === 'undefined') return 'profil';
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    return SETTINGS_TABS.some((t) => t.id === fromUrl) ? (fromUrl as SettingsTab) : 'profil';
}

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
        business_type: BusinessType;
        description: string | null;
        qr_poster_subtitle?: string | null;
        google_review_url?: string | null;
        review_redirect_min_rating?: number;
        review_enabled?: boolean;
        review_sticker_subtitle?: string | null;
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
        brand_color: string | null;
        cover_url: string | null;
    } | null;
    galleries: GalleryItem[];
    canUseGoogleReview?: boolean;
    google_review_url?: string | null;
    review_redirect_min_rating?: number;
    review_enabled?: boolean;
    review_sticker_subtitle?: string | null;
}

export default function SettingsIndex({
    business,
    galleries,
    canUseGoogleReview,
    google_review_url: propGoogleReviewUrl,
    review_redirect_min_rating: propReviewMinRating,
    review_enabled: propReviewEnabled,
    review_sticker_subtitle: propReviewStickerSubtitle,
}: SettingsIndexProps) {
    const { subscription, tenantBaseDomain = 'janjiyan.web.id' } = usePage<PageProps>().props;
    const resolvedCanUseGoogleReview =
        canUseGoogleReview ?? subscription?.capabilities?.can_use_google_review ?? false;

    const [deletingGallery, setDeletingGallery] = useState<GalleryItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [qrPosterOpen, setQrPosterOpen] = useState(false);
    const [qrReviewStickerOpen, setQrReviewStickerOpen] = useState(false);
    const [activeWaTab, setActiveWaTab] = useState<WhatsappTemplateKey>('reminder');
    const [testingTelegram, setTestingTelegram] = useState(false);
    const [tab, setTab] = useState<SettingsTab>(initialTab);

    // Keep the tab in the URL (without an Inertia visit) so refresh and save land on the same tab.
    const changeTab = (next: SettingsTab) => {
        setTab(next);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', next);
        window.history.replaceState(window.history.state, '', url);
    };

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
        brand_color: business?.brand_color ?? '',
        cover_image: null as File | null,
        remove_cover: false,
        google_review_url: business?.google_review_url ?? propGoogleReviewUrl ?? '',
        review_redirect_min_rating: business?.review_redirect_min_rating ?? propReviewMinRating ?? 4,
        review_enabled: business?.review_enabled ?? propReviewEnabled ?? true,
        review_sticker_subtitle: business?.review_sticker_subtitle ?? propReviewStickerSubtitle ?? '',
    });

    // Selected-but-unsaved cover shows in the preview; the object URL is freed when it changes.
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    useEffect(() => {
        if (form.data.cover_image) {
            const url = URL.createObjectURL(form.data.cover_image);
            setCoverPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setCoverPreviewUrl(form.data.remove_cover ? null : (business?.cover_url ?? null));
    }, [form.data.cover_image, form.data.remove_cover, business?.cover_url]);

    const deleteForm = useForm({
        confirm_name: '',
    });

    const galleryForm = useForm({
        image: null as File | null,
        caption: '',
    });

    const businessConfig = getBusinessTypeConfig(business?.business_type);
    const businessTypeOption = getBusinessTypeOption(business?.business_type);
    const filteredWaMeta = getWhatsappTemplateMetaForBusiness(business?.business_type);
    const filteredWaPlaceholders = getWhatsappPlaceholdersForBusiness(business?.business_type);
    const resolvedWaTab: WhatsappTemplateKey = filteredWaMeta.some((m) => m.key === activeWaTab)
        ? activeWaTab
        : (filteredWaMeta[0]?.key ?? 'reminder');

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
        form.transform((data) => {
            const payload = {
                ...data,
                dp_expiry_minutes: Number(data.dp_expiry_minutes || 15),
                min_booking_lead_minutes: Number(data.min_booking_lead_minutes || 0),
                max_booking_advance_days: Number(data.max_booking_advance_days || 1),
                no_show_dp_threshold: Math.max(1, Number(data.no_show_dp_threshold || 1)),
                google_review_url: data.google_review_url.trim(),
                review_redirect_min_rating: Number(data.review_redirect_min_rating || 4),
                review_enabled: Boolean(data.review_enabled),
                review_sticker_subtitle: data.review_sticker_subtitle.trim(),
            };

            if (!resolvedCanUseGoogleReview) {
                const {
                    google_review_url: _googleUrl,
                    review_redirect_min_rating: _minRating,
                    review_enabled: _reviewEnabled,
                    review_sticker_subtitle: _stickerSubtitle,
                    ...withoutReviewFields
                } = payload;
                return withoutReviewFields;
            }

            return payload;
        });
        form.post(route('dashboard.settings.update'), {
            forceFormData: true,
            onSuccess: () => {
                form.setData((prev) => ({
                    ...prev,
                    telegram_bot_token: '',
                    clear_telegram_token: false,
                    cover_image: null,
                    remove_cover: false,
                }));
            },
            onError: (errors) => {
                const firstField = Object.keys(errors)[0];
                if (firstField) changeTab(tabForField(firstField));
                scrollToFirstInvalid();
            },
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
        const current = form.data.whatsapp_templates[resolvedWaTab] ?? '';
        updateWhatsappTemplate(resolvedWaTab, `${current}${current.endsWith(' ') || current === '' ? '' : ' '}${token}`);
    };

    const resetActiveTemplate = () => {
        const defaultVal = business.default_whatsapp_templates?.[resolvedWaTab] ?? '';
        updateWhatsappTemplate(resolvedWaTab, defaultVal);
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
        <DashboardLayout title="Pengaturan Bisnis">
            <Head title="Pengaturan" />

            <div className="max-w-4xl space-y-8">
                <HorizontalScrollContainer
                    as="div"
                    ariaLabel="Bagian pengaturan"
                    wrapperClassName="sticky top-16 z-30 -mx-4 bg-canvas py-2 sm:mx-0"
                    className="flex gap-1.5 pl-4 pr-10 sm:px-0"
                >
                    {SETTINGS_TABS.map((t) => {
                        const active = tab === t.id;
                        const hasError = Object.keys(form.errors).some((field) => tabForField(field) === t.id);
                        return (
                            <button
                                key={t.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => changeTab(t.id)}
                                className={cn(
                                    'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                    active
                                        ? 'border-ink bg-ink text-canvas'
                                        : 'border-hairline-soft bg-canvas text-mute hover:bg-bone hover:text-ink'
                                )}
                            >
                                {t.label}
                                {hasError && (
                                    <>
                                        <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                                        <span className="sr-only"> (ada isian yang perlu diperbaiki)</span>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </HorizontalScrollContainer>

                {/* noValidate: fields on hidden tabs can't show browser bubbles; server errors open the right tab. */}
                <form onSubmit={handleSubmit} noValidate className="space-y-8">
                    <div id="profil" hidden={tab !== 'profil'} className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
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

                        <div className="flex items-start gap-3 rounded-sm border border-hairline-soft bg-bone/70 p-3.5">
                            <Lock className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-ink">Tipe Bisnis:</span>
                                    <Badge variant="secondary">{businessTypeOption.label}</Badge>
                                    <Badge variant="outline" className="gap-1">
                                        <Lock className="size-3" aria-hidden="true" />
                                        Terkunci Permanen
                                    </Badge>
                                </div>
                                <p className="text-xs leading-relaxed text-mute">
                                    {BUSINESS_TYPE_LOCK_NOTICE}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="settings-logo-upload">Logo Bisnis (Opsional)</Label>
                            {business.logo_url && !form.data.remove_logo && !form.data.logo_image && (
                                <div className="flex flex-wrap items-center gap-3">
                                    <img
                                        src={business.logo_url}
                                        alt={`Logo ${business.name}`}
                                        className="size-16 shrink-0 rounded-[30%] object-cover outline-1 -outline-offset-1 outline-black/10"
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
                            <FileUpload
                                id="settings-logo-upload"
                                file={form.data.logo_image}
                                accept="image/png,image/jpeg,image/webp"
                                placeholder="Unggah logo bisnis (JPG/PNG/WebP, maks 2MB)"
                                onFileChange={(file) => {
                                    form.setData((prev) => ({
                                        ...prev,
                                        logo_image: file,
                                        remove_logo: false,
                                    }));
                                }}
                            />
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
                            <div className="min-w-0 space-y-1.5">
                                <Label htmlFor="settings-slug" className="block break-all">
                                    {`Slug URL (${form.data.slug || business.slug}.${tenantBaseDomain})`}
                                </Label>
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
                                <SelectField
                                    id="settings-timezone"
                                    value={form.data.timezone}
                                    onValueChange={(val) => form.setData('timezone', val)}
                                    options={[
                                        { value: 'Asia/Jakarta', label: 'WIB (Asia/Jakarta)' },
                                        { value: 'Asia/Makassar', label: 'WITA (Asia/Makassar)' },
                                        { value: 'Asia/Jayapura', label: 'WIT (Asia/Jayapura)' },
                                    ]}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-dp-expiry">Batas Waktu Bayar Uang Muka Nanti (Menit)</Label>
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
                                <p className="text-xs text-mute">
                                    Berlaku untuk layanan yang mengaktifkan uang muka dengan opsi bayar nanti.
                                </p>
                                {form.errors.dp_expiry_minutes && (
                                    <p className="text-xs text-destructive">{form.errors.dp_expiry_minutes}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-4">
                            <div className="min-w-0">
                                <Label htmlFor="settings-is-active" className="text-sm font-semibold text-ink">
                                    Portal Booking Publik Aktif
                                </Label>
                                <p className="mt-0.5 text-xs text-mute [overflow-wrap:anywhere]">
                                    Jika dinonaktifkan, link {form.data.slug || business.slug}.{tenantBaseDomain} tidak dapat diakses pelanggan sementara.
                                </p>
                            </div>
                            <Switch
                                id="settings-is-active"
                                className="shrink-0"
                                checked={form.data.is_active}
                                onCheckedChange={(val) => form.setData('is_active', val)}
                            />
                        </div>
                    </div>

                    {/* Public shop page look: color + cover */}
                    <div id="tampilan" hidden={tab !== 'tampilan'} className="scroll-mt-12 space-y-5 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div>
                            <h2 className="text-lg font-semibold text-ink">Tampilan halaman toko</h2>
                            <p className="mt-1 text-sm text-mute [overflow-wrap:anywhere]">
                                Warna dan foto ini muncul di {form.data.slug || business.slug}.{tenantBaseDomain}. Warna teks di atasnya diatur otomatis supaya tetap terbaca.
                            </p>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
                            <div className="min-w-0 space-y-5">
                                <fieldset className="space-y-2.5">
                                    <legend className="text-sm font-medium text-ink">Warna toko</legend>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            aria-pressed={!form.data.brand_color}
                                            onClick={() => form.setData('brand_color', '')}
                                            className={cn(
                                                'inline-flex h-10 cursor-pointer items-center rounded-full border border-hairline px-3.5 text-xs font-semibold text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                                !form.data.brand_color && 'ring-2 ring-ink ring-offset-2'
                                            )}
                                        >
                                            Tanpa warna
                                        </button>
                                        {BRAND_PRESETS.map((hex) => {
                                            const active = form.data.brand_color.toLowerCase() === hex;
                                            return (
                                                <button
                                                    key={hex}
                                                    type="button"
                                                    aria-pressed={active}
                                                    aria-label={`Warna ${hex}`}
                                                    onClick={() => form.setData('brand_color', hex)}
                                                    style={{ backgroundColor: hex, color: onBrand(hex) }}
                                                    className={cn(
                                                        'flex size-10 cursor-pointer items-center justify-center rounded-full outline-1 -outline-offset-1 outline-black/10 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                                        active && 'ring-2 ring-ink ring-offset-2'
                                                    )}
                                                >
                                                    {active && <Check className="size-4" aria-hidden="true" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="settings-brand-color" className="sr-only">
                                            Kode warna hex
                                        </Label>
                                        <ColorInput
                                            id="settings-brand-color"
                                            value={form.data.brand_color}
                                            onValueChange={(val) => form.setData('brand_color', val)}
                                            aria-invalid={Boolean(form.errors.brand_color)}
                                            aria-describedby={form.errors.brand_color ? 'settings-brand-color-error' : undefined}
                                            className="max-w-48"
                                        />
                                    </div>
                                    {form.errors.brand_color && (
                                        <p id="settings-brand-color-error" className="text-xs text-destructive">
                                            Format warna harus #RRGGBB, misalnya #16423c.
                                        </p>
                                    )}
                                </fieldset>

                                <div className="space-y-2">
                                    <Label htmlFor="settings-cover-upload">Foto cover (Opsional)</Label>
                                    <p className="text-xs text-mute">
                                        Tanpa foto cover, halaman memakai foto galeri pertama, lalu foto layanan, lalu warna polos.
                                    </p>
                                    {business.cover_url && !form.data.remove_cover && !form.data.cover_image && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                            onClick={() => form.setData('remove_cover', true)}
                                        >
                                            Hapus foto cover
                                        </Button>
                                    )}
                                    <FileUpload
                                        id="settings-cover-upload"
                                        file={form.data.cover_image}
                                        accept="image/png,image/jpeg,image/webp"
                                        placeholder="Unggah foto cover (JPG/PNG/WebP, maks 5MB, mendatar)"
                                        aria-describedby={form.errors.cover_image ? 'settings-cover-error' : undefined}
                                        onFileChange={(file) => {
                                            form.setData((prev) => ({ ...prev, cover_image: file, remove_cover: false }));
                                        }}
                                    />
                                    {form.errors.cover_image && (
                                        <p id="settings-cover-error" className="text-xs text-destructive">
                                            {form.errors.cover_image}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Mini preview of the hub top */}
                            <div
                                aria-hidden="true"
                                style={brandVars(isHex(form.data.brand_color) ? form.data.brand_color : null)}
                                className="overflow-hidden rounded-md bg-canvas outline-1 -outline-offset-1 outline-black/10"
                            >
                                <div className="relative">
                                    <div className="h-20 overflow-hidden bg-(--band)">
                                        {coverPreviewUrl && <img src={coverPreviewUrl} alt="" className="size-full object-cover" />}
                                    </div>
                                    <BusinessMark
                                        name={form.data.name || 'Toko'}
                                        logoUrl={form.data.remove_logo ? null : business.logo_url}
                                        branded
                                        className="absolute bottom-0 left-1/2 size-14 -translate-x-1/2 translate-y-1/2 border-[3px] border-canvas text-lg font-bold"
                                    />
                                </div>
                                <div className="px-3 pt-9 pb-3 text-center">
                                    <p className="truncate text-sm font-bold text-ink">{form.data.name || 'Nama toko'}</p>
                                    <div className="mt-2.5 rounded-xl bg-(--brand) px-3 py-2.5 text-left text-xs font-semibold text-(--on-brand)">
                                        {businessConfig.publicPortal.ctaLabel}
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-bone px-3 py-2 text-left text-xs font-semibold text-ink">
                                        <span className="flex size-6 items-center justify-center rounded-md bg-(--brand-soft) text-(--brand-ink)">
                                            <Tag className="size-3.5" />
                                        </span>
                                        Daftar harga
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booking Window & Automated Reminders */}
                    <div id="aturan" hidden={tab !== 'aturan'} className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div>
                            <h2 className="text-lg font-semibold text-ink">Aturan Booking &amp; Pengingat Otomatis</h2>
                            <p className="text-xs text-mute">
                                {businessConfig.settings.showNoShowDp
                                    ? 'Batasi jarak waktu pemesanan pelanggan dan aktifkan email pengingat otomatis untuk menekan no-show.'
                                    : 'Batasi jarak hari pemesanan pelanggan dan aktifkan email pengingat otomatis H-1.'}
                            </p>
                        </div>

                        <div
                            className={cn(
                                'grid gap-4',
                                businessConfig.settings.showLeadTimeMinutes ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
                            )}
                        >
                            {businessConfig.settings.showLeadTimeMinutes && (
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
                            )}
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
                                <div className="min-w-0">
                                    <Label htmlFor="settings-reminder-h1" className="text-sm font-semibold text-ink">
                                        Email Pengingat H-1 Hari (24 Jam Sebelumnya)
                                    </Label>
                                    <p className="mt-0.5 text-xs text-mute">
                                        Kirim pengingat otomatis ke email pelanggan yang sudah dikonfirmasi 1 hari sebelum jadwal.
                                    </p>
                                </div>
                                <Switch
                                    id="settings-reminder-h1"
                                    className="shrink-0"
                                    checked={form.data.reminder_h1_enabled}
                                    onCheckedChange={(val) => form.setData('reminder_h1_enabled', val)}
                                />
                            </div>

                            {businessConfig.settings.showReminderH2 && (
                                <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-4">
                                    <div className="min-w-0">
                                        <Label htmlFor="settings-reminder-h2" className="text-sm font-semibold text-ink">
                                            Email Pengingat H-2 Jam
                                        </Label>
                                        <p className="mt-0.5 text-xs text-mute">
                                            Kirim pengingat terakhir 2 jam sebelum jadwal dimulai agar pelanggan datang tepat waktu.
                                        </p>
                                    </div>
                                    <Switch
                                        id="settings-reminder-h2"
                                        className="shrink-0"
                                        checked={form.data.reminder_h2_enabled}
                                        onCheckedChange={(val) => form.setData('reminder_h2_enabled', val)}
                                    />
                                </div>
                            )}

                            {businessConfig.settings.showNoShowDp && (
                                <div className="space-y-3 rounded-sm border border-hairline-soft bg-bone/70 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <Label
                                                htmlFor="settings-noshow-dp"
                                                className="flex items-center gap-1.5 text-sm font-semibold text-ink"
                                            >
                                                <ShieldAlert className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                                Proteksi No-Show Otomatis (Wajib Uang Muka 100%)
                                            </Label>
                                            <p className="mt-0.5 text-xs text-mute">
                                                Jika pelanggan pernah tidak hadir (no-show) mencapai batas tertentu, sistem otomatis mewajibkan uang muka 100% pada {businessConfig.bookings.itemSingular.toLowerCase()} online berikutnya.
                                            </p>
                                        </div>
                                        <Switch
                                            id="settings-noshow-dp"
                                            className="shrink-0"
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
                                                className="h-10 w-20 rounded-full bg-canvas py-2 text-center font-mono text-base tabular-nums md:text-sm"
                                            />
                                            <span className="text-xs text-mute">kali tidak hadir</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Template Pesan WhatsApp 1-Klik */}
                    <div id="whatsapp" hidden={tab !== 'notifikasi'} className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                                    <MessageCircle className="size-5 text-ink" aria-hidden="true" />
                                    Template Pesan WhatsApp 1-Klik
                                </h2>
                                <p className="mt-0.5 text-xs text-mute">
                                    Kustomisasi pesan yang otomatis terisi saat Anda klik tombol WhatsApp di halaman {businessConfig.bookings.pageTitle}.
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

                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih jenis template WhatsApp">
                            {filteredWaMeta.map((item) => {
                                const active = resolvedWaTab === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setActiveWaTab(item.key)}
                                        className={`min-h-10 cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
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
                                {filteredWaMeta.find((m) => m.key === resolvedWaTab)?.description}
                            </Label>
                            <Textarea
                                id="wa-template-editor"
                                rows={5}
                                value={form.data.whatsapp_templates[resolvedWaTab] ?? ''}
                                onChange={(e) => updateWhatsappTemplate(resolvedWaTab, e.target.value)}
                                className="font-sans text-base md:text-sm"
                            />
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-xs font-medium text-mute">Sisipkan variabel:</span>
                                {filteredWaPlaceholders.map((p) => (
                                    <button
                                        key={p.token}
                                        type="button"
                                        onClick={() => insertPlaceholder(p.token)}
                                        className="min-h-9 cursor-pointer rounded-full border border-hairline-soft bg-bone px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
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
                            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink [overflow-wrap:anywhere]">
                                {interpolateWhatsappTemplate(form.data.whatsapp_templates[resolvedWaTab] ?? '', {
                                    customer_name: 'Budi Santoso',
                                    business_name: form.data.name || business.name,
                                    service_name:
                                        business.business_type === 'dropoff'
                                            ? 'Deep Clean Sepatu'
                                            : business.business_type === 'space_booking'
                                              ? 'Lapangan Padel Court A (1 Jam)'
                                              : 'Signature Haircut & Wash',
                                    quantity: 2,
                                    unit_label: 'pasang',
                                    staff_name: business.business_type === 'staff_appointment' ? 'Raka' : null,
                                    date: 'Sabtu, 21 Nov 2026',
                                    time: business.business_type === 'dropoff' ? 'Drop-off (Jam Buka)' : '14:00',
                                    estimated_ready_date: 'Senin, 23 Nov 2026',
                                    booking_code: 'JNJ-8A2F1C',
                                    dp_amount: 25000,
                                    total_price: 75000,
                                    invoice_url: `https://${form.data.slug || business.slug}.janjiyan.web.id/invoice/contoh`,
                                    review_url: `https://${form.data.slug || business.slug}.janjiyan.web.id/review?token=contoh`,
                                    business_address: form.data.address || 'Jl. Kemang Raya No. 12',
                                })}
                            </p>
                        </div>
                    </div>

                    {/* Notifikasi Instan Telegram Bot */}
                    <div id="telegram" hidden={tab !== 'notifikasi'} className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                                    <BellRing className="size-5 shrink-0 text-ink" aria-hidden="true" />
                                    <span>Notifikasi Instan Telegram Bot</span>
                                </h2>
                                <p className="mt-0.5 text-xs text-mute">
                                    Terima notifikasi real-time gratis di HP Anda setiap kali ada {businessConfig.bookings.itemSingular.toLowerCase()} baru atau bukti uang muka diunggah.
                                </p>
                            </div>
                            <Switch
                                id="settings-telegram-enabled"
                                className="shrink-0"
                                aria-label="Aktifkan notifikasi Telegram"
                                checked={form.data.telegram_notifications_enabled}
                                onCheckedChange={(val) => form.setData('telegram_notifications_enabled', val)}
                            />
                        </div>

                        {/* Token fields only matter once Telegram is switched on. */}
                        <div hidden={!form.data.telegram_notifications_enabled} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="min-w-0 space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <Label htmlFor="settings-telegram-token">Bot Token (dari @BotFather)</Label>
                                        {business.has_telegram_bot_token && !form.data.clear_telegram_token && (
                                            <Badge variant="success" className="max-w-full font-mono">
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
                                            className="inline-flex min-h-9 cursor-pointer items-center text-xs text-destructive hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                        >
                                            {form.data.clear_telegram_token
                                                ? 'Batal hapus token'
                                                : 'Hapus token tersimpan saat simpan'}
                                        </button>
                                    )}
                                </div>

                                <div className="min-w-0 space-y-1.5">
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

                            <div className="flex flex-col gap-3 rounded-sm bg-bone p-3.5 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
                                <span className="min-w-0 leading-relaxed">
                                    Cara cepat: buat bot di <strong className="text-ink">@BotFather</strong> → mulai chat dengan bot Anda → cek Chat ID via <strong className="text-ink">@userinfobot</strong>, lalu simpan pengaturan sebelum tes.
                                </span>
                                {business.has_telegram_bot_token && business.telegram_chat_id && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={testingTelegram}
                                        onClick={handleTestTelegram}
                                        className="w-full shrink-0 rounded-full bg-canvas sm:w-auto"
                                    >
                                        <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                                        {testingTelegram ? 'Mengirim…' : 'Kirim Pesan Tes'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bank & QRIS */}
                    <div id="rekening" hidden={tab !== 'pembayaran'} className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-ink">Rekening Bank & QRIS</h2>
                                <p className="text-xs text-mute">Ditampilkan ke pelanggan saat melakukan transfer uang muka atau pembayaran (0% fee).</p>
                            </div>
                            <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" onClick={addBank}>
                                <Plus className="size-3.5" aria-hidden="true" />
                                Tambah Bank
                            </Button>
                        </div>

                        {form.data.bank_accounts.map((bank, idx) => (
                            <div key={idx} className="grid items-center gap-2 rounded-md bg-bone p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto]">
                                <Input
                                    aria-label={`Nama bank rekening ${idx + 1}`}
                                    className="h-10 min-w-0 rounded-xs bg-canvas py-2 text-base md:text-sm"
                                    placeholder="Bank (BCA)"
                                    value={bank.bank_name}
                                    onChange={(e) => updateBank(idx, 'bank_name', e.target.value)}
                                    required
                                />
                                <Input
                                    aria-label={`Nomor rekening ${idx + 1}`}
                                    className="h-10 min-w-0 rounded-xs bg-canvas py-2 font-mono text-base tabular-nums md:text-sm"
                                    placeholder="No. Rekening"
                                    value={bank.account_number}
                                    onChange={(e) => updateBank(idx, 'account_number', e.target.value)}
                                    required
                                />
                                <Input
                                    aria-label={`Atas nama rekening ${idx + 1}`}
                                    className="h-10 min-w-0 rounded-xs bg-canvas py-2 text-base md:text-sm"
                                    placeholder="Atas Nama"
                                    value={bank.account_holder}
                                    onChange={(e) => updateBank(idx, 'account_holder', e.target.value)}
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Hapus rekening ${bank.bank_name || idx + 1}`}
                                    className="w-full justify-center text-destructive hover:bg-destructive-soft hover:text-destructive sm:size-9 sm:w-9 sm:px-0"
                                    onClick={() => removeBank(idx)}
                                >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                    <span className="sm:hidden">Hapus Rekening</span>
                                </Button>
                            </div>
                        ))}

                        <div className="space-y-2 pt-2">
                            <Label htmlFor="settings-qris-upload">Gambar QRIS Statis (Opsional)</Label>
                            {business.qris_url && !form.data.remove_qris && !form.data.qris_image && (
                                <div className="flex flex-wrap items-center gap-3">
                                    <img
                                        src={business.qris_url}
                                        alt={`QRIS ${business.name}`}
                                        className="size-32 shrink-0 rounded-sm object-cover outline-1 -outline-offset-1 outline-black/10"
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
                            <FileUpload
                                id="settings-qris-upload"
                                file={form.data.qris_image}
                                accept="image/png,image/jpeg,image/webp"
                                placeholder="Unggah gambar QRIS (JPG/PNG)"
                                onFileChange={(file) => {
                                    form.setData((prev) => ({
                                        ...prev,
                                        qris_image: file,
                                        remove_qris: false,
                                    }));
                                }}
                            />
                            {form.errors.qris_image && (
                                <p className="text-xs text-destructive">{form.errors.qris_image}</p>
                            )}
                        </div>
                    </div>

                    {/* Google Maps Review & Stiker QR */}
                    <div id="ulasan" hidden={tab !== 'ulasan'} className="scroll-mt-12 space-y-5 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                                        <Star className="size-5 shrink-0 text-ink" aria-hidden="true" />
                                        <span>Ulasan Pelanggan &amp; Google Maps</span>
                                    </h2>
                                    {!resolvedCanUseGoogleReview && (
                                        <Badge variant="popular" className="gap-1">
                                            <Lock className="size-3" aria-hidden="true" />
                                            Pro / Enterprise
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs leading-relaxed text-mute">
                                    Arahkan pelanggan dengan penilaian tinggi langsung ke Google Maps Review, sementara kritik dan saran tetap masuk ke kotak masuk privat Anda.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setQrReviewStickerOpen(true)}
                                className="w-full rounded-full sm:w-auto"
                            >
                                <QrCode className="mr-1.5 size-4" aria-hidden="true" />
                                Buka Stiker QR Ulasan
                            </Button>
                        </div>

                        {!resolvedCanUseGoogleReview && (
                            <div className="flex flex-col justify-between gap-3 rounded-sm bg-bone p-4 sm:flex-row sm:items-center">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-sm font-semibold text-ink">
                                        Tersedia pada Paket Professional &amp; Enterprise
                                    </p>
                                    <p className="text-xs leading-relaxed text-mute">
                                        Upgrade paket untuk mengaktifkan link Google Review, pengalihan rating cerdas, notifikasi Telegram rating rendah, dan Stiker QR Ulasan.
                                    </p>
                                </div>
                                <Button asChild size="sm" className="w-full shrink-0 sm:w-auto">
                                    <Link href={route('dashboard.billing')}>Lihat Paket</Link>
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-4">
                            <div className="min-w-0">
                                <Label htmlFor="settings-review-enabled" className="text-sm font-semibold text-ink">
                                    Aktifkan Halaman Ulasan Publik
                                </Label>
                                <p className="mt-0.5 text-xs text-mute [overflow-wrap:anywhere]">
                                    Izinkan pelanggan mengisi rating &amp; masukan melalui {form.data.slug || business.slug}.{tenantBaseDomain}/review atau link di invoice.
                                </p>
                            </div>
                            <Switch
                                id="settings-review-enabled"
                                className="shrink-0"
                                disabled={!resolvedCanUseGoogleReview}
                                checked={form.data.review_enabled}
                                onCheckedChange={(val) => form.setData('review_enabled', val)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="settings-google-review-url">Link Google Maps Review</Label>
                            <Input
                                id="settings-google-review-url"
                                type="url"
                                inputMode="url"
                                disabled={!resolvedCanUseGoogleReview}
                                placeholder="https://g.page/r/xxxxxxxxxxxx/review"
                                value={form.data.google_review_url}
                                onChange={(e) => form.setData('google_review_url', e.target.value)}
                                aria-invalid={Boolean(form.errors.google_review_url)}
                            />
                            <p className="text-xs leading-relaxed text-mute">
                                Wajib menggunakan HTTPS dan domain resmi Google (<span className="font-mono">google.com</span>, <span className="font-mono">g.page</span>, atau <span className="font-mono">maps.app.goo.gl</span>).
                            </p>
                            {form.errors.google_review_url && (
                                <p className="text-xs text-destructive">{form.errors.google_review_url}</p>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="settings-review-min-rating">Minimal Rating Diarahkan ke Google</Label>
                                <SelectField
                                    id="settings-review-min-rating"
                                    disabled={!resolvedCanUseGoogleReview}
                                    value={String(form.data.review_redirect_min_rating)}
                                    onValueChange={(val) => form.setData('review_redirect_min_rating', Number(val))}
                                    aria-invalid={Boolean(form.errors.review_redirect_min_rating)}
                                    options={[
                                        { value: '5', label: '5 Bintang saja' },
                                        { value: '4', label: '4 Bintang ke atas (Direkomendasikan)' },
                                        { value: '3', label: '3 Bintang ke atas' },
                                    ]}
                                />
                                <p className="text-xs leading-relaxed text-mute">
                                    Penilaian di bawah batas ini tetap tersimpan sebagai masukan privat untuk tim Anda.
                                </p>
                                {form.errors.review_redirect_min_rating && (
                                    <p className="text-xs text-destructive">{form.errors.review_redirect_min_rating}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="settings-review-sticker-subtitle">Sub-judul Stiker QR Ulasan</Label>
                                <Input
                                    id="settings-review-sticker-subtitle"
                                    maxLength={120}
                                    disabled={!resolvedCanUseGoogleReview}
                                    placeholder="Scan QR untuk Beri Ulasan & Rating"
                                    value={form.data.review_sticker_subtitle}
                                    onChange={(e) => form.setData('review_sticker_subtitle', e.target.value)}
                                    aria-invalid={Boolean(form.errors.review_sticker_subtitle)}
                                />
                                <p className="text-xs leading-relaxed text-mute">
                                    Tampil pada halaman ulasan publik, stiker PNG, Tent Card A6, dan cetak Grid A4.
                                </p>
                                {form.errors.review_sticker_subtitle && (
                                    <p className="text-xs text-destructive">{form.errors.review_sticker_subtitle}</p>
                                )}
                            </div>
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

                    {/* One form behind the tabs: this saves changes made on every tab. */}
                    <div
                        hidden={tab === 'galeri'}
                        className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-end gap-2 sm:gap-3 lg:bottom-4"
                    >
                        {form.isDirty && (
                            <span className="rounded-full border border-hairline bg-canvas/95 px-3 py-1 text-xs text-mute">
                                Ada perubahan belum disimpan
                            </span>
                        )}
                        <Button type="submit" size="lg" disabled={form.processing} className="w-full sm:w-auto">
                            {form.processing ? 'Menyimpan…' : 'Simpan Semua Tab'}
                        </Button>
                    </div>
                </form>

                {/* Portfolio / Business Gallery */}
                <section id="galeri" hidden={tab !== 'galeri'} aria-labelledby="gallery-section-heading" className="scroll-mt-12 space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
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
                            <FileUpload
                                id="gallery-image-upload"
                                file={galleryForm.data.image}
                                accept="image/png,image/jpeg,image/webp"
                                placeholder="Pilih foto portofolio (JPG/PNG/WebP, maks 3MB)"
                                className="bg-canvas hover:bg-hairline-soft"
                                onFileChange={(file) => galleryForm.setData('image', file)}
                            />
                            {galleryForm.errors.image && (
                                <p className="text-xs text-destructive">{galleryForm.errors.image}</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1 space-y-1.5">
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
                                className="w-full sm:w-auto"
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

                {business.is_owner && tab === 'profil' && (
                    <section
                        aria-labelledby="danger-zone-heading"
                        className="space-y-4 rounded-md border border-destructive/30 bg-destructive-soft p-4 sm:p-6"
                    >
                        <div>
                            <h2 id="danger-zone-heading" className="text-lg font-semibold text-destructive">
                                Hapus Bisnis
                            </h2>
                            <p className="mt-1 text-sm leading-relaxed text-body">
                                Menghapus bisnis akan menghapus permanen seluruh layanan, tim, jadwal, pelanggan, dan riwayat {businessConfig.bookings.itemSingular.toLowerCase()} yang terhubung. Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </div>

                        {!showDeleteConfirm ? (
                            <Button
                                type="button"
                                variant="destructive"
                                className="w-full sm:w-auto"
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
                                    <strong className="font-semibold break-words text-ink">{business.name}</strong> untuk mengonfirmasi penghapusan permanen.
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
                                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowDeleteConfirm(false)}>
                                        Batal
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        className="w-full sm:w-auto"
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
                publicUrl={route('public.booking', form.data.slug || business.slug)}
                businessType={business.business_type}
                businessAddress={form.data.address || business.address}
                qrSubtitle={business.qr_poster_subtitle}
                canSaveSubtitle
            />
            <QrReviewStickerDialog
                open={qrReviewStickerOpen}
                onOpenChange={setQrReviewStickerOpen}
                businessName={form.data.name || business.name}
                businessCategory={form.data.category || business.category}
                businessSlug={form.data.slug || business.slug}
                publicReviewUrl={route('public.review.show', form.data.slug || business.slug)}
                businessType={business.business_type}
                businessAddress={form.data.address || business.address}
                reviewSubtitle={form.data.review_sticker_subtitle}
                canSaveSubtitle
                canUseGoogleReview={resolvedCanUseGoogleReview}
                onSubtitleSaved={(nextSubtitle) => {
                    const value = nextSubtitle ?? '';
                    form.setData('review_sticker_subtitle', value);
                    form.setDefaults('review_sticker_subtitle', value);
                }}
            />
        </DashboardLayout>
    );
}
