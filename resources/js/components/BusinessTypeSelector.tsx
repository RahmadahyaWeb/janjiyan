import { Building2, Check, Lock, Package, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    BUSINESS_TYPE_LOCK_NOTICE,
    BUSINESS_TYPE_OPTIONS,
    getBusinessTypeOption,
} from '@/lib/businessType';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types';

interface BusinessTypeSelectorProps {
    businessType: BusinessType;
    onBusinessTypeChange: (value: BusinessType) => void;
    businessName: string;
    onBusinessNameChange: (value: string) => void;
    category: string;
    onCategoryChange: (value: string) => void;
    errors?: {
        business_type?: string;
        name?: string;
        category?: string;
    };
    idPrefix?: string;
}

const TYPE_ICONS: Record<BusinessType, typeof Users> = {
    staff_appointment: Users,
    space_booking: Building2,
    dropoff: Package,
};

const ALL_CATEGORY_PRESETS = new Set(
    BUSINESS_TYPE_OPTIONS.flatMap((option) => option.categoryPresets)
);

export function BusinessTypeSelector({
    businessType,
    onBusinessTypeChange,
    businessName,
    onBusinessNameChange,
    category,
    onCategoryChange,
    errors,
    idPrefix = 'business',
}: BusinessTypeSelectorProps) {
    const selectedOption = getBusinessTypeOption(businessType);

    const handleTypeSelect = (nextType: BusinessType) => {
        onBusinessTypeChange(nextType);

        const nextOption = getBusinessTypeOption(nextType);
        const trimmedCategory = category.trim();
        if (trimmedCategory === '' || ALL_CATEGORY_PRESETS.has(trimmedCategory)) {
            onCategoryChange(nextOption.categoryPresets[0]);
        }
    };

    return (
        <div className="space-y-6">
            <fieldset className="space-y-3" aria-describedby={errors?.business_type ? `${idPrefix}-type-error` : undefined}>
                <legend className="text-sm font-semibold text-ink">
                    1. Pilih Tipe Operasional Bisnis *
                </legend>
                <p className="text-sm leading-relaxed text-mute">
                    Tentukan alur utama pemesanan yang sesuai dengan operasional bisnis Anda.
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {BUSINESS_TYPE_OPTIONS.map((option) => {
                        const Icon = TYPE_ICONS[option.value];
                        const isSelected = businessType === option.value;
                        const radioId = `${idPrefix}-type-${option.value}`;

                        return (
                            <label
                                key={option.value}
                                htmlFor={radioId}
                                className={cn(
                                    'relative flex min-w-0 cursor-pointer flex-col justify-between gap-3 rounded-sm border p-4 transition-[border-color,background-color,box-shadow] duration-150 ease-out focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2',
                                    isSelected
                                        ? 'border-ink bg-bone/70 ring-1 ring-ink'
                                        : 'border-hairline bg-canvas hover:border-control-border hover:bg-bone/40'
                                )}
                            >
                                <input
                                    id={radioId}
                                    type="radio"
                                    name="business_type"
                                    value={option.value}
                                    checked={isSelected}
                                    onChange={() => handleTypeSelect(option.value)}
                                    className="sr-only"
                                />

                                <div className="space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <span
                                            className={cn(
                                                'inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
                                                isSelected ? 'bg-ink text-canvas' : 'bg-bone text-ink'
                                            )}
                                        >
                                            <Icon className="size-4" aria-hidden="true" />
                                        </span>

                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                                                isSelected
                                                    ? 'border-ink bg-ink text-canvas'
                                                    : 'border-control-border bg-canvas text-transparent'
                                            )}
                                        >
                                            <Check className="size-3" strokeWidth={2.5} />
                                        </span>
                                    </div>

                                    <div>
                                        <span className="block text-base font-semibold text-ink">
                                            {option.label}
                                        </span>
                                        <span className="mt-1 block text-xs font-medium leading-relaxed text-body">
                                            {option.tagline}
                                        </span>
                                    </div>

                                    <p className="text-xs leading-relaxed text-mute">
                                        {option.description}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {option.examples.map((example) => (
                                        <span
                                            key={example}
                                            className="inline-flex items-center rounded-xs bg-canvas px-2 py-0.5 text-[11px] font-medium text-charcoal ring-1 ring-hairline"
                                        >
                                            {example}
                                        </span>
                                    ))}
                                </div>
                            </label>
                        );
                    })}
                </div>

                {errors?.business_type && (
                    <p id={`${idPrefix}-type-error`} className="text-xs text-destructive">
                        {errors.business_type}
                    </p>
                )}

                <div
                    role="note"
                    className="flex items-start gap-3 rounded-sm border border-warning-border bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning"
                >
                    <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold">Tipe bisnis terkunci permanen setelah disimpan</p>
                        <p className="text-xs leading-relaxed text-warning/90">{BUSINESS_TYPE_LOCK_NOTICE}</p>
                    </div>
                </div>
            </fieldset>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-name`}>2. Nama Bisnis *</Label>
                    <Input
                        id={`${idPrefix}-name`}
                        name="name"
                        autoComplete="organization"
                        placeholder={selectedOption.businessNamePlaceholder}
                        value={businessName}
                        onChange={(e) => onBusinessNameChange(e.target.value)}
                        aria-invalid={Boolean(errors?.name)}
                        aria-describedby={errors?.name ? `${idPrefix}-name-error` : undefined}
                        required
                    />
                    {errors?.name && (
                        <p id={`${idPrefix}-name-error`} className="text-xs text-destructive">
                            {errors.name}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-category`}>3. Kategori Bisnis *</Label>
                    <div
                        role="group"
                        aria-label={`Saran kategori untuk ${selectedOption.label}`}
                        className="flex flex-wrap gap-2"
                    >
                        {selectedOption.categoryPresets.map((preset) => {
                            const isActive = category === preset;

                            return (
                                <button
                                    key={preset}
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={() => onCategoryChange(preset)}
                                    className={cn(
                                        'inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                        isActive
                                            ? 'border-ink bg-ink text-canvas'
                                            : 'border-hairline bg-canvas text-body hover:border-control-border hover:bg-bone'
                                    )}
                                >
                                    {preset}
                                </button>
                            );
                        })}
                    </div>

                    <Input
                        id={`${idPrefix}-category`}
                        name="category"
                        placeholder={selectedOption.categoryPresets[0]}
                        value={category}
                        onChange={(e) => onCategoryChange(e.target.value)}
                        aria-invalid={Boolean(errors?.category)}
                        aria-describedby={`${idPrefix}-category-hint${errors?.category ? ` ${idPrefix}-category-error` : ''}`}
                        required
                    />
                    <p id={`${idPrefix}-category-hint`} className="text-xs text-mute">
                        Pilih salah satu kategori di atas atau ketik kategori bisnis Anda sendiri.
                    </p>
                    {errors?.category && (
                        <p id={`${idPrefix}-category-error`} className="text-xs text-destructive">
                            {errors.category}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
