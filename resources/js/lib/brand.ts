import type { CSSProperties } from 'react';

const INK = '#141414';
const WHITE = '#ffffff';
// Card surface on the white public pages (bone, as on the Janjiyan landing); brand icons sit on it.
const SURFACE = '#f3f3f3';

/** Shop color choices in Settings. Each one reaches ≥ 4.5:1 with its auto text color (see tests/js/brand.check.mjs). */
export const BRAND_PRESETS = [
    '#16423c',
    '#1e3a8a',
    '#9f1239',
    '#c2410c',
    '#5b21b6',
    '#141414',
    '#f5c542',
    '#a7d8c9',
] as const;

export const isHex = (value: string | null | undefined): value is string => /^#[0-9a-f]{6}$/i.test(value ?? '');

function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// Pure black (not ink) so even mid-grey custom colors reach 4.5:1 with one of the two.
const BLACK = '#000000';

/** White or black, whichever reads better on the brand color. */
export const onBrand = (hex: string): string => (contrast(hex, WHITE) >= contrast(hex, BLACK) ? WHITE : BLACK);

/**
 * CSS variables for a shop's color. `--brand-ink` is for icons/marks sitting on light cards: a light brand
 * (yellow, mint) would vanish there, so it is darkened toward ink while keeping its hue.
 * `--band`/`--on-band` paint the header and cover band: the shop color, or a light neutral when unset
 * (buttons keep `--brand`, which falls back to ink).
 */
export function brandVars(color: string | null | undefined): CSSProperties {
    const hex = isHex(color) ? color.toLowerCase() : INK;
    const brandInk = contrast(hex, SURFACE) >= 3 ? hex : `color-mix(in oklab, ${hex} 40%, ${INK})`;
    return {
        '--brand': hex,
        '--on-brand': onBrand(hex),
        '--brand-ink': brandInk,
        '--brand-soft': `color-mix(in oklab, ${hex} 14%, white)`,
        '--band': isHex(color) ? hex : SURFACE,
        '--on-band': isHex(color) ? onBrand(hex) : INK,
    } as CSSProperties;
}
