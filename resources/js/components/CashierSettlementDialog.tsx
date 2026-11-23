import { router } from '@inertiajs/react';
import {
    CheckCircle2,
    Download,
    Minus,
    Plus,
    Printer,
    ReceiptText,
    RotateCcw,
    Trash2,
    Wallet,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import {
    downloadThermalReceiptPng,
    getReceiptPageStyle,
    type ReceiptBookingData,
    ReceiptPrintSheet,
    useReceiptQrDataUrl,
} from '@/components/ReceiptPrintSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UNIT_LABEL_OPTIONS } from '@/lib/businessType';
import {
    formatRupiah,
    PAYMENT_METHOD_LABELS,
    PAYMENT_STATUS_LABELS,
    PAYMENT_TYPE_LABELS,
} from '@/lib/format';
import { cn, parseNumericInput } from '@/lib/utils';
import type {
    BookingItemType,
    BookingPaymentType,
    PaymentMethod,
    ServiceAddon,
    ServiceUnitLabel,
} from '@/types';

export interface CashierBookingData extends ReceiptBookingData {
    service_id: number;
    reservation_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
}

export interface CashierServiceOption {
    id: number;
    name: string;
    price: number;
    unit_label?: string;
}

interface DraftBookingItem {
    localKey: string;
    item_type: BookingItemType;
    service_id: number | null;
    service_addon_id: number | null;
    name: string;
    unit_label: ServiceUnitLabel | string;
    unit_price: number;
    quantity: number;
    is_commissionable: boolean;
}

interface CashierSettlementDialogProps {
    booking: CashierBookingData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    services: CashierServiceOption[];
    addons: ServiceAddon[];
    canVerifyPayments: boolean;
    canManageBookings?: boolean;
    defaultMarkCompleted?: boolean;
    supportsCommissions: boolean;
    businessName: string;
    businessAddress?: string | null;
    businessPhone?: string | null;
    businessEmail?: string | null;
    cashierName?: string | null;
    onOpenReceiptDialog: (bookingId: number) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'qris', 'transfer', 'edc'];

function buildInitialDraftItems(booking: CashierBookingData): DraftBookingItem[] {
    if (booking.items && booking.items.length > 0) {
        return booking.items.map((item) => ({
            localKey: `item-${item.id}`,
            item_type: item.item_type,
            service_id: item.service_id,
            service_addon_id: item.service_addon_id,
            name: item.name_snapshot,
            unit_label: item.unit_label_snapshot || 'item',
            unit_price: item.unit_price,
            quantity: Math.max(1, item.quantity),
            is_commissionable: Boolean(item.is_commissionable),
        }));
    }

    const qty = Math.max(1, booking.quantity ?? 1);
    return [
        {
            localKey: `legacy-${booking.id}`,
            item_type: 'service',
            service_id: booking.service_id,
            service_addon_id: null,
            name: booking.service_name,
            unit_label: booking.unit_label || 'item',
            unit_price: Math.round(booking.total_price / qty),
            quantity: qty,
            is_commissionable: true,
        },
    ];
}

function getSuggestedCashAmounts(amount: number): number[] {
    if (amount <= 0) return [];
    const candidates = [10000, 20000, 50000, 100000, 150000, 200000, 300000, 500000];
    const nextStep50k = Math.ceil(amount / 50000) * 50000;
    const nextStep100k = Math.ceil(amount / 100000) * 100000;
    const set = new Set<number>();
    if (nextStep50k > amount) set.add(nextStep50k);
    if (nextStep100k > amount) set.add(nextStep100k);
    for (const c of candidates) {
        if (c > amount && set.size < 3) {
            set.add(c);
        }
    }
    return Array.from(set).sort((a, b) => a - b).slice(0, 3);
}

export function CashierSettlementDialog({
    booking,
    open,
    onOpenChange,
    services,
    addons,
    canVerifyPayments,
    canManageBookings = true,
    defaultMarkCompleted = false,
    supportsCommissions,
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    cashierName,
    onOpenReceiptDialog,
}: CashierSettlementDialogProps) {
    const activeAddons = useMemo(() => addons.filter((a) => a.is_active), [addons]);
    const paidAmount = booking
        ? (booking.paid_amount ?? (booking.payment_status === 'settled' ? booking.total_price : 0))
        : 0;
    const remainingBalance = booking
        ? (booking.remaining_balance ?? Math.max(0, booking.total_price - paidAmount))
        : 0;
    const isSettled = Boolean(
        booking &&
            (booking.payment_status === 'settled' ||
                (remainingBalance === 0 && (paidAmount > 0 || booking.total_price === 0)))
    );
    const isCancelledOrNoShow = Boolean(
        booking && (booking.reservation_status === 'cancelled' || booking.reservation_status === 'no_show')
    );

    // Itemized Editor State
    const [draftItems, setDraftItems] = useState<DraftBookingItem[]>([]);
    const [itemsDirty, setItemsDirty] = useState(false);
    const [savingItems, setSavingItems] = useState(false);
    const [itemMode, setItemMode] = useState<'none' | 'service' | 'addon' | 'custom'>('none');
    const [selectedAddServiceId, setSelectedAddServiceId] = useState<string>('');
    const [selectedAddAddonId, setSelectedAddAddonId] = useState<string>('');
    const [customName, setCustomName] = useState('');
    const [customNameError, setCustomNameError] = useState('');
    const customNameRef = useRef<HTMLInputElement | null>(null);
    const [customPrice, setCustomPrice] = useState<number | ''>(0);
    const [customUnit, setCustomUnit] = useState<ServiceUnitLabel>('item');
    const [customQty, setCustomQty] = useState<number | ''>(1);
    const [customCommissionable, setCustomCommissionable] = useState(false);

    // Payment State
    const [paymentType, setPaymentType] = useState<BookingPaymentType>('settlement');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [amount, setAmount] = useState<number | ''>(0);
    const [receivedAmount, setReceivedAmount] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [markCompleted, setMarkCompleted] = useState(defaultMarkCompleted);
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [actionError, setActionError] = useState('');

    // Offscreen receipt print / PNG triggers
    const offscreenReceiptRef = useRef<HTMLDivElement>(null);
    const [downloadingPng, setDownloadingPng] = useState(false);
    const qrDataUrl = useReceiptQrDataUrl(
        booking?.invoice_url || (typeof window !== 'undefined' ? window.location.href : ''),
        open && Boolean(booking)
    );
    const pageStyle58 = useMemo(() => getReceiptPageStyle('58mm'), []);
    const handleDirectPrint = useReactToPrint({
        contentRef: offscreenReceiptRef,
        ignoreGlobalStyles: true,
        pageStyle: pageStyle58,
        documentTitle: `Struk-${booking?.invoice_number || booking?.booking_code || 'Janjiyan'}`,
    });

    const itemsSignature = useMemo(() => {
        if (!booking) return '';
        return `${booking.id}|${booking.total_price}|${(booking.items ?? [])
            .map((i) => `${i.id}:${i.quantity}:${i.subtotal}`)
            .join(',')}`;
    }, [booking]);

    useEffect(() => {
        if (!open || !booking) return;
        setDraftItems(buildInitialDraftItems(booking));
        setItemsDirty(false);
        setItemMode('none');
        setSelectedAddServiceId(services[0]?.id ? String(services[0].id) : '');
        setSelectedAddAddonId(activeAddons[0]?.id ? String(activeAddons[0].id) : '');
        setActionError('');
    }, [open, itemsSignature, services, activeAddons]);

    useEffect(() => {
        if (!open || !booking) return;
        if (isCancelledOrNoShow) {
            setPaymentType('refund');
            setAmount(paidAmount > 0 ? paidAmount : 0);
        } else if (remainingBalance > 0) {
            setPaymentType('settlement');
            setAmount(remainingBalance);
        } else {
            setPaymentType('adjustment');
            setAmount(0);
        }
        setReceivedAmount('');
        setNotes('');
        setMarkCompleted(defaultMarkCompleted);
        setActionError('');
    }, [open, booking?.id, remainingBalance, paidAmount, isCancelledOrNoShow, defaultMarkCompleted]);

    if (!booking) {
        return null;
    }

    const draftTotal = draftItems.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0
    );

    const updateDraftQty = (localKey: string, nextQty: number) => {
        const clamped = Math.max(1, Math.min(100, nextQty));
        setDraftItems((prev) =>
            prev.map((item) => (item.localKey === localKey ? { ...item, quantity: clamped } : item))
        );
        setItemsDirty(true);
    };

    const removeDraftItem = (localKey: string) => {
        if (draftItems.length <= 1) return;
        setDraftItems((prev) => prev.filter((item) => item.localKey !== localKey));
        setItemsDirty(true);
    };

    const handleAddServiceItem = () => {
        const svc = services.find((s) => String(s.id) === selectedAddServiceId);
        if (!svc) return;

        setDraftItems((prev) => {
            const existingIdx = prev.findIndex(
                (i) => i.item_type === 'service' && i.service_id === svc.id
            );
            if (existingIdx >= 0) {
                return prev.map((item, idx) =>
                    idx === existingIdx
                        ? { ...item, quantity: Math.min(100, item.quantity + 1) }
                        : item
                );
            }
            return [
                ...prev,
                {
                    localKey: `svc-${svc.id}-${Date.now()}`,
                    item_type: 'service',
                    service_id: svc.id,
                    service_addon_id: null,
                    name: svc.name,
                    unit_label: svc.unit_label || 'item',
                    unit_price: svc.price,
                    quantity: 1,
                    is_commissionable: true,
                },
            ];
        });
        setItemsDirty(true);
        setItemMode('none');
    };

    const handleAddAddonItem = () => {
        const addon = activeAddons.find((a) => String(a.id) === selectedAddAddonId);
        if (!addon) return;

        setDraftItems((prev) => {
            const existingIdx = prev.findIndex(
                (i) => i.item_type === 'addon' && i.service_addon_id === addon.id
            );
            if (existingIdx >= 0) {
                return prev.map((item, idx) =>
                    idx === existingIdx
                        ? { ...item, quantity: Math.min(100, item.quantity + 1) }
                        : item
                );
            }
            return [
                ...prev,
                {
                    localKey: `addon-${addon.id}-${Date.now()}`,
                    item_type: 'addon',
                    service_id: null,
                    service_addon_id: addon.id,
                    name: addon.name,
                    unit_label: addon.unit_label || 'item',
                    unit_price: addon.price,
                    quantity: 1,
                    is_commissionable: Boolean(addon.is_commissionable),
                },
            ];
        });
        setItemsDirty(true);
        setItemMode('none');
    };

    const handleAddCustomItem = () => {
        const trimmedName = customName.trim();
        if (!trimmedName) {
            setCustomNameError('Nama item tambahan wajib diisi.');
            customNameRef.current?.focus();
            return;
        }
        setCustomNameError('');
        setActionError('');
        setDraftItems((prev) => [
            ...prev,
            {
                localKey: `custom-${Date.now()}`,
                item_type: 'custom',
                service_id: null,
                service_addon_id: null,
                name: trimmedName,
                unit_label: customUnit,
                unit_price: Math.max(0, Number(customPrice || 0)),
                quantity: Math.max(1, Math.min(100, Number(customQty || 1))),
                is_commissionable: supportsCommissions ? customCommissionable : false,
            },
        ]);
        setCustomName('');
        setCustomPrice(0);
        setCustomQty(1);
        setCustomCommissionable(false);
        setItemsDirty(true);
        setItemMode('none');
    };

    const handleSaveItems = () => {
        if (!canVerifyPayments || savingItems || draftItems.length === 0) return;
        setSavingItems(true);
        setActionError('');

        router.post(
            route('dashboard.bookings.items.update', booking.id),
            {
                items: draftItems.map((item) => ({
                    item_type: item.item_type,
                    service_id: item.service_id,
                    service_addon_id: item.service_addon_id,
                    name: item.name,
                    unit_label: item.unit_label,
                    unit_price: item.unit_price,
                    quantity: item.quantity,
                    is_commissionable: item.is_commissionable,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setItemsDirty(false);
                    toast.success('Rincian item transaksi diperbarui.');
                },
                onError: (errors) => {
                    const first = Object.values(errors)[0];
                    setActionError(typeof first === 'string' ? first : 'Gagal menyimpan rincian item.');
                },
                onFinish: () => setSavingItems(false),
            }
        );
    };

    const numericAmount = Math.max(0, Number(amount || 0));
    const numericReceived = receivedAmount === '' ? null : Math.max(0, Number(receivedAmount));
    const cashInsufficient =
        paymentMethod === 'cash' &&
        paymentType !== 'refund' &&
        numericReceived !== null &&
        numericReceived < numericAmount;
    const changeAmount =
        paymentMethod === 'cash' && paymentType !== 'refund' && numericReceived !== null
            ? Math.max(0, numericReceived - numericAmount)
            : 0;

    const handleFillExactRemaining = () => {
        setPaymentType('settlement');
        setAmount(remainingBalance);
        if (paymentMethod === 'cash') {
            setReceivedAmount(remainingBalance);
        }
        setActionError('');
    };

    const handleRecordPayment = (e: FormEvent) => {
        e.preventDefault();
        if (!canVerifyPayments || submittingPayment) return;

        if (paymentType === 'refund') {
            if (numericAmount <= 0 || numericAmount > paidAmount) {
                setActionError('Nominal refund harus lebih dari 0 dan tidak melebihi total yang sudah dibayar.');
                return;
            }
        } else if (numericAmount <= 0 && !(booking.total_price === 0 && paymentType === 'settlement')) {
            setActionError('Nominal pembayaran harus lebih dari Rp 0.');
            return;
        }

        if (cashInsufficient) {
            setActionError('Uang tunai diterima tidak boleh kurang dari nominal pembayaran.');
            return;
        }

        setSubmittingPayment(true);
        setActionError('');

        router.post(
            route('dashboard.bookings.payments.store', booking.id),
            {
                payment_type: paymentType,
                payment_method: paymentMethod,
                amount: numericAmount,
                received_amount:
                    paymentMethod === 'cash' && paymentType !== 'refund' ? numericReceived : null,
                notes: notes.trim() || undefined,
                mark_completed:
                    paymentType === 'settlement' && canManageBookings ? markCompleted : false,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNotes('');
                    setReceivedAmount('');
                    toast.success(
                        paymentType === 'refund'
                            ? 'Pengembalian dana berhasil dicatat.'
                            : 'Pembayaran berhasil dicatat.'
                    );
                },
                onError: (errors) => {
                    const first = Object.values(errors)[0];
                    setActionError(typeof first === 'string' ? first : 'Gagal mencatat pembayaran.');
                },
                onFinish: () => setSubmittingPayment(false),
            }
        );
    };

    const handleDirectDownloadPng = async () => {
        if (downloadingPng) return;
        setDownloadingPng(true);
        try {
            await downloadThermalReceiptPng(offscreenReceiptRef.current, {
                booking,
                format: '58mm',
                businessName,
                businessAddress,
                businessPhone,
                businessEmail,
                cashierName,
                qrDataUrl,
            });
            toast.success('Struk PNG siap dikirim via WhatsApp.');
        } catch {
            toast.error('Gagal mengunduh gambar struk PNG.');
        } finally {
            setDownloadingPng(false);
        }
    };

    const allowedPaymentTypes: BookingPaymentType[] = isCancelledOrNoShow
        ? paidAmount > 0
            ? ['refund']
            : []
        : [
              'settlement',
              'partial',
              'dp',
              'adjustment',
              ...(paidAmount > 0 ? (['refund'] as const) : []),
          ];

    const suggestedCashValues =
        paymentMethod === 'cash' && paymentType !== 'refund'
            ? getSuggestedCashAmounts(numericAmount)
            : [];

    const payments = booking.payments ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-2xl sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink">
                        <Wallet className="size-5 shrink-0 text-ink" aria-hidden="true" />
                        Kasir &amp; Pelunasan — {booking.booking_code}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-mute">
                        {booking.customer_name}
                        {booking.invoice_number ? ` · ${booking.invoice_number}` : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Financial Summary Strip */}
                    <div className="grid grid-cols-1 gap-2.5 rounded-sm bg-bone p-3.5 sm:grid-cols-3 sm:p-4">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-mute">Total Tagihan</p>
                            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                                {formatRupiah(booking.total_price)}
                            </p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-mute">Sudah Dibayar</p>
                            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                                {formatRupiah(paidAmount)}
                            </p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-mute">Status / Sisa</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                {isSettled ? (
                                    <Badge variant="success">
                                        <CheckCircle2 className="size-3" aria-hidden="true" />
                                        LUNAS
                                    </Badge>
                                ) : (
                                    <span className="text-lg font-semibold tabular-nums text-electric">
                                        {formatRupiah(remainingBalance)}
                                    </span>
                                )}
                                <Badge variant="secondary" className="text-[11px]">
                                    {PAYMENT_STATUS_LABELS[booking.payment_status] ?? booking.payment_status}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {!canVerifyPayments && (
                        <div className="rounded-sm border border-hairline-soft bg-bone/60 px-4 py-3 text-xs text-mute">
                            Anda hanya memiliki izin melihat rincian pesanan. Penyesuaian item dan pencatatan pembayaran membutuhkan izin verifikasi pembayaran.
                        </div>
                    )}

                    {actionError && (
                        <div
                            role="alert"
                            className="rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-2.5 text-xs font-medium text-destructive"
                        >
                            {actionError}
                        </div>
                    )}

                    {/* Itemized Editor */}
                    <section aria-labelledby="cashier-items-heading" className="space-y-3 rounded-sm border border-hairline-soft bg-canvas p-3.5 sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 id="cashier-items-heading" className="text-sm font-semibold text-ink">
                                    Rincian Item &amp; Add-on
                                </h3>
                                <p className="text-xs text-mute">
                                    Tambahkan layanan, add-on, atau biaya tambahan sebelum pelunasan.
                                </p>
                            </div>
                            {itemsDirty && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="min-h-11 px-3 sm:min-h-8"
                                    onClick={() => {
                                        setDraftItems(buildInitialDraftItems(booking));
                                        setItemsDirty(false);
                                    }}
                                >
                                    <RotateCcw className="size-3" aria-hidden="true" />
                                    Reset
                                </Button>
                            )}
                        </div>

                        <div className="divide-y divide-divider">
                            {draftItems.map((item) => (
                                <div
                                    key={item.localKey}
                                    className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-sm font-semibold break-words text-ink">
                                                {item.name}
                                            </span>
                                            <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
                                                {item.item_type === 'service'
                                                    ? 'Layanan'
                                                    : item.item_type === 'addon'
                                                      ? 'Add-on'
                                                      : 'Tambahan'}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 text-xs tabular-nums text-mute">
                                            {formatRupiah(item.unit_price)} / {item.unit_label}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
                                        {canVerifyPayments && !isCancelledOrNoShow ? (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    aria-label={`Kurangi jumlah ${item.name}`}
                                                    disabled={item.quantity <= 1}
                                                    onClick={() => updateDraftQty(item.localKey, item.quantity - 1)}
                                                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                                                >
                                                    <Minus className="size-3.5" aria-hidden="true" />
                                                </button>
                                                <span className="min-w-6 text-center font-mono text-xs font-semibold tabular-nums text-ink">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-label={`Tambah jumlah ${item.name}`}
                                                    disabled={item.quantity >= 100}
                                                    onClick={() => updateDraftQty(item.localKey, item.quantity + 1)}
                                                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                                                >
                                                    <Plus className="size-3.5" aria-hidden="true" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-medium tabular-nums text-mute">
                                                × {item.quantity} {item.unit_label}
                                            </span>
                                        )}

                                        <span className="min-w-20 text-right text-sm font-semibold tabular-nums text-ink">
                                            {formatRupiah(item.unit_price * item.quantity)}
                                        </span>

                                        {canVerifyPayments && !isCancelledOrNoShow && draftItems.length > 1 && (
                                            <button
                                                type="button"
                                                aria-label={`Hapus item ${item.name}`}
                                                onClick={() => removeDraftItem(item.localKey)}
                                                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive-soft sm:size-8"
                                            >
                                                <Trash2 className="size-3.5" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {canVerifyPayments && !isCancelledOrNoShow && (
                            <div className="space-y-3 border-t border-divider pt-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {services.length > 0 && (
                                        <Button
                                            type="button"
                                            variant={itemMode === 'service' ? 'default' : 'secondary'}
                                            size="xs"
                                            className="min-h-11 px-3 sm:min-h-8"
                                            onClick={() => setItemMode((m) => (m === 'service' ? 'none' : 'service'))}
                                        >
                                            <Plus className="size-3" aria-hidden="true" />
                                            Layanan
                                        </Button>
                                    )}
                                    {activeAddons.length > 0 && (
                                        <Button
                                            type="button"
                                            variant={itemMode === 'addon' ? 'default' : 'secondary'}
                                            size="xs"
                                            className="min-h-11 px-3 sm:min-h-8"
                                            onClick={() => setItemMode((m) => (m === 'addon' ? 'none' : 'addon'))}
                                        >
                                            <Plus className="size-3" aria-hidden="true" />
                                            Add-on
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant={itemMode === 'custom' ? 'default' : 'secondary'}
                                        size="xs"
                                        className="min-h-11 px-3 sm:min-h-8"
                                        onClick={() => {
                                            setCustomNameError('');
                                            setItemMode((m) => (m === 'custom' ? 'none' : 'custom'));
                                        }}
                                    >
                                        <Plus className="size-3" aria-hidden="true" />
                                        Item Custom
                                    </Button>
                                </div>

                                {itemMode === 'service' && services.length > 0 && (
                                    <div className="flex flex-col gap-2 rounded-xl bg-bone p-3 sm:flex-row sm:items-center">
                                        <SelectField
                                            aria-label="Pilih layanan tambahan"
                                            className="h-11 bg-canvas text-base md:h-10 md:text-sm"
                                            value={String(selectedAddServiceId)}
                                            onValueChange={(val) => setSelectedAddServiceId(val)}
                                            options={services.map((s) => ({
                                                value: String(s.id),
                                                label: `${s.name} (${formatRupiah(s.price)})`,
                                            }))}
                                        />
                                        <Button type="button" size="sm" className="min-h-11 sm:min-h-9" onClick={handleAddServiceItem}>
                                            Tambahkan
                                        </Button>
                                    </div>
                                )}

                                {itemMode === 'addon' && activeAddons.length > 0 && (
                                    <div className="flex flex-col gap-2 rounded-xl bg-bone p-3 sm:flex-row sm:items-center">
                                        <SelectField
                                            aria-label="Pilih add-on tambahan"
                                            className="h-11 bg-canvas text-base md:h-10 md:text-sm"
                                            value={String(selectedAddAddonId)}
                                            onValueChange={(val) => setSelectedAddAddonId(val)}
                                            options={activeAddons.map((a) => ({
                                                value: String(a.id),
                                                label: `${a.name} (${formatRupiah(a.price)} / ${a.unit_label})`,
                                            }))}
                                        />
                                        <Button type="button" size="sm" className="min-h-11 sm:min-h-9" onClick={handleAddAddonItem}>
                                            Tambahkan
                                        </Button>
                                    </div>
                                )}

                                {itemMode === 'custom' && (
                                    <div className="space-y-2.5 rounded-xl bg-bone p-3">
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label htmlFor="custom-item-name" className="text-xs">
                                                    Nama Item *
                                                </Label>
                                                <Input
                                                    ref={customNameRef}
                                                    id="custom-item-name"
                                                    className="h-11 bg-canvas text-base md:h-10 md:text-sm"
                                                    placeholder="Mis. Tali sepatu baru"
                                                    value={customName}
                                                    aria-invalid={Boolean(customNameError)}
                                                    aria-describedby={customNameError ? 'custom-item-name-error' : undefined}
                                                    onChange={(e) => {
                                                        setCustomName(e.target.value);
                                                        if (customNameError) setCustomNameError('');
                                                    }}
                                                />
                                                {customNameError && (
                                                    <p id="custom-item-name-error" role="alert" className="text-xs font-medium text-destructive">
                                                        {customNameError}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="custom-item-price" className="text-xs">
                                                    Harga Satuan (Rp) *
                                                </Label>
                                                <CurrencyInput
                                                    id="custom-item-price"
                                                    min={0}
                                                    showPrefix={false}
                                                    className="h-11 bg-canvas text-base md:h-10 md:text-sm"
                                                    value={customPrice}
                                                    onValueChange={setCustomPrice}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label htmlFor="custom-item-unit" className="text-xs">
                                                    Satuan
                                                </Label>
                                                <SelectField
                                                    id="custom-item-unit"
                                                    className="h-11 bg-canvas text-base md:h-10 md:text-sm"
                                                    value={customUnit}
                                                    onValueChange={(val) => setCustomUnit(val as ServiceUnitLabel)}
                                                    options={UNIT_LABEL_OPTIONS.map((opt) => ({
                                                        value: opt.value,
                                                        label: opt.label,
                                                    }))}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="custom-item-qty" className="text-xs">
                                                    Jumlah
                                                </Label>
                                                <Input
                                                    id="custom-item-qty"
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    inputMode="numeric"
                                                    className="h-11 bg-canvas text-base tabular-nums md:h-10 md:text-sm"
                                                    value={customQty}
                                                    onChange={(e) => setCustomQty(parseNumericInput(e.target.value))}
                                                />
                                            </div>
                                        </div>
                                        {supportsCommissions && (
                                            <div className="flex items-center justify-between gap-3 pt-1">
                                                <Label htmlFor="custom-item-comm" className="cursor-pointer text-xs text-ink">
                                                    Hitung ke komisi staff
                                                </Label>
                                                <Switch
                                                    id="custom-item-comm"
                                                    size="sm"
                                                    checked={customCommissionable}
                                                    onCheckedChange={setCustomCommissionable}
                                                />
                                            </div>
                                        )}
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                className="min-h-11 px-3 sm:min-h-8"
                                                onClick={() => {
                                                    setCustomNameError('');
                                                    setItemMode('none');
                                                }}
                                            >
                                                Batal
                                            </Button>
                                            <Button
                                                type="button"
                                                size="xs"
                                                className="min-h-11 px-3.5 sm:min-h-8"
                                                onClick={handleAddCustomItem}
                                            >
                                                Tambahkan Item
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {itemsDirty && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bone px-3 py-2.5 text-xs">
                                        <span className="font-semibold tabular-nums text-ink">
                                            Total item terbaru: {formatRupiah(draftTotal)}
                                        </span>
                                        <Button
                                            type="button"
                                            size="xs"
                                            className="min-h-11 px-3.5 sm:min-h-8"
                                            disabled={savingItems}
                                            onClick={handleSaveItems}
                                        >
                                            {savingItems ? 'Menyimpan…' : 'Simpan Perubahan Item'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Record Payment Form */}
                    {canVerifyPayments && allowedPaymentTypes.length > 0 && (
                        <form
                            onSubmit={handleRecordPayment}
                            className="space-y-4 rounded-sm border border-hairline-soft bg-canvas p-3.5 sm:p-4"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-ink">Catat Pembayaran</h3>
                                {!isCancelledOrNoShow && remainingBalance > 0 && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="xs"
                                        className="min-h-11 px-3 sm:min-h-8"
                                        onClick={handleFillExactRemaining}
                                    >
                                        Bayar Sisa Pas ({formatRupiah(remainingBalance)})
                                    </Button>
                                )}
                            </div>

                            {/* Payment Type Pills */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-mute">Jenis Transaksi</Label>
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih jenis pembayaran">
                                    {allowedPaymentTypes.map((typeKey) => {
                                        const active = paymentType === typeKey;
                                        return (
                                            <button
                                                key={typeKey}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => {
                                                    setPaymentType(typeKey);
                                                    if (typeKey === 'settlement') {
                                                        setAmount(remainingBalance);
                                                    } else if (typeKey === 'dp' && booking.dp_amount > 0) {
                                                        setAmount(Math.max(0, booking.dp_amount - paidAmount));
                                                    } else if (typeKey === 'refund') {
                                                        setAmount(paidAmount);
                                                    }
                                                }}
                                                className={cn(
                                                    'min-h-11 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:min-h-9 sm:px-3',
                                                    active
                                                        ? 'bg-ink text-canvas'
                                                        : 'bg-bone text-ink hover:bg-hairline-soft'
                                                )}
                                            >
                                                {PAYMENT_TYPE_LABELS[typeKey]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Payment Method Pills */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-mute">Metode Pembayaran</Label>
                                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap" role="group" aria-label="Pilih metode pembayaran">
                                    {PAYMENT_METHODS.map((methodKey) => {
                                        const active = paymentMethod === methodKey;
                                        return (
                                            <button
                                                key={methodKey}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => setPaymentMethod(methodKey)}
                                                className={cn(
                                                    'min-h-11 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:min-h-10',
                                                    active
                                                        ? 'bg-ink text-canvas'
                                                        : 'bg-bone text-ink hover:bg-hairline-soft'
                                                )}
                                            >
                                                {PAYMENT_METHOD_LABELS[methodKey]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="cashier-amount" className="text-xs">
                                        {paymentType === 'refund' ? 'Nominal Refund (Rp) *' : 'Nominal Dibayar (Rp) *'}
                                    </Label>
                                    <CurrencyInput
                                        id="cashier-amount"
                                        min={0}
                                        max={paymentType === 'refund' ? paidAmount : undefined}
                                        className="h-11 text-base md:h-10 md:text-sm"
                                        value={amount}
                                        onValueChange={setAmount}
                                        required
                                    />
                                </div>

                                {paymentMethod === 'cash' && paymentType !== 'refund' && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="cashier-received" className="text-xs">
                                            Uang Tunai Diterima (Rp)
                                        </Label>
                                        <CurrencyInput
                                            id="cashier-received"
                                            min={0}
                                            placeholder={numericAmount > 0 ? String(numericAmount) : '0'}
                                            className="h-11 text-base md:h-10 md:text-sm"
                                            value={receivedAmount}
                                            onValueChange={setReceivedAmount}
                                            aria-invalid={cashInsufficient}
                                        />
                                        {suggestedCashValues.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setReceivedAmount(numericAmount)}
                                                    className="min-h-11 cursor-pointer rounded-full bg-bone px-3 py-1 text-xs font-semibold tabular-nums text-ink hover:bg-hairline-soft sm:min-h-8 sm:px-2.5 sm:text-[11px]"
                                                >
                                                    Uang Pas
                                                </button>
                                                {suggestedCashValues.map((val) => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => setReceivedAmount(val)}
                                                        className="min-h-11 cursor-pointer rounded-full bg-bone px-3 py-1 text-xs font-semibold tabular-nums text-ink hover:bg-hairline-soft sm:min-h-8 sm:px-2.5 sm:text-[11px]"
                                                    >
                                                        {formatRupiah(val)}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {paymentMethod === 'cash' && paymentType !== 'refund' && (
                                <div className="flex items-center justify-between gap-2 rounded-xl bg-bone px-3.5 py-2.5 text-sm">
                                    <span className="text-mute">Kembalian</span>
                                    {cashInsufficient ? (
                                        <span className="text-xs font-semibold text-destructive">
                                            Uang diterima kurang
                                        </span>
                                    ) : (
                                        <span className="font-semibold tabular-nums text-ink">
                                            {formatRupiah(changeAmount)}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="cashier-notes" className="text-xs">
                                    Catatan (Opsional)
                                </Label>
                                <Input
                                    id="cashier-notes"
                                    maxLength={255}
                                    placeholder="Mis. Pelunasan di meja kasir"
                                    className="h-11 text-base md:h-10 md:text-sm"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            {canManageBookings &&
                                paymentType === 'settlement' &&
                                booking.reservation_status !== 'completed' &&
                                !isCancelledOrNoShow && (
                                    <div className="flex items-center justify-between gap-3 rounded-xl bg-bone px-3.5 py-2.5">
                                        <Label
                                            htmlFor="cashier-mark-completed"
                                            className="cursor-pointer text-xs font-medium text-ink"
                                        >
                                            Sekaligus tandai selesai / sudah diambil setelah lunas
                                        </Label>
                                        <Switch
                                            id="cashier-mark-completed"
                                            size="sm"
                                            checked={markCompleted}
                                            onCheckedChange={setMarkCompleted}
                                        />
                                    </div>
                                )}

                            <Button
                                type="submit"
                                className="w-full"
                                variant={paymentType === 'refund' ? 'destructive' : 'default'}
                                disabled={
                                    submittingPayment ||
                                    cashInsufficient ||
                                    (paymentType === 'refund'
                                        ? numericAmount <= 0 || numericAmount > paidAmount
                                        : numericAmount <= 0 &&
                                          !(booking.total_price === 0 && paymentType === 'settlement'))
                                }
                            >
                                {submittingPayment
                                    ? 'Menyimpan…'
                                    : paymentType === 'refund'
                                      ? 'Catat Pengembalian Dana'
                                      : 'Simpan Pembayaran'}
                            </Button>
                        </form>
                    )}

                    {/* Payment Ledger */}
                    <section aria-labelledby="cashier-ledger-heading" className="space-y-2.5 rounded-sm bg-bone p-3.5 sm:p-4">
                        <h3 id="cashier-ledger-heading" className="text-sm font-semibold text-ink">
                            Riwayat Pembayaran ({payments.length})
                        </h3>
                        {payments.length === 0 ? (
                            <p className="text-xs text-mute">Belum ada pembayaran yang tercatat di buku kasir.</p>
                        ) : (
                            <div className="divide-y divide-divider rounded-xl bg-canvas px-3.5">
                                {payments.map((pay) => {
                                    const isRefund = pay.payment_type === 'refund' || pay.amount < 0;
                                    return (
                                        <div
                                            key={pay.id}
                                            className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-xs"
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="font-semibold text-ink">
                                                        {PAYMENT_TYPE_LABELS[pay.payment_type] ?? pay.payment_type}
                                                    </span>
                                                    <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                                                        {PAYMENT_METHOD_LABELS[pay.payment_method] ?? pay.payment_method}
                                                    </Badge>
                                                </div>
                                                <p className="text-mute">
                                                    {pay.paid_at_local || pay.paid_at}
                                                    {pay.recorded_by_name ? ` · ${pay.recorded_by_name}` : ''}
                                                </p>
                                                {pay.payment_method === 'cash' && pay.change_amount > 0 && (
                                                    <p className="tabular-nums text-mute">
                                                        Tunai {formatRupiah(pay.received_amount ?? 0)} · Kembalian{' '}
                                                        {formatRupiah(pay.change_amount)}
                                                    </p>
                                                )}
                                                {pay.notes && <p className="text-body">{pay.notes}</p>}
                                            </div>
                                            <span
                                                className={cn(
                                                    'shrink-0 font-semibold tabular-nums',
                                                    isRefund ? 'text-destructive' : 'text-ink'
                                                )}
                                            >
                                                {isRefund
                                                    ? `-${formatRupiah(Math.abs(pay.amount))}`
                                                    : formatRupiah(pay.amount)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Direct Print & Receipt PNG Actions */}
                    <div className="flex flex-col gap-2 border-t border-divider pt-3 sm:flex-row">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDirectPrint()}
                        >
                            <Printer className="size-4" aria-hidden="true" />
                            Cetak Struk
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={downloadingPng}
                            onClick={handleDirectDownloadPng}
                        >
                            <Download className="size-4" aria-hidden="true" />
                            {downloadingPng ? 'Menyiapkan PNG…' : 'Unduh PNG'}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                                onOpenChange(false);
                                onOpenReceiptDialog(booking.id);
                            }}
                        >
                            <ReceiptText className="size-4" aria-hidden="true" />
                            Format 80mm / Label
                        </Button>
                    </div>
                </div>

                {/* Offscreen mounted thermal receipt node for direct Cetak Struk / Unduh PNG */}
                <div
                    aria-hidden="true"
                    style={{
                        position: 'fixed',
                        left: '-10000px',
                        top: 0,
                        pointerEvents: 'none',
                        opacity: 1,
                    }}
                >
                    <ReceiptPrintSheet
                        ref={offscreenReceiptRef}
                        booking={booking}
                        format="58mm"
                        businessName={businessName}
                        businessAddress={businessAddress}
                        businessPhone={businessPhone}
                        businessEmail={businessEmail}
                        cashierName={cashierName}
                        qrDataUrl={qrDataUrl}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
