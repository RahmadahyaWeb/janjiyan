import { Head, Link, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Check,
    CheckCircle2,
    Copy,
    ExternalLink,
    MessageSquareHeart,
    ReceiptText,
    Star,
} from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BusinessHeader } from '@/components/BusinessHeader';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildCsrfHeaders } from '@/lib/csrf';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types';

interface ReviewSubmitProps {
    business: {
        name: string;
        slug: string;
        category: string;
        business_type?: BusinessType;
        logo_url: string | null;
        brand_color: string | null;
        review_sticker_subtitle: string | null;
        review_redirect_min_rating: number;
    };
    bookingContext: {
        token: string;
        booking_code: string;
        invoice_number: string | null;
        service_name: string;
        customer_name: string;
        already_reviewed: boolean;
    } | null;
    submittedReview: {
        id: number;
        rating: number;
        comment: string | null;
        should_redirect_google: boolean;
        google_review_url: string | null;
    } | null;
    reviewDisabledReason: string | null;
}

const RATING_LABELS: Record<number, string> = {
    1: 'Sangat Kurang',
    2: 'Kurang Memuaskan',
    3: 'Cukup Baik',
    4: 'Memuaskan',
    5: 'Sangat Memuaskan',
};

function getSafeHttpsUrl(raw: string | null | undefined): string | null {
    if (!raw) return null;
    try {
        const parsed = new URL(raw);
        return parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
        return null;
    }
}

export default function ReviewSubmit({
    business,
    bookingContext,
    submittedReview,
    reviewDisabledReason,
}: ReviewSubmitProps) {
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [ratingValidationError, setRatingValidationError] = useState<string>('');
    const [copiedComment, setCopiedComment] = useState(false);
    const [redirectRecorded, setRedirectRecorded] = useState(false);
    const starRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const form = useForm({
        rating: 0,
        comment: '',
        reviewer_name: bookingContext?.customer_name ?? '',
        reviewer_phone: '',
        token: bookingContext?.token ?? '',
        website: '',
    });

    const activeStars = hoverRating || form.data.rating;
    const safeGoogleUrl = getSafeHttpsUrl(submittedReview?.google_review_url);
    const subtitleText = business.review_sticker_subtitle?.trim() || 'Bagikan pengalaman Anda bersama kami';

    const selectStar = (value: number) => {
        form.setData('rating', value);
        setRatingValidationError('');
        form.clearErrors('rating');
    };

    const handleStarKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentStar: number) => {
        let nextStar: number | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            nextStar = Math.min(5, (form.data.rating || currentStar) + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            nextStar = Math.max(1, (form.data.rating || currentStar) - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            nextStar = 1;
        } else if (e.key === 'End') {
            e.preventDefault();
            nextStar = 5;
        }

        if (nextStar !== null) {
            selectStar(nextStar);
            starRefs.current[nextStar - 1]?.focus();
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (form.data.rating < 1 || form.data.rating > 5) {
            setRatingValidationError('Pilih rating bintang (1–5) terlebih dahulu.');
            starRefs.current[0]?.focus();
            return;
        }
        setRatingValidationError('');
        form.post(route('public.review.store', business.slug), {
            preserveScroll: true,
        });
    };

    const handleCopyComment = async (text: string) => {
        try {
            try {
                await navigator.clipboard.writeText(text);
            } catch {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                ta.remove();
                if (!ok) throw new Error('copy failed');
            }
            setCopiedComment(true);
            toast.success('Komentar disalin! Anda tinggal menempelkannya di Google Maps.');
            setTimeout(() => setCopiedComment(false), 2500);
        } catch {
            toast.error('Gagal menyalin komentar, silakan salin secara manual.');
        }
    };

    const trackGoogleRedirect = () => {
        if (!submittedReview || redirectRecorded) return;
        setRedirectRecorded(true);

        fetch(
            route('public.review.redirect', {
                slug: business.slug,
                review: submittedReview.id,
            }),
            {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers: buildCsrfHeaders(),
            }
        ).catch(() => {
            // Non-blocking: never prevent customer from reaching Google Maps
        });
    };

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <Head title={`Ulasan — ${business.name}`} />

            <BusinessHeader business={business} label="Ulasan Pelanggan" widthClassName="box-content max-w-xl" />

            <main className="mx-auto box-content max-w-xl space-y-6 px-4 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
                {reviewDisabledReason ? (
                    <section className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-5 text-center sm:p-8">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-bone text-mute">
                            <AlertCircle className="size-6" aria-hidden="true" />
                        </div>
                        <div className="space-y-1.5">
                            <h1 className="text-xl font-semibold text-ink">Halaman Ulasan Tidak Tersedia</h1>
                            <p className="text-sm leading-relaxed text-mute">{reviewDisabledReason}</p>
                        </div>
                        <Button asChild variant="outline" className="h-auto min-h-12 w-full whitespace-normal px-5 py-2.5 text-center">
                            <Link href={route('public.booking', business.slug)}>Kembali ke Halaman {business.name}</Link>
                        </Button>
                    </section>
                ) : submittedReview ? (
                    submittedReview.should_redirect_google && safeGoogleUrl ? (
                        <section
                            aria-label="Arahkan ke Google Maps Review"
                            className="space-y-5 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-8"
                        >
                            <div className="space-y-3 text-center">
                                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                                    <CheckCircle2 className="size-6" aria-hidden="true" />
                                </div>
                                <div className="flex items-center justify-center gap-1" aria-label={`Rating ${submittedReview.rating} dari 5 bintang`}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={cn(
                                                'size-5',
                                                star <= submittedReview.rating
                                                    ? 'fill-warning text-warning'
                                                    : 'text-control-border'
                                            )}
                                            aria-hidden="true"
                                        />
                                    ))}
                                </div>
                                <h1 className="text-2xl font-semibold text-ink">
                                    Terima kasih atas ulasan Anda!
                                </h1>
                                <p className="text-sm leading-relaxed text-mute">
                                    Penilaian Anda sangat berarti bagi <strong className="font-semibold text-ink">{business.name}</strong>. Yuk bantu pelanggan lain menemukan kami dengan membagikan ulasan singkat di Google Maps.
                                </p>
                            </div>

                            {submittedReview.comment?.trim() && (
                                <div className="space-y-2.5 rounded-sm bg-bone p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-mute">Komentar Anda</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyComment(submittedReview.comment!.trim())}
                                            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                        >
                                            {copiedComment ? (
                                                <Check className="size-3.5 text-success" aria-hidden="true" />
                                            ) : (
                                                <Copy className="size-3.5" aria-hidden="true" />
                                            )}
                                            {copiedComment ? 'Tersalin' : 'Salin Komentar'}
                                        </button>
                                    </div>
                                    <blockquote className="whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">
                                        “{submittedReview.comment.trim()}”
                                    </blockquote>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Button asChild size="lg" className="h-auto min-h-12 w-full whitespace-normal px-5 py-2.5 text-center">
                                    <a
                                        href={safeGoogleUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={trackGoogleRedirect}
                                    >
                                        <span>Lanjutkan ke Google Maps Review</span>
                                        <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                                    </a>
                                </Button>
                                <Button asChild variant="ghost" className="h-auto min-h-12 w-full whitespace-normal px-5 py-2.5 text-center text-mute hover:text-ink">
                                    <Link href={route('public.booking', business.slug)}>
                                        Kembali ke Halaman {business.name}
                                    </Link>
                                </Button>
                            </div>
                        </section>
                    ) : (
                        <section
                            aria-label="Konfirmasi masukan diterima"
                            className="space-y-5 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-8"
                        >
                            <div className="space-y-3 text-center">
                                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-bone text-ink">
                                    <MessageSquareHeart className="size-6" aria-hidden="true" />
                                </div>
                                <div className="flex items-center justify-center gap-1" aria-label={`Rating ${submittedReview.rating} dari 5 bintang`}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={cn(
                                                'size-5',
                                                star <= submittedReview.rating
                                                    ? 'fill-warning text-warning'
                                                    : 'text-control-border'
                                            )}
                                            aria-hidden="true"
                                        />
                                    ))}
                                </div>
                                <h1 className="text-2xl font-semibold text-ink">
                                    Terima kasih atas masukan Anda
                                </h1>
                                <p className="text-sm leading-relaxed text-mute">
                                    Catatan dan penilaian Anda telah diterima secara langsung oleh tim{' '}
                                    <strong className="font-semibold text-ink">{business.name}</strong>. Kami akan menjadikannya bahan evaluasi untuk meningkatkan kenyamanan dan kualitas layanan kami.
                                </p>
                            </div>

                            {submittedReview.comment?.trim() && (
                                <div className="rounded-sm bg-bone p-4">
                                    <p className="text-xs font-semibold text-mute">Ringkasan Catatan Anda</p>
                                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">
                                        {submittedReview.comment.trim()}
                                    </p>
                                </div>
                            )}

                            <Button asChild variant="outline" className="h-auto min-h-12 w-full whitespace-normal px-5 py-2.5 text-center">
                                <Link href={route('public.booking', business.slug)}>
                                    Kembali ke Halaman {business.name}
                                </Link>
                            </Button>
                        </section>
                    )
                ) : bookingContext?.already_reviewed ? (
                    <section className="space-y-5 rounded-md border border-hairline-soft bg-canvas p-5 text-center sm:p-8">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                            <CheckCircle2 className="size-6" aria-hidden="true" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-xl font-semibold text-ink sm:text-2xl">
                                Ulasan Sudah Pernah Dikirim
                            </h1>
                            <p className="text-sm leading-relaxed text-mute">
                                Terima kasih, <strong className="font-semibold text-ink">{bookingContext.customer_name}</strong>. Penilaian Anda untuk layanan{' '}
                                <strong className="font-semibold text-ink">{bookingContext.service_name}</strong> sudah tercatat di sistem {business.name}.
                            </p>
                        </div>

                        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-bone px-4 py-1.5 text-xs font-medium text-ink">
                            <ReceiptText className="size-3.5 text-mute" aria-hidden="true" />
                            <span className="font-mono">{bookingContext.invoice_number || bookingContext.booking_code}</span>
                        </div>

                        <div className="flex flex-col gap-2.5 sm:flex-row">
                            <Button asChild variant="outline" className="w-full sm:flex-1">
                                <Link
                                    href={route('public.booking.invoice', {
                                        slug: business.slug,
                                        token: bookingContext.token,
                                    })}
                                >
                                    Lihat Invoice
                                </Link>
                            </Button>
                            <Button asChild className="w-full sm:flex-1">
                                <Link href={route('public.booking', business.slug)}>
                                    Halaman {business.name}
                                </Link>
                            </Button>
                        </div>
                    </section>
                ) : (
                    <section className="space-y-6 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-8">
                        <div className="space-y-1.5">
                            <h1 className="text-2xl font-semibold text-ink">Beri Ulasan &amp; Rating</h1>
                            <p className="text-sm text-mute">{subtitleText}</p>
                        </div>

                        {bookingContext && (
                            <div className="flex flex-col gap-2 rounded-sm bg-bone p-3.5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-mute">Pesanan Terkait</p>
                                    <p className="truncate text-sm font-semibold text-ink">{bookingContext.service_name}</p>
                                    <p className="truncate text-xs text-mute">Pelanggan: {bookingContext.customer_name}</p>
                                </div>
                                <Badge variant="secondary" className="shrink-0 font-mono">
                                    {bookingContext.invoice_number || bookingContext.booking_code}
                                </Badge>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} noValidate className="space-y-5">
                            {/* Hidden honeypot field */}
                            <div aria-hidden="true" className="hidden">
                                <label htmlFor="review-website-hp">Website</label>
                                <input
                                    id="review-website-hp"
                                    name="website"
                                    type="text"
                                    tabIndex={-1}
                                    autoComplete="off"
                                    value={form.data.website}
                                    onChange={(e) => form.setData('website', e.target.value)}
                                />
                            </div>

                            {/* Interactive 1-5 Star Picker */}
                            <fieldset className="w-full min-w-0 space-y-2.5">
                                <legend className="text-sm font-semibold text-ink">
                                    Bagaimana pengalaman Anda? <span className="text-destructive">*</span>
                                </legend>

                                <div
                                    role="radiogroup"
                                    aria-label="Pilih rating bintang"
                                    aria-required="true"
                                    aria-invalid={Boolean(ratingValidationError || form.errors.rating)}
                                    aria-describedby={ratingValidationError || form.errors.rating ? 'review-rating-error' : undefined}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="flex items-center justify-between gap-1 rounded-sm bg-bone p-2 min-[375px]:gap-1.5 min-[375px]:p-3 sm:justify-center sm:gap-3 sm:p-4"
                                >
                                    {[1, 2, 3, 4, 5].map((star, idx) => {
                                        const filled = star <= activeStars;
                                        const checked = form.data.rating === star;
                                        const isTabStop =
                                            form.data.rating === star || (form.data.rating === 0 && star === 1);

                                        return (
                                            <button
                                                key={star}
                                                ref={(el) => {
                                                    starRefs.current[idx] = el;
                                                }}
                                                type="button"
                                                role="radio"
                                                aria-checked={checked}
                                                aria-label={`${star} bintang`}
                                                tabIndex={isTabStop ? 0 : -1}
                                                onClick={() => selectStar(star)}
                                                onMouseEnter={() => setHoverRating(star)}
                                                onKeyDown={(e) => handleStarKeyDown(e, star)}
                                                className={cn(
                                                    'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none active:scale-95 min-[375px]:size-12 sm:size-14',
                                                    checked ? 'bg-canvas ring-2 ring-ink' : 'hover:bg-canvas/70'
                                                )}
                                            >
                                                <Star
                                                    className={cn(
                                                        'size-7 transition-colors sm:size-8',
                                                        filled
                                                            ? 'fill-warning text-warning'
                                                            : 'text-control-border'
                                                    )}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        );
                                    })}
                                </div>

                                <p className="min-h-5 text-center text-xs font-semibold text-ink">
                                    {activeStars > 0
                                        ? `${activeStars} Bintang · ${RATING_LABELS[activeStars]}`
                                        : 'Ketuk bintang untuk memilih penilaian (1–5)'}
                                </p>

                                {(ratingValidationError || form.errors.rating) && (
                                    <p id="review-rating-error" role="alert" className="text-center text-xs font-medium text-destructive">
                                        {ratingValidationError || form.errors.rating}
                                    </p>
                                )}
                                {form.errors.token && (
                                    <p id="review-token-error" role="alert" className="text-center text-xs font-medium text-destructive">
                                        {form.errors.token}
                                    </p>
                                )}
                            </fieldset>

                            {/* Comment */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor="review-comment">Ulasan atau Masukan (Opsional)</Label>
                                    <span className="text-xs tabular-nums text-mute">
                                        {form.data.comment.length}/1000
                                    </span>
                                </div>
                                <Textarea
                                    id="review-comment"
                                    rows={4}
                                    maxLength={1000}
                                    placeholder="Ceritakan hal yang Anda sukai atau hal yang bisa kami tingkatkan…"
                                    value={form.data.comment}
                                    onChange={(e) => form.setData('comment', e.target.value)}
                                    aria-invalid={Boolean(form.errors.comment)}
                                    aria-describedby={form.errors.comment ? 'review-comment-error' : undefined}
                                />
                                {form.errors.comment && (
                                    <p id="review-comment-error" role="alert" className="text-xs font-medium text-destructive">
                                        {form.errors.comment}
                                    </p>
                                )}
                            </div>

                            {/* Optional identity fields when opened from generic QR sticker */}
                            {!bookingContext && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="review-name">Nama Anda (Opsional)</Label>
                                        <Input
                                            id="review-name"
                                            maxLength={120}
                                            placeholder="Contoh: Rina"
                                            value={form.data.reviewer_name}
                                            onChange={(e) => form.setData('reviewer_name', e.target.value)}
                                            aria-invalid={Boolean(form.errors.reviewer_name)}
                                            aria-describedby={form.errors.reviewer_name ? 'review-name-error' : undefined}
                                        />
                                        {form.errors.reviewer_name && (
                                            <p id="review-name-error" role="alert" className="text-xs font-medium text-destructive">
                                                {form.errors.reviewer_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="review-phone">Nomor WhatsApp (Opsional)</Label>
                                        <Input
                                            id="review-phone"
                                            type="tel"
                                            inputMode="tel"
                                            maxLength={30}
                                            placeholder="081234567890"
                                            value={form.data.reviewer_phone}
                                            onChange={(e) => form.setData('reviewer_phone', e.target.value)}
                                            aria-invalid={Boolean(form.errors.reviewer_phone)}
                                            aria-describedby={form.errors.reviewer_phone ? 'review-phone-error' : undefined}
                                        />
                                        {form.errors.reviewer_phone && (
                                            <p id="review-phone-error" role="alert" className="text-xs font-medium text-destructive">
                                                {form.errors.reviewer_phone}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <Button type="submit" size="lg" className="w-full" disabled={form.processing}>
                                {form.processing ? 'Mengirim Ulasan…' : 'Kirim Ulasan'}
                            </Button>
                        </form>
                    </section>
                )}

                <p className="text-center text-xs text-ash">
                    <span className="inline-flex items-center gap-1.5">
                        Ditenagai oleh <JanjiyanLogo size="sm" />
                    </span>
                </p>
            </main>
        </div>
    );
}
