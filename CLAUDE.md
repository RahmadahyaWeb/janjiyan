# Janjiyan — Agent Guidelines & Project Architecture

**Janjiyan** is an all-in-one B2B SaaS appointment booking, drop-off, and counter POS operations platform built for Indonesian service businesses (barbershops, salons, clinics, studios, sports courts, laundry, shoe care, and repair workshops).

---

## 1. Tech Stack

- **Backend:** Laravel 13 (PHP 8.5), Inertia.js v3 (`inertiajs/inertia-laravel`), Laravel Socialite (Google OAuth), Tightenco Ziggy.
- **Database:** SQLite (WAL mode) for local development & tests; PostgreSQL/MySQL compatible migrations and composite indexes for production.
- **Frontend:** React 19 + TypeScript 7, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (Radix UI primitives), Lucide React icons, `date-fns`.
- **Print, Export & QR:** `react-to-print` v3+ (`58mm`/`80mm` thermal receipts & drop-off item tags), `html-to-image` (WhatsApp PNG receipts), `qrcode` (printable posters, invoice QR, and review stickers).
- **Testing & QA:** PHPUnit 12 (`php artisan test`), Laravel Pint (`./vendor/bin/pint`), TypeScript (`npm run typecheck`), Playwright E2E (`npx playwright test`).

---

## 2. Primary Documentation (Read First)

Before planning or modifying features, consult the canonical documentation in `docs/` and root:

1. [`docs/PRD.md`](docs/PRD.md) — Product requirements, user stories, domain models, and technical specifications (v2.1 baseline + v2.2 multi-service cart, service add-ons, cashier settlement ledger, thermal receipts, and Google Maps review flow).
2. [`docs/subdomain-tenant-architecture.md`](docs/subdomain-tenant-architecture.md) — **CRITICAL:** Public tenant portals use wildcard subdomains (`{slug}.{tenant_domain}`), NOT legacy `/b/{slug}` paths.
3. [`docs/business-type-architecture.md`](docs/business-type-architecture.md) — Rules and adaptive Indonesian copywriting matrix for the 3 permanently locked business types (`staff_appointment`, `space_booking`, `dropoff`).
4. [`docs/ui-pages.md`](docs/ui-pages.md) — Complete inventory of Inertia/React pages (`resources/js/Pages/`) and Blade views mapped to routes.
5. [`design.md`](design.md) — Mobbin-inspired Gallery-White Minimal design system tokens, typography, and component geometry.
6. [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md) — Production deployment, security, queue, scheduler, and wildcard SSL checklist.

---

## 3. Core Architecture & Domain Invariants

### 3.1 Wildcard Subdomain Multi-Tenancy (`{slug}.{tenant_domain}`)
- **Root Domain (`config('app.tenant_domain')`, e.g., `janjiyan.web.id` or `localhost`):** Serves marketing landing (`/`), legal (`/terms`, `/privacy`), auth (`/login`, `/register`, `/auth/google/*`), merchant dashboard (`/dashboard/*`), superadmin panel (`/admin/*`), and payment webhooks (`/webhooks/mayar`).
- **Tenant Subdomain (`{slug}.{tenant_domain}`, e.g., `rapi-studio.localhost:8000` or `rapi-studio.janjiyan.web.id`):** Serves public business home (`/`), booking portal (`/pesan`, `/slots`, `/book`), invoices & calendar export (`/invoice/{token}`, `/invoices`, `/booking/{code}`), and public review flow (`/review`).
- **URL Construction:** Legacy `/b/{slug}` routes are removed. Always generate public tenant URLs via `Business::publicUrl()` and `Business::publicReviewUrl()` on the backend, or `business.public_url` / `business.public_review_url` props on the frontend. Never hardcode `/b/${slug}`.
- **Slug Safety:** Business slugs must pass `Business::SLUG_REGEX` (DNS label format) and must not collide with `Business::RESERVED_SLUGS`.
- **Tenant Data Isolation:** Every dashboard controller and service query must explicitly scope records to the authenticated user's active `business_id`.

### 3.2 Three Permanently Locked Business Types (`business.business_type`)
Every `Business` selects an immutable `business_type` during onboarding (`/dashboard/onboarding`) or creation (`/dashboard/businesses/create`). `ServiceController` enforces `booking_mode` and `assignment_mode` server-side from `$business->business_type`:
1. `staff_appointment` (`time_slot` + `staff`): Supports per-staff operating hours (`StaffOperatingHour`), leave/time-off (`StaffTimeOff`), service-staff assignments, and staff commissions (`/dashboard/commissions`).
2. `space_booking` (`time_slot` + `capacity`): Capacity-based slot booking (courts, studios, classes). Hides personal staff shift schedules and commission menus (`403` guarded) while keeping team login access (**Tim & Admin**).
3. `dropoff` (`dropoff` + `capacity`): Daily item quota (`unit_label`: `item`, `pasang`, `kg`, `pcs`, `unit`), turnaround estimate (`turnaround_days`), optional pick-up/delivery (`supports_pickup`), multi-service cart checkout, and Work-Status Queue Tabs (`awaiting_dropoff`, `in_progress`, `ready_for_pickup`, `picked_up`).

### 3.3 Concurrency, Booking Items & Cashier Ledger Integrity
- **Slot & Quota Locking (`app/Services/SlotAvailabilityService.php`):** All booking creations and reschedules run inside `DB::transaction()` using pessimistic locking (`lockForUpdate()`). For multi-service `dropoff` orders, lock `services` rows **ordered by `id` ascending** to prevent deadlocks, and sum `booking_items.quantity` against daily capacity.
- **Line Item Snapshots (`BookingItem`):** Every booked primary service and `ServiceAddon` is snapshotted into `booking_items` (`name_snapshot`, `unit_label_snapshot`, `unit_price`, `quantity`, `duration_minutes_snapshot`, `turnaround_days_snapshot`, `is_commissionable`, `subtotal`) so historical invoices and commissions never drift when master prices change.
- **Cashier Payment Ledger (`app/Services/BookingLedgerService.php` & `BookingPayment`):** All payment events (DP verification, walk-in initial payments, counter settlements, item adjustments) are recorded in `booking_payments` (`cash`, `qris`, `transfer`, `edc`). `bookings.paid_amount` is atomically recomputed from `SUM(booking_payments.amount)` inside a transaction, enforcing `payment_status = 'settled'` when `paid_amount >= total_price` and `'dp_verified'` when `0 < paid_amount < total_price`.
- **Staff Commissions (`app/Services/StaffCommissionService.php`):** Calculated and snapshotted onto `bookings.commission_amount` from the primary service plus `is_commissionable` items only.

### 3.4 RBAC, Plan Limits & Subscription Soft-Lock
- **Team RBAC (`BusinessUser` pivot):** Roles (`owner`, `admin`, `staff`) with granular permissions (`manage_bookings`, `verify_payments`, `manage_services`, `manage_staff`, `manage_settings`).
- **SaaS Plans & Soft-Lock (`app/Services/PlanLimitService.php`):** Enforces Basic, Professional, and Enterprise limits (plus 14-day Trial on Professional). Expired subscriptions or suspended businesses are blocked on mutating routes by the `writable.subscription` middleware. SaaS billing integrates with **Mayar** (`MayarService` & `/webhooks/mayar`).

---

## 4. Key Services & Directory Structure

- `app/Http/Controllers/PublicBookingController.php` & `PublicReviewController.php` — Public tenant subdomain endpoints.
- `app/Http/Controllers/Dashboard/` — Authenticated merchant dashboard controllers.
- `app/Http/Controllers/Admin/AdminController.php` — Platform superadmin panel (`/admin`).
- `app/Services/`
  - `SlotAvailabilityService.php` — Real-time slot & daily drop-off quota engine, atomic booking creation, and rescheduling.
  - `BookingLedgerService.php` — Counter item adjustments, payment ledger entries (`booking_payments`), and payment status invariants.
  - `StaffCommissionService.php` — Commission calculation and reporting.
  - `PlanLimitService.php` & `SubscriptionActivationService.php` — SaaS plan quotas, feature gates (`can_use_google_review`, `max_addons_per_business`), and trial/subscription activation.
  - `MayarService.php` — Mayar payment gateway checkout and server-to-server invoice verification.
  - `BookingNotificationService.php`, `InAppNotificationService.php`, `TelegramNotificationService.php` — Email, in-app, and queued encrypted Telegram notifications (`SendTelegramBookingAlertJob`).
  - `IcsCalendarService.php` — RFC 5545 `.ics` calendar feed generation.
- `resources/js/Pages/` — Inertia React page components (`Landing.tsx`, `Public/*`, `Auth/*`, `Dashboard/*`, `Admin/*`, `Legal/*`).
- `resources/js/Components/` — Shared UI primitives, dialogs (`QrPosterDialog.tsx`, `QrReviewStickerDialog.tsx`), and print sheets (`ReceiptPrintSheet.tsx`).

---

## 5. Design System & UI Standards (`design.md`)

- **Aesthetic:** Mobbin Gallery-White Minimal — pure white canvas (`#ffffff`), neutral bone tint (`#f3f3f3`) for structure instead of heavy drop shadows, near-black primary ink (`#141414`), and electric blue (`#0066ff`) reserved for commercial accents.
- **Geometry & Typography:** Stadium-pill buttons and nav pills (`rounded-full` / `9999px`), card radius `16px`–`24px`, Inter sans-serif UI copy + Geist Mono for codes, timestamps, and tabular numbers (`tabular-nums`).
- **Print & Canvas Safety:** Components rendered via `html-to-image`, HTML Canvas, or `react-to-print` (`ReceiptPrintSheet`, `QrPosterDialog`, `QrReviewStickerDialog`) must use explicit hex colors and system/loaded fonts (avoid Tailwind v4 `oklch()` CSS variables inside isolated print/canvas DOM trees) and `crossOrigin="anonymous"` on images for WebKit/Safari compatibility.
- **Language Convention:** All end-user and merchant UI copy is in **Bahasa Indonesia** (adapting terms to `business_type`), while all source code, identifiers, comments, and technical documentation in `docs/` are in **English**.

---

## 6. Verification & Development Commands

Always run verification checks before concluding code changes:

```bash
# Run PHPUnit feature and unit test suite
php artisan test

# Run TypeScript static typecheck
npm run typecheck

# Check PHP code style with Laravel Pint
./vendor/bin/pint --test

# Build frontend assets with Vite
npm run build

# Run Playwright E2E tests (when modifying critical UI flows)
npx playwright test
```
