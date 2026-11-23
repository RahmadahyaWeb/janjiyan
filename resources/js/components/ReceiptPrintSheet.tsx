import { Download, Printer, ReceiptText, Tag } from 'lucide-react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    formatDateShortIndo,
    formatRupiah,
    PAYMENT_METHOD_LABELS,
    PAYMENT_TYPE_LABELS,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingItemRecord, BookingPaymentRecord } from '@/types';

export type ReceiptFormat = '58mm' | '80mm' | 'tag58';

export interface ReceiptBookingData {
    id: number;
    booking_code: string;
    invoice_number?: string | null;
    invoice_url?: string | null;
    customer_name: string;
    customer_phone: string;
    service_name: string;
    service_summary?: string;
    booking_mode?: 'time_slot' | 'dropoff';
    quantity?: number;
    unit_label?: string;
    fulfillment_type?: 'dropoff' | 'pickup';
    estimated_ready_date?: string | null;
    schedule_label?: string;
    staff_name?: string | null;
    booking_date: string;
    start_time_local: string;
    total_price: number;
    dp_amount: number;
    paid_amount?: number;
    remaining_balance?: number;
    settled_at_local?: string | null;
    payment_status: 'unpaid' | 'waiting_verification' | 'dp_verified' | 'settled';
    customer_notes?: string | null;
    items?: BookingItemRecord[];
    payments?: BookingPaymentRecord[];
}

export interface ReceiptSheetProps {
    booking: ReceiptBookingData;
    format: ReceiptFormat;
    businessName: string;
    businessAddress?: string | null;
    businessPhone?: string | null;
    businessEmail?: string | null;
    cashierName?: string | null;
    qrDataUrl?: string;
}

function resolveDisplayItems(booking: ReceiptBookingData): Array<{
    key: string;
    name: string;
    qty: number;
    unit: string;
    unitPrice: number;
    subtotal: number;
}> {
    if (booking.items && booking.items.length > 0) {
        return booking.items.map((item) => ({
            key: String(item.id),
            name: item.name_snapshot,
            qty: item.quantity,
            unit: item.unit_label_snapshot || 'item',
            unitPrice: item.unit_price,
            subtotal: item.subtotal,
        }));
    }

    const qty = Math.max(1, booking.quantity ?? 1);
    return [
        {
            key: `fallback-${booking.id}`,
            name: booking.service_name,
            qty,
            unit: booking.unit_label || 'item',
            unitPrice: Math.round(booking.total_price / qty),
            subtotal: booking.total_price,
        },
    ];
}

function resolvePaidAndRemaining(booking: ReceiptBookingData) {
    const paidAmount =
        booking.paid_amount ??
        (booking.payment_status === 'settled' ? booking.total_price : 0);
    const remainingBalance =
        booking.remaining_balance ?? Math.max(0, booking.total_price - paidAmount);
    const isSettled =
        booking.payment_status === 'settled' ||
        (booking.total_price >= 0 && remainingBalance === 0 && (paidAmount > 0 || booking.total_price === 0));

    return { paidAmount, remainingBalance, isSettled };
}

export function useReceiptQrDataUrl(url: string | null | undefined, enabled = true): string {
    const [qrDataUrl, setQrDataUrl] = useState('');

    useEffect(() => {
        if (!enabled || !url) {
            setQrDataUrl('');
            return;
        }

        let cancelled = false;
        QRCode.toDataURL(url, {
            width: 320,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#141414',
                light: '#ffffff',
            },
        })
            .then((dataUrl) => {
                if (!cancelled) setQrDataUrl(dataUrl);
            })
            .catch(() => {
                if (!cancelled) setQrDataUrl('');
            });

        return () => {
            cancelled = true;
        };
    }, [url, enabled]);

    return qrDataUrl;
}

export function getReceiptPageStyle(format: ReceiptFormat): string {
    if (format === '80mm') {
        return `
            @page { size: 80mm auto; margin: 3mm; }
            html, body { margin: 0; padding: 0; background: #ffffff; color: #141414; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            * { box-sizing: border-box; }
        `;
    }

    return `
        @page { size: 58mm auto; margin: 2mm; }
        html, body { margin: 0; padding: 0; background: #ffffff; color: #141414; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { box-sizing: border-box; }
    `;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines;
}

export async function renderThermalReceiptToCanvas({
    booking,
    format,
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    cashierName,
    qrDataUrl,
}: ReceiptSheetProps): Promise<string> {
    const is80 = format === '80mm';
    const isTag = format === 'tag58';
    const width = is80 ? 600 : 420;
    const padX = is80 ? 24 : 16;
    const contentW = width - padX * 2;
    const lineH = is80 ? 28 : 22;
    const monoFont = '"Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';
    const baseFontSize = is80 ? 20 : 16;
    const smallFontSize = is80 ? 17 : 14;

    const items = resolveDisplayItems(booking);
    const { paidAmount, remainingBalance, isSettled } = resolvePaidAndRemaining(booking);
    const payments = booking.payments ?? [];
    const invoiceLabel = booking.invoice_number || booking.booking_code;
    const isDropoff = booking.booking_mode === 'dropoff';

    // Measure first on a scratch canvas so total height fits tightly without clipping
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = 100;
    const sctx = scratch.getContext('2d');
    if (!sctx) {
        throw new Error('Canvas 2D context tidak tersedia.');
    }

    type DrawOp = (ctx: CanvasRenderingContext2D) => void;
    const ops: DrawOp[] = [];
    let y = 24;

    const addCenteredText = (text: string, font: string, color: string, step = lineH) => {
        sctx.font = font;
        const wrapped = wrapCanvasText(sctx, text, contentW);
        for (const line of wrapped) {
            const drawY = y;
            ops.push((ctx) => {
                ctx.font = font;
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(line, width / 2, drawY, contentW);
            });
            y += step;
        }
    };

    const addDashedLine = () => {
        const drawY = y + 6;
        ops.push((ctx) => {
            ctx.save();
            ctx.strokeStyle = '#a3a3a3';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 5]);
            ctx.beginPath();
            ctx.moveTo(padX, drawY);
            ctx.lineTo(width - padX, drawY);
            ctx.stroke();
            ctx.restore();
        });
        y += 18;
    };

    const addKeyValue = (
        left: string,
        right: string,
        font = `${baseFontSize}px ${monoFont}`,
        color = '#141414',
        step = lineH
    ) => {
        const drawY = y;
        ops.push((ctx) => {
            ctx.font = font;
            ctx.fillStyle = color;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(left, padX, drawY, contentW * 0.58);
            ctx.textAlign = 'right';
            ctx.fillText(right, width - padX, drawY, contentW * 0.45);
        });
        y += step;
    };

    if (isTag) {
        addCenteredText(businessName.toUpperCase(), `bold ${smallFontSize}px ${monoFont}`, '#525252', lineH - 2);
        addCenteredText('LABEL ORDER DROP-OFF', `bold ${baseFontSize}px ${monoFont}`, '#141414', lineH + 2);
        addDashedLine();

        addCenteredText(booking.booking_code, `bold ${is80 ? 34 : 30}px ${monoFont}`, '#141414', 38);
        if (booking.invoice_number) {
            addCenteredText(booking.invoice_number, `${smallFontSize}px ${monoFont}`, '#525252', lineH - 2);
        }
        addDashedLine();

        addKeyValue('Pelanggan', booking.customer_name, `bold ${baseFontSize}px ${monoFont}`);
        addKeyValue('Masuk', formatDateShortIndo(booking.booking_date), `${smallFontSize}px ${monoFont}`);
        if (booking.estimated_ready_date) {
            addKeyValue('Est. Selesai', formatDateShortIndo(booking.estimated_ready_date), `bold ${smallFontSize}px ${monoFont}`);
        }
        addDashedLine();

        for (const item of items) {
            const lineText = `${item.qty} ${item.unit} x ${item.name}`;
            sctx.font = `bold ${smallFontSize}px ${monoFont}`;
            const lines = wrapCanvasText(sctx, lineText, contentW);
            for (const line of lines) {
                const drawY = y;
                ops.push((ctx) => {
                    ctx.font = `bold ${smallFontSize}px ${monoFont}`;
                    ctx.fillStyle = '#141414';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(line, padX, drawY, contentW);
                });
                y += lineH - 2;
            }
        }

        if (booking.customer_notes) {
            addDashedLine();
            sctx.font = `${smallFontSize}px ${monoFont}`;
            for (const line of wrapCanvasText(sctx, `Catatan: ${booking.customer_notes}`, contentW)) {
                const drawY = y;
                ops.push((ctx) => {
                    ctx.font = `${smallFontSize}px ${monoFont}`;
                    ctx.fillStyle = '#525252';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(line, padX, drawY, contentW);
                });
                y += lineH - 3;
            }
        }

        addDashedLine();
        addKeyValue(
            'Pembayaran',
            isSettled ? 'LUNAS' : `SISA ${formatRupiah(remainingBalance)}`,
            `bold ${baseFontSize}px ${monoFont}`
        );
    } else {
        addCenteredText(businessName.toUpperCase(), `bold ${baseFontSize + 4}px ${monoFont}`, '#141414', lineH + 4);
        if (businessAddress) {
            addCenteredText(businessAddress, `${smallFontSize}px ${monoFont}`, '#525252', lineH - 3);
        }
        if (businessPhone) {
            addCenteredText(`Telp/WA: ${businessPhone}`, `${smallFontSize}px ${monoFont}`, '#525252', lineH - 3);
        }
        if (businessEmail) {
            addCenteredText(businessEmail, `${smallFontSize}px ${monoFont}`, '#525252', lineH - 3);
        }

        addDashedLine();
        addKeyValue('Invoice', invoiceLabel, `bold ${smallFontSize}px ${monoFont}`);
        addKeyValue('Kode', booking.booking_code, `${smallFontSize}px ${monoFont}`);
        addKeyValue(
            'Tanggal',
            isDropoff
                ? formatDateShortIndo(booking.booking_date)
                : `${formatDateShortIndo(booking.booking_date)} ${booking.start_time_local}`,
            `${smallFontSize}px ${monoFont}`
        );
        addKeyValue('Pelanggan', booking.customer_name, `${smallFontSize}px ${monoFont}`);
        if (booking.staff_name) {
            addKeyValue('Staff', booking.staff_name, `${smallFontSize}px ${monoFont}`);
        }
        if (cashierName) {
            addKeyValue('Kasir', cashierName, `${smallFontSize}px ${monoFont}`);
        }
        if (isDropoff && booking.estimated_ready_date) {
            addKeyValue('Est. Selesai', formatDateShortIndo(booking.estimated_ready_date), `${smallFontSize}px ${monoFont}`);
        }

        addDashedLine();
        for (const item of items) {
            sctx.font = `bold ${smallFontSize}px ${monoFont}`;
            for (const line of wrapCanvasText(sctx, item.name, contentW)) {
                const drawY = y;
                ops.push((ctx) => {
                    ctx.font = `bold ${smallFontSize}px ${monoFont}`;
                    ctx.fillStyle = '#141414';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(line, padX, drawY, contentW);
                });
                y += lineH - 2;
            }
            addKeyValue(
                `  ${item.qty} ${item.unit} x ${formatRupiah(item.unitPrice)}`,
                formatRupiah(item.subtotal),
                `${smallFontSize}px ${monoFont}`,
                '#525252',
                lineH - 1
            );
        }

        addDashedLine();
        addKeyValue('TOTAL', formatRupiah(booking.total_price), `bold ${baseFontSize + 2}px ${monoFont}`);
        addKeyValue('DIBAYAR', formatRupiah(paidAmount), `${smallFontSize}px ${monoFont}`);

        for (const pay of payments) {
            const label = `${PAYMENT_TYPE_LABELS[pay.payment_type] ?? pay.payment_type} (${PAYMENT_METHOD_LABELS[pay.payment_method] ?? pay.payment_method})`;
            const val = pay.amount < 0 ? `-${formatRupiah(Math.abs(pay.amount))}` : formatRupiah(pay.amount);
            addKeyValue(label, val, `${smallFontSize - 1}px ${monoFont}`, '#525252', lineH - 4);
            if (pay.payment_method === 'cash' && pay.change_amount > 0) {
                addKeyValue(
                    `  Tunai ${formatRupiah(pay.received_amount ?? 0)}`,
                    `Kembali ${formatRupiah(pay.change_amount)}`,
                    `${smallFontSize - 1}px ${monoFont}`,
                    '#525252',
                    lineH - 4
                );
            }
        }

        if (remainingBalance > 0) {
            addKeyValue('SISA TAGIHAN', formatRupiah(remainingBalance), `bold ${baseFontSize}px ${monoFont}`);
        } else if (isSettled) {
            addCenteredText('*** LUNAS ***', `bold ${baseFontSize}px ${monoFont}`, '#141414', lineH + 4);
        }

        addDashedLine();
    }

    const qrSize = isTag ? 140 : is80 ? 180 : 150;
    const qrY = y + 4;
    if (qrDataUrl) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Gagal memuat QR struk'));
            img.src = qrDataUrl;
        });
        ops.push((ctx) => {
            ctx.drawImage(img, (width - qrSize) / 2, qrY, qrSize, qrSize);
        });
        y = qrY + qrSize + 10;
    }

    addCenteredText('Scan QR untuk status & invoice', `${smallFontSize - 1}px ${monoFont}`, '#525252', lineH - 4);
    if (!isTag) {
        addCenteredText('Terima kasih atas kunjungan Anda', `${smallFontSize - 1}px ${monoFont}`, '#525252', lineH - 4);
    }
    addCenteredText('Ditenagai oleh Janjiyan', `${smallFontSize - 2}px ${monoFont}`, '#737373', lineH - 4);
    y += 16;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(240, y);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas 2D context tidak tersedia.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const op of ops) {
        op(ctx);
    }

    return canvas.toDataURL('image/png');
}

export async function downloadThermalReceiptPng(
    node: HTMLElement | null,
    props: ReceiptSheetProps
): Promise<void> {
    let pngDataUrl = '';

    if (node) {
        try {
            pngDataUrl = await toPng(node, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: true,
                cacheBust: true,
            });
            if (!pngDataUrl || !pngDataUrl.startsWith('data:image/png')) {
                pngDataUrl = '';
            }
        } catch {
            pngDataUrl = '';
        }
    }

    if (!pngDataUrl) {
        pngDataUrl = await renderThermalReceiptToCanvas(props);
    }

    const prefix = props.format === 'tag58' ? 'label-dropoff' : `struk-${props.format}`;
    const safeCode = (props.booking.invoice_number || props.booking.booking_code).replace(/[^a-zA-Z0-9_-]/g, '');
    const link = document.createElement('a');
    link.href = pngDataUrl;
    link.download = `${prefix}-${safeCode || 'janjiyan'}.png`;
    link.click();
}

export const ReceiptPrintSheet = forwardRef<HTMLDivElement, ReceiptSheetProps>(function ReceiptPrintSheet(
    {
        booking,
        format,
        businessName,
        businessAddress,
        businessPhone,
        businessEmail,
        cashierName,
        qrDataUrl: providedQrDataUrl,
    },
    ref
) {
    const fallbackQr = useReceiptQrDataUrl(
        booking.invoice_url || (typeof window !== 'undefined' ? window.location.href : ''),
        !providedQrDataUrl
    );
    const qrDataUrl = providedQrDataUrl || fallbackQr;

    const items = resolveDisplayItems(booking);
    const { paidAmount, remainingBalance, isSettled } = resolvePaidAndRemaining(booking);
    const payments = booking.payments ?? [];
    const invoiceLabel = booking.invoice_number || booking.booking_code;
    const isDropoff = booking.booking_mode === 'dropoff';
    const is80 = format === '80mm';
    const isTag = format === 'tag58';

    const widthPx = is80 ? '300px' : '210px';
    const fontSizePx = is80 ? '12px' : '11px';
    const smallFontPx = is80 ? '11px' : '10px';
    const paddingStyle = is80 ? '12px 10px' : '8px 6px';

    const rootStyle: React.CSSProperties = {
        width: widthPx,
        maxWidth: '100%',
        padding: paddingStyle,
        backgroundColor: '#ffffff',
        color: '#141414',
        fontFamily: "'Courier New', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: fontSizePx,
        lineHeight: 1.38,
        boxSizing: 'border-box',
        borderStyle: 'none',
        borderColor: 'transparent',
        outline: 'none',
        boxShadow: 'none',
        margin: '0 auto',
    };

    const dividerStyle: React.CSSProperties = {
        borderTop: '1px dashed #a3a3a3',
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        margin: '7px 0',
        height: 0,
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '8px',
        borderColor: 'transparent',
    };

    const mutedStyle: React.CSSProperties = {
        color: '#525252',
        fontSize: smallFontPx,
        borderColor: 'transparent',
    };

    if (isTag) {
        return (
            <div ref={ref} data-testid="receipt-print-sheet" data-receipt-format={format} style={rootStyle}>
                <div style={{ textAlign: 'center', borderColor: 'transparent' }}>
                    <div style={{ fontWeight: 700, fontSize: smallFontPx, color: '#525252', textTransform: 'uppercase' }}>
                        {businessName}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#141414', marginTop: '2px' }}>
                        LABEL ORDER DROP-OFF
                    </div>
                </div>

                <div style={dividerStyle} />

                <div style={{ textAlign: 'center', borderColor: 'transparent' }}>
                    <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '0.02em', color: '#141414' }}>
                        {booking.booking_code}
                    </div>
                    {booking.invoice_number && (
                        <div style={mutedStyle}>{booking.invoice_number}</div>
                    )}
                </div>

                <div style={dividerStyle} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderColor: 'transparent' }}>
                    <div style={rowStyle}>
                        <span style={mutedStyle}>Pelanggan</span>
                        <span style={{ fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{booking.customer_name}</span>
                    </div>
                    <div style={rowStyle}>
                        <span style={mutedStyle}>Tgl Masuk</span>
                        <span style={{ textAlign: 'right' }}>{formatDateShortIndo(booking.booking_date)}</span>
                    </div>
                    {booking.estimated_ready_date && (
                        <div style={rowStyle}>
                            <span style={mutedStyle}>Target</span>
                            <span style={{ fontWeight: 700, textAlign: 'right' }}>
                                {formatDateShortIndo(booking.estimated_ready_date)}
                            </span>
                        </div>
                    )}
                </div>

                <div style={dividerStyle} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderColor: 'transparent' }}>
                    {items.map((item) => (
                        <div key={item.key} style={{ fontWeight: 700, wordBreak: 'break-word', borderColor: 'transparent' }}>
                            • {item.qty} {item.unit} × {item.name}
                        </div>
                    ))}
                </div>

                {booking.customer_notes && (
                    <>
                        <div style={dividerStyle} />
                        <div style={{ ...mutedStyle, wordBreak: 'break-word' }}>
                            Catatan: {booking.customer_notes}
                        </div>
                    </>
                )}

                <div style={dividerStyle} />

                <div style={rowStyle}>
                    <span style={{ fontWeight: 700 }}>STATUS BAYAR</span>
                    <span style={{ fontWeight: 700 }}>
                        {isSettled ? 'LUNAS' : `SISA ${formatRupiah(remainingBalance)}`}
                    </span>
                </div>

                {qrDataUrl && (
                    <div style={{ textAlign: 'center', marginTop: '8px', borderColor: 'transparent' }}>
                        <img
                            src={qrDataUrl}
                            alt={`QR Invoice ${booking.booking_code}`}
                            style={{ width: '74px', height: '74px', display: 'inline-block', backgroundColor: '#ffffff' }}
                        />
                        <div style={{ ...mutedStyle, marginTop: '3px' }}>Scan QR cek status</div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div ref={ref} data-testid="receipt-print-sheet" data-receipt-format={format} style={rootStyle}>
            <div style={{ textAlign: 'center', borderColor: 'transparent' }}>
                <div style={{ fontWeight: 700, fontSize: is80 ? '14px' : '13px', color: '#141414', textTransform: 'uppercase' }}>
                    {businessName}
                </div>
                {businessAddress && (
                    <div style={{ ...mutedStyle, marginTop: '2px', wordBreak: 'break-word' }}>{businessAddress}</div>
                )}
                {businessPhone && <div style={mutedStyle}>Telp/WA: {businessPhone}</div>}
                {businessEmail && <div style={mutedStyle}>{businessEmail}</div>}
            </div>

            <div style={dividerStyle} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderColor: 'transparent' }}>
                <div style={rowStyle}>
                    <span style={mutedStyle}>Invoice</span>
                    <span style={{ fontWeight: 700, textAlign: 'right', wordBreak: 'break-all' }}>{invoiceLabel}</span>
                </div>
                <div style={rowStyle}>
                    <span style={mutedStyle}>Kode</span>
                    <span style={{ textAlign: 'right' }}>{booking.booking_code}</span>
                </div>
                <div style={rowStyle}>
                    <span style={mutedStyle}>Tanggal</span>
                    <span style={{ textAlign: 'right' }}>
                        {isDropoff
                            ? formatDateShortIndo(booking.booking_date)
                            : `${formatDateShortIndo(booking.booking_date)} ${booking.start_time_local}`}
                    </span>
                </div>
                <div style={rowStyle}>
                    <span style={mutedStyle}>Pelanggan</span>
                    <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{booking.customer_name}</span>
                </div>
                {booking.staff_name && (
                    <div style={rowStyle}>
                        <span style={mutedStyle}>Staff</span>
                        <span style={{ textAlign: 'right' }}>{booking.staff_name}</span>
                    </div>
                )}
                {cashierName && (
                    <div style={rowStyle}>
                        <span style={mutedStyle}>Kasir</span>
                        <span style={{ textAlign: 'right' }}>{cashierName}</span>
                    </div>
                )}
                {isDropoff && booking.estimated_ready_date && (
                    <div style={rowStyle}>
                        <span style={mutedStyle}>Est. Selesai</span>
                        <span style={{ textAlign: 'right' }}>{formatDateShortIndo(booking.estimated_ready_date)}</span>
                    </div>
                )}
            </div>

            <div style={dividerStyle} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderColor: 'transparent' }}>
                {items.map((item) => (
                    <div key={item.key} style={{ borderColor: 'transparent' }}>
                        <div style={{ fontWeight: 700, color: '#141414', wordBreak: 'break-word' }}>{item.name}</div>
                        <div style={rowStyle}>
                            <span style={mutedStyle}>
                                {item.qty} {item.unit} × {formatRupiah(item.unitPrice)}
                            </span>
                            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRupiah(item.subtotal)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={dividerStyle} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderColor: 'transparent' }}>
                <div style={{ ...rowStyle, fontWeight: 700, fontSize: is80 ? '13px' : '12px' }}>
                    <span>TOTAL</span>
                    <span>{formatRupiah(booking.total_price)}</span>
                </div>
                <div style={rowStyle}>
                    <span style={mutedStyle}>DIBAYAR</span>
                    <span style={{ fontWeight: 700 }}>{formatRupiah(paidAmount)}</span>
                </div>

                {payments.map((pay) => (
                    <div key={pay.id} style={{ borderColor: 'transparent' }}>
                        <div style={{ ...rowStyle, ...mutedStyle }}>
                            <span>
                                {PAYMENT_TYPE_LABELS[pay.payment_type] ?? pay.payment_type} ·{' '}
                                {PAYMENT_METHOD_LABELS[pay.payment_method] ?? pay.payment_method}
                            </span>
                            <span style={{ whiteSpace: 'nowrap' }}>
                                {pay.amount < 0
                                    ? `-${formatRupiah(Math.abs(pay.amount))}`
                                    : formatRupiah(pay.amount)}
                            </span>
                        </div>
                        {pay.payment_method === 'cash' && pay.change_amount > 0 && (
                            <div style={{ ...rowStyle, ...mutedStyle }}>
                                <span>Tunai {formatRupiah(pay.received_amount ?? 0)}</span>
                                <span>Kembali {formatRupiah(pay.change_amount)}</span>
                            </div>
                        )}
                    </div>
                ))}

                {remainingBalance > 0 ? (
                    <div style={{ ...rowStyle, fontWeight: 700, marginTop: '2px' }}>
                        <span>SISA TAGIHAN</span>
                        <span>{formatRupiah(remainingBalance)}</span>
                    </div>
                ) : isSettled ? (
                    <div
                        style={{
                            textAlign: 'center',
                            fontWeight: 700,
                            marginTop: '4px',
                            padding: '2px 6px',
                            border: '1px solid #141414',
                            color: '#141414',
                        }}
                    >
                        *** LUNAS ***
                    </div>
                ) : null}
            </div>

            <div style={dividerStyle} />

            {qrDataUrl && (
                <div style={{ textAlign: 'center', marginTop: '6px', borderColor: 'transparent' }}>
                    <img
                        src={qrDataUrl}
                        alt={`QR Code Invoice ${invoiceLabel}`}
                        style={{
                            width: is80 ? '98px' : '82px',
                            height: is80 ? '98px' : '82px',
                            display: 'inline-block',
                            backgroundColor: '#ffffff',
                        }}
                    />
                    <div style={{ ...mutedStyle, marginTop: '4px' }}>Scan QR untuk status &amp; invoice</div>
                </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '6px', borderColor: 'transparent' }}>
                <div style={mutedStyle}>Terima kasih atas kunjungan Anda</div>
                <div style={{ color: '#737373', fontSize: '9px', marginTop: '2px' }}>Ditenagai oleh Janjiyan</div>
            </div>
        </div>
    );
});

interface ReceiptPrintDialogProps {
    booking: ReceiptBookingData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    businessName: string;
    businessAddress?: string | null;
    businessPhone?: string | null;
    businessEmail?: string | null;
    cashierName?: string | null;
    initialFormat?: ReceiptFormat;
}

export function ReceiptPrintDialog({
    booking,
    open,
    onOpenChange,
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    cashierName,
    initialFormat = '58mm',
}: ReceiptPrintDialogProps) {
    const [format, setFormat] = useState<ReceiptFormat>(initialFormat);
    const [downloading, setDownloading] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            setFormat(initialFormat);
        }
    }, [open, initialFormat]);

    const isDropoff = booking?.booking_mode === 'dropoff';
    const qrDataUrl = useReceiptQrDataUrl(
        booking?.invoice_url || (typeof window !== 'undefined' ? window.location.href : ''),
        open && Boolean(booking)
    );

    const pageStyle = useMemo(() => getReceiptPageStyle(format), [format]);

    const handlePrint = useReactToPrint({
        contentRef,
        ignoreGlobalStyles: true,
        pageStyle,
        documentTitle: `Struk-${booking?.invoice_number || booking?.booking_code || 'Janjiyan'}`,
    });

    const handleDownloadPng = async () => {
        if (!booking || downloading) return;
        setDownloading(true);
        try {
            await downloadThermalReceiptPng(contentRef.current, {
                booking,
                format,
                businessName,
                businessAddress,
                businessPhone,
                businessEmail,
                cashierName,
                qrDataUrl,
            });
            toast.success('Gambar struk PNG siap dikirim ke pelanggan.');
        } catch {
            toast.error('Gagal membuat gambar PNG struk.');
        } finally {
            setDownloading(false);
        }
    };

    const formatOptions: Array<{ value: ReceiptFormat; label: string }> = [
        { value: '58mm', label: 'Thermal 58mm' },
        { value: '80mm', label: 'Thermal 80mm' },
        ...(isDropoff ? [{ value: 'tag58' as const, label: 'Label Drop-off' }] : []),
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-lg sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink">
                        <ReceiptText className="size-5 shrink-0 text-ink" aria-hidden="true" />
                        Struk &amp; Label Cetak
                    </DialogTitle>
                    <DialogDescription className="text-sm text-mute">
                        Cetak ke printer thermal Bluetooth/USB atau unduh sebagai gambar PNG untuk dibagikan via WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                {booking && (
                    <div className="space-y-4">
                        <div
                            className="flex flex-wrap gap-1.5 rounded-sm bg-bone p-1 sm:rounded-full"
                            role="group"
                            aria-label="Pilih format cetak struk"
                        >
                            {formatOptions.map((opt) => {
                                const active = format === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setFormat(opt.value)}
                                        className={cn(
                                            'inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                            active ? 'bg-canvas text-ink' : 'text-mute hover:text-ink'
                                        )}
                                    >
                                        {opt.value === 'tag58' && <Tag className="size-3.5" aria-hidden="true" />}
                                        <span>{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex max-h-[52dvh] items-start overflow-auto overscroll-contain rounded-sm border border-hairline-soft bg-bone p-4">
                            <div className="mx-auto inline-block h-fit shrink-0 rounded-xs bg-white p-2 outline-1 -outline-offset-1 outline-hairline">
                                <ReceiptPrintSheet
                                    ref={contentRef}
                                    booking={booking}
                                    format={format}
                                    businessName={businessName}
                                    businessAddress={businessAddress}
                                    businessPhone={businessPhone}
                                    businessEmail={businessEmail}
                                    cashierName={cashierName}
                                    qrDataUrl={qrDataUrl}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                type="button"
                                className="flex-1"
                                onClick={() => handlePrint()}
                            >
                                <Printer className="size-4" aria-hidden="true" />
                                Cetak {format === 'tag58' ? 'Label 58mm' : `Thermal ${format}`}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                disabled={downloading}
                                onClick={handleDownloadPng}
                            >
                                <Download className="size-4" aria-hidden="true" />
                                {downloading ? 'Menyiapkan PNG…' : 'Unduh PNG (WA)'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
