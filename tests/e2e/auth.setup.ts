import { expect, test as setup } from '@playwright/test';

// Accounts come from database/seeders/DemoSeeder.php and ResponsiveQaSeeder.php.
const accounts = {
    owner: 'owner@janjiyan.test',
    dropoff: 'dropoff@janjiyan.test',
    admin: 'admin@janjiyan.test',
};

for (const [role, email] of Object.entries(accounts)) {
    setup(`login ${role}`, async ({ page }) => {
        await page.goto('/login');
        await page.locator('#email').fill(email);
        await page.locator('#password').fill('password123');
        await page.locator('button[type="submit"]').click();
        await expect(page).not.toHaveURL(/\/login/);
        await page.context().storageState({ path: `playwright/.auth/${role}.json` });
    });
}
