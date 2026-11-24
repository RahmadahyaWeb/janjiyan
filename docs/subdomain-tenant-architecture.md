# Subdomain Tenant Architecture (`{slug}.janjiyan.web.id`)

**Status:** Implemented in Application Code (Ready for Production VPS Rollout)  
**Scope:** Replace path-based tenant routing (`/b/{slug}`) directly with wildcard tenant subdomains (`{slug}.janjiyan.web.id`), DNS-safe slug validation, cross-origin asset/canvas safety, and VPS/Cloudflare wildcard SSL setup.

---

## 1. Executive Summary & Core Decisions

Currently, Janjiyan serves all public merchant booking portals under a path prefix (`/b/{slug}`, `/b/{slug}/pesan`, `/b/{slug}/invoice/{token}`, `/b/{slug}/review`) on the apex domain (`https://janjiyan.web.id`).

This specification establishes the architecture to promote each business to its own branded subdomain (`https://{slug}.janjiyan.web.id`) based on the following approved decisions:

1. **Universal Subdomain Provisioning (All Plans & Trial):**
   - Every active, non-suspended `Business` automatically receives `{slug}.{tenant_domain}` regardless of subscription tier (Trial, Starter, Pro, Business).
   - Custom CNAME white-label domains (e.g., `booking.merchantdomain.com`) remain out of scope per [`docs/PRD.md`](./PRD.md) Non-Goals.
2. **Clean Cutover (Remove Legacy `/b/{slug}` Routes):**
   - Because there are no active live merchants or circulated printed QR links yet, all `/b/{slug}/*` path routes are removed completely rather than maintained as redirects (returning standard `404` on the root domain). This keeps routing, tests, and SEO clean with zero legacy redirect overhead.
3. **Domain Separation:**
   - **Root Domain (`janjiyan.web.id`):** Marketing landing page (`/`), `/terms`, `/privacy`, `/sitemap.xml`, authentication (`/login`, `/register`, `/auth/google/*`, `/forgot-password`, `/email/verify`), merchant dashboard (`/dashboard/*`), superadmin panel (`/admin/*`), and payment gateway webhooks (`/webhooks/mayar`).
   - **Wildcard Subdomains (`{slug}.janjiyan.web.id`):** Public business homepage (`/`), booking flow (`/pesan`, `/slots`, `/book`), invoice & status tracking (`/invoice/{token}`, `/invoices`, `/booking/{code}`, `*.ics`, `*/proof`), and review portal (`/review`).
   - **`www` Subdomain (`www.janjiyan.web.id`):** `301` redirect to `https://janjiyan.web.id`.

---

## 2. Configuration & Environment Design

### 2.1 New Configuration Keys (`config/app.php` & `.env.example`)

Add dedicated tenant domain configuration so routing is decoupled from `APP_URL` and works across local development, PHPUnit tests, staging, and production:

```php
// config/app.php
'tenant_domain' => env('APP_TENANT_DOMAIN', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost'),
'tenant_scheme' => env('APP_TENANT_SCHEME', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_SCHEME) ?: 'http'),
```

**Environment values:**
- **Production (`.env`):**
  - `APP_URL=https://janjiyan.web.id`
  - `APP_TENANT_DOMAIN=janjiyan.web.id`
  - `APP_TENANT_SCHEME=https`
- **Local Development (`.env.example`):**
  - `APP_URL=http://localhost:8000`
  - `APP_TENANT_DOMAIN=localhost`
  - `APP_TENANT_SCHEME=http`
  - Modern browsers resolve `*.localhost` natively to `127.0.0.1` without `/etc/hosts` edits (e.g., `http://rapi-studio.localhost:8000`).

### 2.2 Public URL Helper on `Business` Model

Centralize tenant URL construction on `app/Models/Business.php` (eliminating manual `/b/{slug}` string concatenation in controllers, Blade views, and React components):

- `Business::publicUrl(string $path = '', array $query = []): string`
- `Business::publicReviewUrl(?string $invoiceToken = null): string`
- Expose `public_url` (or `tenantBaseDomain` via `HandleInertiaRequests`) to the dashboard, settings, admin, and QR generators so frontend components never reconstruct URLs from `window.location.origin + '/b/...'`.

---

## 3. DNS-Safe Slug Validation & Reserved Subdomains

### 3.1 Current Gap in Codebase
- `app/Http/Controllers/Dashboard/SettingsController.php` (line 83) currently validates:
  ```php
  'slug' => ['required', 'alpha_dash', 'max:80', Rule::unique('businesses', 'slug')->ignore($business->id)]
  ```
- `alpha_dash` permits underscores (`_`), which are **invalid in DNS hostnames (RFC 1123)** and rejected by browsers/SSL certificates.
- `max:80` exceeds the **RFC 1035 DNS label limit of 63 characters**.
- Slug auto-generation is currently duplicated between `OnboardingController::store` and `BusinessController::store`.

### 3.2 Target Slug Rules & Shared Helper
Extract a shared helper (e.g., `Business::generateUniqueSlug(string $name)` + `Business::RESERVED_SLUGS`):

1. **Format Rule (RFC 1123 compliant):**
   - Lowercase ASCII alphanumeric and hyphens only: `regex:/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/`
   - Length: `min:3`, `max:63`
   - Reject consecutive hyphens (`--`) if desired, or at minimum forbid leading/trailing `-` and underscores `_`.
   - Normalize input with `strtolower(trim(...))` before validation/uniqueness check.
2. **Reserved Subdomain Blacklist (`Rule::notIn(Business::RESERVED_SLUGS)`):**
   - `www`, `app`, `api`, `admin`, `superadmin`, `dashboard`, `auth`, `login`, `register`, `mail`, `smtp`, `imap`, `pop`, `webmail`, `ftp`, `cdn`, `static`, `assets`, `storage`, `media`, `files`, `billing`, `pay`, `payment`, `webhook`, `webhooks`, `support`, `help`, `docs`, `blog`, `status`, `dev`, `staging`, `test`, `demo`, `localhost`, `ns1`, `ns2`, `mx`.
   - When `Business::generateUniqueSlug()` produces a reserved word (e.g., a business named `"Admin"` or `"Support"`), append `-1` (or `-biz`) automatically.
3. **Pre-Migration Data Audit:**
   - Before enforcing subdomain routing in production, query `businesses` for any existing `slug` containing `_`, uppercase letters, leading/trailing `-`, length `< 3` or `> 63`, or matching `RESERVED_SLUGS`, and normalize them cleanly.

---

## 4. Routing Architecture (`routes/web.php`)

### 4.1 Subdomain Route Group

Register the tenant subdomain group in `routes/web.php` using `config('app.tenant_domain')`:

```php
$tenantDomain = config('app.tenant_domain');
$reservedPattern = implode('|', array_map('preg_quote', Business::RESERVED_SLUGS));

Route::domain("{slug}.{$tenantDomain}")
    ->where(['slug' => "(?!({$reservedPattern})$)[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?"])
    ->group(function () {
        Route::get('/', [PublicBookingController::class, 'show'])->name('public.booking');
        Route::get('/pesan', [PublicBookingController::class, 'booking'])->name('public.booking.form');
        Route::get('/slots', [PublicBookingController::class, 'slots'])
            ->middleware('throttle:public-slots')
            ->name('public.booking.slots');
        Route::post('/book', [PublicBookingController::class, 'store'])
            ->middleware('throttle:public-booking')
            ->name('public.booking.store');

        Route::get('/invoice/{token}', [PublicBookingController::class, 'invoice'])
            ->middleware('throttle:public-booking-status')
            ->name('public.booking.invoice');
        Route::get('/invoice/{token}/calendar.ics', [PublicBookingController::class, 'calendarIcsByToken'])
            ->middleware('throttle:60,1')
            ->name('public.booking.invoice.ics');
        Route::post('/invoice/{token}/proof', [PublicBookingController::class, 'uploadProofByToken'])
            ->middleware('throttle:public-dp-proof')
            ->name('public.booking.invoice.proof');

        Route::get('/invoices', [PublicBookingController::class, 'invoices'])->name('public.booking.invoices');
        Route::post('/invoices', [PublicBookingController::class, 'lookupInvoices'])
            ->middleware('throttle:public-invoice-lookup')
            ->name('public.booking.invoices.lookup');

        Route::get('/booking/{code}', [PublicBookingController::class, 'status'])
            ->middleware('throttle:public-booking-status')
            ->name('public.booking.status');
        Route::get('/booking/{code}/calendar.ics', [PublicBookingController::class, 'calendarIcsByCode'])
            ->middleware('throttle:60,1')
            ->name('public.booking.ics');
        Route::post('/booking/{code}/proof', [PublicBookingController::class, 'uploadProof'])
            ->middleware('throttle:public-dp-proof')
            ->name('public.booking.proof');

        Route::get('/review', [PublicReviewController::class, 'show'])->name('public.review.show');
        Route::post('/review', [PublicReviewController::class, 'store'])
            ->middleware('throttle:public-review')
            ->name('public.review.store');
        Route::post('/review/{review}/redirect', [PublicReviewController::class, 'markRedirected'])
            ->middleware('throttle:public-review')
            ->name('public.review.redirect');
    });
```

### 4.2 Root Domain Route Group

Wrap landing, legal, webhooks, auth, onboarding, dashboard, and admin routes inside `Route::domain($tenantDomain)` (with `www.{$tenantDomain}` redirected to the apex domain at Nginx). Remove the old `Route::prefix('b/{slug}')` block completely so all public portal traffic resolves exclusively via `{slug}.{$tenantDomain}`.

---

## 5. Cross-Subdomain Technical Audit (Codebase Impact)

### 5.1 Backend Files Using `/b/` or Route Generation

| Component / File | Current Behavior | Required Change |
| :--- | :--- | :--- |
| `app/Http/Controllers/PublicBookingController.php` | Line 815 fallback: `url("/b/{$business->slug}/review{$query}")` | Replace fallback with `$business->publicReviewUrl(...)` |
| `app/Http/Controllers/Dashboard/BookingController.php` | Line 1453 fallback: `url("/b/{$business->slug}/review{$query}")` | Replace fallback with `$business->publicReviewUrl(...)` |
| `app/Http/Controllers/LandingController.php` | Line 54: `route('public.booking', ['slug' => $business->slug])` | Automatically emits `https://{slug}.janjiyan.web.id` once route uses `domain()` |
| `app/Services/IcsCalendarService.php` | Line 53: `route('public.booking.invoice', ...)` | Automatically emits subdomain URL |
| `app/Notifications/CustomerBookingStatusNotification.php` | Lines 53–54: `route('public.booking.invoice' / 'status', ...)` | Automatically emits subdomain URL |
| `app/Notifications/CustomerBookingReminderNotification.php` | Lines 53–54: `route('public.booking.invoice' / 'status', ...)` | Automatically emits subdomain URL |
| `app/Http/Controllers/Dashboard/OnboardingController.php` | Inline slug generator | Extract to `Business::generateUniqueSlug()` with reserved slug guard |
| `app/Http/Controllers/Dashboard/BusinessController.php` | Inline slug generator | Reuse `Business::generateUniqueSlug()` |
| `app/Http/Controllers/Dashboard/SettingsController.php` | Line 83: `alpha_dash`, `max:80` | Update to RFC 1123 DNS regex, `min:3|max:63`, and `Rule::notIn(Business::RESERVED_SLUGS)` |

### 5.2 Frontend Files & Ziggy Routing

| File | Current Usage | Required Change |
| :--- | :--- | :--- |
| `resources/js/pages/Public/BookingPortal.tsx` | Lines 272 & 353: hardcoded `` `/b/${business.slug}/slots?${params}` `` | Use `route('public.booking.slots', business.slug)` or relative `/slots?${params}` |
| `resources/js/pages/Dashboard/Index.tsx` | Lines 112, 226, 239: `${window.location.origin}/b/${activeBusiness.slug}` | Display & link to `activeBusiness.public_url` (`https://{slug}.janjiyan.web.id`) |
| `resources/js/layouts/DashboardLayout.tsx` | Lines 137, 175, 210, 428: `/b/${activeBusiness.slug}` | Display `{slug}.{tenantDomain}` and link via `<a href={activeBusiness.public_url}>` (full anchor, not Inertia `<Link>`, to avoid cross-origin XHR) |
| `resources/js/components/QrPosterDialog.tsx` | Lines 144–147: `${window.location.origin}/b/${businessSlug}` | Receive `publicUrl` prop from `Business::publicUrl()` |
| `resources/js/components/QrReviewStickerDialog.tsx` | Lines 158–162: `${window.location.origin}/b/${businessSlug}/review` | Receive `publicReviewUrl` prop from `Business::publicReviewUrl()` |
| `resources/js/pages/Dashboard/Settings/Index.tsx` | Lines 466, 558, 575, 940–941, 1195: `/b/...` and `https://janjiyan.id/b/...` preview copy | Update UI labels & WA template previews to `{slug}.janjiyan.web.id` (or dynamic `tenantBaseDomain`) |
| `resources/js/pages/Admin/Index.tsx` & `SuspendBusiness.tsx` | Line 314 & line 51: `/b/{slug}` display | Update display to `{b.slug}.{tenantDomain}` |

> [!TIP]
> **Ziggy Cross-Origin Behavior Check:** Verify `tightenco/ziggy` (`^2.7`) output on both root and subdomain pages. When `route('public.booking.form', business.slug)` is called from `rapi-studio.janjiyan.web.id`, Ziggy must resolve to `/pesan` (same-origin) so Inertia `<Link>` works as an SPA transition without CORS preflight failures. When `route('public.booking', business.slug)` is called from `janjiyan.web.id`, it produces an absolute cross-origin URL (`https://rapi-studio.janjiyan.web.id`), which must be opened with standard `<a href>` rather than Inertia `<Link>`.

### 5.3 Storage, Vite Assets, Canvas Export & Sessions

1. **Same-Origin Storage & Assets (Critical for QR/Receipt PNG Export):**
   - `config/filesystems.php` line 44 currently sets `'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage'`.
   - When `APP_URL=https://janjiyan.web.id`, `Storage::url($logoPath)` outputs `https://janjiyan.web.id/storage/...`.
   - **Risk:** If a page on `https://rapi-studio.janjiyan.web.id` loads a logo from `https://janjiyan.web.id/storage/...` without CORS headers and renders it via `html-to-image` or `<canvas>` (e.g., PNG receipts on the public invoice page), the browser can taint the canvas or block font/CSS fetches.
   - **Solution:** Configure `public` disk URL as `'/storage'` (relative path) or ensure Nginx serves `/storage/` and `/build/` directly from every `{slug}.janjiyan.web.id` vhost (with `Access-Control-Allow-Origin` if ever needed across subdomains). Relative `/storage` ensures 100% same-origin loading on both root and tenant subdomains.
2. **Cookies & Session Isolation:**
   - Keep `SESSION_DOMAIN=null` (host-only cookies). Customers visiting `toko-a.janjiyan.web.id` get an isolated session/CSRF cookie scoped strictly to `toko-a.janjiyan.web.id`—no session or CSRF leakage between tenants or the merchant dashboard on `janjiyan.web.id`.
3. **HSTS & HTTPS Requirement (`app/Http/Middleware/SecurityHeaders.php`):**
   - Line 21 already sends `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
   - Because `includeSubDomains` is already enabled in production, browsers that have visited `https://janjiyan.web.id` **require valid HTTPS certificates on every `*.janjiyan.web.id` subdomain**. Wildcard SSL must be active before exposing subdomain URLs in production.
4. **Google OAuth & Mayar Webhooks:**
   - Both remain strictly on the root domain (`https://janjiyan.web.id/auth/google/callback` and `https://janjiyan.web.id/webhooks/mayar`), so existing Google Cloud Console OAuth redirect URIs and Mayar webhook registrations do not need changes.
5. **PWA (`manifest.json` & `sw.js`):**
   - Because `public/manifest.json` uses `"start_url": "/"` and `"scope": "/"`, and `public/sw.js` is a pass-through worker, each subdomain serves its own relative manifest and service worker cleanly.

---

## 6. Production Infrastructure Setup (Cloudflare + SSL + Nginx)

### 6.1 Cloudflare DNS
Add a wildcard DNS record in the Cloudflare dashboard for `janjiyan.web.id`:
- **Type:** `A` (or `CNAME` pointing to `janjiyan.web.id`)
- **Name:** `*`
- **Target / IPv4:** `43.173.21.218`
- **Proxy Status:** Proxied (orange cloud) — Cloudflare Free tier Universal SSL covers first-level wildcards (`*.janjiyan.web.id`).

### 6.2 Wildcard SSL on VPS
HTTP-01 (`certbot --nginx`) cannot issue wildcard (`*.janjiyan.web.id`) certificates. Use one of:
- **Option 1 (Recommended with Cloudflare):** Install **Cloudflare Origin CA Certificate** covering `janjiyan.web.id` and `*.janjiyan.web.id` (valid up to 15 years, zero renewal cron risk) and set Cloudflare SSL/TLS mode to **Full (Strict)**.
- **Option 2:** Use **Certbot DNS-01** via `python3-certbot-dns-cloudflare`:
  ```sh
  certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
    -d janjiyan.web.id \
    -d "*.janjiyan.web.id"
  ```

### 6.3 Nginx Virtual Host (`/etc/nginx/sites-available/janjiyan`)
Update `server_name` to accept both apex and wildcard subdomains, and add an optional `www` redirect block:

```nginx
server {
    listen 80;
    server_name janjiyan.web.id *.janjiyan.web.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name www.janjiyan.web.id;

    ssl_certificate     /etc/ssl/cloudflare/janjiyan.pem;
    ssl_certificate_key /etc/ssl/cloudflare/janjiyan.key;

    return 301 https://janjiyan.web.id$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name janjiyan.web.id *.janjiyan.web.id;

    root /var/www/janjiyan/public;
    index index.php;

    ssl_certificate     /etc/ssl/cloudflare/janjiyan.pem;
    ssl_certificate_key /etc/ssl/cloudflare/janjiyan.key;

    client_max_body_size 10M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.5-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known) {
        deny all;
    }
}
```

---

## 7. Verification & Testing Strategy

1. **Automated Feature Tests (PHPUnit):**
   - Add `tests/Feature/SubdomainRoutingTest.php` covering:
     - Active business accessible at `http://{slug}.{tenant_domain}/` (`200`).
     - Unknown slug returns `404` on subdomain; suspended/inactive business renders `Public/BusinessUnavailable`.
     - Reserved subdomains (`admin`, `www`, `app`, `api`) do not resolve to `PublicBookingController`.
     - Removed `/b/{slug}` path routes return `404` on the root domain.
     - `SettingsController::update` rejects underscores (`my_studio`), >63 char slugs, and reserved slugs (`admin`, `www`).
     - `LandingController::sitemap` outputs subdomain URLs (`{slug}.{tenant_domain}`).
   - Update existing feature tests in `tests/Feature/` that hit `/b/{slug}` directly to use `route('public.booking...', ...)` or subdomain URLs.
2. **E2E Tests (Playwright):**
   - Update `tests/e2e/responsive.spec.ts` and `tests/e2e/v22-flows.spec.ts` to visit `http://{slug}.localhost:8000/...` (matching `APP_TENANT_DOMAIN=localhost`).
3. **Production Post-Deploy Smoke Checks:**
   - Verify `https://janjiyan.web.id` loads Landing & Dashboard.
   - Verify `https://{test-slug}.janjiyan.web.id` loads Public Portal with valid HTTPS cert, images (`/storage/...`), Vite assets (`/build/...`), slot fetching (`/slots`), booking submission (`/book`), and QR PNG download.
   - Verify `https://www.janjiyan.web.id` returns `301` -> `https://janjiyan.web.id/`.

---

## 8. Implementation Checklist

### Phase A: Configuration, Slug Hardening & Model Helpers
- [x] Add `tenant_domain` and `tenant_scheme` to `config/app.php` and `.env.example`.
- [x] Add `Business::RESERVED_SLUGS`, `Business::generateUniqueSlug()`, `Business::publicUrl()`, and `Business::publicReviewUrl()` to `app/Models/Business.php`.
- [x] Refactor `OnboardingController::store` and `BusinessController::store` to use `Business::generateUniqueSlug()`.
- [x] Harden `SettingsController::update` slug validation (RFC 1123 regex, `min:3|max:63`, `Rule::notIn(Business::RESERVED_SLUGS)`).
- [ ] Run DB audit script on production `businesses.slug` before rollout.

### Phase B: Subdomain Routing & Cleanup
- [x] Refactor `routes/web.php` into subdomain tenant group (`{slug}.{tenant_domain}`) and root domain group (`{tenant_domain}`), removing `/b/{slug}` routes completely.
- [x] Update `PublicBookingController.php` and `Dashboard/BookingController.php` review URL fallbacks to use `Business::publicReviewUrl()`.
- [x] Update `config/filesystems.php` `public` disk URL to relative `'/storage'` (prevent cross-origin canvas taint on subdomains).
- [x] Verify Ziggy `@routes` output on both root domain and tenant subdomains.

### Phase C: Frontend & UI Updates
- [x] Share `tenantBaseDomain` (or `public_url` per business) via `HandleInertiaRequests.php`.
- [x] Fix hardcoded `/b/${business.slug}/slots` in `resources/js/pages/Public/BookingPortal.tsx`.
- [x] Update public link display, copy-link, and `<a href>` in `Dashboard/Index.tsx` and `DashboardLayout.tsx`.
- [x] Update `QrPosterDialog.tsx` and `QrReviewStickerDialog.tsx` to use the canonical subdomain URL.
- [x] Update helper/preview text in `Dashboard/Settings/Index.tsx`, `Admin/Index.tsx`, and `Admin/SuspendBusiness.tsx`.

### Phase D: Tests, Documentation & Production Rollout
- [x] Add `tests/Feature/SubdomainRoutingTest.php` and update affected `tests/Feature/*` + `tests/e2e/*` specs.
- [x] Run full verification suite (`php artisan test`, `npm run build`, Playwright E2E).
- [ ] Add Cloudflare wildcard DNS record (`*` -> VPS IP) and Wildcard SSL (Cloudflare Origin CA or Certbot DNS-01).
- [ ] Update Nginx virtual host (`server_name janjiyan.web.id *.janjiyan.web.id;`) and set `APP_TENANT_DOMAIN=janjiyan.web.id` in VPS `.env`.
- [ ] Deploy, run `php artisan optimize`, clear cached `sitemap.xml`, and execute production smoke checks.
