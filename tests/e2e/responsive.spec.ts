import { expect, test, type Page } from '@playwright/test';

/**
 * Responsive sweep: every page x every width. Fails on layout breakage, saves a full-page
 * screenshot of each so a human can eyeball them (playwright-report/responsive/<width>/<name>.png).
 * IDs match a fresh ResponsiveQaSeeder run.
 */

const WIDTHS = [320, 375, 390, 768, 1280];

type Route = { name: string; path: string; as: 'guest' | 'owner' | 'admin'; open?: (page: Page) => Promise<void> };

const ROUTES: Route[] = [
    { name: 'landing', path: '/', as: 'guest' },
    { name: 'login', path: '/login', as: 'guest' },
    { name: 'register', path: '/register', as: 'guest' },
    { name: 'forgot-password', path: '/forgot-password', as: 'guest' },
    { name: 'reset-password', path: '/reset-password/x?email=a@b.test', as: 'guest' },
    { name: 'terms', path: '/terms', as: 'guest' },
    { name: 'privacy', path: '/privacy', as: 'guest' },
    { name: 'portal', path: '/b/rapi-studio', as: 'guest' },
    { name: 'portal-padel', path: '/b/arena-padel', as: 'guest' },
    { name: 'invoice-lookup', path: '/b/rapi-studio/invoices', as: 'guest' },
    { name: 'invoice', path: '/b/rapi-studio/invoice/6bf5568fc1a844a8bace598d02a23afa', as: 'guest' },
    { name: 'invoice-confirmed', path: '/b/rapi-studio/invoice/581d0ca7937ab3b02ce14ed6d07f7781', as: 'guest' },

    { name: 'dashboard', path: '/dashboard', as: 'owner' },
    { name: 'bookings', path: '/dashboard/bookings', as: 'owner' },
    { name: 'bookings-create', path: '/dashboard/bookings/create', as: 'owner' },
    { name: 'bookings-cancel', path: '/dashboard/bookings/3/cancel', as: 'owner' },
    { name: 'bookings-reschedule', path: '/dashboard/bookings/3/reschedule', as: 'owner' },
    { name: 'schedule', path: '/dashboard/schedule', as: 'owner' },
    { name: 'services', path: '/dashboard/services', as: 'owner' },
    { name: 'services-create', path: '/dashboard/services/create', as: 'owner' },
    { name: 'services-edit', path: '/dashboard/services/6/edit', as: 'owner' },
    { name: 'customers', path: '/dashboard/customers', as: 'owner' },
    { name: 'customer-show', path: '/dashboard/customers/1', as: 'owner' },
    { name: 'customer-show-long', path: '/dashboard/customers/7', as: 'owner' },
    { name: 'staff', path: '/dashboard/staff', as: 'owner' },
    { name: 'staff-create', path: '/dashboard/staff/create', as: 'owner' },
    { name: 'staff-edit', path: '/dashboard/staff/4/edit', as: 'owner' },
    { name: 'staff-schedule-manage', path: '/dashboard/staff/1/schedule/manage', as: 'owner' },
    { name: 'commissions', path: '/dashboard/commissions', as: 'owner' },
    { name: 'settings', path: '/dashboard/settings', as: 'owner' },
    { name: 'profile', path: '/dashboard/profile', as: 'owner' },
    { name: 'billing', path: '/dashboard/billing', as: 'owner' },
    { name: 'business-create', path: '/dashboard/businesses/create', as: 'owner' },

    { name: 'admin', path: '/admin', as: 'admin' },
    { name: 'admin-plan', path: '/admin/users/2/plan', as: 'admin' },
    { name: 'admin-trial', path: '/admin/users/2/trial', as: 'admin' },
    { name: 'admin-suspend', path: '/admin/businesses/1/suspend', as: 'admin' },
];

type Issue = { kind: string; el: string; detail: string };

/** Runs in the page. Finds horizontal overflow, off-screen boxes, squeezed text and overlapping siblings. */
function detect(): Issue[] {
    const vw = document.documentElement.clientWidth;
    const issues: Issue[] = [];
    const label = (el: Element) => {
        const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : '';
        const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}> "${text}"`;
    };
    const visible = (el: Element) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0' && r.width > 1 && r.height > 1;
    };
    // Inside a scroll/clip container, overflow is intended.
    const clipped = (el: Element) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox !== 'visible') return true;
        }
        return false;
    };

    if (document.documentElement.scrollWidth > vw + 1) {
        issues.push({ kind: 'h-scroll', el: 'document', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });
    }

    const all = Array.from(document.body.querySelectorAll('*')).filter((el) => visible(el) && !el.closest('svg'));
    const offenders = new Set<Element>();
    for (const el of all) {
        const r = el.getBoundingClientRect();
        if ((r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== 'fixed') {
            if (el.parentElement && offenders.has(el.parentElement)) continue;
            offenders.add(el);
            issues.push({ kind: 'off-screen', el: label(el), detail: `left ${Math.round(r.left)} right ${Math.round(r.right)} vw ${vw}` });
        }
    }

    for (const el of all) {
        const ownText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? '')
            .join(' ')
            .trim();
        const words = ownText.split(/\s+/).filter((w) => w.length > 1);
        if (words.length === 0) continue;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // Count rendered lines from the text's own line boxes.
        const tops: number[] = [];
        for (const n of Array.from(el.childNodes)) {
            if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? '').trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const rect of Array.from(range.getClientRects())) if (rect.width > 0) tops.push(rect.top);
        }
        tops.sort((a, b) => a - b);
        const gap = parseFloat(s.fontSize) * 0.6;
        const lines = tops.filter((t, i) => i === 0 || t - tops[i - 1] > gap).length;
        // Mixed inline text (text + <span>) wraps naturally mid-sentence; only judge pure text or flex items.
        const mixedInline = !s.display.includes('flex') && Array.from(el.children).some((c) => (c.textContent ?? '').trim());
        // Each line holds at most one word: the box is too narrow for its text.
        if (!mixedInline && words.length >= 2 && lines >= words.length && r.width < vw * 0.5) {
            issues.push({ kind: 'squeezed', el: label(el), detail: `${words.length} words on ${lines} lines, width ${Math.round(r.width)}` });
        }
        // A single word wider than its box (not an intended ellipsis).
        if (el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis' && s.overflowX === 'visible' && !clipped(el)) {
            issues.push({ kind: 'text-overflow', el: label(el), detail: `scrollWidth ${el.scrollWidth} > ${el.clientWidth}` });
        }
    }

    for (const el of all) {
        const kids = Array.from(el.children).filter(
            (k) =>
                visible(k) &&
                !k.closest('svg') &&
                getComputedStyle(k).display !== 'inline' &&
                !['absolute', 'fixed', 'sticky'].includes(getComputedStyle(k).position),
        );
        for (let i = 0; i < kids.length; i++) {
            for (let j = i + 1; j < kids.length; j++) {
                const a = kids[i].getBoundingClientRect();
                const b = kids[j].getBoundingClientRect();
                const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (w > 2 && h > 2) issues.push({ kind: 'overlap', el: label(kids[i]), detail: `overlaps ${label(kids[j])}` });
            }
        }
    }

    return issues;
}

for (const width of WIDTHS) {
    for (const route of ROUTES) {
        test.describe(`${width}px`, () => {
            test.use({
                viewport: { width, height: 800 },
                storageState: route.as === 'guest' ? { cookies: [], origins: [] } : `playwright/.auth/${route.as}.json`,
            });

            test(route.name, async ({ page }) => {
                const res = await page.goto(route.path);
                expect(res?.status(), `${route.path} status`).toBeLessThan(400);
                await page.waitForLoadState('networkidle');
                await route.open?.(page);
                await page.screenshot({ path: `playwright-report/responsive/${width}/${route.name}.png`, fullPage: true });
                const issues = await page.evaluate(detect);
                expect(issues, issues.map((i) => `${i.kind}: ${i.el} — ${i.detail}`).join('\n')).toEqual([]);
            });
        });
    }
}
