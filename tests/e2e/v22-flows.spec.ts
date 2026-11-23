import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
] as const;

async function submitPublicMultiServiceDropoffOrder(page: Page, vpName: string) {
    await page.goto('/b/soklenn-shoes/pesan');
    await page.waitForLoadState('networkidle');

    // Toggle first two visible drop-off service cards
    const serviceButtons = page.locator('[id^="service-"] button[aria-pressed]:visible');
    const count = await serviceButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);

    if ((await serviceButtons.nth(0).getAttribute('aria-pressed')) !== 'true') {
        await serviceButtons.nth(0).click();
    }
    if ((await serviceButtons.nth(1).getAttribute('aria-pressed')) !== 'true') {
        await serviceButtons.nth(1).click();
    }

    // Increment Anti-Waterproof Coating add-on by 1
    const addCoatingBtn = page.getByRole('button', { name: 'Tambah add-on Anti-Waterproof Coating' }).locator(':visible').first();
    await expect(addCoatingBtn).toBeVisible();
    await addCoatingBtn.click();

    // Advance from Step 1 (Layanan) to Step 2 (Jadwal)
    await page.getByRole('button', { name: /Lanjut/i }).locator(':visible').first().click();

    // Pick a future open date button with available quota
    const dateButtons = page.locator('[aria-label="Pilih tanggal"] button:not([disabled]):visible');
    const dateCount = await dateButtons.count();
    expect(dateCount).toBeGreaterThan(0);

    let foundOpenQuotaDate = false;
    for (let i = 1; i < dateCount; i++) {
        await dateButtons.nth(i).click();
        await page.waitForLoadState('networkidle');
        if (await page.getByText(/Datang kapan saja pukul/i).isVisible()) {
            foundOpenQuotaDate = true;
            break;
        }
    }
    if (!foundOpenQuotaDate) {
        await dateButtons.nth(0).click();
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/Datang kapan saja pukul/i)).toBeVisible();
    }

    // Advance from Step 2 (Jadwal) to Step 3 (Data & DP)
    await page.getByRole('button', { name: /Lanjut/i }).locator(':visible').first().click();

    await expect(page.getByLabel('Nama lengkap *')).toBeVisible();
    await page.getByLabel('Nama lengkap *').fill(`E2E Multi ${vpName}`);
    await page.getByLabel('Nomor WhatsApp *').fill('081255556666');

    const payLaterBtn = page.locator('button:has-text("Bayar nanti"):visible');
    if (await payLaterBtn.count()) {
        await payLaterBtn.first().click();
    }

    const visibleSubmit = page.locator('button[type="submit"]:visible').first();
    await expect(visibleSubmit).toBeVisible();
    await visibleSubmit.click();

    await page.waitForURL(/\/b\/soklenn-shoes\/invoice\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Anti-Waterproof Coating')).toBeVisible();
    await expect(page.getByText('Total Biaya')).toBeVisible();
}

for (const vp of VIEWPORTS) {
    test.describe(`v2.2 flows (${vp.name} ${vp.width}x${vp.height})`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        test('public multi-service dropoff + add-on checkout renders itemized invoice', async ({ page }) => {
            await submitPublicMultiServiceDropoffOrder(page, vp.name);
        });

        test('public review submission + smart Google Maps redirect flow', async ({ page }) => {
            await page.goto('/b/rapi-studio/review');
            await page.waitForLoadState('networkidle');

            await page.getByRole('radio', { name: '5 bintang' }).click();
            await page.getByLabel('Ulasan atau Masukan (Opsional)').fill(`Mantap banget hasil cukurnya (${vp.name})!`);
            await page.getByLabel('Nama Anda (Opsional)').fill(`Pelanggan E2E ${vp.name}`);

            await page.getByRole('button', { name: 'Kirim Ulasan' }).click();

            await expect(page.getByRole('heading', { name: 'Terima kasih atas ulasan Anda!' })).toBeVisible();
            const googleCta = page.getByRole('link', { name: /Lanjutkan ke Google Maps Review/i });
            await expect(googleCta).toBeVisible();
            await expect(googleCta).toHaveAttribute('href', /^https:\/\/(g\.page|maps\.app\.goo\.gl|www\.google\.com)/);
            await expect(page.getByRole('button', { name: /Salin Komentar/i })).toBeVisible();
        });

        test.describe('owner cashier + thermal receipt + QR review sticker', () => {
            test.use({ storageState: 'playwright/.auth/owner.json' });

            test('cashier settlement + 58mm/80mm thermal receipt DOM uses pure hex (no oklch)', async ({ page }) => {
                await page.goto('/dashboard/bookings');
                await page.waitForLoadState('networkidle');

                // Open Cashier Settlement dialog on the first visible booking row/card
                const cashierBtn = page.locator('button:has-text("Kasir / Bayar"):visible').first();
                await expect(cashierBtn).toBeVisible();
                await cashierBtn.click();

                const dialog = page.getByRole('dialog');
                await expect(dialog).toBeVisible();
                await expect(dialog.getByText('Rincian Item & Add-on')).toBeVisible();

                // Verify live item custom validation & addition inside cashier dialog
                const customBtn = dialog.getByRole('button', { name: 'Item Custom' });
                if (await customBtn.count()) {
                    await customBtn.click();
                    await dialog.getByLabel('Nama Item *').fill(`Handuk Hangat (${vp.name})`);
                    await dialog.getByLabel('Harga Satuan (Rp) *').fill('15000');
                    await dialog.getByRole('button', { name: 'Tambahkan Item' }).click();
                    await expect(dialog.getByText(`Handuk Hangat (${vp.name})`)).toBeVisible();
                    await expect(dialog.getByRole('button', { name: 'Simpan Perubahan Item' })).toBeVisible();
                    await dialog.getByRole('button', { name: 'Reset' }).click();
                }

                // Exercise cash change preview if cash received field is shown
                const receivedField = dialog.locator('#cashier-received');
                if (await receivedField.count()) {
                    await dialog.locator('#cashier-amount').fill('50000');
                    await receivedField.fill('100000');
                    await expect(dialog.getByText('Rp 50.000')).toBeVisible();
                }

                // Close cashier dialog cleanly
                await page.keyboard.press('Escape');
                await expect(dialog).toBeHidden();

                // Open dedicated Struk / Cetak dialog
                const receiptBtn = page.locator('button:has-text("Struk / Cetak"):visible').first();
                await expect(receiptBtn).toBeVisible();
                await receiptBtn.click();

                const receiptDialog = page.getByRole('dialog');
                await expect(receiptDialog).toBeVisible();

                const sheet = receiptDialog.getByTestId('receipt-print-sheet');
                await expect(sheet).toBeVisible();
                await expect(sheet).toHaveAttribute('data-receipt-format', '58mm');

                // Assert isolated thermal DOM uses zero oklch CSS tokens
                const thermalCheck58 = await sheet.evaluate((el) => ({
                    width: (el as HTMLElement).style.width,
                    hasOklch: el.outerHTML.includes('oklch('),
                    bg: (el as HTMLElement).style.backgroundColor,
                }));
                expect(thermalCheck58.width).toBe('210px');
                expect(thermalCheck58.hasOklch).toBe(false);

                // Switch to 80mm thermal paper
                await receiptDialog.getByRole('button', { name: 'Thermal 80mm' }).click();
                await expect(sheet).toHaveAttribute('data-receipt-format', '80mm');
                const width80 = await sheet.evaluate((el) => (el as HTMLElement).style.width);
                expect(width80).toBe('300px');

                // Switch back to 58mm and verify PNG download trigger produces a .png download
                await receiptDialog.getByRole('button', { name: 'Thermal 58mm' }).click();
                const downloadPromise = page.waitForEvent('download');
                await receiptDialog.getByRole('button', { name: /Unduh PNG/i }).click();
                const download = await downloadPromise;
                expect(download.suggestedFilename()).toMatch(/\.png$/i);
            });

            test('QR review sticker dialog renders QR preview, A4 2x2/3x3 toggle, and downloads 1:1 PNG', async ({
                page,
            }) => {
                await page.goto('/dashboard/reviews');
                await page.waitForLoadState('networkidle');

                const openQrBtn = page.locator('button:has-text("Cetak Stiker QR"):visible').first();
                await expect(openQrBtn).toBeVisible();
                await openQrBtn.click();

                const dialog = page.getByRole('dialog');
                await expect(dialog).toBeVisible();

                const qrImg = dialog.locator('img[alt^="QR Code halaman ulasan"]');
                await expect(qrImg).toBeVisible();
                await expect(qrImg).toHaveAttribute('src', /^data:image\/png;base64,/);

                // Toggle A4 grid layout between 2x2 and 3x3
                const btn3x3 = dialog.getByRole('button', { name: /3×3/ });
                await btn3x3.click();
                await expect(btn3x3).toHaveAttribute('aria-pressed', 'true');
                await expect(dialog.getByRole('button', { name: /Grid A4 \(3x3\)/ })).toBeVisible();

                const btn2x2 = dialog.getByRole('button', { name: /2×2/ });
                await btn2x2.click();
                await expect(btn2x2).toHaveAttribute('aria-pressed', 'true');

                // Download 1:1 1200x1200 PNG sticker
                const downloadPromise = page.waitForEvent('download');
                await dialog.getByRole('button', { name: 'Stiker PNG 1:1' }).click();
                const download = await downloadPromise;
                expect(download.suggestedFilename()).toBe('review-sticker-rapi-studio.png');
            });
        });

        test.describe('dropoff receipt tag58 preview', () => {
            test.use({ storageState: 'playwright/.auth/dropoff.json' });

            test('dropoff merchant can open Tag Barang 58mm label sheet', async ({ page }) => {
                await page.goto('/dashboard/bookings');
                await page.waitForLoadState('networkidle');

                const receiptBtn = page.locator('button:has-text("Struk / Cetak"):visible').first();
                await expect(receiptBtn).toBeVisible();
                await receiptBtn.click();

                const dialog = page.getByRole('dialog');
                await expect(dialog).toBeVisible();

                const tagBtn = dialog.getByRole('button', { name: 'Label Drop-off' });
                await expect(tagBtn).toBeVisible();
                await tagBtn.click();

                const sheet = dialog.getByTestId('receipt-print-sheet');
                await expect(sheet).toHaveAttribute('data-receipt-format', 'tag58');
                const tagHtml = await sheet.evaluate((el) => el.outerHTML);
                expect(tagHtml.includes('oklch(')).toBe(false);
            });
        });
    });
}
