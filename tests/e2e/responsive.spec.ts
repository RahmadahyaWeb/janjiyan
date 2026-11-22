import { expect, test, type Page } from '@playwright/test';

/**
 * Responsive sweep: every page x every width (Chromium) + iPhone 13 WebKit (390x844).
 * Fails on layout breakage (h-scroll, off-screen, container overflow, squeezed text,
 * sibling overlap, bottom-nav label wrapping/icon misalignment) and saves screenshots
 * under playwright-report/responsive/<width|webkit-390>/<name>.png.
 * IDs match a fresh ResponsiveQaSeeder run.
 */

const WIDTHS = [320, 375, 390, 768, 1280];

type Role = 'guest' | 'owner' | 'dropoff' | 'admin';

type Route = {
    name: string;
    path: string;
    as: Role;
    /** Skip this route on viewports wider than maxWidth (e.g. mobile-only sheets/filters). */
    maxWidth?: number;
    /** Capture viewport screenshot instead of fullPage (useful for fixed bottom sheets). */
    viewportScreenshot?: boolean;
    open?: (page: Page) => Promise<void>;
};

const openMobileBookingsFilter = async (page: Page) => {
    const filterButton = page.getByRole('button', { name: /^Filter/ }).first();
    await expect(filterButton).toBeVisible();
    await filterButton.click();
    await page.waitForTimeout(250);
};

const openMobileMoreSheet = async (page: Page) => {
    const moreButton = page.locator('nav[aria-label="Navigasi Dashboard"]').getByRole('button', { name: /Lainnya/ });
    await expect(moreButton).toBeVisible();
    await moreButton.click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
};

const ROUTES: Route[] = [
    // Public / Guest routes
    { name: 'landing', path: '/', as: 'guest' },
    { name: 'login', path: '/login', as: 'guest' },
    { name: 'register', path: '/register', as: 'guest' },
    { name: 'forgot-password', path: '/forgot-password', as: 'guest' },
    { name: 'reset-password', path: '/reset-password/x?email=a@b.test', as: 'guest' },
    { name: 'terms', path: '/terms', as: 'guest' },
    { name: 'privacy', path: '/privacy', as: 'guest' },
    { name: 'portal', path: '/b/rapi-studio', as: 'guest' },
    { name: 'portal-padel', path: '/b/arena-padel', as: 'guest' },
    { name: 'portal-dropoff', path: '/b/soklenn-shoes', as: 'guest' },
    { name: 'portal-empty', path: '/b/toko-polos', as: 'guest' },
    { name: 'pesan', path: '/b/rapi-studio/pesan', as: 'guest' },
    { name: 'pesan-padel', path: '/b/arena-padel/pesan', as: 'guest' },
    { name: 'pesan-dropoff', path: '/b/soklenn-shoes/pesan', as: 'guest' },
    { name: 'pesan-empty', path: '/b/toko-polos/pesan', as: 'guest' },
    { name: 'invoice-lookup', path: '/b/rapi-studio/invoices', as: 'guest' },
    { name: 'invoice', path: '/b/rapi-studio/invoice/6bf5568fc1a844a8bace598d02a23afa', as: 'guest' },
    { name: 'invoice-confirmed', path: '/b/rapi-studio/invoice/581d0ca7937ab3b02ce14ed6d07f7781', as: 'guest' },

    // Time-slot / Staff Appointment Merchant Dashboard (rapi-studio)
    { name: 'dashboard', path: '/dashboard', as: 'owner' },
    {
        name: 'dashboard-more-sheet',
        path: '/dashboard',
        as: 'owner',
        maxWidth: 1023,
        viewportScreenshot: true,
        open: openMobileMoreSheet,
    },
    { name: 'bookings', path: '/dashboard/bookings', as: 'owner' },
    {
        name: 'bookings-filter-open',
        path: '/dashboard/bookings',
        as: 'owner',
        maxWidth: 767,
        open: openMobileBookingsFilter,
    },
    { name: 'bookings-create', path: '/dashboard/bookings/create', as: 'owner' },
    { name: 'bookings-cancel', path: '/dashboard/bookings/3/cancel', as: 'owner' },
    { name: 'bookings-reschedule', path: '/dashboard/bookings/3/reschedule', as: 'owner' },
    { name: 'schedule', path: '/dashboard/schedule', as: 'owner' },
    { name: 'services', path: '/dashboard/services', as: 'owner' },
    { name: 'services-create', path: '/dashboard/services/create', as: 'owner' },
    { name: 'services-edit', path: '/dashboard/services/9/edit', as: 'owner' },
    { name: 'customers', path: '/dashboard/customers', as: 'owner' },
    { name: 'customer-show', path: '/dashboard/customers/1', as: 'owner' },
    { name: 'customer-show-long', path: '/dashboard/customers/11', as: 'owner' },
    { name: 'staff', path: '/dashboard/staff', as: 'owner' },
    { name: 'staff-create', path: '/dashboard/staff/create', as: 'owner' },
    { name: 'staff-edit', path: '/dashboard/staff/4/edit', as: 'owner' },
    { name: 'staff-schedule-manage', path: '/dashboard/staff/1/schedule/manage', as: 'owner' },
    { name: 'commissions', path: '/dashboard/commissions', as: 'owner' },
    { name: 'settings', path: '/dashboard/settings', as: 'owner' },
    { name: 'profile', path: '/dashboard/profile', as: 'owner' },
    { name: 'billing', path: '/dashboard/billing', as: 'owner' },
    { name: 'business-create', path: '/dashboard/businesses/create', as: 'owner' },

    // Drop-off Merchant Dashboard (soklenn-shoes)
    { name: 'dropoff-dashboard', path: '/dashboard', as: 'dropoff' },
    {
        name: 'dropoff-more-sheet',
        path: '/dashboard',
        as: 'dropoff',
        maxWidth: 1023,
        viewportScreenshot: true,
        open: openMobileMoreSheet,
    },
    { name: 'dropoff-bookings', path: '/dashboard/bookings', as: 'dropoff' },
    {
        name: 'dropoff-bookings-filter-open',
        path: '/dashboard/bookings',
        as: 'dropoff',
        maxWidth: 767,
        open: openMobileBookingsFilter,
    },
    { name: 'dropoff-bookings-create', path: '/dashboard/bookings/create', as: 'dropoff' },
    { name: 'dropoff-schedule', path: '/dashboard/schedule', as: 'dropoff' },
    { name: 'dropoff-services', path: '/dashboard/services', as: 'dropoff' },
    { name: 'dropoff-customers', path: '/dashboard/customers', as: 'dropoff' },
    { name: 'dropoff-settings', path: '/dashboard/settings', as: 'dropoff' },

    // Superadmin
    { name: 'admin', path: '/admin', as: 'admin' },
    { name: 'admin-plan', path: '/admin/users/2/plan', as: 'admin' },
    { name: 'admin-trial', path: '/admin/users/2/trial', as: 'admin' },
    { name: 'admin-suspend', path: '/admin/businesses/1/suspend', as: 'admin' },
];

type Issue = { kind: string; el: string; detail: string };

/**
 * Runs in the page. Finds:
 * - document horizontal overflow (`h-scroll`)
 * - elements extending off-screen (`off-screen`)
 * - children overflowing their bordered/rounded card container (`container-overflow`)
 * - squeezed text (`squeezed`) and unclipped text overflow (`text-overflow`)
 * - overlapping sibling boxes (`overlap`)
 * - mobile bottom-nav label wrapping (`bottom-nav-wrap`) & icon vertical misalignment (`bottom-nav-align`)
 */
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
    const isScrollableX = (el: Element) => {
        const ox = getComputedStyle(el).overflowX;
        return ox === 'auto' || ox === 'scroll';
    };
    const isCardContainer = (el: Element) => {
        if (el === document.body || el === document.documentElement) return false;
        const tag = el.tagName.toLowerCase();
        if (['nav', 'header', 'main', 'table', 'thead', 'tbody', 'tr', 'ul', 'ol'].includes(tag)) return false;
        const s = getComputedStyle(el);
        if (s.display === 'inline' || s.display === 'contents') return false;
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 28) return false;
        const radius = Math.max(
            parseFloat(s.borderTopLeftRadius) || 0,
            parseFloat(s.borderTopRightRadius) || 0,
            parseFloat(s.borderBottomLeftRadius) || 0,
            parseFloat(s.borderBottomRightRadius) || 0,
        );
        if (radius < 4) return false;
        const hasBorder =
            (parseFloat(s.borderLeftWidth) > 0 && s.borderLeftColor !== 'rgba(0, 0, 0, 0)' && s.borderLeftColor !== 'transparent') ||
            (parseFloat(s.borderRightWidth) > 0 && s.borderRightColor !== 'rgba(0, 0, 0, 0)' && s.borderRightColor !== 'transparent');
        const hasBg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
        return hasBorder || hasBg;
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

    // Check children overflowing their nearest bordered/rounded card container (e.g. iOS <input type="time"> breaking out of a card).
    const containerOffenders = new Map<Element, Set<Element>>();
    for (const el of all) {
        const es = getComputedStyle(el);
        if (['absolute', 'fixed', 'sticky'].includes(es.position)) continue;
        if (parseFloat(es.marginLeft) < -1 || parseFloat(es.marginRight) < -1) continue;
        const er = el.getBoundingClientRect();

        let insideHorizontalScroll = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            if (isScrollableX(p)) {
                insideHorizontalScroll = true;
                break;
            }
            if (!isCardContainer(p)) continue;

            const pr = p.getBoundingClientRect();
            const overflowsRight = er.right > pr.right + 1.5;
            const overflowsLeft = er.left < pr.left - 1.5;
            if (overflowsRight || overflowsLeft) {
                let flagged = containerOffenders.get(p);
                if (!flagged) {
                    flagged = new Set<Element>();
                    containerOffenders.set(p, flagged);
                }
                let ancestorFlagged = false;
                for (let anc = el.parentElement; anc && anc !== p; anc = anc.parentElement) {
                    if (flagged.has(anc)) {
                        ancestorFlagged = true;
                        break;
                    }
                }
                if (!ancestorFlagged) {
                    flagged.add(el);
                    issues.push({
                        kind: 'container-overflow',
                        el: label(el),
                        detail: `child [${Math.round(er.left)}..${Math.round(er.right)}] overflows ${label(p)} [${Math.round(pr.left)}..${Math.round(pr.right)}]`,
                    });
                }
            }
            break;
        }
        if (insideHorizontalScroll) continue;
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

    // Mobile bottom navigation checks: labels must stay single-line and all slot icons must align vertically.
    const fixedBottomNavs = Array.from(document.querySelectorAll('nav')).filter((nav) => {
        if (!visible(nav)) return false;
        const s = getComputedStyle(nav);
        const r = nav.getBoundingClientRect();
        return s.position === 'fixed' && r.bottom >= window.innerHeight - 24 && r.height <= 140;
    });
    for (const nav of fixedBottomNavs) {
        const items = Array.from(nav.querySelectorAll('a, button')).filter((el) => visible(el));
        if (items.length < 2) continue;
        const iconTops: { el: string; top: number }[] = [];
        for (const item of items) {
            const tops: number[] = [];
            const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (!(node.textContent ?? '').trim()) continue;
                let isFloatingOrSrOnly = false;
                for (let p = node.parentElement; p && p !== item; p = p.parentElement) {
                    const ps = getComputedStyle(p);
                    if (ps.position === 'absolute' || ps.position === 'fixed' || p.classList.contains('sr-only')) {
                        isFloatingOrSrOnly = true;
                        break;
                    }
                }
                if (isFloatingOrSrOnly) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of Array.from(range.getClientRects())) {
                    if (rect.width > 0 && rect.height > 0) tops.push(rect.top);
                }
            }
            tops.sort((a, b) => a - b);
            const gap = parseFloat(getComputedStyle(item).fontSize) * 0.6;
            const lines = tops.filter((t, i) => i === 0 || t - tops[i - 1] > gap).length;
            if (lines > 1) {
                issues.push({
                    kind: 'bottom-nav-wrap',
                    el: label(item),
                    detail: `bottom-nav label wrapped onto ${lines} lines`,
                });
            }
            const icon = Array.from(item.querySelectorAll('svg')).find((svg) => {
                const ps = getComputedStyle(svg);
                return ps.position !== 'absolute' && visible(svg);
            });
            if (icon) {
                iconTops.push({ el: label(item), top: icon.getBoundingClientRect().top });
            }
        }
        if (iconTops.length >= 2) {
            const minTop = Math.min(...iconTops.map((x) => x.top));
            const maxTop = Math.max(...iconTops.map((x) => x.top));
            if (maxTop - minTop > 2) {
                issues.push({
                    kind: 'bottom-nav-align',
                    el: label(nav),
                    detail: `bottom-nav icons misaligned by ${Math.round(maxTop - minTop)}px (${iconTops.map((x) => `${Math.round(x.top)}px`).join(', ')})`,
                });
            }
        }
    }

    return issues;
}

async function runRouteCheck(page: Page, route: Route, screenshotDir: string) {
    const res = await page.goto(route.path);
    expect(res?.status(), `${route.path} status`).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await route.open?.(page);
    await page.screenshot({
        path: `playwright-report/responsive/${screenshotDir}/${route.name}.png`,
        fullPage: !route.viewportScreenshot,
    });
    const issues = await page.evaluate(detect);
    expect(issues, issues.map((i) => `${i.kind}: ${i.el} — ${i.detail}`).join('\n')).toEqual([]);
}

for (const width of WIDTHS) {
    for (const route of ROUTES) {
        if (route.maxWidth !== undefined && width > route.maxWidth) continue;
        test.describe(`${width}px`, () => {
            test.use({
                viewport: { width, height: 800 },
                storageState: route.as === 'guest' ? { cookies: [], origins: [] } : `playwright/.auth/${route.as}.json`,
            });

            test(route.name, async ({ page }) => {
                await runRouteCheck(page, route, String(width));
            });
        });
    }
}

test.describe('webkit-390 @webkit-mobile', () => {
    for (const route of ROUTES) {
        test.describe(route.name, () => {
            test.use({
                storageState: route.as === 'guest' ? { cookies: [], origins: [] } : `playwright/.auth/${route.as}.json`,
            });

            test(route.name, async ({ page }) => {
                await runRouteCheck(page, route, 'webkit-390');
            });
        });
    }
});
