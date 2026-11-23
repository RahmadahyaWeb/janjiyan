import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types';
import type { BankAccount } from './types';

interface CustomerDetailsStepProps {
    isDropoffService: boolean;
    businessType: BusinessType;
    businessName: string;
    bookingNoun: string;
    detailsLabel: string;
    submitLabel: string;
    requiresDp: boolean;
    computedDpAmount: number;
    dpExpiryMinutes: number;
    bankAccounts: BankAccount[];
    qrisUrl: string | null;
    dpMode: 'now' | 'later';
    dpProof: File | null;
    dpProofError: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    customerNotes: string;
    errors: Record<string, string>;
    submitting: boolean;
    bookingDisabledReason: string | null;
    onBackToSchedule: () => void;
    onChangeName: (val: string) => void;
    onChangePhone: (val: string) => void;
    onChangeEmail: (val: string) => void;
    onChangeNotes: (val: string) => void;
    onChangeDpMode: (mode: 'now' | 'later') => void;
    onChangeDpProof: (file: File | null) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CustomerDetailsStep({
    isDropoffService,
    businessType,
    businessName,
    bookingNoun,
    detailsLabel,
    submitLabel,
    requiresDp,
    computedDpAmount,
    dpExpiryMinutes,
    bankAccounts,
    qrisUrl,
    dpMode,
    dpProof,
    dpProofError,
    customerName,
    customerPhone,
    customerEmail,
    customerNotes,
    errors,
    submitting,
    bookingDisabledReason,
    onBackToSchedule,
    onChangeName,
    onChangePhone,
    onChangeEmail,
    onChangeNotes,
    onChangeDpMode,
    onChangeDpProof,
}: CustomerDetailsStepProps) {
    const dpPreviewUrl = useMemo(() => (dpProof ? URL.createObjectURL(dpProof) : null), [dpProof]);

    useEffect(() => {
        return () => {
            if (dpPreviewUrl) URL.revokeObjectURL(dpPreviewUrl);
        };
    }, [dpPreviewUrl]);

    return (
        <section
            id="step-customer"
            aria-labelledby="step-customer-heading"
            className="scroll-mt-4 space-y-6 rounded-md bg-bone p-5 sm:p-6"
        >
            <div>
                <h2 id="step-customer-heading" className="text-xl font-semibold text-ink">
                    {requiresDp ? 'Data pemesan & uang muka.' : `${detailsLabel}.`}
                </h2>
                <p className="mt-1 text-sm text-mute">
                    Tanpa perlu membuat akun. Bukti &amp; status {bookingNoun} langsung muncul setelah submit.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="customer_name">Nama lengkap *</Label>
                    <Input
                        id="customer_name"
                        autoComplete="name"
                        className="bg-canvas"
                        placeholder="Contoh: Andi Wijaya"
                        value={customerName}
                        onChange={(e) => onChangeName(e.target.value)}
                        aria-invalid={Boolean(errors.customer_name)}
                        aria-describedby={errors.customer_name ? 'customer-name-error' : undefined}
                        required
                    />
                    {errors.customer_name && (
                        <p id="customer-name-error" className="text-xs text-destructive">
                            {errors.customer_name}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="customer_phone">Nomor WhatsApp *</Label>
                    <Input
                        id="customer_phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        className="bg-canvas"
                        placeholder="08123456789"
                        value={customerPhone}
                        onChange={(e) => onChangePhone(e.target.value)}
                        aria-invalid={Boolean(errors.customer_phone)}
                        aria-describedby={errors.customer_phone ? 'customer-phone-error' : undefined}
                        required
                    />
                    {errors.customer_phone && (
                        <p id="customer-phone-error" className="text-xs text-destructive">
                            {errors.customer_phone}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="customer_email">Email (opsional)</Label>
                    <Input
                        id="customer_email"
                        type="email"
                        autoComplete="email"
                        className="bg-canvas"
                        placeholder="andi@email.com"
                        value={customerEmail}
                        onChange={(e) => onChangeEmail(e.target.value)}
                        aria-invalid={Boolean(errors.customer_email)}
                        aria-describedby={errors.customer_email ? 'customer-email-error' : undefined}
                    />
                    {errors.customer_email && (
                        <p id="customer-email-error" className="text-xs text-destructive">
                            {errors.customer_email}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="customer_notes">Catatan tambahan (opsional)</Label>
                    <Textarea
                        id="customer_notes"
                        className="bg-canvas"
                        placeholder={
                            businessType === 'dropoff'
                                ? 'Contoh: Ada noda di bagian kerah, atau patokan alamat rumah'
                                : businessType === 'space_booking'
                                  ? 'Contoh: Butuh tambahan perlengkapan atau persiapan ruangan'
                                  : 'Contoh: Preferensi khusus layanan atau catatan untuk staff'
                        }
                        value={customerNotes}
                        onChange={(e) => onChangeNotes(e.target.value)}
                        aria-invalid={Boolean(errors.customer_notes)}
                        aria-describedby={errors.customer_notes ? 'customer-notes-error' : undefined}
                    />
                    {errors.customer_notes && (
                        <p id="customer-notes-error" className="text-xs text-destructive">
                            {errors.customer_notes}
                        </p>
                    )}
                </div>
            </div>

            {requiresDp && (
                <div className="space-y-4 rounded-xs border border-hairline-soft bg-canvas p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="text-base font-semibold text-ink">Uang muka diperlukan</h3>
                            <p className="text-xs text-mute">Transfer langsung ke rekening toko.</p>
                        </div>
                        <span className="text-lg font-semibold tabular-nums text-ink">
                            {formatRupiah(computedDpAmount)}
                        </span>
                    </div>

                    {bankAccounts.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {bankAccounts.map((acc, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-bone p-3 text-xs">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-ink">{acc.bank_name}</p>
                                        <p className="mt-0.5 font-mono text-sm font-semibold break-all tabular-nums text-ink">
                                            {acc.account_number}
                                        </p>
                                        <p className="break-words text-mute">a.n. {acc.account_holder}</p>
                                    </div>
                                    <CopyButton value={acc.account_number} label={`nomor rekening ${acc.bank_name}`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {qrisUrl && (
                        <div className="flex items-center gap-4 rounded-md bg-bone p-3">
                            <img
                                src={qrisUrl}
                                alt={`QRIS ${businessName}`}
                                className="size-24 shrink-0 rounded-xs object-cover outline-1 -outline-offset-1 outline-black/10"
                            />
                            <div className="text-xs text-mute">
                                <p className="font-semibold text-ink">Scan QRIS</p>
                                <p className="mt-1">Gunakan aplikasi mobile banking atau e-wallet Anda.</p>
                            </div>
                        </div>
                    )}

                    <div
                        className="grid w-full grid-cols-2 rounded-sm bg-bone p-1 sm:inline-flex sm:h-11 sm:w-auto sm:items-center sm:rounded-full"
                        role="group"
                        aria-label="Metode unggah bukti uang muka"
                    >
                        <button
                            type="button"
                            aria-pressed={dpMode === 'now'}
                            onClick={() => onChangeDpMode('now')}
                            className={cn(
                                'min-h-10 cursor-pointer rounded-xl px-3 py-2 text-center text-xs leading-tight font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:h-9 sm:min-h-0 sm:rounded-full sm:px-4 sm:py-0',
                                dpMode === 'now' ? 'bg-canvas text-ink' : 'text-mute'
                            )}
                        >
                            Upload bukti sekarang
                        </button>
                        <button
                            type="button"
                            aria-pressed={dpMode === 'later'}
                            onClick={() => onChangeDpMode('later')}
                            className={cn(
                                'min-h-10 cursor-pointer rounded-xl px-3 py-2 text-center text-xs leading-tight font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:h-9 sm:min-h-0 sm:rounded-full sm:px-4 sm:py-0',
                                dpMode === 'later' ? 'bg-canvas text-ink' : 'text-mute'
                            )}
                        >
                            Bayar nanti ({dpExpiryMinutes} mnt)
                        </button>
                    </div>

                    {dpMode === 'now' ? (
                        <div className="space-y-2">
                            {dpProof && dpPreviewUrl ? (
                                <div className="flex items-center justify-between gap-3 rounded-sm border border-hairline bg-bone p-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <img
                                            src={dpPreviewUrl}
                                            alt="Pratinjau bukti transfer"
                                            className="size-14 shrink-0 rounded-xs object-cover outline-1 -outline-offset-1 outline-black/10"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-ink">{dpProof.name}</p>
                                            <p className="text-xs text-mute">{formatFileSize(dpProof.size)}</p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <label
                                            htmlFor="dp-proof-upload"
                                            className="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-canvas px-3 text-xs font-semibold text-ink ring-1 ring-hairline transition-colors hover:bg-hairline-soft"
                                        >
                                            Ganti
                                            <input
                                                id="dp-proof-upload"
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                className="sr-only"
                                                onChange={(e) => onChangeDpProof(e.target.files?.[0] ?? null)}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            aria-label="Hapus bukti transfer"
                                            onClick={() => onChangeDpProof(null)}
                                            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-canvas text-mute ring-1 ring-hairline transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                        >
                                            <X className="size-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <FileUpload
                                    id="dp-proof-upload"
                                    file={dpProof}
                                    accept="image/png,image/jpeg,image/webp"
                                    placeholder="Pilih foto/screenshot bukti transfer (JPG/PNG/WebP, maks 5MB)"
                                    aria-invalid={Boolean(dpProofError || errors.dp_proof)}
                                    aria-describedby={dpProofError || errors.dp_proof ? 'dp-proof-error' : undefined}
                                    className={cn(
                                        'justify-center py-4',
                                        dpProofError || errors.dp_proof ? 'border-destructive' : 'border-control-border'
                                    )}
                                    onFileChange={onChangeDpProof}
                                />
                            )}
                            {(dpProofError || errors.dp_proof) && (
                                <p id="dp-proof-error" className="text-xs font-medium text-destructive">
                                    {dpProofError || errors.dp_proof}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-mute">
                            {isDropoffService ? 'Kuota' : 'Slot'} akan ditahan selama{' '}
                            <strong>{dpExpiryMinutes} menit</strong>. Jika bukti uang muka belum diunggah hingga batas waktu,{' '}
                            {bookingNoun} otomatis dibatalkan.
                        </p>
                    )}
                </div>
            )}

            {Object.keys(errors).length > 0 && (
                <div
                    role="alert"
                    data-form-error="true"
                    className="rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-xs font-medium text-destructive"
                >
                    {Object.values(errors)[0]}
                </div>
            )}

            <div className="hidden items-center justify-between gap-3 pt-1 lg:flex">
                <Button type="button" variant="outline" size="lg" onClick={onBackToSchedule}>
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Kembali
                </Button>
                <Button
                    type="submit"
                    size="lg"
                    className="flex-1"
                    disabled={submitting || Boolean(bookingDisabledReason)}
                >
                    {submitting ? 'Memproses…' : submitLabel}
                </Button>
            </div>
        </section>
    );
}
