import { router } from '@inertiajs/react';
import { Check, Download, Grid2x2, Grid3x3, Lock, Printer, QrCode, Star } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types';

const DEFAULT_REVIEW_SUBTITLE = 'Scan QR untuk Beri Ulasan & Rating';

const REVIEW_SUBTITLE_PRESETS_BY_TYPE: Record<BusinessType, string[]> = {
    staff_appointment: [
        'Scan QR untuk Beri Ulasan & Rating',
        'Puas dengan pelayanan kami? Beri Bintang 5!',
        'Bagikan Pengalaman Janji Temu Anda',
        'Saran & Ulasan Anda Sangat Berarti',
    ],
    space_booking: [
        'Scan QR untuk Beri Ulasan & Rating',
        'Puas dengan fasilitas kami? Beri Bintang 5!',
        'Bagikan Pengalaman Sesi Anda di Google Maps',
        'Saran & Ulasan Anda Sangat Berarti',
    ],
    dropoff: [
        'Scan QR untuk Beri Ulasan & Rating',
        'Puas dengan hasil pengerjaan kami? Beri Bintang 5!',
        'Bagikan Pengalaman Order Anda di Google Maps',
        'Saran & Ulasan Anda Sangat Berarti',
    ],
};

interface QrReviewStickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    businessName: string;
    businessCategory: string;
    businessSlug: string;
    publicReviewUrl?: string;
    businessType?: BusinessType;
    businessAddress?: string | null;
    reviewSubtitle?: string | null;
    canSaveSubtitle?: boolean;
    canUseGoogleReview?: boolean;
    onSubtitleSaved?: (subtitle: string | null) => void;
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function wrapCanvasLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number
): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const lines: string[] = [];
    let current = '';

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
            continue;
        }

        if (current) {
            lines.push(current);
            current = word;
        } else {
            lines.push(word);
            current = '';
        }

        if (lines.length === maxLines - 1) {
            current = [current, ...words.slice(i + 1)].filter(Boolean).join(' ');
            break;
        }
    }

    if (current) {
        lines.push(current);
    }

    return lines.slice(0, maxLines);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function QrReviewStickerDialog({
    open,
    onOpenChange,
    businessName,
    businessCategory,
    businessSlug,
    publicReviewUrl: propPublicReviewUrl,
    businessType = 'staff_appointment',
    businessAddress,
    reviewSubtitle,
    canSaveSubtitle = false,
    canUseGoogleReview = true,
    onSubtitleSaved,
}: QrReviewStickerDialogProps) {
    const subtitlePresets =
        REVIEW_SUBTITLE_PRESETS_BY_TYPE[businessType] ?? REVIEW_SUBTITLE_PRESETS_BY_TYPE.staff_appointment;

    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [downloading, setDownloading] = useState(false);
    const [subtitle, setSubtitle] = useState<string>(reviewSubtitle?.trim() || DEFAULT_REVIEW_SUBTITLE);
    const [savingSubtitle, setSavingSubtitle] = useState(false);
    const [gridLayout, setGridLayout] = useState<'2x2' | '3x3'>('2x2');

    useEffect(() => {
        setSubtitle(reviewSubtitle?.trim() || DEFAULT_REVIEW_SUBTITLE);
    }, [reviewSubtitle, open]);

    const resolvedSubtitle = subtitle.trim() || DEFAULT_REVIEW_SUBTITLE;
    const savedSubtitle = reviewSubtitle?.trim() || DEFAULT_REVIEW_SUBTITLE;
    const subtitleChanged = resolvedSubtitle !== savedSubtitle;

    const publicReviewUrl =
        propPublicReviewUrl ||
        (typeof route === 'function'
            ? route('public.review.show', businessSlug)
            : `https://${businessSlug}.janjiyan.web.id/review`);
    const displayUrl = publicReviewUrl.replace(/^https?:\/\//, '');

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        QRCode.toDataURL(publicReviewUrl, {
            width: 640,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#141414',
                light: '#ffffff',
            },
        })
            .then((url) => {
                if (!cancelled) setQrDataUrl(url);
            })
            .catch(() => {
                if (!cancelled) setQrDataUrl('');
            });

        return () => {
            cancelled = true;
        };
    }, [open, publicReviewUrl]);

    const saveSubtitle = () => {
        if (!canSaveSubtitle || !canUseGoogleReview || savingSubtitle) return;
        setSavingSubtitle(true);
        const normalized = resolvedSubtitle === DEFAULT_REVIEW_SUBTITLE ? null : resolvedSubtitle;

        router.patch(
            route('dashboard.settings.review-subtitle'),
            { review_sticker_subtitle: normalized },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onSubtitleSaved?.(normalized);
                },
                onFinish: () => setSavingSubtitle(false),
            }
        );
    };

    const downloadStickerPng = async () => {
        if (!qrDataUrl || downloading) return;
        setDownloading(true);

        try {
            const size = 1200;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Gallery-white canvas
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);

            // Subtle outer frame
            drawRoundedRect(ctx, 44, 44, size - 88, size - 88, 44);
            ctx.strokeStyle = '#e5e5e5';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Category pill
            const catText = (businessCategory || 'Bisnis Jasa').toUpperCase();
            ctx.font = '600 20px Inter, system-ui, -apple-system, sans-serif';
            const catWidth = Math.min(size - 200, ctx.measureText(catText).width + 52);
            drawRoundedRect(ctx, (size - catWidth) / 2, 86, catWidth, 44, 22);
            ctx.fillStyle = '#f3f3f3';
            ctx.fill();
            ctx.fillStyle = '#525252';
            ctx.fillText(catText, size / 2, 108, catWidth - 32);

            // Star badge pill
            const starText = '★ ★ ★ ★ ★';
            ctx.font = '700 24px Inter, system-ui, -apple-system, sans-serif';
            const starPillW = Math.max(240, ctx.measureText(starText).width + 64);
            drawRoundedRect(ctx, (size - starPillW) / 2, 146, starPillW, 48, 24);
            ctx.fillStyle = '#141414';
            ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(starText, size / 2, 170);

            // Business Name (auto-scale up to 2 lines)
            const maxTitleWidth = size - 180;
            let titleFontSize = 48;
            let titleLines: string[] = [];
            for (const candidateSize of [48, 42, 36, 32]) {
                titleFontSize = candidateSize;
                ctx.font = `700 ${candidateSize}px Inter, system-ui, -apple-system, sans-serif`;
                if (ctx.measureText(businessName).width <= maxTitleWidth) {
                    titleLines = [businessName];
                    break;
                }
                const wrapped = wrapCanvasLines(ctx, businessName, maxTitleWidth, 2);
                const fits = wrapped.every((line) => ctx.measureText(line).width <= maxTitleWidth);
                if (fits || candidateSize === 32) {
                    titleLines = wrapped;
                    break;
                }
            }

            ctx.fillStyle = '#141414';
            ctx.font = `700 ${titleFontSize}px Inter, system-ui, -apple-system, sans-serif`;
            const titleStartY = titleLines.length > 1 ? 236 : 248;
            const titleLineHeight = Math.round(titleFontSize * 1.16);
            titleLines.forEach((line, idx) => {
                ctx.fillText(line, size / 2, titleStartY + idx * titleLineHeight, maxTitleWidth);
            });

            // Subtitle (wraps up to 2 lines)
            ctx.fillStyle = '#636363';
            ctx.font = '400 24px Inter, system-ui, -apple-system, sans-serif';
            const subtitleLines = wrapCanvasLines(ctx, resolvedSubtitle, size - 200, 2);
            const subtitleStartY = titleStartY + (titleLines.length - 1) * titleLineHeight + 50;
            const subtitleLineHeight = 32;
            subtitleLines.forEach((line, idx) => {
                ctx.fillText(line, size / 2, subtitleStartY + idx * subtitleLineHeight, size - 180);
            });

            // QR Card Container
            const qrBoxSize = 500;
            const qrBoxX = (size - qrBoxSize) / 2;
            const subtitleBottom = subtitleStartY + Math.max(0, subtitleLines.length - 1) * subtitleLineHeight;
            const qrBoxY = Math.max(368, subtitleBottom + 36);
            drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32);
            ctx.fillStyle = '#f8f8f8';
            ctx.fill();
            ctx.strokeStyle = '#e5e5e5';
            ctx.lineWidth = 2;
            ctx.stroke();

            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Gagal memuat gambar QR Code'));
                img.src = qrDataUrl;
            });

            const qrDrawSize = 432;
            ctx.drawImage(
                img,
                (size - qrDrawSize) / 2,
                qrBoxY + (qrBoxSize - qrDrawSize) / 2,
                qrDrawSize,
                qrDrawSize
            );

            // URL Pill
            const maxPillW = size - 160;
            let urlFontSize = 22;
            for (const candidateSize of [22, 19, 17, 15]) {
                urlFontSize = candidateSize;
                ctx.font = `500 ${candidateSize}px "Geist Mono", ui-monospace, monospace`;
                if (ctx.measureText(displayUrl).width + 64 <= maxPillW) break;
            }
            ctx.font = `500 ${urlFontSize}px "Geist Mono", ui-monospace, monospace`;
            const pillW = Math.min(maxPillW, ctx.measureText(displayUrl).width + 64);
            const pillY = qrBoxY + qrBoxSize + 34;
            drawRoundedRect(ctx, (size - pillW) / 2, pillY, pillW, 56, 28);
            ctx.fillStyle = '#141414';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(displayUrl, size / 2, pillY + 28, maxPillW - 36);

            // Footer
            ctx.fillStyle = '#707070';
            ctx.font = '500 21px Inter, system-ui, -apple-system, sans-serif';
            ctx.fillText('Ditenagai oleh Janjiyan', size / 2, Math.max(pillY + 94, 1098));

            const stickerUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = stickerUrl;
            link.download = `review-sticker-${businessSlug}.png`;
            link.click();
            toast.success('Stiker QR ulasan PNG berhasil diunduh.');
        } catch {
            toast.error('Gagal membuat file PNG stiker QR. Silakan coba lagi.');
        } finally {
            setDownloading(false);
        }
    };

    const printTentCardA6 = () => {
        if (!qrDataUrl || typeof window === 'undefined') return;
        const win = window.open('', '_blank', 'width=640,height=860');
        if (!win) {
            toast.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak Tent Card A6.');
            return;
        }

        win.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Tent Card A6 Ulasan — ${escapeHtml(businessName)}</title>
<style>
  @page { size: 105mm 148mm; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; color: #141414; font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 100%; height: 131mm; display: flex; align-items: stretch; justify-content: center; }
  .card { width: 100%; border: 1.5px solid #e0e0e0; border-radius: 7mm; padding: 6mm 5.5mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; break-inside: avoid; }
  .top { width: 100%; }
  .pill { display: inline-block; background: #f3f3f3; color: #525252; font-size: 7.5pt; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 1.5mm 3.5mm; border-radius: 999px; }
  .stars { margin: 2.5mm auto 0; display: inline-block; background: #141414; color: #fbbf24; font-size: 10pt; font-weight: 700; letter-spacing: 0.1em; padding: 1.5mm 4mm; border-radius: 999px; }
  h1 { font-size: 14.5pt; font-weight: 700; line-height: 1.18; margin: 3mm 0 1.5mm; color: #141414; overflow-wrap: anywhere; }
  .sub { font-size: 8.8pt; line-height: 1.35; color: #636363; margin: 0; overflow-wrap: anywhere; }
  .qr-wrap { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 5mm; padding: 3.5mm; display: inline-flex; align-items: center; justify-content: center; margin: 2mm 0; }
  .qr-wrap img { width: 46mm; height: 46mm; display: block; object-fit: contain; }
  .bottom { width: 100%; }
  .url { display: inline-block; max-width: 100%; background: #141414; color: #ffffff; font-family: ui-monospace, Menlo, monospace; font-size: 7pt; padding: 1.6mm 3.5mm; border-radius: 999px; overflow-wrap: anywhere; }
  .addr { font-size: 7pt; color: #636363; margin: 2mm 0 0; overflow-wrap: anywhere; }
  .foot { font-size: 7pt; color: #707070; margin: 2.2mm 0 0; font-weight: 500; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="card">
      <div class="top">
        <span class="pill">${escapeHtml(businessCategory || 'Bisnis Jasa')}</span>
        <div><span class="stars">★ ★ ★ ★ ★</span></div>
        <h1>${escapeHtml(businessName)}</h1>
        <p class="sub">${escapeHtml(resolvedSubtitle)}</p>
      </div>
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="QR Ulasan ${escapeHtml(businessName)}" />
      </div>
      <div class="bottom">
        <div><span class="url">${escapeHtml(displayUrl)}</span></div>
        ${businessAddress ? `<p class="addr">${escapeHtml(businessAddress)}</p>` : ''}
        <p class="foot">Ditenagai oleh Janjiyan</p>
      </div>
    </div>
  </div>
  <script>
    function triggerPrint() { setTimeout(function() { window.print(); }, 120); }
    if (document.readyState === 'complete') { triggerPrint(); } else { window.addEventListener('load', triggerPrint); }
  </script>
</body>
</html>`);
        win.document.close();
    };

    const printGridA4 = (layout: '2x2' | '3x3') => {
        if (!qrDataUrl || typeof window === 'undefined') return;
        const win = window.open('', '_blank', 'width=860,height=1040');
        if (!win) {
            toast.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak Grid A4.');
            return;
        }

        const count = layout === '2x2' ? 4 : 9;
        const isCompact = layout === '3x3';

        const cardsHtml = Array.from({ length: count })
            .map(
                () => `
      <div class="sticker">
        <div class="head">
          <span class="pill">${escapeHtml(businessCategory || 'Bisnis Jasa')}</span>
          <div class="stars">★ ★ ★ ★ ★</div>
          <h2>${escapeHtml(businessName)}</h2>
          <p class="sub">${escapeHtml(resolvedSubtitle)}</p>
        </div>
        <div class="qr-box">
          <img src="${qrDataUrl}" alt="QR Ulasan ${escapeHtml(businessName)}" />
        </div>
        <div class="foot-wrap">
          <span class="url">${escapeHtml(displayUrl)}</span>
          <p class="foot">Ditenagai oleh Janjiyan</p>
        </div>
      </div>`
            )
            .join('');

        win.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Grid Cetak A4 (${layout}) Stiker QR Ulasan — ${escapeHtml(businessName)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; color: #141414; font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${isCompact ? 3 : 2}, minmax(0, 1fr));
    grid-template-rows: repeat(${isCompact ? 3 : 2}, ${isCompact ? '89mm' : '134mm'});
    gap: ${isCompact ? '4mm' : '5mm'};
    width: 100%;
  }
  .sticker {
    border: 1px dashed #bdbdbd;
    border-radius: ${isCompact ? '4mm' : '5.5mm'};
    padding: ${isCompact ? '3.5mm 3mm' : '5.5mm 5mm'};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    background: #ffffff;
    overflow: hidden;
    break-inside: avoid;
  }
  .head { width: 100%; }
  .pill {
    display: inline-block;
    background: #f3f3f3;
    color: #525252;
    font-size: ${isCompact ? '6pt' : '7.5pt'};
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: ${isCompact ? '0.8mm 2.5mm' : '1.2mm 3.2mm'};
    border-radius: 999px;
  }
  .stars {
    margin: ${isCompact ? '1.5mm' : '2.2mm'} auto 0;
    display: inline-block;
    background: #141414;
    color: #fbbf24;
    font-size: ${isCompact ? '7.5pt' : '9.5pt'};
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: ${isCompact ? '0.9mm 2.8mm' : '1.3mm 3.8mm'};
    border-radius: 999px;
  }
  h2 {
    font-size: ${isCompact ? '9.5pt' : '13.5pt'};
    font-weight: 700;
    line-height: 1.15;
    margin: ${isCompact ? '1.8mm 0 1mm' : '2.6mm 0 1.4mm'};
    color: #141414;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sub {
    font-size: ${isCompact ? '6.6pt' : '8.5pt'};
    line-height: 1.3;
    color: #636363;
    margin: 0;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .qr-box {
    background: #f8f8f8;
    border: 1px solid #e5e5e5;
    border-radius: ${isCompact ? '3mm' : '4.5mm'};
    padding: ${isCompact ? '2mm' : '3.2mm'};
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .qr-box img {
    width: ${isCompact ? '31mm' : '46mm'};
    height: ${isCompact ? '31mm' : '46mm'};
    display: block;
    object-fit: contain;
  }
  .foot-wrap { width: 100%; }
  .url {
    display: inline-block;
    max-width: 100%;
    background: #141414;
    color: #ffffff;
    font-family: ui-monospace, Menlo, monospace;
    font-size: ${isCompact ? '5.4pt' : '6.8pt'};
    padding: ${isCompact ? '1mm 2.4mm' : '1.4mm 3.2mm'};
    border-radius: 999px;
    overflow-wrap: anywhere;
  }
  .foot {
    font-size: ${isCompact ? '5.6pt' : '6.8pt'};
    color: #707070;
    margin: ${isCompact ? '1.2mm 0 0' : '1.8mm 0 0'};
    font-weight: 500;
  }
</style>
</head>
<body>
  <div class="grid">${cardsHtml}</div>
  <script>
    function triggerPrint() { setTimeout(function() { window.print(); }, 120); }
    if (document.readyState === 'complete') { triggerPrint(); } else { window.addEventListener('load', triggerPrint); }
  </script>
</body>
</html>`);
        win.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-lg sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink">
                        <QrCode className="size-5 shrink-0 text-ink" aria-hidden="true" />
                        Stiker &amp; Tent Card QR Ulasan
                    </DialogTitle>
                    <DialogDescription className="text-sm text-mute">
                        Unduh stiker kotak 1:1, cetak Tent Card A6 untuk meja kasir, atau cetak lembar A4 siap potong.
                    </DialogDescription>
                </DialogHeader>

                {!canUseGoogleReview && (
                    <div className="flex items-start gap-2.5 rounded-sm border border-hairline-soft bg-bone p-3.5 text-xs text-body">
                        <Lock className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="popular">Pro / Enterprise</Badge>
                                <span className="font-semibold text-ink">Fitur Ulasan Publik Terkunci</span>
                            </div>
                            <p className="text-mute">
                                Pelanggan dapat memindai stiker ini setelah Anda mengaktifkan paket Professional atau Enterprise.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-2 rounded-sm bg-bone p-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="qr-review-subtitle" className="text-xs font-semibold text-ink">
                            Sub-judul Stiker QR
                        </Label>
                        {canSaveSubtitle && canUseGoogleReview && subtitleChanged && (
                            <Button
                                type="button"
                                size="xs"
                                onClick={saveSubtitle}
                                disabled={savingSubtitle}
                            >
                                <Check className="size-3" aria-hidden="true" />
                                {savingSubtitle ? 'Menyimpan…' : 'Simpan Permanen'}
                            </Button>
                        )}
                    </div>
                    <Input
                        id="qr-review-subtitle"
                        maxLength={120}
                        placeholder={DEFAULT_REVIEW_SUBTITLE}
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="h-10 bg-canvas py-2 text-base md:text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {subtitlePresets.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setSubtitle(preset)}
                                className={cn(
                                    'min-h-9 cursor-pointer rounded-full px-3 py-1.5 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                    resolvedSubtitle === preset
                                        ? 'bg-ink text-canvas'
                                        : 'bg-canvas text-mute hover:text-ink'
                                )}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Live Sticker Preview */}
                <div className="rounded-md border border-hairline-soft bg-canvas p-4 text-center sm:p-5">
                    <div className="flex flex-col items-center gap-2">
                        <span className="inline-block rounded-full bg-bone px-3 py-1 text-xs font-semibold tracking-wider text-mute uppercase">
                            {businessCategory}
                        </span>
                        <span
                            aria-label="5 bintang"
                            className="inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1 text-xs font-semibold text-amber-400"
                        >
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                            ))}
                        </span>
                    </div>

                    <h3 className="mt-2.5 break-words text-xl font-semibold tracking-tight text-ink">
                        {businessName}
                    </h3>
                    <p className="mt-1 break-words text-xs text-mute">{resolvedSubtitle}</p>

                    <div className="mx-auto mt-4 inline-flex items-center justify-center rounded-sm border border-hairline-soft bg-bone/50 p-3 sm:p-4">
                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt={`QR Code halaman ulasan ${businessName}`}
                                className="size-40 rounded-xs bg-white object-contain sm:size-44"
                            />
                        ) : (
                            <div className="flex size-40 items-center justify-center text-xs text-mute sm:size-44">
                                Membuat QR Code…
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <span className="inline-block max-w-full rounded-full bg-ink px-4 py-1.5 font-mono text-xs break-all text-canvas">
                            {displayUrl}
                        </span>
                    </div>
                    <p className="mt-3 text-xs text-ash">Ditenagai oleh Janjiyan</p>
                </div>

                {/* Grid A4 Selector + Export / Print Actions */}
                <div className="space-y-2.5 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-bone px-3 py-2">
                        <span className="text-xs font-semibold text-ink">Tata Letak Lembar A4</span>
                        <div className="inline-flex rounded-full bg-canvas p-0.5" role="group" aria-label="Pilih ukuran grid cetak A4">
                            <button
                                type="button"
                                aria-pressed={gridLayout === '2x2'}
                                onClick={() => setGridLayout('2x2')}
                                className={cn(
                                    'inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                    gridLayout === '2x2' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                <Grid2x2 className="size-3.5" aria-hidden="true" />
                                2×2 (4 Stiker)
                            </button>
                            <button
                                type="button"
                                aria-pressed={gridLayout === '3x3'}
                                onClick={() => setGridLayout('3x3')}
                                className={cn(
                                    'inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                    gridLayout === '3x3' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                                )}
                            >
                                <Grid3x3 className="size-3.5" aria-hidden="true" />
                                3×3 (9 Stiker)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Button
                            type="button"
                            size="sm"
                            onClick={downloadStickerPng}
                            disabled={!qrDataUrl || downloading}
                            className="w-full rounded-full"
                        >
                            <Download className="size-4" aria-hidden="true" />
                            {downloading ? 'Menyiapkan…' : 'Stiker PNG 1:1'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={printTentCardA6}
                            disabled={!qrDataUrl}
                            className="w-full rounded-full"
                        >
                            <Printer className="size-4" aria-hidden="true" />
                            Tent Card A6
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => printGridA4(gridLayout)}
                            disabled={!qrDataUrl}
                            className="w-full rounded-full"
                        >
                            <Printer className="size-4" aria-hidden="true" />
                            Grid A4 ({gridLayout})
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
