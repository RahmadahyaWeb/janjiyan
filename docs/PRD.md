# Product Requirements Document (PRD): Janjiyan

> **Version:** 2.1.0  
> **Date:** 2026-11-20  
> **Status:** Active — Synchronized with Implemented Codebase  
> **Tech Stack:** Laravel 13 (PHP 8.5) + Inertia.js v3 + React 19 (TypeScript) + Tailwind CSS v4 + shadcn/ui + SQLite (WAL) / PostgreSQL-ready  
> **Design System:** Mobbin-inspired Gallery-White Minimal ([design.md](../design.md))

---

## 1. Executive Summary

### Problem Statement
Indonesian service-based businesses (barbershops, salons, clinics, studios, sports courts, and workshops) still rely heavily on manual WhatsApp chats, social media DMs, and fragmented spreadsheets to schedule appointments, verify down payments (DP), track staff commissions, and manage repeat no-shows. This creates administrative overhead, frequent double-bookings, unverified payment disputes, and lost leads when customers have to wait for manual replies.

### Proposed Solution
**Janjiyan** is an all-in-one B2B SaaS appointment booking and operations platform featuring:
- A frictionless, no-login public booking portal (`/b/{slug}`) with real-time slot & capacity engine, portfolio gallery, invoice lookup, and Add-to-Calendar (`.ics` & Google Calendar).
- Direct-to-merchant DP verification (0% transaction fee) with pay-later auto-expiry and automatic **No-Show DP Protection**.
- Multi-business merchant dashboard with Calendar & List views, walk-in booking, rescheduling, per-staff shift/time-off schedules, customizable **1-click WhatsApp templates**, **printable QR poster generator**, **encrypted async Telegram Bot alerts**, **staff commission reporting**, and **CRM tagging/blocking**.
- Built-in SaaS monetization via **Mayar** payment gateway + webhooks, subscription soft-lock enforcement, and a **Superadmin Panel**.

### Success Criteria (KPIs)
1. **Booking Completion Speed:** End customers can complete a service booking (from landing on `/b/{slug}` to confirmation) in **<= 60 seconds** without account registration.
2. **Slot Availability Latency:** The real-time slot calculation endpoint returns available time slots in **<= 200ms** (p95) for a 30-day schedule window.
3. **Zero Double-Booking:** Atomic database locking ensures **0 concurrent double-bookings** across overlapping requests for the same staff member or capacity-limited slot.
4. **Merchant Onboarding Time:** A new merchant can register, configure 1 business + 1 service + operating hours, and obtain a live `/b/{slug}` link + printable QR poster in **< 5 minutes**.
5. **Accessibility & UI Compliance:** Public pages (Landing & Public Booking Portal) achieve **>= 95 Lighthouse Accessibility score** and **100% token adherence** to `design.md`.

---

## 2. User Experience & Functionality

### User Personas
1. **Business Owner (Merchant Owner):** Manages 1 to 10 service businesses, configures pricing/services/DP rules/WhatsApp templates/Telegram alerts/no-show policies, monitors revenue and staff commissions, and manages subscription billing.
2. **Staff / Admin (Merchant Team):** Handles daily reservation operations (Calendar/List), walk-in bookings, reschedules, verifies manual DP proofs, updates reservation statuses (`Confirmed`, `Completed`, `No-Show`, `Cancelled`), exports personal `.ics` schedules, and manages customers within scoped RBAC permissions.
3. **End Customer (Client):** Discovers the merchant via Instagram/TikTok bio, WhatsApp, or printed QR poster, books an available slot on mobile without creating an account, uploads DP proof immediately or via unique invoice token before expiry, saves the appointment to Google/Apple Calendar, and looks up past invoices by phone number.
4. **Platform Superadmin:** Monitors SaaS merchants, subscription revenue, extends trials, activates plans manually, and suspends/unsuspends non-compliant businesses.

### User Stories & Acceptance Criteria

#### Epic 1: Marketing Landing Page, Legal & Conversion
- **Story 1.1:** As a prospective merchant, I want to understand Janjiyan's value proposition, supported industries, workflow, pricing tiers, legal terms, and FAQs on a clean landing page so I can start my 14-day free trial.
  - **Acceptance Criteria:**
    - Follows `design.md` strictly: `#ffffff` canvas, `#141414` ink, `#f3f3f3` bone tint, `#0066ff` electric blue reserved strictly for the "Popular" plan badge and yearly-savings callout, `9999px` stadium-pill buttons/nav, Inter (300/450/650) + Geist Mono typography, and inverse `#141414` rounded-top footer.
    - Displays all 3 pricing plans (**Basic** Rp 49.000/mo, **Professional** Rp 129.000/mo, **Enterprise** Rp 249.000/mo) with monthly/yearly segmented toggle and 14-day free trial CTA.
    - Includes interactive FAQ accordion, 4-step workflow breakdown in Indonesian copy, plus public `/terms` and `/privacy` legal pages.

#### Epic 2: Authentication, Verification & Multi-Business Onboarding
- **Story 2.1:** As a merchant owner, I want to sign up, verify my email, manage my profile/password, and log in using Email & Password or Google OAuth.
  - **Acceptance Criteria:**
    - Supports Email/Password registration, email verification (`/email/verify`), login, password reset, profile & password management (`/dashboard/profile`), and Google OAuth via Laravel Socialite.
    - New accounts automatically start a **14-day free trial**.
- **Story 2.2:** As a merchant owner, I want to create, switch, and delete businesses under one account with isolated data.
  - **Acceptance Criteria:**
    - Dashboard includes a Business Switcher scoped to the authenticated user's businesses (subject to plan limits: Basic 1, Pro 3, Enterprise 10).
    - Services, operating hours, staff, customers, reservations, galleries, and payment settings are strictly isolated by `business_id`.
    - Each business generates a unique, customizable URL slug (`/b/{slug}`) and an on-demand **Printable QR Code Poster** (HD PNG 1200×1600, QR-only PNG, and A5 print layout).

#### Epic 3: Service, Schedule, Staff Shift & Portfolio Configuration
- **Story 3.1:** As a business owner, I want to configure operating hours, break times, holidays, booking lead/advance windows, services (with images), and per-staff schedules/time-offs.
  - **Acceptance Criteria:**
    - Per-day business operating hours (Monday–Sunday open/close + break time + active toggle), specific holiday/blocked dates, `min_booking_lead_minutes`, and `max_booking_advance_days`.
    - Per-staff custom operating hours (`StaffOperatingHour`) and scheduled leave/time-off ranges (`StaffTimeOff`) that override default availability.
    - Service configuration supports: name, description, optional image, price, scheduling mode (`time_slot` for hourly appointments or `dropoff` for turnaround/daily-quota services such as shoe cleaning, laundry, or repair), turnaround estimate (`turnaround_days`), optional Pick-up & Delivery toggle (`supports_pickup`), duration/buffer (for `time_slot`), max capacity per slot or per day (`>= 1`), DP requirement (`none` / `fixed` / `percentage`), and assignment mode (`staff` or `capacity`).
    - Business Portfolio Gallery (`BusinessGallery`, up to 12 photos with captions) displayed on `/b/{slug}`.
    - Enforces plan limits on max services per business (Basic 5, Pro 10, Enterprise Unlimited).

#### Epic 4: Frictionless Public Booking Engine, Invoices & Calendar Export (`/b/{slug}`)
- **Story 4.1:** As an end customer, I want to browse services and portfolio photos, pick a staff member or "Siapa saja yang tersedia", select an available date/time slot, and submit my booking without registering.
  - **Acceptance Criteria:**
    - Mobile-first UI following `design.md` strictly, with rate-limited endpoints (`public-slots`, `public-booking`, `public-dp-proof`, `public-invoice-lookup`).
    - Real-time availability engine supports both hourly `time_slot` services (excluding past times, lead-time/max-advance violations, holidays, break times, staff shifts/time-offs, and overlapping capacity/staff bookings) and `dropoff` services (checking daily item quota `SUM(quantity)` against service `capacity`, computing `estimated_ready_date` across open operating days, supporting multi-item `quantity` 1–50, and optional `pickup` session + address).
    - Prevents double-booking and daily quota overbooking via `DB::transaction()` + pessimistic row locking (`lockForUpdate()`).
    - Enforces **No-Show Protection**: blocked customers (`is_blocked = true`) are politely rejected from public booking; customers meeting the business's `no_show_dp_threshold` automatically require **100% DP** when `no_show_require_full_dp` is enabled.
- **Story 4.2:** As an end customer, I want a secure invoice page to upload DP proof (immediately or before expiry), look up my past invoices, and add the booking to my calendar.
  - **Acceptance Criteria:**
    - Displays merchant bank accounts and/or static QRIS image clearly.
    - **Immediate Upload:** Receipt image (`jpg/png/webp`, max 5MB) -> `reservation_status = pending`, `payment_status = waiting_verification`.
    - **Pay Later:** `payment_status = unpaid` with `dp_expires_at` (configurable per business, default 2 hours) and unique secret invoice link (`/b/{slug}/invoice/{token}`).
    - **Auto-Expiry:** Scheduled command `bookings:expire-unpaid` runs every minute to cancel expired `unpaid` bookings (`cancellation_reason = dp_expired`), releasing the slot.
    - **Invoice Lookup:** Customers can retrieve their bookings by phone number at `/b/{slug}/invoices`.
    - **Add to Calendar:** Active invoice pages provide **Google Calendar** deep-link and RFC 5545 **`.ics` download** (`/b/{slug}/invoice/{token}/calendar.ics`).
    - **WhatsApp Summary:** Confirmation screen provides a pre-filled `wa.me` button.

#### Epic 5: Merchant Reservation Operations, WhatsApp Templates & Notifications
- **Story 5.1:** As a merchant or staff member, I want to manage bookings in List or Calendar view, create walk-in bookings, reschedule, verify DP proofs, mark no-shows, and message customers via 1-click WhatsApp templates.
  - **Acceptance Criteria:**
    - Supports **List View** (with search, status/payment/staff/service/date filters) and **7-day / per-staff Calendar View** (`BookingCalendarView`).
    - Supports manual **Walk-in Booking** creation and atomic **Rescheduling** (`rescheduled_count` tracking + automatic reminder reset).
    - Reservation statuses (`pending`, `confirmed`, `completed`, `no_show`, `cancelled`) tracked independently from Payment statuses (`unpaid`, `waiting_verification`, `dp_verified`, `settled`), plus Drop-off Work Progress stages (`awaiting_dropoff`, `in_progress`, `ready_for_pickup`, `picked_up`) with 1-click progression and public invoice progress tracking.
    - **1-Click WhatsApp Templates:** Customizable per-business templates (`reminder`, `dp_verified`, `confirmed`, `ready_for_pickup`, `follow_up`) with variable placeholders (including `{quantity}` and `{estimated_ready_date}`) and live preview in Settings, accessible via a 1-click dropdown on every booking row.
    - Enforces monthly booking quota per plan (Basic 100/mo, Pro 500/mo, Enterprise Unlimited).
- **Story 5.2:** As a merchant, I want automated customer email reminders and instant merchant alerts via Email and Telegram Bot.
  - **Acceptance Criteria:**
    - **Automated Email Reminders:** Scheduled command `bookings:send-reminders` runs every 5 minutes to send H-1 day (23–25h prior) and H-2 hour (105–135m prior) emails for `confirmed` bookings with atomic deduplication (`reminder_h1_sent_at`, `reminder_h2_sent_at`).
    - **Merchant Email Alerts:** Owner and assigned staff receive email notifications on new public bookings and DP proof uploads.
    - **Instant Telegram Bot Alerts:** Configurable per business (`telegram_notifications_enabled`, encrypted `telegram_bot_token`, `telegram_chat_id`). Dispatched asynchronously via `SendTelegramBookingAlertJob` (`ShouldQueue`, 3 retries with backoff, 5s HTTP timeout, HTML-escaped) with a rate-limited **"Send Test Message"** button in Settings.

#### Epic 6: Advanced CRM, Team RBAC, Staff Commissions & Analytics
- **Story 6.1:** As a merchant, I want a Customer Directory (CRM) with detail pages, internal treatment notes, custom tags, and online-booking block controls.
  - **Acceptance Criteria:**
    - Auto-creates/updates customer records scoped to `business_id` keyed by normalized phone.
    - Customer detail page (`/dashboard/customers/{customer}`) displays booking stats, history, internal notes, up to 10 tags (presets: `VIP`, `Langganan`, `Alergi / Sensitif`, `Perhatian Khusus` + custom), and an `is_blocked` toggle.
    - Directory supports segment filtering (`all`, `vip`, `repeat`, `has_no_show`, `blocked`), sorting, and formula-safe CSV export.
    - Booking rows display inline CRM indicators (`VIP`, `No-Show Xx`, `Diblokir`).
- **Story 6.2:** As a business owner, I want to manage staff accounts with RBAC, export staff `.ics` calendars, and track staff commissions automatically.
  - **Acceptance Criteria:**
    - Staff can act as bookable resources and optionally dashboard login users with roles (`owner`, `admin`, `staff`) and granular permissions (`manage_bookings`, `verify_payments`, `manage_services`, `manage_staff`, `manage_settings`).
    - Authenticated staff `.ics` calendar export (`/dashboard/staff/{staff}/calendar.ics`) for upcoming 60 days.
    - Per-staff commission configuration (`none`, `percentage`, `fixed`) snapshotted onto `bookings.commission_amount` at creation/reschedule for historical accuracy.
    - Dedicated **Staff Commission Report** (`/dashboard/commissions`) using indexed SQL `GROUP BY` aggregation, date range presets, optional `confirmed` projection toggle, and formula-safe CSV export (Pro/Enterprise).
- **Story 6.3:** As a business owner, I want dashboard analytics and CSV exports.
  - **Acceptance Criteria:**
    - Overview displays today's bookings, pending DP verifications, gross revenue, and top services.
    - CSV exports (bookings, customers, commissions) use `CsvHelper::sanitizeRow()` to prevent spreadsheet formula injection and are gated to **Professional** and **Enterprise** plans.

#### Epic 7: SaaS Monetization (Mayar), Soft-Lock & Superadmin Panel
- **Story 7.1:** As a business owner, I want to monitor my plan usage, pay for subscriptions via Mayar, and view invoice history.
  - **Acceptance Criteria:**
    - Billing page (`/dashboard/billing`) displays real-time usage meters (Businesses, Services, Staff, Monthly Bookings, Customers) and `SubscriptionInvoice` history.
    - Integrates with **Mayar** payment gateway (`MayarService`, `POST /dashboard/billing/checkout`, `POST /webhooks/mayar` with signature/token verification, and manual invoice status check).
    - Expired subscriptions or suspended businesses trigger **Soft-Lock** (`writable.subscription` middleware): dashboard remains read-only while operational writes/exports and public booking portal are blocked.
- **Story 7.2:** As a platform superadmin, I want an admin panel to manage merchants, subscriptions, and business compliance.
  - **Acceptance Criteria:**
    - Protected by `superadmin` middleware at `/admin` (bootstrapped via `php artisan janjiyan:make-superadmin`).
    - Displays platform KPIs (total merchants, active paid, trialing, expired, suspended businesses, paid subscription revenue) and allows extending trials, activating plans, and suspending/unsuspending businesses.

### Non-Goals (Out of Scope for Current Release)
- Native iOS/Android mobile apps.
- Automated payment gateway escrow for end-customer DP payments (end-customer DP remains direct-to-merchant at 0% fee; Mayar is used for B2B SaaS merchant subscriptions).
- Automated WhatsApp Business API bot / blast messaging (current release uses customizable 1-click `wa.me` templates + Email + Telegram Bot).
- Multi-service cart / add-ons in a single booking, customer self-service reschedule, waitlist, promo vouchers/packages, or custom CNAME white-label domains.

---

## 3. AI System Requirements
*Not applicable for Janjiyan v2.0. All scheduling, slot calculation, commission snapshots, quota enforcement, no-show protection, and expiry workflows are strictly deterministic.*

---

## 4. Technical Specifications

### Architecture Overview
- **Monolith Full-Stack:** Laravel 13 (PHP 8.5) serving Inertia.js v3 responses to a React 19 + TypeScript SPA frontend styled with Tailwind CSS v4 and **shadcn/ui** primitives (themed to `design.md`).
- **Database:** SQLite with WAL mode enabled for local/MVP concurrency safety, designed with standard Eloquent migrations and composite indexes compatible with PostgreSQL/MySQL for production scaling.
- **Core Domain Models:**
  - `User` (Auth, email verification, Google OAuth ID, `is_superadmin`, `active_business_id`)
  - `SubscriptionPlan`, `Subscription`, `SubscriptionInvoice` (Plan limits, usage tracking, Mayar billing records)
  - `Business` (Multi-tenant root, `slug`, `timezone`, `dp_expiry_minutes`, `min_booking_lead_minutes`, `max_booking_advance_days`, reminder flags, `whatsapp_templates`, encrypted `telegram_bot_token`, `telegram_chat_id`, `no_show_require_full_dp`, `no_show_dp_threshold`, bank/QRIS settings, suspension state)
  - `BusinessUser` (Pivot with `role` and JSON `permissions`)
  - `BusinessGallery`, `OperatingHour`, `BusinessHoliday`
  - `Service` (Image, `booking_mode` `time_slot|dropoff`, `turnaround_days`, `supports_pickup`, duration, buffer, capacity, DP rules, assignment mode)
  - `Staff` (Optional `user_id`, service assignments, `commission_type`, `commission_value`), `StaffOperatingHour`, `StaffTimeOff`
  - `Customer` (Scoped to `business_id`, normalized phone, `notes`, `tags` JSON, `is_blocked`)
  - `Booking` (`booking_code`, `invoice_number`, `invoice_token`, `booking_mode`, `quantity`, `fulfillment_type`, `pickup_session`, `pickup_address`, `start_at`, `end_at`, `buffer_end_at`, `estimated_ready_date`, `total_price`, `dp_amount`, `commission_amount`, `reservation_status`, `work_status`, `payment_status`, `dp_proof_path`, `dp_expires_at`, `rescheduled_count`, `reminder_h1_sent_at`, `reminder_h2_sent_at`)

### Integration Points
- **Authentication:** Email/Password + Email Verification + Password Reset + **Laravel Socialite** (Google OAuth).
- **SaaS Billing:** **Mayar API** (`MayarService`) + CSRF-exempt rate-limited webhook (`POST /webhooks/mayar`).
- **Notifications & Queues:** Laravel Mail (transactional + H-1/H-2 reminders), **Telegram Bot API** via `SendTelegramBookingAlertJob` (`QUEUE_CONNECTION=database`), and client-side `wa.me` template deep-links.
- **Calendar & QR:** Server-side RFC 5545 `.ics` generator (`IcsCalendarService`) + client-side `qrcode` HD PNG poster generator (`QrPosterDialog`).
- **File Storage:** Laravel Filesystem (`public` disk for logos, QRIS, service photos, gallery; `local` private disk for customer DP proofs served only via authorized routes).
- **Scheduler (`routes/console.php`):**
  - `bookings:expire-unpaid` (every minute, `withoutOverlapping`)
  - `bookings:send-reminders` (every 5 minutes, `withoutOverlapping`)

### Security & Privacy
- **Tenant Isolation:** Explicit scoping on `business_id` across every dashboard query, route model check, `.ics` export, and authorization check.
- **Secret Protection:** `Business::$hidden` excludes `telegram_bot_token`; stored encrypted at rest (`encrypted` cast); queued jobs store only `bookingId` and load credentials at execution time.
- **Concurrency & Double-Booking Prevention:** Slot reservation and rescheduling run inside `DB::transaction()` with pessimistic locking (`lockForUpdate()`).
- **Validation, Rate Limiting & Injection Defense:** Strict Laravel validation rules, named rate limiters on public/auth/webhook/telegram-test endpoints, HTML escaping on Telegram payloads, and `CsvHelper::sanitizeRow()` on all CSV exports.
- **DP Proof Protection:** Uploaded payment proofs validated (`mimes:jpg,jpeg,png,webp`, `max:5120`) and served only to authenticated team members of the owning business.

---

## 5. Risks & Roadmap

### Phased Rollout
- **Phase 1 (MVP — Completed):** Landing page (`design.md`), Email + Google OAuth, Multi-business switcher, Service/Schedule/Staff setup, Public Booking Engine (`/b/{slug}`) with DP upload + Pay-Later auto-expiry, Dashboard RBAC, CRM, Analytics + CSV Export.
- **Phase 2 (v1.1–v2.0 Operational & Monetization — Completed):** Portfolio gallery, Invoice tokens & phone lookup, Calendar View, Walk-in & Reschedule, Per-staff shifts/time-offs, Automated H-1/H-2 Email Reminders, Mayar SaaS billing + Soft-Lock + Superadmin Panel, 1-Click Customizable WhatsApp Templates, Printable QR Code Posters, Add-to-Calendar (`.ics` & Google Calendar), Encrypted Async Telegram Bot Alerts, Staff Commission Reporting, and CRM Tags + Auto No-Show Protection.
- **Phase 3 (Future — v2.1+):** Multi-service cart & add-ons in a single booking, customer self-service reschedule/cancel with H-X hour rules, waitlist management, settlement payment method breakdown & thermal receipts, promo vouchers/session packages, post-service reviews & Google Maps review redirect, and optional WhatsApp Business API integration.

### Technical Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| **Double-booking race conditions** | High (concurrent bookings on same slot) | `DB::transaction()` + `lockForUpdate()` + SQLite WAL mode (`busy_timeout=5000`). |
| **Telegram API latency / downtime** | Medium (could slow public checkout) | Async `SendTelegramBookingAlertJob` with 5s timeout and 3x exponential backoff retries; checkout never blocks. |
| **Credential exposure (Telegram token)** | High (bot hijacking) | Encrypted at rest via Eloquent cast, `$hidden` from serialization, masked hint only in UI, omitted from queue payload. |
| **Timezone mismatches** | Medium (wrong slot/calendar times) | Store all timestamps in UTC in DB; convert using `business.timezone` (default `Asia/Jakarta`) on slot generation, UI, and `.ics` export. |
| **Commission history drift** | Medium (past payroll changes if rate edited) | Snapshot `commission_amount` onto `bookings` at booking creation and reschedule; aggregate via indexed SQL `GROUP BY`. |
| **Ghost bookings & repeat no-shows** | Medium (blocked slots without attendance) | Pay-later `dp_expires_at` auto-expiry + configurable automatic 100% DP protection & online booking block for repeat no-shows. |
