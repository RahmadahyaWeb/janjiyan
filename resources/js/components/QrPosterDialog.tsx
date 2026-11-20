import { Download, Printer, QrCode } from 'lucide-react';
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

interface QrPosterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    businessName: string;
    businessCategory: string;
    businessSlug: string;
    businessAddress?: string | null;
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

export function QrPosterDialog({
    open,
    onOpenChange,
    businessName,
    businessCategory,
    businessSlug,
    businessAddress,
}: QrPosterDialogProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [downloading, setDownloading] = useState(false);

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
            const catWidth = ctx.measureText(catText).width + 64;
            drawRoundedRect(ctx, (width - catWidth) / 2, 130, catWidth, 56, 28);
            ctx.fillStyle = '#f3f3f3';
            ctx.fill();
            ctx.fillStyle = '#525252';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(catText, width / 2, 158);

            // Business Name
            ctx.fillStyle = '#141414';
            ctx.font = '700 62px Inter, system-ui, -apple-system, sans-serif';
            const safeName = businessName.length > 26 ? `${businessName.slice(0, 25)}…` : businessName;
            ctx.fillText(safeName, width / 2, 260);

            // Subtitle
            ctx.fillStyle = '#666666';
            ctx.font = '400 32px Inter, system-ui, -apple-system, sans-serif';
            ctx.fillText('Scan QR untuk Booking Online Tanpa Antre', width / 2, 330);

            // QR Card Container
            const qrBoxSize = 720;
            const qrBoxX = (width - qrBoxSize) / 2;
            const qrBoxY = 410;
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

            const qrDrawSize = 600;
            ctx.drawImage(img, (width - qrDrawSize) / 2, qrBoxY + 60, qrDrawSize, qrDrawSize);

            // URL Pill
            const urlText = publicUrl.replace(/^https?:\/\//, '');
            ctx.font = '500 28px "Geist Mono", ui-monospace, monospace';
            const pillW = Math.min(width - 180, ctx.measureText(urlText).width + 80);
            drawRoundedRect(ctx, (width - pillW) / 2, 1190, pillW, 68, 34);
            ctx.fillStyle = '#141414';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(urlText, width / 2, 1224);

            // Address (if present)
            if (businessAddress) {
                ctx.fillStyle = '#666666';
                ctx.font = '400 26px Inter, system-ui, -apple-system, sans-serif';
                const shortAddr =
                    businessAddress.length > 58
                        ? `${businessAddress.slice(0, 57)}…`
                        : businessAddress;
                ctx.fillText(shortAddr, width / 2, 1320);
            }

            // Footer brand
            ctx.fillStyle = '#8a8a8a';
            ctx.font = '500 24px Inter, system-ui, -apple-system, sans-serif';
            ctx.fillText('Reservasi Real-Time didukung oleh Janjiyan', width / 2, 1460);

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
  h1 { font-size: 26px; font-weight: 700; margin: 14px 0 6px; letter-spacing: -0.02em; }
  .sub { font-size: 14px; color: #666; margin: 0 0 24px; }
  .qr-wrap { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 22px; padding: 20px; display: inline-block; }
  .qr-wrap img { width: 250px; height: 250px; display: block; }
  .url { margin-top: 20px; display: inline-block; background: #141414; color: #fff; font-family: ui-monospace, monospace; font-size: 12px; padding: 8px 18px; border-radius: 999px; word-break: break-all; }
  .addr { font-size: 12px; color: #666; margin-top: 12px; }
  .foot { font-size: 11px; color: #8a8a8a; margin-top: 24px; }
</style>
</head>
<body>
  <div class="card">
    <span class="pill">${escapeHtml(businessCategory)}</span>
    <h1>${escapeHtml(businessName)}</h1>
    <p class="sub">Scan QR untuk Booking Online Tanpa Antre</p>
    <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Code Booking ${escapeHtml(businessName)}" /></div>
    <div><span class="url">${escapeHtml(displayUrl)}</span></div>
    ${businessAddress ? `<p class="addr">${escapeHtml(businessAddress)}</p>` : ''}
    <p class="foot">Reservasi Real-Time didukung oleh Janjiyan</p>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
        win.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain rounded-[24px] border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-md sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink">
                        <QrCode className="size-5 shrink-0 text-ink" aria-hidden="true" />
                        Poster QR Booking Siap Cetak
                    </DialogTitle>
                    <DialogDescription className="text-sm text-mute">
                        Cetak atau tempel di meja kasir, cermin, atau pintu masuk agar pelanggan bisa booking langsung.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 rounded-[20px] border border-hairline-soft bg-canvas p-4 text-center sm:p-6">
                    <span className="inline-block rounded-full bg-bone px-3 py-1 text-[11px] font-semibold tracking-wider text-mute uppercase">
                        {businessCategory}
                    </span>
                    <h3 className="mt-2.5 break-words text-xl font-semibold tracking-tight text-ink">
                        {businessName}
                    </h3>
                    <p className="mt-1 text-xs text-mute">
                        Scan QR untuk Booking Online Tanpa Antre
                    </p>

                    <div className="mx-auto mt-4 inline-flex items-center justify-center rounded-[18px] border border-hairline-soft bg-bone/50 p-3 sm:p-4">
                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt={`QR Code portal booking ${businessName}`}
                                className="size-40 rounded-lg bg-white object-contain sm:size-48"
                            />
                        ) : (
                            <div className="flex size-40 items-center justify-center text-xs text-mute sm:size-48">
                                Membuat QR Code...
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <span className="inline-block max-w-full break-all rounded-full bg-ink px-4 py-1.5 font-mono text-xs text-canvas">
                            {publicUrl.replace(/^https?:\/\//, '')}
                        </span>
                    </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                        type="button"
                        onClick={downloadPosterPng}
                        disabled={!qrDataUrl || downloading}
                        className="flex-1 rounded-full"
                    >
                        <Download className="mr-1.5 size-4" aria-hidden="true" />
                        {downloading ? 'Menyiapkan...' : 'Unduh Poster PNG'}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={downloadQrOnly}
                        disabled={!qrDataUrl}
                        className="rounded-full"
                    >
                        QR Saja
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={printPoster}
                        disabled={!qrDataUrl}
                        className="rounded-full"
                    >
                        <Printer className="mr-1.5 size-4" aria-hidden="true" />
                        Cetak
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
