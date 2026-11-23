import { ShieldCheck } from 'lucide-react';
import {
    formatDateIndo,
    formatRupiah,
    formatTurnaroundLabel,
    PICKUP_SESSION_LABELS,
} from '@/lib/format';
import type { BusinessType } from '@/types';
import type { ActiveServiceLine, SelectedAddonLine, ServiceItem, StaffOption } from './types';

interface BookingSummaryCardProps {
    businessName: string;
    businessType: BusinessType;
    bookingNoun: string;
    isMultiDropoffMode: boolean;
    isDropoffService: boolean;
    selectedService: ServiceItem | null;
    activeServiceLines: ActiveServiceLine[];
    selectedAddonLines: SelectedAddonLine[];
    extraAddonDuration: number;
    effectiveQuantity: number;
    selectedUnitLabel: string;
    showStaffStep: boolean;
    selectedStaffObj: StaffOption | null;
    selectedDate: string;
    selectedTime: string;
    anyPickupSupported: boolean;
    fulfillmentType: 'dropoff' | 'pickup';
    pickupSession: 'morning' | 'afternoon' | 'evening' | 'anytime';
    multiEstimatedReadyDate: string | null;
    computedTotalPrice: number;
    requiresDp: boolean;
    computedDpAmount: number;
    compact?: boolean;
}

export function BookingSummaryCard({
    businessName,
    businessType,
    bookingNoun,
    isMultiDropoffMode,
    isDropoffService,
    selectedService,
    activeServiceLines,
    selectedAddonLines,
    extraAddonDuration,
    effectiveQuantity,
    selectedUnitLabel,
    showStaffStep,
    selectedStaffObj,
    selectedDate,
    selectedTime,
    anyPickupSupported,
    fulfillmentType,
    pickupSession,
    multiEstimatedReadyDate,
    computedTotalPrice,
    requiresDp,
    computedDpAmount,
    compact = false,
}: BookingSummaryCardProps) {
    return (
        <div className={compact ? 'space-y-4' : 'space-y-5 rounded-md bg-bone p-4 sm:p-6'}>
            {!compact && (
                <div className="flex items-center gap-3">
                    {selectedService?.image_url && (
                        <img
                            src={selectedService.image_url}
                            alt={selectedService.name}
                            className="size-12 shrink-0 rounded-xs object-cover outline-1 -outline-offset-1 outline-black/10"
                        />
                    )}
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-mute">Ringkasan {bookingNoun}</p>
                        <h2 className="mt-0.5 truncate text-lg font-semibold text-ink">{businessName}</h2>
                    </div>
                </div>
            )}

            <div className="space-y-3 border-t border-divider pt-4 text-sm">
                {isMultiDropoffMode ? (
                    <div className="space-y-2">
                        <span className="text-mute">Layanan dipilih</span>
                        {activeServiceLines.length === 0 ? (
                            <p className="text-xs font-medium text-mute">Belum ada layanan dipilih</p>
                        ) : (
                            <div className="space-y-1.5">
                                {activeServiceLines.map((line) => (
                                    <div key={line.service.id} className="flex items-start justify-between gap-2 text-xs">
                                        <span className="font-semibold text-ink">
                                            {line.service.name} ({line.quantity} {line.service.unit_label ?? 'item'})
                                        </span>
                                        <span className="shrink-0 font-semibold tabular-nums text-ink">
                                            {formatRupiah(line.service.price * line.quantity)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <span className="text-mute">
                                {businessType === 'space_booking' ? 'Fasilitas / Paket' : 'Layanan'}
                            </span>
                            <span className="text-right font-semibold text-ink">
                                {selectedService?.name ?? 'Belum dipilih'}
                            </span>
                        </div>

                        {selectedService && (
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-mute">{isDropoffService ? 'Estimasi' : 'Durasi'}</span>
                                <span className="font-semibold tabular-nums text-ink">
                                    {isDropoffService
                                        ? formatTurnaroundLabel(selectedService.turnaround_days ?? 1)
                                        : extraAddonDuration > 0
                                          ? `${selectedService.duration_minutes + extraAddonDuration} menit`
                                          : `${selectedService.duration_minutes} menit`}
                                </span>
                            </div>
                        )}

                        {isDropoffService && selectedService && (
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-mute">Jumlah</span>
                                <span className="font-semibold tabular-nums text-ink">
                                    {effectiveQuantity} {selectedUnitLabel}
                                </span>
                            </div>
                        )}
                    </>
                )}

                {selectedAddonLines.length > 0 && (
                    <div className="space-y-1.5 border-t border-divider pt-2.5">
                        <span className="text-xs font-medium text-mute">Add-on tambahan</span>
                        {selectedAddonLines.map((line) => (
                            <div key={line.addon.id} className="flex items-start justify-between gap-2 text-xs">
                                <span className="text-body">
                                    {line.addon.name} × {line.quantity}
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-ink">
                                    +{formatRupiah(line.addon.price * line.quantity)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {showStaffStep && (
                    <div className="flex items-start justify-between gap-3">
                        <span className="text-mute">Staff</span>
                        <span className="text-right font-semibold text-ink">
                            {selectedStaffObj ? selectedStaffObj.name : 'Siapa saja tersedia'}
                        </span>
                    </div>
                )}

                <div className="flex items-start justify-between gap-3">
                    <span className="text-mute">{isDropoffService ? 'Tanggal drop-off' : 'Tanggal'}</span>
                    <span className="text-right font-semibold tabular-nums text-ink">
                        {formatDateIndo(selectedDate)}
                    </span>
                </div>

                {isDropoffService ? (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <span className="text-mute">Metode</span>
                            <span className="text-right font-semibold text-ink">
                                {anyPickupSupported && fulfillmentType === 'pickup'
                                    ? `Jemput (${PICKUP_SESSION_LABELS[pickupSession]})`
                                    : 'Antar ke toko'}
                            </span>
                        </div>
                        {multiEstimatedReadyDate && (
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-mute">Est. selesai</span>
                                <span className="text-right font-semibold tabular-nums text-ink">
                                    {formatDateIndo(multiEstimatedReadyDate)}
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-mute">Jam</span>
                        <span className="font-mono font-semibold tabular-nums text-ink">
                            {selectedTime || 'Belum dipilih'}
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t border-divider pt-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-mute">Total biaya</span>
                    <span className="text-lg font-semibold tabular-nums text-ink">
                        {formatRupiah(computedTotalPrice)}
                    </span>
                </div>
                {requiresDp && activeServiceLines.length > 0 && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-mute">Nominal uang muka</span>
                        <span className="font-semibold tabular-nums text-electric">
                            {formatRupiah(computedDpAmount)}
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-2 rounded-sm bg-canvas p-4 text-xs text-mute">
                <div className="flex items-center gap-2 font-semibold text-ink">
                    <ShieldCheck className="size-4 shrink-0 text-electric" aria-hidden="true" />
                    <span>Jaminan {bookingNoun}</span>
                </div>
                <ul className="space-y-1 leading-relaxed">
                    <li>
                        •{' '}
                        {isDropoffService
                            ? 'Kuota harian terkunci otomatis tanpa perlu antre jam.'
                            : 'Slot terkunci otomatis dan bebas bentrok jadwal.'}
                    </li>
                    {requiresDp && <li>• Transfer uang muka langsung ke rekening toko.</li>}
                    <li>• Halaman status &amp; ringkasan WhatsApp tersedia setelah submit.</li>
                </ul>
            </div>
        </div>
    );
}
