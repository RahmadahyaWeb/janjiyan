import { ArrowRight, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { formatDateShortIndo, formatRupiah } from '@/lib/format';
import type { BusinessType } from '@/types';
import type { BookingStepKey } from './BookingProgressNav';
import { BookingSummaryCard } from './BookingSummaryCard';
import type { ActiveServiceLine, SelectedAddonLine, ServiceItem, StaffOption } from './types';

interface MobileBookingBarProps {
    activeStep: BookingStepKey;
    businessName: string;
    businessType: BusinessType;
    bookingNoun: string;
    isMultiDropoffMode: boolean;
    isDropoffService: boolean;
    hasSelectedService: boolean;
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
    submitting: boolean;
    submitLabel: string;
    bookingDisabledReason: string | null;
    onGoToSchedule: () => void;
    onGoToDetails: () => void;
}

export function MobileBookingBar({
    activeStep,
    businessName,
    businessType,
    bookingNoun,
    isMultiDropoffMode,
    isDropoffService,
    hasSelectedService,
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
    submitting,
    submitLabel,
    bookingDisabledReason,
    onGoToSchedule,
    onGoToDetails,
}: MobileBookingBarProps) {
    const [sheetOpen, setSheetOpen] = useState(false);

    // Hide the floating bar completely before the customer picks at least one service.
    if (activeStep === 'service' && !hasSelectedService) {
        return null;
    }

    const summaryLine =
        activeStep === 'service'
            ? isMultiDropoffMode
                ? `${activeServiceLines.length} layanan${selectedAddonLines.length > 0 ? ` + ${selectedAddonLines.length} add-on` : ''}`
                : `${selectedService?.name ?? ''}${isDropoffService ? ` × ${effectiveQuantity} ${selectedUnitLabel}` : ''}${
                      selectedAddonLines.length > 0 ? ` + ${selectedAddonLines.length} add-on` : ''
                  }`
            : `${isMultiDropoffMode ? `${activeServiceLines.length} layanan` : selectedService?.name ?? ''} · ${formatDateShortIndo(
                  selectedDate
              )}${!isDropoffService && selectedTime ? `, ${selectedTime}` : ''}`;

    return (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-canvas px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 lg:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 sm:gap-4">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <button
                            type="button"
                            className="min-w-0 flex-1 cursor-pointer rounded-xl py-0.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            aria-label={`Lihat rincian ${bookingNoun}`}
                        >
                            <p className="flex items-center gap-1 truncate text-xs text-mute">
                                <span className="truncate">{summaryLine}</span>
                                <ChevronUp className="size-3.5 shrink-0 text-ink" aria-hidden="true" />
                            </p>
                            <p className="text-base font-semibold whitespace-nowrap tabular-nums text-ink sm:text-lg">
                                {formatRupiah(computedTotalPrice)}
                            </p>
                        </button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-md bg-bone p-0">
                        <SheetHeader className="border-b border-divider bg-canvas px-5 py-4 text-left">
                            <SheetTitle className="text-base">Ringkasan {bookingNoun}</SheetTitle>
                            <SheetDescription className="text-xs">{businessName}</SheetDescription>
                        </SheetHeader>
                        <div className="overflow-y-auto overscroll-contain p-5">
                            <BookingSummaryCard
                                businessName={businessName}
                                businessType={businessType}
                                bookingNoun={bookingNoun}
                                isMultiDropoffMode={isMultiDropoffMode}
                                isDropoffService={isDropoffService}
                                selectedService={selectedService}
                                activeServiceLines={activeServiceLines}
                                selectedAddonLines={selectedAddonLines}
                                extraAddonDuration={extraAddonDuration}
                                effectiveQuantity={effectiveQuantity}
                                selectedUnitLabel={selectedUnitLabel}
                                showStaffStep={showStaffStep}
                                selectedStaffObj={selectedStaffObj}
                                selectedDate={selectedDate}
                                selectedTime={selectedTime}
                                anyPickupSupported={anyPickupSupported}
                                fulfillmentType={fulfillmentType}
                                pickupSession={pickupSession}
                                multiEstimatedReadyDate={multiEstimatedReadyDate}
                                computedTotalPrice={computedTotalPrice}
                                requiresDp={requiresDp}
                                computedDpAmount={computedDpAmount}
                                compact
                            />
                        </div>
                    </SheetContent>
                </Sheet>

                {activeStep === 'service' ? (
                    <Button
                        type="button"
                        className="shrink-0"
                        disabled={Boolean(bookingDisabledReason)}
                        onClick={onGoToSchedule}
                    >
                        <span className="sm:hidden">Lanjut</span>
                        <span className="hidden sm:inline">Lanjut ke Jadwal</span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                ) : activeStep === 'schedule' ? (
                    <Button
                        type="button"
                        className="shrink-0"
                        disabled={Boolean(bookingDisabledReason)}
                        onClick={onGoToDetails}
                    >
                        <span className="sm:hidden">Lanjut</span>
                        <span className="hidden sm:inline">Lanjut Isi Data</span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                ) : (
                    <Button
                        type="submit"
                        className="shrink-0"
                        disabled={submitting || Boolean(bookingDisabledReason)}
                    >
                        {submitting ? 'Memproses…' : submitLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}
