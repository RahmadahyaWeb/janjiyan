import { router } from '@inertiajs/react';
import { Check, Download, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
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
import type { BusinessType } from '@/types';

const DEFAULT_SUBTITLE = 'Scan QR untuk Booking Online';

const SUBTITLE_PRESETS_BY_TYPE: Record<BusinessType, string[]> = {
    staff_appointment: [
        'Scan QR untuk Booking Online',
        'Scan QR untuk Buat Janji Temu',
        'Scan QR untuk Cek Layanan & Harga',
        'Scan QR untuk Reservasi Jadwal',
    ],
    space_booking: [
        'Scan QR untuk Booking Online',
        'Scan QR untuk Cek Jadwal & Sesi',
        'Scan QR untuk Sewa Tempat / Paket',
        'Scan QR untuk Cek Fasilitas & Harga',
    ],
    dropoff: [
        'Scan QR untuk Order & Drop-off',
        'Scan QR untuk Booking Online',
        'Scan QR untuk Cek Layanan & Tarif',
        'Scan QR untuk Lacak Status Pesanan',
    ],
};

interface QrPosterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    businessName: string;
    businessCategory: string;
    businessSlug: string;
    businessType?: BusinessType;
    businessAddress?: string | null;
    qrSubtitle?: string | null;
    canSaveSubtitle?: boolean;
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
            const remaining = [current, ...words.slice(i + 1)].filter(Boolean).join(' ');
            current = remaining;
            break;
        }
    }

    if (current) {
        lines.push(current);
    }

    return lines.slice(0, maxLines);
}

export function QrPosterDialog({
    open,
    onOpenChange,
    businessName,
    businessCategory,
    businessSlug,
    businessType = 'staff_appointment',
    businessAddress,
    qrSubtitle,
    canSaveSubtitle = false,
}: QrPosterDialogProps) {
    const subtitlePresets = SUBTITLE_PRESETS_BY_TYPE[businessType] ?? SUBTITLE_PRESETS_BY_TYPE.staff_appointment;
    const footerTagline =
        businessType === 'dropoff'
            ? 'Pemesanan & Pelacakan Online didukung oleh Janjiyan'
            : 'Booking Online Real-Time didukung oleh Janjiyan';
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [downloading, setDownloading] = useState(false);
    const [subtitle, setSubtitle] = useState<string>(qrSubtitle?.trim() || DEFAULT_SUBTITLE);
    const [savingSubtitle, setSavingSubtitle] = useState(false);

    useEffect(() => {
        setSubtitle(qrSubtitle?.trim() || DEFAULT_SUBTITLE);
    }, [qrSubtitle, open]);

    const resolvedSubtitle = subtitle.trim() || DEFAULT_SUBTITLE;
    const savedSubtitle = qrSubtitle?.trim() || DEFAULT_SUBTITLE;
    const subtitleChanged = resolvedSubtitle !== savedSubtitle;

    const publicUrl =
        typeof window !== 'undefined'
            ? `${window.location.origin}/b/${businessSlug}`
            : `/b/${businessSlug}`;

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        QRCode.toDataURL(publicUrl, {
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
    }, [open, publicUrl]);

    const saveSubtitle = () => {
        if (!canSaveSubtitle || savingSubtitle) return;
        setSavingSubtitle(true);
        router.patch(
            route('dashboard.settings.qr-subtitle'),
            { qr_poster_subtitle: resolvedSubtitle === DEFAULT_SUBTITLE ? null : resolvedSubtitle },
            {
                preserveScroll: true,
                onFinish: () => setSavingSubtitle(false),
            }
        );
    };

    const downloadQrOnly = () => {
        if (!qrDataUrl) return;
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `qr-${businessSlug}.png`;
        link.click();
    };

    const downloadPosterPng = async () => {
        if (!qrDataUrl || downloading) return;
        setDownloading(true);

        try {
            const width = 1200;
            const height = 1600;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Gallery-white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Subtle outer border
            drawRoundedRect(ctx, 56, 56, width - 112, height - 112, 48);
            ctx.strokeStyle = '#e5e5e5';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Category pill
            const catText = (businessCategory || 'Layanan').toUpperCase();
            ctx.font = '600 26px Inter, system-ui, -apple-system, sans-serif';
            const catWidth = Math.min(width - 200, ctx.measureText(catText).width + 64);
            drawRoundedRect(ctx, (width - catWidth) / 2, 124, catWidth, 56, 28);
            ctx.fillStyle = '#f3f3f3';
            ctx.fill();
            ctx.fillStyle = '#525252';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(catText, width / 2, 152, catWidth - 40);

            // Business Name (auto-scale & wrap up to 2 lines, never truncated with ellipsis)
            const maxTitleWidth = width - 200;
            let titleFontSize = 58;
            let titleLines: string[] = [];
            for (const size of [58, 52, 46, 40]) {
                titleFontSize = size;
                ctx.font = `700 ${size}px Inter, system-ui, -apple-system, sans-serif`;
                if (ctx.measureText(businessName).width <= maxTitleWidth) {
                    titleLines = [businessName];
                    break;
                }
                const wrapped = wrapCanvasLines(ctx, businessName, maxTitleWidth, 2);
                const fits = wrapped.every((line) => ctx.measureText(line).width <= maxTitleWidth);
                if (fits || size === 40) {
                    titleLines = wrapped;
                    break;
                }
            }

            ctx.fillStyle = '#141414';
            ctx.font = `700 ${titleFontSize}px Inter, system-ui, -apple-system, sans-serif`;
            const titleStartY = titleLines.length > 1 ? 238 : 252;
            const titleLineHeight = Math.round(titleFontSize * 1.18);
            titleLines.forEach((line, idx) => {
                ctx.fillText(line, width / 2, titleStartY + idx * titleLineHeight, maxTitleWidth);
            });

            // Custom Subtitle (wraps up to 2 lines)
            const subFontSize = 30;
            ctx.fillStyle = '#666666';
            ctx.font = `400 ${subFontSize}px Inter, system-ui, -apple-system, sans-serif`;
            const subtitleLines = wrapCanvasLines(ctx, resolvedSubtitle, width - 220, 2);
            const subtitleStartY = titleStartY + (titleLines.length - 1) * titleLineHeight + 66;
            const subtitleLineHeight = 40;
            subtitleLines.forEach((line, idx) => {
                ctx.fillText(line, width / 2, subtitleStartY + idx * subtitleLineHeight, width - 200);
            });

            // QR Card Container
            const qrBoxSize = 690;
            const qrBoxX = (width - qrBoxSize) / 2;
            const qrBoxY = Math.max(410, subtitleStartY + (subtitleLines.length - 1) * subtitleLineHeight + 58);
            drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 40);
            ctx.fillStyle = '#f8f8f8';
            ctx.fill();
            ctx.strokeStyle = '#e5e5e5';
            ctx.lineWidth = 2;
            ctx.stroke();

            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load QR'));
                img.src = qrDataUrl;
            });

            const qrDrawSize = 576;
            ctx.drawImage(img, (width - qrDrawSize) / 2, qrBoxY + (qrBoxSize - qrDrawSize) / 2, qrDrawSize, qrDrawSize);

            // URL Pill (auto-scaled so long slug fits cleanly without clipping)
            const urlText = publicUrl.replace(/^https?:\/\//, '');
            let urlFontSize = 26;
            const maxPillW = width - 180;
            for (const size of [26, 23, 20]) {
                urlFontSize = size;
                ctx.font = `500 ${size}px "Geist Mono", ui-monospace, monospace`;
                if (ctx.measureText(urlText).width + 72 <= maxPillW) break;
            }
            const pillW = Math.min(maxPillW, ctx.measureText(urlText).width + 72);
            const pillY = qrBoxY + qrBoxSize + 52;
            drawRoundedRect(ctx, (width - pillW) / 2, pillY, pillW, 66, 33);
            ctx.fillStyle = '#141414';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(urlText, width / 2, pillY + 33, maxPillW - 40);

            // Address (wraps up to 2 lines if present)
            if (businessAddress) {
                ctx.fillStyle = '#666666';
                ctx.font = '400 24px Inter, system-ui, -apple-system, sans-serif';
                const addrLines = wrapCanvasLines(ctx, businessAddress, width - 220, 2);
                const addrStartY = pillY + 114;
                addrLines.forEach((line, idx) => {
                    ctx.fillText(line, width / 2, addrStartY + idx * 32, width - 200);
                });
            }

            // Footer brand
            ctx.fillStyle = '#8a8a8a';
            ctx.font = '500 23px Inter, system-ui, -apple-system, sans-serif';
            ctx.fillText(footerTagline, width / 2, 1485);

            const posterUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = posterUrl;
            link.download = `poster-booking-${businessSlug}.png`;
            link.click();
        } finally {
            setDownloading(false);
        }
    };

    const printPoster = () => {
        if (!qrDataUrl || typeof window === 'undefined') return;
        const win = window.open('', '_blank', 'width=720,height=920');
        if (!win) return;

        const escapeHtml = (s: string) =>
            s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

        const displayUrl = publicUrl.replace(/^https?:\/\//, '');

        win.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Poster QR Booking — ${escapeHtml(businessName)}</title>
<style>
  @page { size: A5 portrait; margin: 12mm; }
  body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; color: #141414; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100dvh; background: #fff; }
  .card { width: 100%; max-width: 440px; border: 1.5px solid #e5e5e5; border-radius: 28px; padding: 36px 28px; text-align: center; box-sizing: border-box; }
  .pill { display: inline-block; background: #f3f3f3; color: #525252; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
  h1 { font-size: 26px; font-weight: 700; margin: 14px 0 6px; letter-spacing: -0.02em; overflow-wrap: anywhere; }
  .sub { font-size: 14px; color: #666; margin: 0 0 24px; }
  .qr-wrap { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 22px; padding: 20px; display: inline-block; }
  .qr-wrap img { width: 250px; height: 250px; display: block; }
  .url { margin-top: 20px; display: inline-block; background: #141414; color: #fff; font-family: ui-monospace, monospace; font-size: 12px; padding: 8px 18px; border-radius: 999px; overflow-wrap: anywhere; }
  .addr { font-size: 12px; color: #666; margin-top: 12px; }
  .foot { font-size: 11px; color: #8a8a8a; margin-top: 24px; }
</style>
</head>
<body>
  <div class="card">
    <span class="pill">${escapeHtml(businessCategory)}</span>
    <h1>${escapeHtml(businessName)}</h1>
    <p class="sub">${escapeHtml(resolvedSubtitle)}</p>
    <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Code Booking ${escapeHtml(businessName)}" /></div>
    <div><span class="url">${escapeHtml(displayUrl)}</span></div>
    ${businessAddress ? `<p class="addr">${escapeHtml(businessAddress)}</p>` : ''}
    <p class="foot">${escapeHtml(footerTagline)}</p>
  </div>
  <script>window.onload = () => { window.print(); };</script>
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
                        Poster QR Booking Siap Cetak
                    </DialogTitle>
                    <DialogDescription className="text-sm text-mute">
                        Cetak atau tempel di meja kasir, cermin, atau pintu masuk agar pelanggan bisa scan langsung.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 rounded-sm bg-bone p-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="qr-poster-subtitle" className="text-xs font-semibold text-ink">
                            Sub-headline Poster
                        </Label>
                        {canSaveSubtitle && subtitleChanged && (
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
                        id="qr-poster-subtitle"
                        maxLength={120}
                        placeholder={DEFAULT_SUBTITLE}
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="h-10 bg-canvas text-base md:text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {subtitlePresets.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setSubtitle(preset)}
                                className={`min-h-8 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                                    resolvedSubtitle === preset
                                        ? 'bg-ink text-canvas'
                                        : 'bg-canvas text-mute hover:text-ink'
                                }`}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-md border border-hairline-soft bg-canvas p-4 text-center sm:p-5">
                    <span className="inline-block rounded-full bg-bone px-3 py-1 text-xs font-semibold tracking-wider text-mute uppercase">
                        {businessCategory}
                    </span>
                    <h3 className="mt-2.5 break-words text-xl font-semibold tracking-tight text-ink">
                        {businessName}
                    </h3>
                    <p className="mt-1 break-words text-xs text-mute">
                        {resolvedSubtitle}
                    </p>

                    <div className="mx-auto mt-4 inline-flex items-center justify-center rounded-sm border border-hairline-soft bg-bone/50 p-3 sm:p-4">
                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt={`QR Code portal booking ${businessName}`}
                                className="size-40 rounded-lg bg-white object-contain sm:size-44"
                            />
                        ) : (
                            <div className="flex size-40 items-center justify-center text-xs text-mute sm:size-44">
                                Membuat QR Code...
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <span className="inline-block max-w-full break-words rounded-full bg-ink px-4 py-1.5 font-mono text-xs text-canvas">
                            {publicUrl.replace(/^https?:\/\//, '')}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                        type="button"
                        size="sm"
                        onClick={downloadPosterPng}
                        disabled={!qrDataUrl || downloading}
                        className="w-full rounded-full sm:w-auto sm:flex-1"
                    >
                        <Download className="size-4" aria-hidden="true" />
                        {downloading ? 'Menyiapkan…' : 'Unduh Poster PNG'}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={downloadQrOnly}
                        disabled={!qrDataUrl}
                        className="flex-1 rounded-full sm:flex-initial"
                    >
                        QR Saja
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={printPoster}
                        disabled={!qrDataUrl}
                        className="flex-1 rounded-full sm:flex-initial"
                    >
                        <Printer className="size-4" aria-hidden="true" />
                        Cetak
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
