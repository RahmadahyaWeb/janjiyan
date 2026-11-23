# Product Requirements Document (PRD): Janjiyan

> **Version:** 2.2.0  
> **Date:** 2026-11-23  
> **Status:** Active (v2.1 Implemented Baseline + v2.2 Approved Feature Blueprint)  
> **Tech Stack:** Laravel 13 (PHP 8.5) + Inertia.js v3 + React 19 (TypeScript) + Tailwind CSS v4 + shadcn/ui + SQLite (WAL) / PostgreSQL-ready  
> **Design System:** Mobbin-inspired Gallery-White Minimal ([design.md](../design.md))

---

## 1. Executive Summary

### Problem Statement
Indonesian service-based businesses (barbershops, salons, clinics, studios, sports courts, laundry, shoe care, and workshops) still rely heavily on manual WhatsApp chats, social media DMs, separate POS/paper receipt books, and fragmented spreadsheets to schedule appointments, verify down payments (*Uang Muka* / DP), record final settlements, track staff commissions, collect Google Maps reviews, and manage repeat no-shows. This creates administrative overhead, frequent double-bookings, unverified payment disputes, and lost leads when customers have to wait for manual replies.

### Proposed Solution
**Janjiyan** is an all-in-one B2B SaaS appointment booking, drop-off, and counter operations platform featuring:
- A frictionless, no-login public booking portal (`/b/{slug}`) adapted to three locked operational business types (`staff_appointment`, `space_booking`, `dropoff`), with real-time slot & daily quota engines, portfolio gallery, brand color/cover customization, invoice lookup, and Add-to-Calendar (`.ics` & Google Calendar).
- Direct-to-merchant Uang Muka (DP) verification (0% transaction fee) with pay-later auto-expiry and automatic **No-Show Uang Muka Protection**.
- Multi-business merchant dashboard with Calendar & List views (or Work-Status Queue Tabs for `dropoff`), walk-in booking, rescheduling, per-staff shift/time-off schedules, customizable **1-click WhatsApp templates**, **printable QR poster generator**, **encrypted async Telegram Bot alerts**, **staff commission reporting**, and **CRM tagging/aliasing/merging/blocking**.
- Built-in SaaS monetization via **Mayar** payment gateway + webhooks, subscription soft-lock enforcement, and a **Superadmin Panel**.
- **[Planned — v2.2]** Multi-service cart & service add-ons, integrated **Cashier Settlement & Thermal/PNG Receipt Printing (`58mm`/`80mm` + Drop-off Tags)**, and **Smart Google Maps Review Redirect + Printable QR Review Stickers**.

### Success Criteria (KPIs)
1. **Booking Completion Speed:** End customers can complete a service booking (from landing on `/b/{slug}` to confirmation) in **<= 60 seconds** without account registration.
2. **Slot Availability Latency:** The real-time slot calculation endpoint returns available time slots in **<= 200ms** (p95) for a 30-day schedule window.
3. **Zero Double-Booking & Overbooking:** Atomic database locking ensures **0 concurrent double-bookings** across overlapping staff/capacity slots and **0 daily quota overflows** on multi-item drop-off orders.
4. **Merchant Onboarding Time:** A new merchant can register, select a locked `business_type`, configure 1 business + 1 service + operating hours, and obtain a live `/b/{slug}` link + printable QR poster in **< 5 minutes**.
5. **Accessibility & UI Compliance:** Public pages (Landing & Public Booking Portal) achieve **>= 95 Lighthouse Accessibility score** and **100% token adherence** to `design.md`.

---

## 2. User Experience & Functionality

### User Personas
1. **Business Owner (Merchant Owner):** Manages 1 to 10 service businesses across locked operational types, configures pricing/services/add-ons/Uang Muka rules/WhatsApp templates/Telegram alerts/no-show policies/Google review redirects, monitors cashflow & staff commissions, and manages subscription billing.
2. **Staff / Admin / Cashier (Merchant Team):** Handles daily reservation operations (Calendar/List/Work Queue), walk-in bookings, reschedules, verifies manual Uang Muka proofs, collects in-person settlements, prints thermal receipts & item tags, updates reservation/work statuses, exports personal `.ics` schedules, and manages customers within scoped RBAC permissions.
3. **End Customer (Client):** Discovers the merchant via Instagram/TikTok bio, WhatsApp, or printed QR poster, books an available slot or drop-off order on mobile without creating an account, uploads Uang Muka proof before expiry, tracks order/work progress, saves appointments to Google/Apple Calendar, looks up past invoices by phone number, and submits post-service feedback / Google Maps reviews via QR sticker or invoice link.
4. **Platform Superadmin:** Monitors SaaS merchants, subscription revenue, extends trials, activates plans manually, and suspends/unsuspends non-compliant businesses.

### Implemented User Stories & Acceptance Criteria (v2.1 Baseline)

#### Epic 1: Marketing Landing Page, Legal & Conversion
- **Story 1.1:** As a prospective merchant, I want to understand Janjiyan's value proposition, supported business types (`staff_appointment`, `space_booking`, `dropoff`), workflow, pricing tiers, legal terms, and FAQs on a clean landing page so I can start my 14-day free trial.
  - **Acceptance Criteria:**
    - Follows `design.md` strictly: `#ffffff` canvas, `#141414` ink, `#f3f3f3` bone tint, `#0066ff` electric blue accents, `9999px` stadium-pill buttons/nav, Inter + Geist Mono typography, and inverse `#141414` rounded-top footer.
    - Displays all 3 pricing plans (**Basic** Rp 49.000/mo, **Professional** Rp 129.000/mo, **Enterprise** Rp 249.000/mo) with monthly/yearly toggle and 14-day free trial CTA.
    - Includes interactive FAQ accordion, workflow breakdown in Indonesian copy, plus public `/terms`, `/privacy`, and `/sitemap.xml`.

#### Epic 2: Authentication, Verification & Locked Business Onboarding
- **Story 2.1:** As a merchant owner, I want to sign up, verify my email, manage my profile/password, and log in using Email & Password or Google OAuth.
  - **Acceptance Criteria:**
    - `/register` collects account credentials (`name`, `email`, `password`, `password_confirmation`) only; Google OAuth does not auto-provision placeholder businesses.
    - Supports email verification (`/email/verify`), password reset, profile & password management (`/dashboard/profile`), and Google OAuth via Laravel Socialite with account pre-hijack protection.
    - New accounts automatically start a **14-day free trial** on the Professional plan.
- **Story 2.2:** As a merchant owner, I want to complete post-verification onboarding by choosing a permanently locked `business_type`, and create/switch/delete isolated businesses under one account.
  - **Acceptance Criteria:**
    - Verified owners without a business are routed via `EnsureBusinessOnboarded` middleware to `/dashboard/onboarding` to pick one of 3 permanently locked business types (`staff_appointment`, `space_booking`, `dropoff`), category preset, name, and optional phone/address; invited staff/admin accounts bypass owner onboarding and land directly in their assigned business dashboard.
    - Dashboard includes a Business Switcher scoped to the authenticated user's businesses (Basic 1, Pro 3, Enterprise 10), strictly isolated by `business_id`.
    - Each business generates a customizable `/b/{slug}` link, supports `brand_color` & `cover_path` customization, and provides an on-demand **Printable QR Code Poster** (`QrPosterDialog`: HD PNG 1200×1600, QR-only PNG, A5 print layout, customizable `qr_poster_subtitle`).

#### Epic 3: Business-Type-Adapted Services, Schedules, Staff Shifts & Portfolio
- **Story 3.1:** As a business owner, I want services, schedules, and UI terminology to adapt automatically to my locked `business_type`.
  - **Acceptance Criteria:**
    - Server-side `ServiceController` enforces `booking_mode` and `assignment_mode` from `$business->business_type` (`staff_appointment` -> `time_slot` + `staff`; `space_booking` -> `time_slot` + `capacity`; `dropoff` -> `dropoff` + `capacity`), preventing client-side tampering.
    - Supports per-day business operating hours (open/close + break time + active toggle), specific holiday dates, `min_booking_lead_minutes`, and `max_booking_advance_days`.
    - `staff_appointment` businesses configure per-staff custom operating hours (`StaffOperatingHour`) and leave/time-off ranges (`StaffTimeOff`); `space_booking` and `dropoff` hide personal staff schedules and commission menus (`403` guarded) while retaining team login management (**Tim & Admin**).
    - `dropoff` services support selectable `unit_label` (`item`, `pasang`, `kg`, `pcs`, `unit`), turnaround estimate (`turnaround_days`), daily item quota (`capacity`), and optional Pick-up & Delivery toggle (`supports_pickup`).
    - Business Portfolio Gallery (`BusinessGallery`, up to 12 photos with captions) displayed on `/b/{slug}`.
    - Enforces plan limits on max services per business (Basic 5, Pro 10, Enterprise Unlimited).

#### Epic 4: Frictionless Public Booking Engine, Invoices & Calendar Export (`/b/{slug}`)
- **Story 4.1:** As an end customer, I want to browse services and portfolio photos, pick a staff member (when applicable) or available slot/drop-off date, and submit my booking without registering.
  - **Acceptance Criteria:**
    - Mobile-first UI following `design.md` strictly, with named rate limiters (`public-slots`, `public-booking`, `public-dp-proof`, `public-invoice-lookup`, `public-booking-status`).
    - `SlotAvailabilityService` handles both `time_slot` services and `dropoff` daily quota services (`SUM(quantity)` vs `capacity`, `estimated_ready_date` calculation across open operating days, multi-item `quantity` 1–50, optional `pickup` session + address) inside `DB::transaction()` + `lockForUpdate()`.
    - Captures `booked_customer_name` and `booked_customer_email` snapshots per booking without overwriting existing customer records blindly.
    - Enforces **No-Show Protection**: blocked customers (`is_blocked = true`) are rejected cleanly; repeat no-shows meeting `no_show_dp_threshold` automatically require **100% Uang Muka** when `no_show_require_full_dp` is enabled (hidden for `dropoff` where not applicable).
- **Story 4.2:** As an end customer, I want a secure invoice page to upload Uang Muka proof, look up past invoices, track drop-off work progress, and save appointments to my calendar.
  - **Acceptance Criteria:**
    - Displays merchant bank accounts and/or static QRIS image clearly.
    - **Immediate Upload:** Receipt image (`jpg/png/webp`, max 5MB) -> `reservation_status = pending`, `payment_status = waiting_verification`.
    - **Pay Later:** `payment_status = unpaid` with `dp_expires_at` (configurable, default 2h) and unique secret token URL (`/b/{slug}/invoice/{token}`).
    - **Auto-Expiry:** Scheduled command `bookings:expire-unpaid` runs every minute to cancel expired `unpaid` bookings (`cancellation_reason = dp_expired`), releasing the slot/quota.
    - **Invoice Lookup & Calendar:** Phone-based lookup at `/b/{slug}/invoices`; active invoice pages provide **Google Calendar** deep-link, RFC 5545 **`.ics` download**, `window.print()` invoice printing, and pre-filled `wa.me` confirmation.

#### Epic 5: Merchant Reservation Operations, WhatsApp Templates & Notifications
- **Story 5.1:** As a merchant or staff member, I want to manage bookings in List, Calendar, or Drop-off Work-Status Queue views, create walk-in bookings, reschedule, verify Uang Muka proofs, and message customers via 1-click WhatsApp templates.
  - **Acceptance Criteria:**
    - Supports **List View** (search + status/payment/staff/service/date filters), **Calendar View** (`staff_appointment` & `space_booking`), and **Work-Status Queue Tabs** (`awaiting_dropoff`, `in_progress`, `ready_for_pickup`, `picked_up` for `dropoff`).
    - Supports manual **Walk-in Booking** creation (with customer autocomplete lookup) and atomic **Rescheduling** (`rescheduled_count` tracking + automatic reminder reset).
    - **1-Click Customizable WhatsApp Templates:** Per-business templates (`reminder`, `dp_verified`, `confirmed`, `ready_for_pickup`, `follow_up`) tailored by `business_type` with live preview in Settings.
    - Enforces monthly booking quota per plan (Basic 100/mo, Pro 500/mo, Enterprise Unlimited).
- **Story 5.2:** As a merchant, I want automated customer email reminders and instant merchant alerts via Email and Telegram Bot.
  - **Acceptance Criteria:**
    - `bookings:send-reminders` runs every 5 minutes for H-1 day (23–25h prior) and H-2 hour (105–135m prior, omitted for `dropoff`) email reminders with atomic deduplication (`reminder_h1_sent_at`, `reminder_h2_sent_at`).
    - Owner and assigned staff receive email alerts on new public bookings and Uang Muka proof uploads.
    - **Instant Telegram Bot Alerts:** Encrypted `telegram_bot_token`, dispatched asynchronously via `SendTelegramBookingAlertJob` (`ShouldQueue`, 3 retries with backoff, 5s timeout, HTML-escaped) with a rate-limited **"Send Test Message"** button.

#### Epic 6: Advanced CRM, Team RBAC, Staff Commissions & Analytics
- **Story 6.1:** As a merchant, I want a Customer Directory (CRM) with detail pages, alias protection, profile merging, internal notes, custom tags, and online-booking block controls.
  - **Acceptance Criteria:**
    - Scoped to `business_id` keyed by normalized phone, tracking `name_aliases` when different names book with the same phone, plus customer autocomplete (`/dashboard/customers/lookup`) and manual profile merge (`/dashboard/customers/{customer}/merge`).
    - Supports internal notes, up to 10 tags, `is_blocked` toggle, segment filtering (`all`, `vip`, `repeat`, `has_no_show`, `blocked`), sorting, and formula-safe CSV export.
- **Story 6.2:** As a business owner, I want to manage staff/team accounts with RBAC, export staff `.ics` calendars, and track staff commissions automatically.
  - **Acceptance Criteria:**
    - Team roles (`owner`, `admin`, `staff`) with granular permissions (`manage_bookings`, `verify_payments`, `manage_services`, `manage_staff`, `manage_settings`).
    - Authenticated staff `.ics` calendar export and dedicated **Staff Commission Report** (`/dashboard/commissions`) with CSV export for `staff_appointment` businesses (Pro/Enterprise).
- **Story 6.3:** As a business owner, I want dashboard analytics and formula-safe CSV exports.
  - **Acceptance Criteria:**
    - Overview displays today's bookings, pending verifications, monthly revenue, weekly trend, and top services (hiding financial/setup cards for non-managing staff).
    - CSV exports use `CsvHelper::sanitizeRow()` and are gated to **Professional** and **Enterprise** plans.

#### Epic 7: SaaS Monetization (Mayar), Soft-Lock & Superadmin Panel
- **Story 7.1:** As a business owner, I want to monitor my plan usage, pay for subscriptions via Mayar, and view invoice history.
  - **Acceptance Criteria:**
    - `/dashboard/billing` displays real-time usage meters and `SubscriptionInvoice` history, integrating **Mayar** (`MayarService`, `POST /dashboard/billing/checkout`, `POST /webhooks/mayar` with server-to-server verification, and manual invoice check).
    - Expired subscriptions or suspended businesses trigger **Soft-Lock** (`writable.subscription` middleware).
- **Story 7.2:** As a platform superadmin, I want an admin panel to manage merchants, subscriptions, and business compliance.
  - **Acceptance Criteria:**
    - Protected by `superadmin` middleware at `/admin` (`php artisan janjiyan:make-superadmin`) for trial extension, manual plan activation, and business suspension/unsuspension.

---

### Planned User Stories & Acceptance Criteria (v2.2 Approved Blueprint)

#### Epic 8 [Planned — v2.2]: Multi-Service Cart, Service Add-ons & Cashier Settlement (POS + Thermal Receipts)
- **Story 8.1:** As a merchant, I want to define reusable service add-ons and support multi-item orders so Janjiyan handles complete transactions across `dropoff`, `space_booking`, and `staff_appointment`.
  - **Acceptance Criteria:**
    - Merchants with `manage_services` permission can manage `service_addons` (name, description, price, `unit_label`, optional `duration_minutes`, `is_commissionable` flag, active toggle) and assign them to specific services (`service_addon_assignments`) or globally across the business.
    - **Checkout & Booking Model:**
      - `space_booking` & `staff_appointment`: 1 primary service + multiple optional add-ons with quantities; add-on durations sum into total booking duration for `staff_appointment` slot checks and rescheduling (`$booking->resolveTotalDurationMinutes()`).
      - `dropoff`: Multi-service cart + add-ons in a single order/invoice; `SlotAvailabilityService` sums `booking_items.quantity` per `service_id` & `booking_date` inside `DB::transaction()`, applying `lockForUpdate()` on involved `services` rows **ordered by `id` ascending** to prevent deadlocks, and computes `estimated_ready_date = MAX(turnaround_days)` across all selected services.
    - Every line item is snapshotted into `booking_items` (`item_type`, `service_id`, `service_addon_id`, `name_snapshot`, `unit_label_snapshot`, `unit_price`, `quantity`, `duration_minutes_snapshot`, `turnaround_days_snapshot`, `is_commissionable`, `subtotal`) so historical invoices/receipts never drift when master prices change.
    - Existing single-service bookings are backfilled into `booking_items` and `bookings.service_id` remains populated with the primary service for backward compatibility.
    - Staff commissions (`StaffCommissionService` & `SlotAvailabilityService`) calculate commission from the primary service plus `is_commissionable` items only (excluding non-commissionable goods/rentals).
- **Story 8.2:** As a cashier/admin, I want to adjust items at the counter, record partial or final settlements by payment method, view daily cashier totals, and print/share thermal receipts & item tags so Janjiyan replaces separate POS apps.
  - **Acceptance Criteria:**
    - Counter adjustments & payment entries require `verify_payments` permission and `writable.subscription` middleware.
    - All payment events (including `verifyDp()`, walk-in initial payments, counter settlements, adjustments, and refunds) are recorded in `booking_payments` (`payment_type`, `payment_method`: `cash` | `qris` | `transfer` | `edc`, `amount`, `received_amount`, `change_amount`, `recorded_by_user_id`, `paid_at`, `notes`).
    - `bookings.paid_amount` is atomically recomputed from `SUM(booking_payments.amount)` inside `DB::transaction()`. Payment status invariants are enforced automatically: `paid_amount >= total_price` sets `payment_status = 'settled'` & `settled_at = now()`; `0 < paid_amount < total_price` sets/reverts `payment_status = 'dp_verified'` & `settled_at = null` (e.g., when counter staff add items to a previously settled booking).
    - Cashier dialog on booking rows/details displays itemized total, `paid_amount`, remaining balance (`total_price - paid_amount`), counter item/qty editing, quick *"Bayar Sisa Pas"* button, cash change calculation, and method selector.
    - Dashboard provides a **Daily Cashier Summary** widget (actual cashflow collected by `paid_at` broken down by `cash`, `qris`, `transfer`, `edc`), with CSV export gated to Pro/Enterprise.
    - **Thermal Receipt & Digital Share (`ReceiptPrintSheet`):**
      - Isolated hex-only styling (free of `oklch` CSS variables) supporting `58mm` and `80mm` `@page` print widths via `react-to-print` (v3+ compatible with React 19).
      - Prints merchant header, invoice number, timestamp, cashier name, itemized `booking_items`, payment ledger (`booking_payments` incl. cash received & change), `LUNAS` / remaining balance badge, and a small QR code (`qrcode`) pointing to `/b/{slug}/invoice/{token}`.
      - Supports 1-click **Download PNG Receipt** (`html-to-image` with hex-only styling / Canvas fallback for Safari reliability) for WhatsApp sharing, plus **Drop-off Item Tag/Label** printing (order code, customer name, item counts).
    - Public invoice page (`/b/{slug}/invoice/{token}`) displays itemized `booking_items`, `paid_amount`, and remaining balance clearly.
    - Plan gating: Basic allows up to 5 add-ons, cashier settlement, and thermal/tag printing; Professional & Enterprise (including 14-day Trial) unlock unlimited add-ons, unlimited multi-service drop-off cart items, and daily payment-method breakdown + CSV export.

#### Epic 9 [Planned — v2.2]: Smart Google Maps Review Redirect & Printable QR Review Stickers
- **Story 9.1:** As a merchant, I want a QR review flow that captures internal satisfaction ratings, directs happy customers to Google Maps Reviews, routes low ratings to private feedback, and lets me print table/counter QR stickers.
  - **Acceptance Criteria:**
    - Feature gated to **Professional** and **Enterprise** plans (including active 14-day Trial) via `can_use_google_review` on `subscription_plans` / `PlanLimitService`.
    - Settings (`manage_settings` + `writable.subscription`) configure `google_review_url` (strictly validated `https://` URL on valid Google domains: `google.com`, `g.page`, `maps.app.goo.gl`, `search.google.com`), `review_redirect_min_rating` (default `4`), `review_enabled`, and `review_sticker_subtitle`.
    - Public endpoint `/b/{slug}/review` (protected by `throttle:public-review` + honeypot anti-spam) accepts optional `?token={invoice_token}` (auto-linking `booking_id` & `customer_id`, max 1 review per booking on non-cancelled/non-no_show bookings) or anonymous/counter QR submissions (optional name/phone).
    - Stores feedback in `business_reviews` (`business_id`, `booking_id`, `customer_id`, `reviewer_name`, `reviewer_phone`, `rating`, `comment`, `redirected_to_google`, `created_at`).
    - **Smart Routing:**
      - `rating >= review_redirect_min_rating` (with `google_review_url` configured): shows warm thank-you screen, 1-click **Copy Comment** button, and prominent **"Lanjutkan ke Google Maps Review"** CTA (recording redirect intent).
      - `rating < review_redirect_min_rating`: shows empathetic acknowledgement, saves as **Private Feedback** in the merchant dashboard (and dispatches optional Telegram owner alert), using neutral non-deceptive copy.
    - Public invoice page (`/b/{slug}/invoice/{token}`) shows a **"Beri Ulasan"** CTA once `reservation_status === 'completed'` or `work_status === 'picked_up'`; WhatsApp `follow_up` template exposes `{review_url}` placeholder.
    - **Printable QR Review Stickers (`QrReviewStickerDialog`):** Reuses existing `qrcode` + Canvas architecture from `QrPosterDialog.tsx` to export **1:1 Square Sticker PNG (`1200×1200px`)**, **A6 Tent Card (`105×148mm`)**, and **A4 Multi-Sticker Print Grid (`2×2` and `3×3`)** via `@media print`.

---

### Non-Goals (Out of Scope for Current & v2.2 Release)
- Native iOS/Android mobile apps.
- Automated payment gateway escrow or platform payout aggregation for end-customer DP payments (end-customer DP remains direct-to-merchant at 0% fee; Mayar is used for B2B SaaS merchant subscriptions; BYO dynamic QRIS gateway is deferred beyond v2.2).
- Automated WhatsApp Business API bot / blast messaging (continues using customizable 1-click `wa.me` templates + Email + Telegram Bot).
- Customer self-service reschedule, waitlist, promo vouchers/session packages, 2-way Google Calendar sync, or custom CNAME white-label domains.

---

## 3. AI System Requirements
*Not applicable for Janjiyan v2.x. All scheduling, multi-item slot/quota calculation, cashier ledger invariants, commission snapshots, no-show protection, review routing, and expiry workflows are strictly deterministic.*

---

## 4. Technical Specifications

### Architecture Overview
- **Monolith Full-Stack:** Laravel 13 (PHP 8.5) serving Inertia.js v3 responses to a React 19 + TypeScript SPA frontend styled with Tailwind CSS v4 and **shadcn/ui** primitives (themed to `design.md`).
- **Database:** SQLite with WAL mode enabled for local/MVP concurrency safety, designed with standard Eloquent migrations and composite indexes compatible with PostgreSQL/MySQL for production scaling.
- **Core Domain Models (Implemented v2.1):**
  - `User` (Auth, email verification, Google OAuth ID, `is_superadmin`, `active_business_id`)
  - `SubscriptionPlan`, `Subscription`, `SubscriptionInvoice` (Plan limits, usage tracking, Mayar billing records)
  - `Business` (Multi-tenant root, `slug`, `category`, locked `business_type`, `timezone`, `logo_path`, `brand_color`, `cover_path`, `qr_poster_subtitle`, `dp_expiry_minutes`, `min_booking_lead_minutes`, `max_booking_advance_days`, reminder flags, `whatsapp_templates`, encrypted `telegram_bot_token`, `telegram_chat_id`, `no_show_require_full_dp`, `no_show_dp_threshold`, bank/QRIS settings, suspension state)
  - `BusinessUser` (Pivot with `role` and JSON `permissions`)
  - `BusinessGallery`, `OperatingHour`, `BusinessHoliday`
  - `Service` (Image, `booking_mode`, `assignment_mode`, `turnaround_days`, `supports_pickup`, `unit_label`, duration, buffer, capacity, DP rules)
  - `Staff` (Optional `user_id`, service assignments, `commission_type`, `commission_value`), `StaffOperatingHour`, `StaffTimeOff`
  - `Customer` (Scoped to `business_id`, normalized phone, `name_aliases` JSON, `notes`, `tags` JSON, `is_blocked`)
  - `Booking` (`booking_code`, `invoice_number`, `invoice_token`, `booked_customer_name`, `booked_customer_email`, `booking_mode`, `quantity`, `unit_label`, `fulfillment_type`, `pickup_session`, `pickup_address`, `start_at`, `end_at`, `buffer_end_at`, `estimated_ready_date`, `total_price`, `dp_amount`, `commission_amount`, `reservation_status`, `work_status`, `payment_status`, `dp_proof_path`, `dp_expires_at`, `rescheduled_count`, `reminder_h1_sent_at`, `reminder_h2_sent_at`)
- **Additional Domain Models (Planned v2.2):**
  - `ServiceAddon` (`business_id`, `name`, `description`, `price`, `unit_label`, `duration_minutes`, `is_commissionable`, `is_active`, `sort_order`) & `service_addon_assignments`
  - `BookingItem` (`booking_id`, `item_type`, `service_id`, `service_addon_id`, `name_snapshot`, `unit_label_snapshot`, `unit_price`, `quantity`, `duration_minutes_snapshot`, `turnaround_days_snapshot`, `is_commissionable`, `subtotal`)
  - `BookingPayment` (`booking_id`, `business_id`, `payment_type`, `payment_method`, `amount`, `received_amount`, `change_amount`, `recorded_by_user_id`, `paid_at`, `notes`), plus `bookings.paid_amount` & `bookings.settled_at`
  - `BusinessReview` (`business_id`, `booking_id`, `customer_id`, `reviewer_name`, `reviewer_phone`, `rating`, `comment`, `redirected_to_google`), plus `businesses.google_review_url`, `businesses.review_redirect_min_rating`, `businesses.review_enabled`, `businesses.review_sticker_subtitle`, and `subscription_plans.can_use_google_review` / `max_addons_per_business`

### Integration Points
- **Authentication:** Email/Password + Email Verification + Password Reset + **Laravel Socialite** (Google OAuth).
- **SaaS Billing:** **Mayar API** (`MayarService`) + CSRF-exempt rate-limited webhook (`POST /webhooks/mayar`).
- **Notifications & Queues:** Laravel Mail (transactional + H-1/H-2 reminders), **Telegram Bot API** via `SendTelegramBookingAlertJob` (`QUEUE_CONNECTION=database`), and client-side `wa.me` template deep-links.
- **Calendar, QR & Receipts:** Server-side RFC 5545 `.ics` generator (`IcsCalendarService`), client-side `qrcode` Canvas poster/sticker generators (`QrPosterDialog` + **[v2.2]** `QrReviewStickerDialog`), and **[v2.2]** `react-to-print` (v3+) + `html-to-image` (hex-isolated receipt sheet / Canvas fallback) for `58mm`/`80mm` thermal receipts, PNG WhatsApp receipts, and drop-off item tags.
- **File Storage:** Laravel Filesystem (`public` disk for logos, covers, QRIS, service photos, gallery; `local` private disk for customer Uang Muka proofs served only via authorized routes).
- **Scheduler (`routes/console.php`):**
  - `bookings:expire-unpaid` (every minute, `withoutOverlapping`)
  - `bookings:send-reminders` (every 5 minutes, `withoutOverlapping`)

### Security & Privacy
- **Tenant Isolation:** Explicit scoping on `business_id` across every dashboard query, route model check, `.ics` export, cashier action, and review management route.
- **Secret Protection:** `Business::$hidden` excludes `telegram_bot_token`; stored encrypted at rest (`encrypted` cast); queued jobs store only IDs and load credentials at execution time.
- **Concurrency & Ledger Integrity:** Slot/quota reservation, multi-service drop-off locking (sorted by `service_id`), rescheduling, and cashier `booking_payments` + `paid_amount` recalculation all execute inside `DB::transaction()` with pessimistic locking (`lockForUpdate()`).
- **Validation, Rate Limiting & Injection Defense:** Strict Laravel validation rules, named rate limiters on public/auth/webhook/telegram-test/**[v2.2]** `public-review` endpoints, strict HTTPS + Google-host validation on `google_review_url`, HTML escaping on Telegram payloads, and `CsvHelper::sanitizeRow()` on all CSV exports.
- **Uang Muka Proof Protection:** Uploaded payment proofs validated (`mimes:jpg,jpeg,png,webp`, `max:5120`) and served only to authenticated team members of the owning business.

---

## 5. Risks & Roadmap

### Phased Rollout
- **Phase 1 (v1.0 MVP — Completed):** Landing page (`design.md`), Email + Google OAuth, Multi-business switcher, Service/Schedule/Staff setup, Public Booking Engine (`/b/{slug}`) with Uang Muka upload + Pay-Later auto-expiry, Dashboard RBAC, CRM, Analytics + CSV Export.
- **Phase 2 (v1.1–v2.1 Operational, Locked Business Types & Monetization — Completed):** Portfolio gallery, brand color & cover, Invoice tokens & phone lookup, Calendar View & Drop-off Work-Status Queue, Walk-in & Reschedule, Per-staff shifts/time-offs, Automated H-1/H-2 Email Reminders, Mayar SaaS billing + Soft-Lock + Superadmin Panel, 1-Click Customizable WhatsApp Templates, Printable QR Code Posters, Add-to-Calendar (`.ics` & Google Calendar), Encrypted Async Telegram Bot Alerts, Staff Commission Reporting, CRM Tags/Aliases/Merge + Auto No-Show Protection, Locked `business_type` & Onboarding, `unit_label`, and Mobile/WebKit QA hardening.
- **Phase 3 (v2.2 — Approved Next Release, Milestones 1–4):**
  - **Milestone 1:** `service_addons`, `booking_items`, `booking_payments` schema + backfill + `SlotAvailabilityService` & `StaffCommissionService` multi-item/ledger refactor.
  - **Milestone 2:** Public & walk-in multi-item/add-on checkout + Cashier Settlement Panel & Daily Payment-Method Summary.
  - **Milestone 3:** Thermal Receipt (`58mm`/`80mm` via `react-to-print` v3+), WhatsApp PNG Receipt Export (`html-to-image` / hex-only Canvas fallback), Drop-off Item Tags, and itemized Public Invoice view.
  - **Milestone 4:** Smart Google Maps Review Redirect (`/b/{slug}/review`), private feedback inbox + Telegram alerts, `{review_url}` WA placeholder, and `QrReviewStickerDialog` (`1:1` PNG, A6 Tent Card, A4 `2×2`/`3×3` print grid).
- **Phase 4 (Future — v2.3+):** Optional BYO dynamic QRIS gateway (Mayar/Midtrans/Xendit), customer self-service reschedule/cancel, waitlist management, promo vouchers/session packages, 2-way Google Calendar sync, and optional WhatsApp Business API integration.

### Technical Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| **Double-booking / multi-service drop-off deadlock** | High (concurrent booking failures or quota overflow) | `DB::transaction()` + `lockForUpdate()` on `services` rows **sorted by `id` ascending**, computing drop-off daily usage from `booking_items.quantity`. |
| **Cashier ledger & status drift** | High (wrong remaining balance or revenue mismatch) | Record all `verifyDp()`, walk-in, and settlement payments in `booking_payments`; atomically recompute `bookings.paid_amount` and enforce `settled` / `dp_verified` invariants inside transactions. |
| **React 19 / Tailwind v4 print & PNG export incompatibility** | Medium (broken print modal or Safari `oklch` canvas failure) | Require `react-to-print` v3+ (`contentRef`), isolate receipt DOM from Tailwind `oklch` variables using explicit hex colors & system fonts, and verify on Chromium/WebKit. |
| **Public review spam & unsafe redirect URLs** | Medium (fake 1-star floods or open redirect) | Enforce `throttle:public-review` + honeypot, restrict `?token=` to 1 review per completed booking, and whitelist `https://` Google domains on `google_review_url`. |
| **Telegram API latency / downtime** | Medium (could slow public checkout/review submit) | Async `SendTelegramBookingAlertJob` with 5s timeout and 3x exponential backoff retries; checkout and review submission never block. |
| **Credential exposure (Telegram token)** | High (bot hijacking) | Encrypted at rest via Eloquent cast, `$hidden` from serialization, masked hint only in UI, omitted from queue payload. |
| **Timezone mismatches** | Medium (wrong slot/calendar/cashier day boundaries) | Store all timestamps in UTC in DB; convert using `business.timezone` (default `Asia/Jakarta`) on slot generation, cashier daily totals, UI, and `.ics` export. |
| **Commission history drift** | Medium (past payroll changes or item-rental distortion) | Snapshot `commission_amount` onto `bookings` at creation/reschedule using primary service + `is_commissionable` items only; aggregate via indexed SQL `GROUP BY`. |
| **Ghost bookings & repeat no-shows** | Medium (blocked slots without attendance) | Pay-later `dp_expires_at` auto-expiry + configurable automatic 100% Uang Muka protection & online booking block for repeat no-shows. |
