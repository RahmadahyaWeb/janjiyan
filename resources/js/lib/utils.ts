import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function parseNumericInput(raw: string): number | '' {
    if (raw === '') {
        return '';
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? '' : parsed;
}

export function scrollToFirstInvalid(container?: ParentNode | null): void {
    if (typeof window === 'undefined') {
        return;
    }
    requestAnimationFrame(() => {
        const scope = container ?? document;
        const invalidEl = scope.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"][data-form-error="true"]');
        invalidEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        invalidEl?.focus?.();
    });
}
