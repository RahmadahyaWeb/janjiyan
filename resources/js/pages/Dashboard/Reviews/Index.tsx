import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ExternalLink,
    Lock,
    MessageCircle,
    QrCode,
    ReceiptText,
    Settings,
    Star,
} from 'lucide-react';
import { useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { PaginationBar, type PaginationMeta } from '@/components/PaginationBar';
import { QrReviewStickerDialog } from '@/components/QrReviewStickerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { SelectField } from '@/components/ui/select';
import DashboardLayout from '@/layouts/DashboardLayout';
import { buildWhatsAppUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BusinessReviewRecord, BusinessType, PageProps } from '@/types';

interface ReviewsIndexProps {
    reviews: BusinessReviewRecord[];
    pagination?: PaginationMeta | null;
    stats: {
        total_count: number;
        average_rating: number;
        private_feedback_count: number;
        google_redirected_count: number;
    };
    filters: {
        type: string;
        rating: string | number | null;
        search: string;
    };
    canUseGoogleReview: boolean;
    googleReviewUrl: string | null;
    reviewRedirectMinRating: number;
    reviewEnabled: boolean;
    reviewStickerSubtitle: string | null;
    publicReviewUrl: string;
    business: {
        name: string;
        slug: string;
        category: string;
        business_type: BusinessType;
        address: string | null;
        review_sticker_subtitle: string | null;
    } | null;
}

const TYPE_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'low', label: 'Masukan Privat' },
    { key: 'high', label: 'Rating Tinggi' },
] as const;

export default function ReviewsIndex({
    reviews,
    pagination,
    stats,
    filters,
    canUseGoogleReview,
    googleReviewUrl,
    reviewRedirectMinRating,
    reviewEnabled,
    reviewStickerSubtitle,
    publicReviewUrl,
    business,
}: ReviewsIndexProps) {
    const { activeBusiness } = usePage<PageProps>().props;
    const canManageSettings = activeBusiness?.can?.manage_settings ?? true;

    const activeFilters = {
        type: filters?.type || 'all',
        rating: filters?.rating != null && filters.rating !== '' ? String(filters.rating) : '',
        search: filters?.search ?? '',
    };

    const [search, setSearch] = useState(activeFilters.search);
    const [stickerOpen, setStickerOpen] = useState(false);

    const hasActiveFilter = Boolean(
        activeFilters.type !== 'all' || activeFilters.rating !== '' || activeFilters.search
    );

    const applyFilters = (next: Partial<typeof activeFilters>) => {
        const merged = {
            ...activeFilters,
            search,
            ...next,
        };

        router.get(
            route('dashboard.reviews'),
            {
                type: merged.type !== 'all' ? merged.type : undefined,
                rating: merged.rating !== '' ? merged.rating : undefined,
                search: merged.search.trim() !== '' ? merged.search.trim() : undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const resetFilters = () => {
        setSearch('');
        router.get(route('dashboard.reviews'), {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const formattedAverage =
        stats.total_count > 0 ? Number(stats.average_rating ?? 0).toFixed(1) : '0.0';

    const resolvedStickerSubtitle =
        reviewStickerSubtitle ?? business?.review_sticker_subtitle ?? null;

    return (
        <DashboardLayout
            title="Ulasan Pelanggan"
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    {canManageSettings && (
                        <Button asChild variant="outline" size="sm">
                            <Link href={route('dashboard.settings', { tab: 'ulasan' })}>
                                <Settings className="size-4" aria-hidden="true" />
                                Pengaturan Ulasan
                            </Link>
                        </Button>
                    )}
                    {business && (
                        <Button type="button" size="sm" onClick={() => setStickerOpen(true)}>
                            <QrCode className="size-4" aria-hidden="true" />
                            Cetak Stiker QR Ulasan
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Ulasan Pelanggan" />

            {!canUseGoogleReview && (
                <div className="flex flex-col justify-between gap-3 rounded-md bg-bone p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="popular">Pro / Enterprise</Badge>
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
                                <Lock className="size-3.5 text-mute" aria-hidden="true" />
                                Fitur Google Maps Review &amp; Stiker QR Terkunci
                            </span>
                        </div>
                        <p className="text-xs leading-relaxed text-mute">
                            Upgrade ke paket Professional atau Enterprise untuk mengaktifkan halaman ulasan cerdas, pengalihan otomatis bintang tinggi ke Google Maps, notifikasi Telegram rating rendah, serta Stiker QR siap cetak.
                        </p>
                    </div>
                    {canManageSettings && (
                        <Button asChild size="sm" className="w-full shrink-0 sm:w-auto">
                            <Link href={route('dashboard.billing')}>Upgrade Paket</Link>
                        </Button>
                    )}
                </div>
            )}

            {canUseGoogleReview && business && (!reviewEnabled || !googleReviewUrl) && (
                <div className="flex flex-col justify-between gap-3 rounded-md border border-hairline-soft bg-bone/70 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-start gap-2.5">
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                        <p className="text-xs leading-relaxed text-body">
                            {!reviewEnabled
                                ? 'Pengumpulan ulasan publik saat ini sedang dinonaktifkan.'
                                : `Link Google Maps Review belum diisi. Ulasan dengan rating ${reviewRedirectMinRating} bintang ke atas tetap tersimpan di kotak masuk ini, namun belum diarahkan ke Google Maps.`}
                        </p>
                    </div>
                    {canManageSettings && (
                        <Button asChild variant="outline" size="sm" className="w-full shrink-0 bg-canvas sm:w-auto">
                            <Link href={route('dashboard.settings', { tab: 'ulasan' })}>
                                Atur Sekarang
                            </Link>
                        </Button>
                    )}
                </div>
            )}

            {business && publicReviewUrl && (
                <div className="flex flex-col justify-between gap-3 rounded-md border border-hairline-soft bg-canvas p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-mute">Link Ulasan Publik</p>
                        <p className="truncate font-mono text-xs text-ink sm:text-sm">{publicReviewUrl}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <CopyButton value={publicReviewUrl} label="Link ulasan" />
                        <Button asChild variant="outline" size="sm">
                            <a href={publicReviewUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                                Buka Halaman
                            </a>
                        </Button>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-semibold text-mute">Total Ulasan</p>
                    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
                        {stats.total_count}
                    </p>
                </div>

                <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-semibold text-mute">Rata-rata Rating</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-2xl font-semibold tabular-nums text-ink">{formattedAverage}</span>
                        <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden="true" />
                    </div>
                </div>

                <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-semibold text-mute">Masukan Privat</p>
                    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
                        {stats.private_feedback_count}
                    </p>
                </div>

                <div className="rounded-md border border-hairline-soft bg-canvas p-4">
                    <p className="text-xs font-semibold text-mute">Terarah ke Google</p>
                    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
                        {stats.google_redirected_count}
                    </p>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div
                        className="flex flex-wrap items-center gap-1.5"
                        role="group"
                        aria-label="Filter jenis ulasan"
                    >
                        {TYPE_FILTERS.map((item) => {
                            const active = activeFilters.type === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => applyFilters({ type: item.key })}
                                    className={cn(
                                        'inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                        active
                                            ? 'bg-ink text-canvas'
                                            : 'bg-bone text-mute hover:text-ink'
                                    )}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1 sm:w-64">
                            <label htmlFor="review-search" className="sr-only">
                                Cari ulasan berdasarkan nama, nomor WA, komentar, atau kode pesanan
                            </label>
                            <SearchInput
                                id="review-search"
                                className="md:h-10 md:text-sm"
                                placeholder="Cari nama, komentar, kode…"
                                value={search}
                                onValueChange={setSearch}
                                clearLabel="Hapus kata kunci ulasan"
                                onClear={() => applyFilters({ search: '' })}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters({ search })}
                            />
                        </div>

                        <SelectField
                            aria-label="Filter berdasarkan bintang"
                            value={activeFilters.rating}
                            onValueChange={(val) => applyFilters({ rating: val })}
                            wrapperClassName="sm:w-40"
                            className="md:h-10 md:py-0"
                            options={[
                                { value: '', label: 'Semua Bintang' },
                                { value: '5', label: '5 Bintang' },
                                { value: '4', label: '4 Bintang' },
                                { value: '3', label: '3 Bintang' },
                                { value: '2', label: '2 Bintang' },
                                { value: '1', label: '1 Bintang' },
                            ]}
                        />

                        {hasActiveFilter && (
                            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                                Reset Filter
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Review Cards */}
            {reviews.length === 0 ? (
                <div className="space-y-3 rounded-md bg-bone p-6 text-center sm:p-12">
                    <p className="text-base font-semibold text-ink">
                        {hasActiveFilter
                            ? 'Tidak ada ulasan yang cocok dengan filter saat ini.'
                            : 'Belum ada ulasan masuk.'}
                    </p>
                    <p className="mx-auto max-w-md text-sm text-mute">
                        {hasActiveFilter
                            ? 'Coba ubah filter bintang, kategori, atau kata kunci pencarian.'
                            : 'Cetak Stiker QR Ulasan di meja kasir atau sisipkan tautan ulasan otomatis pada pesan WhatsApp follow-up untuk mulai mengumpulkan masukan pelanggan.'}
                    </p>
                    {hasActiveFilter ? (
                        <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                            Reset Filter
                        </Button>
                    ) : (
                        business && (
                            <Button type="button" size="sm" onClick={() => setStickerOpen(true)}>
                                <QrCode className="size-4" aria-hidden="true" />
                                Cetak Stiker QR Ulasan
                            </Button>
                        )
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {reviews.map((review) => {
                        const bookingRef = review.invoice_number || review.booking_code;

                        return (
                            <article
                                key={review.id}
                                className="space-y-3 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-5"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div
                                            className="inline-flex items-center gap-0.5 rounded-full bg-bone px-2.5 py-1"
                                            aria-label={`Rating ${review.rating} dari 5 bintang`}
                                        >
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={cn(
                                                        'size-3.5',
                                                        star <= review.rating
                                                            ? 'fill-warning text-warning'
                                                            : 'text-control-border'
                                                    )}
                                                    aria-hidden="true"
                                                />
                                            ))}
                                            <span className="ml-1 text-xs font-semibold tabular-nums text-ink">
                                                {review.rating}/5
                                            </span>
                                        </div>

                                        {review.redirected_to_google ? (
                                            <Badge variant="success">Diarahkan ke Google</Badge>
                                        ) : review.is_private_feedback ? (
                                            <Badge variant="warning">Masukan Privat</Badge>
                                        ) : (
                                            <Badge variant="secondary">Rating Tinggi</Badge>
                                        )}
                                    </div>

                                    <time
                                        dateTime={review.created_at}
                                        className="text-xs tabular-nums text-mute"
                                    >
                                        {review.created_at_local}
                                    </time>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <p className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">
                                        {review.reviewer_name || 'Pelanggan Anonim'}
                                    </p>

                                    {review.reviewer_phone && (
                                        <a
                                            href={buildWhatsAppUrl(
                                                review.reviewer_phone,
                                                `Halo ${review.reviewer_name || 'Kak'}, terima kasih sudah memberikan ulasan untuk ${business?.name ?? 'kami'}.`
                                            )}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-bone px-3 py-1 font-mono text-xs text-ink transition-colors hover:bg-hairline-soft sm:min-h-8"
                                        >
                                            <MessageCircle className="size-3 text-mute" aria-hidden="true" />
                                            <span>{review.reviewer_phone}</span>
                                        </a>
                                    )}

                                    {bookingRef && (
                                        <Badge variant="outline" className="gap-1 font-mono">
                                            <ReceiptText className="size-3 text-mute" aria-hidden="true" />
                                            <span>{bookingRef}</span>
                                        </Badge>
                                    )}
                                </div>

                                {review.comment?.trim() ? (
                                    <p className="rounded-sm bg-bone/60 px-3.5 py-2.5 whitespace-pre-line text-sm leading-relaxed text-body [overflow-wrap:anywhere]">
                                        {review.comment.trim()}
                                    </p>
                                ) : (
                                    <p className="text-xs text-mute">Tidak ada komentar tertulis.</p>
                                )}
                            </article>
                        );
                    })}

                    <PaginationBar pagination={pagination} />
                </div>
            )}

            {business && (
                <QrReviewStickerDialog
                    open={stickerOpen}
                    onOpenChange={setStickerOpen}
                    businessName={business.name}
                    businessCategory={business.category}
                    businessSlug={business.slug}
                    businessType={business.business_type}
                    businessAddress={business.address}
                    reviewSubtitle={resolvedStickerSubtitle}
                    canSaveSubtitle={canManageSettings}
                    canUseGoogleReview={canUseGoogleReview}
                />
            )}
        </DashboardLayout>
    );
}
