# Janjiyan Production Readiness & Deployment Checklist

> **Target Infrastructure:** Linux VPS (Nginx + PHP-FPM 8.3+ + MySQL/PostgreSQL)  
> **Scope:** Security hardening, functional completeness, legal/SEO readiness, monetization, and server deployment.  
> **Reference PRD:** [`docs/PRD.md`](./PRD.md)

---

## Progress Summary

- **Phase 0 (Completed):** Demo removal, local runtime cleanup, and production billing simulation guard.
- **Phase 1 (Completed):** Critical security & authorization fixes (must-fix before public launch).
- **Phase 2 (Completed):** Core auth, business CRUD, and validation/quota gaps.
- **Phase 3 (Completed):** Custom error pages, favicon/SEO metadata, and legal pages (required for Google OAuth).
- **Phase 4 (Completed):** SaaS monetization (Mayar API v2 + double-verified webhook), trial/subscription expiry soft-lock, superadmin web panel (`/admin`), and public hashed customer invoice tracking (`/b/{slug}/invoice/{token}`).
- **Phase 5 (Pending):** VPS provisioning, environment setup, scheduler cron, and post-deploy smoke tests.

---

## Phase 0: Completed Cleanup & Baseline Guards

- [x] Remove demo credentials box (`demo@janjiyan.com`) permanently from `app/Http/Controllers/Auth/AuthController.php` and `resources/js/pages/Auth/Login.tsx`.
- [x] Remove hardcoded `/b/barber-rapi` demo links from hero and footer in `resources/js/pages/Landing.tsx`.
- [x] Replace demo slug preview (`barber-rapi`) with generic placeholder (`studio-anda`) in `resources/js/components/AuthShowcasePanel.tsx`.
- [x] Strip all demo user, business, service, gallery, and booking seeders from `database/seeders/DatabaseSeeder.php` (retaining only `SubscriptionPlanSeeder`).
- [x] Remove `demo/` path special-cases in `SettingsController.php`, `GalleryController.php`, and `ServiceController.php`, and delete `storage/app/public/demo/`.
- [x] Block simulated plan switching (`BillingController::switchPlan`) with HTTP `403` and disable simulation UI (`resources/js/pages/Dashboard/Billing/Index.tsx`) when `APP_ENV=production`.
- [x] Refactor `tests/Feature/JanjiyanBookingTest.php` to use self-contained test fixtures and add `tests/Feature/ProductionSafetyTest.php`.
- [x] Delete local runtime artifacts (`public/hot`, `.phpunit.result.cache`, `.DS_Store`, `storage/logs/laravel.log`, `storage/inertia-devtools/*.json`) and default Playwright boilerplate (`e2e/example.spec.ts`, `.github/workflows/playwright.yml`).
- [x] Remove seeded demo records from local `database/database.sqlite` while preserving `subscription_plans`.

---

## Phase 1: Critical Security & Authorization (Must-Fix Before Public Launch)

- [x] **Fix Staff Login Linking / Account Takeover (`app/Http/Controllers/Dashboard/StaffController.php`)**
  - Prevent `User::firstOrCreate(['email' => ...])` from silently attaching existing unrelated user accounts to a business without consent/invitation.
  - Require an explicit password when creating a new staff login account (remove the hardcoded `'password123'` fallback), or implement an email invitation / password setup token flow.
- [x] **Add Route Rate Limiting (`routes/web.php`)**
  - Apply `throttle` middleware on `POST /login` and `POST /register` to mitigate brute-force and spam registration.
  - Apply `throttle` middleware on public booking endpoints (`GET /b/{slug}/slots`, `POST /b/{slug}/book`, `POST /b/{slug}/booking/{code}/proof`) to prevent slot-exhaustion abuse and storage flooding.
- [x] **Enforce Missing Dashboard Permissions (`BookingController.php` & `CustomerController.php`)**
  - Check `$user->hasBusinessPermission($business, 'verify_payments')` (or `'manage_bookings'`) inside `BookingController::proof`.
  - Check explicit export/admin permissions inside `BookingController::exportCsv` and `CustomerController::exportCsv`.
- [x] **Prevent CSV Formula Injection (`BookingController::exportCsv` & `CustomerController::exportCsv`)**
  - Sanitize/prefix exported string fields starting with `=`, `+`, `-`, `@`, `\t`, or `\r` before passing to `fputcsv`.
- [x] **Mask Sensitive Customer Data on Public Status Page (`app/Http/Controllers/PublicBookingController.php`)**
  - Mask `customer_phone` (e.g., `62812****890`) in `PublicBookingController::status` so publicly accessible `/b/{slug}/booking/{code}` URLs do not expose full phone numbers.
- [x] **Prevent Stale/Duplicate DP Proof Uploads (`app/Http/Controllers/PublicBookingController.php`)**
  - Reject `uploadProof` when `$booking->dp_expires_at?->isPast()` (even before the 1-minute scheduler runs).
  - Delete any previous `$booking->dp_proof_path` from `Storage::disk('local')` when a customer uploads a replacement proof.
- [x] **Configure Reverse Proxy Trust (`config/app.php` & `app/Providers/AppServiceProvider.php`) — *If behind Cloudflare / Load Balancer***
  - Configure `TrustProxies::at(...)` cleanly via `config('app.trusted_proxies')` / `TRUSTED_PROXIES` env so client IPs (for rate limiting) and `https` scheme detection work reliably even with `config:cache`.

---

## Phase 2: Core Auth, Business CRUD & Validation Gaps

- [x] **Implement Forgot Password & Reset Password Flow**
  - Add password reset request, email notification, and reset form routes/controllers/Inertia pages (`PasswordResetController.php`, `Auth/ForgotPassword.tsx`, `Auth/ResetPassword.tsx`) matching `docs/PRD.md` Story 2.1.
  - Add links from `resources/js/pages/Auth/Login.tsx` to the forgot-password page.
- [x] **Implement User Profile & Change Password Page**
  - Allow authenticated users to update their name, email, and password from `Dashboard/Profile/Index.tsx` (`ProfileController.php`) linked from `DashboardLayout.tsx`.
- [x] **Implement Email Verification & Production Mailer**
  - Document production SMTP/Resend/Postmark options in `.env.example`.
  - Enforce `MustVerifyEmail` + `verified` middleware on `/dashboard` (`EmailVerificationController.php`, `Auth/VerifyEmail.tsx`), while auto-verifying Google OAuth and owner-created staff accounts.
- [x] **Complete Staff & Settings CRUD**
  - Add `StaffController::update` + edit modal in `resources/js/pages/Dashboard/Staff/Index.tsx` (update name, title, phone, active status, role, and permissions).
  - Add `remove_qris` handling and `is_active` portal toggle in `SettingsController::update` and `resources/js/pages/Dashboard/Settings/Index.tsx`.
  - Add permanent business deletion (`DashboardController::destroyBusiness`) with exact business-name confirmation modal in `Settings/Index.tsx`.
- [x] **Support Manual / Walk-In Booking Creation in Dashboard**
  - Allow merchants/staff to create reservations directly from `Dashboard/Bookings/Index.tsx` (`BookingController::slots` & `BookingController::store`) using the atomic slot engine with selectable initial payment status (`unpaid`, `dp_verified`, `settled`).
- [x] **Enforce Operating Hours & Break Time Validation (`app/Http/Controllers/Dashboard/ScheduleController.php`)**
  - Validate that `close_time` is after `open_time` when `is_open` is `true`, and `break_end` is after `break_start` (and within operating hours) when provided, with break time inputs and per-day errors in `Schedule/Index.tsx`.
- [x] **Enforce `max_customers_per_business` Quota (`app/Services/PlanLimitService.php` & `SlotAvailabilityService.php`)**
  - Implement `canCreateCustomer` checking consistent with `SubscriptionPlan::$max_customers_per_business` when creating new customer records.

---

## Phase 3: UI Polish, Error Handling, SEO & Legal Compliance

- [x] **Add Favicon & Web App Icons (`public/` & `resources/views/app.blade.php`)**
  - Replace the empty 0-byte `public/favicon.ico` and generate `favicon.svg`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, and `og-default.png` derived from the refined `JanjiyanLogo` mark.
- [x] **Add Meta Description & Open Graph Tags (`resources/views/app.blade.php` & Controllers)**
  - Add server-rendered `<meta name="description">`, `og:title`, `og:description`, `og:image`, and Twitter Card tags, plus dynamic business metadata for `/b/{slug}` and `/b/{slug}/booking/{code}` shares.
- [x] **Create Custom Error Pages (`404`, `403`, `419`, `500`, `503`)**
  - Render standalone Indonesian error views (`resources/views/errors/layout.blade.php` and `403`/`404`/`419`/`500`/`503.blade.php`) with Janjiyan branding and clear recovery actions.
- [x] **Add Legal Pages (Terms of Service & Privacy Policy)**
  - Create `/terms` (`Legal/Terms.tsx`) and `/privacy` (`Legal/Privacy.tsx`) via `LegalController.php` and `PublicLegalLayout.tsx`, linked from `Landing.tsx` footer and `Register.tsx`.
  - *Note: Required for Google Cloud Console OAuth consent screen verification in production.*
- [x] **Document Complete `.env.example`**
  - Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `SESSION_SECURE_COOKIE` placeholders and set `APP_NAME=Janjiyan`.

---

## Phase 4: SaaS Monetization, Trial Expiry & Platform Admin

- [x] **Enforce Subscription & Trial Expiry (`app/Services/PlanLimitService.php`, `app/Models/Subscription.php` & `app/Http/Middleware/EnsureWritableSubscription.php`)**
  - Enforce soft-lock when `trial_ends_at` or `current_period_ends_at` has passed: dashboard remains readable for history/billing renewal while write operations, CSV export, and new public bookings are blocked with a clear renewal banner.
- [x] **Implement Subscription Payment Flow (Mayar Headless API v2)**
  - Added `subscription_invoices` table, `MayarService` (`/hl/v2/invoice/create` & `/hl/v2/invoices/{id}`), monthly/yearly billing toggle on `Dashboard/Billing/Index.tsx`, `POST /webhooks/mayar` with token + server-to-server verification & idempotency, and `SubscriptionActivatedNotification` email confirmation.
- [x] **Build Internal Superadmin Web Panel & CLI Command (`AdminController.php` & `Admin/Index.tsx`)**
  - Added `is_superadmin`, `php artisan janjiyan:make-superadmin {email}`, and `/admin` dashboard to inspect merchants/invoices, extend trials, activate plans manually, and suspend/unsuspend businesses (`Public/BusinessUnavailable.tsx`).
- [x] **Customer Public Invoice & History Lookup (`PublicBookingController.php`, `BookingStatus.tsx` & `Public/InvoiceLookup.tsx`)**
  - Added unique `invoice_number` and randomized 32-char `invoice_token` for `/b/{slug}/invoice/{token}` URLs plus rate-limited `/b/{slug}/invoices` customer lookup (invoice/booking code + last 4 phone digits).
- [ ] **Optional v1.1 Enhancements**
  - Automated WhatsApp Business API booking confirmations, payment verification notices, and H-1 / H-2h reminders.

---

## Phase 5: VPS Deployment & Post-Deploy Verification (Nginx + PHP-FPM + MySQL/PostgreSQL)

- [ ] **Initialize Git Repository & Clean Commit History**
  - Run `git init`, verify `.gitignore` excludes `.env`, `vendor/`, `node_modules/`, `database/*.sqlite*`, `storage/logs/*`, and `public/hot`.
- [ ] **Provision VPS Software Stack**
  - Install PHP 8.3+ with required extensions (`pdo_mysql`/`pdo_pgsql`, `mbstring`, `xml`, `ctype`, `fileinfo`, `openssl`, `tokenizer`, `curl`, `zip`, `bcmath`, `gd`/`imagick`), Composer, Node.js, Nginx, and MySQL/PostgreSQL.
  - Create dedicated production database and user.
- [ ] **Configure Nginx Virtual Host & SSL**
  - Point `root` to `/path/to/janjiyan/public`.
  - Route requests with `try_files $uri $uri/ /index.php?$query_string;`.
  - Set `client_max_body_size 10M;` (must exceed the 5MB DP proof upload limit).
  - Provision HTTPS certificate via Certbot / Let's Encrypt.
- [ ] **Deploy Application & Run Production Commands**
  - Configure `.env` (`APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://...`, `SESSION_SECURE_COOKIE=true`, DB & Mail credentials, and optional Google OAuth credentials).
  - Run:
    ```sh
    composer install --no-dev --optimize-autoloader
    npm ci && npm run build
    php artisan key:generate --force # only on initial deploy
    php artisan migrate --force
    php artisan db:seed --class=SubscriptionPlanSeeder --force
    php artisan storage:link
    php artisan optimize
    ```
  - Ensure `www-data` owns/has write permissions on `storage/` and `bootstrap/cache/`.
- [ ] **Configure Cron Scheduler (`bookings:expire-unpaid`)**
  - Add crontab entry so `routes/console.php` runs every minute:
    ```cron
    * * * * * cd /path/to/janjiyan && php artisan schedule:run >> /dev/null 2>&1
    ```
- [ ] **Run Post-Deploy Smoke Checks**
  - Verify `/` renders without Vite `localhost` references or console errors.
  - Verify `/register`, `/login`, and Google OAuth (if enabled) work over HTTPS and demo credentials are absent.
  - Verify `/dashboard/billing` blocks plan simulation (`403`) and shows the non-simulation notice.
  - Create a test business, upload logo/QRIS/service image (verifying `public/storage` symlink works), submit a public booking at `/b/{slug}` with DP proof upload, verify DP in dashboard, and confirm `schedule:run` expires unpaid bookings after deadline.
  - Verify backups (daily DB dump + `storage/app/` backup) and log rotation.
