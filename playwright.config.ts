import { defineConfig, devices } from '@playwright/test';

// Responsive sweep. Uses a throwaway DB so the dev DB is never touched.
// One-time: touch database/qa.sqlite && DB_DATABASE=$PWD/database/qa.sqlite php artisan migrate:fresh --seed --seeder=ResponsiveQaSeeder
// Then: npm run build && npx playwright test
const PORT = 8010;

export default defineConfig({
    testDir: 'tests/e2e',
    fullyParallel: true,
    workers: 4,
    reporter: [['list']],
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        ...devices['Desktop Chrome'],
    },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        { name: 'responsive', testMatch: /responsive\.spec\.ts/, dependencies: ['setup'] },
    ],
    webServer: {
        command: `php artisan serve --port=${PORT}`,
        url: `http://127.0.0.1:${PORT}/login`,
        reuseExistingServer: false,
        env: {
            DB_DATABASE: `${process.cwd()}/database/qa.sqlite`,
            APP_URL: `http://127.0.0.1:${PORT}`,
            // php artisan serve workers share this; avoid throttling the sweep.
            PHP_CLI_SERVER_WORKERS: '4',
        },
    },
});
