// Run: node tests/js/brand.check.mjs — contrast self-check for the shop color presets.
import assert from 'node:assert/strict';
import { BRAND_PRESETS, brandVars, contrast, onBrand } from '../../resources/js/lib/brand.ts';

for (const hex of [...BRAND_PRESETS, '#fff59d', '#0b1d51', '#7a7a7a', '#777777', '#757575']) {
    const ratio = contrast(hex, onBrand(hex));
    assert.ok(ratio >= 4.5, `${hex} → ${onBrand(hex)} is only ${ratio.toFixed(2)}:1`);
    console.log(hex.padEnd(8), onBrand(hex), ratio.toFixed(2));
}
assert.equal(onBrand('#f5c542'), '#000000');
assert.equal(onBrand('#16423c'), '#ffffff');
const none = brandVars(null);
assert.ok(contrast(none['--band'], none['--on-band']) >= 4.5, 'no-color band text');
// Mid-tone custom colors fail 4.5:1 as text on bone, so --brand-ink must fall back to the darkened mix.
for (const hex of ['#2f9e44', '#e8590c', '#1c7ed6']) assert.match(brandVars(hex)['--brand-ink'], /^color-mix/, hex);
console.log('ok');
