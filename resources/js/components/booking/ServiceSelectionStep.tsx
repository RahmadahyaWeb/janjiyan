import {
    Check,
    Clock,
    CreditCard,
    Minus,
    PackageCheck,
    Plus,
    Sparkles,
    Truck,
    UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { formatRupiah, formatTurnaroundLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BusinessType, ServiceAddon } from '@/types';
import type { SelectedAddonLine, ServiceItem } from './types';

interface ServiceSelectionStepProps {
    headingLabel: string;
    businessType: BusinessType;
    services: ServiceItem[];
    isMultiDropoffMode: boolean;
    selectedService: ServiceItem | null;
    dropoffCart: Array<{ service_id: number; quantity: number }>;
    singleDropoffQuantity: number;
    activeServiceCount: number;
    applicableAddons: ServiceAddon[];
    addonQuantities: Record<number, number>;
    selectedAddonLines: SelectedAddonLine[];
    addonsSubtotal: number;
    isDropoffModeForSelected: boolean;
    onSelectSingleService: (service: ServiceItem) => void;
    onToggleMultiService: (service: ServiceItem) => void;
    onUpdateMultiQty: (serviceId: number, nextQty: number) => void;
    onUpdateSingleQty: (nextQty: number) => void;
    onUpdateAddonQty: (addonId: number, nextQty: number) => void;
}

export function ServiceSelectionStep({
    headingLabel,
    businessType,
    services,
    isMultiDropoffMode,
    selectedService,
    dropoffCart,
    singleDropoffQuantity,
    activeServiceCount,
    applicableAddons,
    addonQuantities,
    selectedAddonLines,
    addonsSubtotal,
    isDropoffModeForSelected,
    onSelectSingleService,
    onToggleMultiService,
    onUpdateMultiQty,
    onUpdateSingleQty,
    onUpdateAddonQty,
}: ServiceSelectionStepProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDescriptions, setExpandedDescriptions] = useState<Record<number, boolean>>({});
    const showSearch = services.length > 5;

    const filteredServices = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return services;
        return services.filter(
            (s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
        );
    }, [services, searchQuery]);

    const toggleExpand = (serviceId: number) => {
        setExpandedDescriptions((prev) => ({
            ...prev,
            [serviceId]: !prev[serviceId],
        }));
    };

    return (
        <section aria-labelledby="step-services-heading" id="layanan" className="scroll-mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="step-services-heading" className="text-xl font-semibold text-ink">
                    {headingLabel}.
                </h2>
                {isMultiDropoffMode ? (
                    <span className="rounded-full bg-bone px-3 py-1 text-xs font-semibold tabular-nums text-ink">
                        {activeServiceCount > 0
                            ? `${activeServiceCount} dipilih · Bisa > 1 layanan`
                            : 'Bisa pilih lebih dari 1 layanan'}
                    </span>
                ) : (
                    !selectedService &&
                    services.length > 1 && (
                        <span className="text-xs font-medium text-mute">Tap layanan untuk melanjutkan</span>
                    )
                )}
            </div>

            {showSearch && (
                <SearchInput
                    wrapperClassName="mb-3.5"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Cari layanan…"
                    aria-label="Cari layanan"
                    clearLabel="Hapus pencarian layanan"
                    className="h-11 border-hairline bg-canvas text-base focus-visible:border-ink focus-visible:ring-ink/20 sm:text-sm"
                />
            )}

            {filteredServices.length === 0 ? (
                <div className="rounded-md border border-dashed border-hairline bg-canvas p-6 text-center">
                    <p className="text-sm font-semibold text-ink">Layanan &ldquo;{searchQuery}&rdquo; tidak ditemukan.</p>
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-2 inline-flex min-h-9 cursor-pointer items-center rounded-full bg-bone px-4 text-xs font-semibold text-ink transition-colors hover:bg-hairline focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                    >
                        Tampilkan semua layanan
                    </button>
                </div>
            ) : (
                <div className={cn('grid gap-3', services.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
                    {filteredServices.map((service) => {
                        const cartItem = isMultiDropoffMode
                            ? dropoffCart.find((item) => item.service_id === service.id)
                            : undefined;
                        const active = isMultiDropoffMode
                            ? Boolean(cartItem)
                            : selectedService?.id === service.id;
                        const serviceIsDropoff = businessType === 'dropoff' || service.booking_mode === 'dropoff';
                        const unitLabel = service.unit_label ?? 'item';
                        const activeQty = isMultiDropoffMode
                            ? (cartItem?.quantity ?? 1)
                            : singleDropoffQuantity;
                        const hasLongDesc = Boolean(service.description && service.description.length > 90);
                        const isExpanded = Boolean(expandedDescriptions[service.id]);

                        return (
                            <div
                                key={service.id}
                                id={`service-${service.id}`}
                                className={cn(
                                    'flex min-w-0 flex-col justify-between rounded-md p-4 text-left transition-colors duration-150',
                                    active
                                        ? 'bg-canvas ring-2 ring-ink'
                                        : 'bg-canvas ring-1 ring-hairline hover:ring-ink/40'
                                )}
                            >
                                <button
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() =>
                                        isMultiDropoffMode
                                            ? onToggleMultiService(service)
                                            : onSelectSingleService(service)
                                    }
                                    className="flex w-full cursor-pointer flex-col text-left focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                                >
                                    <div className="flex items-start gap-3">
                                        {service.image_url && (
                                            <img
                                                src={service.image_url}
                                                alt={`Foto layanan ${service.name}`}
                                                className="size-15 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10 sm:size-16"
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="text-base leading-snug font-semibold break-words text-ink">
                                                    {service.name}
                                                </h3>
                                                {active ? (
                                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
                                                        <Check className="size-3" aria-hidden="true" />
                                                    </span>
                                                ) : isMultiDropoffMode ? (
                                                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-hairline text-mute">
                                                        <Plus className="size-3" aria-hidden="true" />
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-0.5 text-base font-semibold tabular-nums text-ink">
                                                {formatRupiah(service.price)}
                                                {serviceIsDropoff && (
                                                    <span className="text-xs font-normal text-mute"> / {unitLabel}</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {service.description && (
                                        <p
                                            className={cn(
                                                'mt-2 text-xs leading-relaxed break-words text-mute sm:text-sm',
                                                !isExpanded && 'line-clamp-2'
                                            )}
                                        >
                                            {service.description}
                                        </p>
                                    )}

                                    <div className="mt-2.5 flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-divider pt-2 text-xs text-mute">
                                        <span className="inline-flex items-center gap-1 tabular-nums">
                                            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                                            {serviceIsDropoff
                                                ? formatTurnaroundLabel(service.turnaround_days ?? 1)
                                                : `${service.duration_minutes} mnt`}
                                        </span>
                                        {serviceIsDropoff ? (
                                            <>
                                                <span className="inline-flex items-center gap-1 tabular-nums">
                                                    <PackageCheck className="size-3.5 shrink-0" aria-hidden="true" />
                                                    Kuota {service.capacity} {unitLabel}/hari
                                                </span>
                                                {service.supports_pickup && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Truck className="size-3.5 shrink-0" aria-hidden="true" />
                                                        Jemput-antar
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            service.assignment_mode === 'capacity' && (
                                                <span className="inline-flex items-center gap-1 tabular-nums">
                                                    <UserCheck className="size-3.5 shrink-0" aria-hidden="true" />
                                                    Kapasitas {service.capacity}
                                                </span>
                                            )
                                        )}
                                        {service.dp_amount > 0 && (
                                            <span className="inline-flex items-center gap-1 tabular-nums">
                                                <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
                                                DP {formatRupiah(service.dp_amount)}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {hasLongDesc && (
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(service.id)}
                                        aria-expanded={isExpanded}
                                        className="mt-1.5 self-start rounded-xs text-xs font-semibold text-ink/75 underline-offset-2 hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                    >
                                        {isExpanded ? 'Sembunyikan detail' : 'Lihat detail'}
                                    </button>
                                )}

                                {active && serviceIsDropoff && (
                                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-divider pt-3">
                                        <span className="text-xs font-semibold text-ink">
                                            Jumlah ({unitLabel})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                aria-label={`Kurangi jumlah ${service.name}`}
                                                disabled={activeQty <= 1}
                                                onClick={() =>
                                                    isMultiDropoffMode
                                                        ? onUpdateMultiQty(service.id, activeQty - 1)
                                                        : onUpdateSingleQty(activeQty - 1)
                                                }
                                                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <Minus className="size-3.5" aria-hidden="true" />
                                            </button>
                                            <span className="min-w-6 text-center font-mono text-sm font-semibold tabular-nums text-ink">
                                                {activeQty}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={`Tambah jumlah ${service.name}`}
                                                disabled={activeQty >= 50}
                                                onClick={() =>
                                                    isMultiDropoffMode
                                                        ? onUpdateMultiQty(service.id, activeQty + 1)
                                                        : onUpdateSingleQty(activeQty + 1)
                                                }
                                                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <Plus className="size-3.5" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Optional Service Add-ons */}
            {applicableAddons.length > 0 && (
                <div className="mt-5 space-y-3 rounded-md bg-bone p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-ink" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-ink">
                                Layanan Tambahan / Add-on (Opsional)
                            </h3>
                        </div>
                        {selectedAddonLines.length > 0 && (
                            <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold tabular-nums text-electric">
                                +{formatRupiah(addonsSubtotal)}
                            </span>
                        )}
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                        {applicableAddons.map((addon) => {
                            const qty = addonQuantities[addon.id] ?? 0;
                            return (
                                <div
                                    key={addon.id}
                                    className={cn(
                                        'flex flex-col justify-between gap-3 rounded-sm border bg-canvas p-3.5 transition-colors',
                                        qty > 0 ? 'border-ink ring-1 ring-ink' : 'border-hairline-soft'
                                    )}
                                >
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-sm font-semibold break-words text-ink">
                                            {addon.name}
                                        </p>
                                        {addon.description && (
                                            <p className="text-xs break-words text-mute">
                                                {addon.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-2.5">
                                        <p className="min-w-0 text-xs font-semibold tabular-nums text-ink">
                                            <span>
                                                {formatRupiah(addon.price)}{' '}
                                                <span className="font-normal text-mute">
                                                    / {addon.unit_label}
                                                </span>
                                            </span>
                                            {!isDropoffModeForSelected && addon.duration_minutes > 0 && (
                                                <span className="ml-1.5 inline-block font-normal whitespace-nowrap text-mute">
                                                    · +{addon.duration_minutes} mnt
                                                </span>
                                            )}
                                        </p>

                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <button
                                                type="button"
                                                aria-label={`Kurangi add-on ${addon.name}`}
                                                disabled={qty <= 0}
                                                onClick={() => onUpdateAddonQty(addon.id, qty - 1)}
                                                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 sm:size-9"
                                            >
                                                <Minus className="size-3.5" aria-hidden="true" />
                                            </button>
                                            <span className="min-w-5 text-center font-mono text-sm font-semibold tabular-nums text-ink">
                                                {qty}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={`Tambah add-on ${addon.name}`}
                                                disabled={qty >= 50}
                                                onClick={() => onUpdateAddonQty(addon.id, qty + 1)}
                                                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 sm:size-9"
                                            >
                                                <Plus className="size-3.5" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}
