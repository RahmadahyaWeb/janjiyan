// Run: node tests/js/brand.check.mjs — contrast self-check for the shop color presets.
import assert from 'node:assert/strict';
import { BRAND_PRESETS, contrast, onBrand } from '../../resources/js/lib/brand.ts';

for (const hex of [...BRAND_PRESETS, '#fff59d', '#0b1d51', '#7a7a7a', '#777777', '#757575']) {
    const ratio = contrast(hex, onBrand(hex));
    assert.ok(ratio >= 4.5, `${hex} → ${onBrand(hex)} is only ${ratio.toFixed(2)}:1`);
    console.log(hex.padEnd(8), onBrand(hex), ratio.toFixed(2));
}
assert.equal(onBrand('#f5c542'), '#000000');
assert.equal(onBrand('#16423c'), '#ffffff');
console.log('ok');
