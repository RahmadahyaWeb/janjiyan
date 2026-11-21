# Business-Type Locking & Adaptive Copywriting Architecture

**Status:** Approved Specification (Ready for Implementation)  
**Scope:** End-to-end refactor of service scheduling modes into business-level locked operational types, simplified registration & post-verification onboarding, custom Drop-off unit labels, adaptive copywriting across Dashboard, Public Portal, Notifications, and Landing Page.

---

## 1. Executive Summary & Core Decisions

Previously, Janjiyan configured scheduling modes (`time_slot` vs `dropoff`, and `staff` vs `capacity`) per individual `Service` record, while `Business::primaryBookingMode()` inferred the business's primary mode dynamically by counting active services. This created mixed UI toggles (e.g. `hasBothModes` in `BookingController`), cluttered service forms, and inconsistent copywriting across the dashboard, public portal, and notifications.

This specification locks the operational model at the **`Business` level** and adapts all UI, validation, feature visibility, and copywriting accordingly:

1. **Three Locked Business Types (`business_type`)** — scoped to service & reservation businesses (physical retail/e-commerce inventory is intentionally out of scope):
   - `staff_appointment` — **Janji Temu & Staff** (Barbershop, Salon, Clinic, Spa, Pet Grooming, Consulting)
   - `space_booking` — **Booking Tempat / Sesi** (Padel/Futsal Courts, Photo Studios, Yoga/Pilates Classes, Meeting Rooms)
   - `dropoff` — **Layanan Titip / Drop-off** (Shoe Care, Laundry, Electronics/Vehicle Repair, Tailoring)
2. **Simplified Registration + Post-Verification Onboarding**:
   - `/register` only collects account credentials (`name`, `email`, `password`, `password_confirmation`).
   - Google OAuth no longer auto-provisions a placeholder `"<Name> Studio"` business.
   - After email verification (or Google login), owners without a business are routed to a mandatory **Business Setup Onboarding** page to select one of the 3 business types, enter their business name, choose a type-appropriate category preset, and optionally enter WhatsApp/address.
   - Invited staff/admin users who already belong to an existing business bypass onboarding and land directly in their business dashboard.
   - **Add New Business** (`/dashboard/businesses/create`) uses the same 3-type selector & category presets.
3. **100% Permanent Lock**:
   - Once saved during onboarding or business creation, `business_type` is **permanently immutable** (no edit option in Settings; owners wanting another type create a new business or delete the current one).
   - Both Onboarding and Create Business forms must clearly warn the owner before submission that the business type cannot be changed afterward.
4. **Role-Aware Team & Commission Handling**:
   - **Team / Login Access (`Staff` with `grant_login`)** remains available across **all 3 business types** so owners of `space_booking` or `dropoff` businesses can still create cashier/admin logins.
   - For `space_booking` and `dropoff`: per-staff work schedules (`StaffOperatingHour`), time-offs (`StaffTimeOff`), service-staff assignments, and the **Komisi Staff** menu/routes are hidden/disabled; the sidebar label adapts to **Tim & Admin**.
5. **Drop-off Custom Unit Label (`unit_label`)**:
   - Services under `dropoff` businesses support selectable units (e.g., `item`, `pasang`, `kg`, `pcs`, `unit`) so copywriting, capacity quotas, booking portals, and invoices read naturally for shoe care (*pasang*), laundry (*kg*), or repairs (*unit*).
6. **Development Database Strategy**:
   - No live production user data needs preservation; schema migrations and seeders (`DemoSeeder`, `ResponsiveQaSeeder`) can be refactored cleanly for `migrate:fresh --seed`.

---

## 2. Business Type Matrix & Adaptive Copywriting

All Indonesian user-facing copy across the product should derive from a centralized terminology mapping per `business_type`.

| Dimension | `staff_appointment` | `space_booking` | `dropoff` |
| :--- | :--- | :--- | :--- |
| **Underlying `Service.booking_mode`** | `time_slot` | `time_slot` | `dropoff` |
| **Underlying `Service.assignment_mode`** | `staff` | `capacity` | `capacity` |
| **Category Presets** | Barbershop & Salon, Klinik & Kesehatan, Spa & Kecantikan, Pet Grooming, Konsultasi & Jasa | Lapangan & Olahraga, Studio Foto & Kreatif, Kelas & Workshop, Ruang Meeting & Event | Cuci Sepatu & Tas, Laundry & Dry Clean, Servis Elektronik & Gadget, Bengkel & Detailing, Jahit & Permak |
| **Nav: Bookings** | `Reservasi` | `Jadwal Booking` | `Pesanan` |
| **Nav: Services** | `Layanan` | `Fasilitas & Paket` | `Layanan & Tarif` |
| **Nav: Team** | `Tim & Staff` | `Tim & Admin` | `Tim & Admin` |
| **Nav: Commissions** | `Komisi Staff` (Visible) | *Hidden (403/404 guarded)* | *Hidden (403/404 guarded)* |
| **Dashboard Onboarding Steps** | 1. Tambah Layanan<br>2. Tambah Staff<br>3. Atur Pembayaran DP | 1. Tambah Fasilitas/Paket<br>2. Atur Pembayaran DP | 1. Tambah Layanan & Tarif<br>2. Atur Pembayaran DP |
| **Bookings Views** | List + Calendar View | List + Calendar View | List + Work-Status Queue Tabs (`awaiting_dropoff`, `in_progress`, `ready_for_pickup`, `picked_up`) |
| **Service Form Fields** | Price, Duration (min), Buffer (min), Staff Assignment, DP | Price, Session Duration (min), Buffer (min), Max Capacity per Session, DP | Price per `{unit_label}`, Unit (`item`/`pasang`/`kg`/`pcs`/`unit`), Est. Turnaround (days), Max Daily Capacity (`{unit_label}`/day), Pickup & Delivery toggle, DP |
| **Schedule Page (`Schedule/Index.tsx`)** | Store hours + break times + note linking to Staff Schedules & Time Off | Store hours + break times (no staff schedule link) | Store drop-off/pickup hours + holidays (break-time explanation adapted or optional; no staff schedule link) |
| **Settings: Booking Rules** | Lead time (min), Max advance (days), Reminder H-1, Reminder H-2h, No-Show Full DP | Lead time (min), Max advance (days), Reminder H-1, Reminder H-2h, No-Show Full DP | Max advance (days), Reminder H-1 (hide H-2h, lead time in minutes, and No-Show auto-DP if irrelevant to drop-off) |
| **Settings: WA Templates** | `reminder`, `dp_verified`, `confirmed`, `follow_up` (includes `{staff_name}`, `{time}`) | `reminder`, `dp_verified`, `confirmed`, `follow_up` (omits `{staff_name}`, uses `{time}`) | `reminder`, `dp_verified`, `confirmed`, `ready_for_pickup`, `follow_up` (omits `{staff_name}`, includes `{quantity}`, `{unit_label}`, `{estimated_ready_date}`) |
| **Public Portal CTA (`/b/{slug}`)** | `Buat Janji Temu` | `Booking Tempat / Sesi` | `Titip / Pesan Sekarang` |
| **Booking Flow Steps** | 1. Pilih Layanan → 2. Pilih Staff → 3. Pilih Tanggal & Jam → 4. Data & DP | 1. Pilih Fasilitas/Paket → 2. Pilih Tanggal & Jam → 3. Data & DP | 1. Pilih Layanan → 2. Pilih Tanggal & Jumlah (`{unit_label}`) & Antar/Jemput → 3. Data & DP |

---

## 3. Target User Flows

### 3.1 Registration → Email Verification → Onboarding
1. **Guest visits `/register`** (`resources/js/pages/Auth/Register.tsx` + `AuthController::register`):
   - Submits `name`, `email`, `password`, `password_confirmation`.
   - User is created, `Registered` event sends email verification, user is logged in and redirected to `verification.notice`.
   - *No business is created yet.*
2. **Google OAuth** (`AuthController::handleGoogleCallback`):
   - New Google user is created with `email_verified_at = now()`, logged in, and redirected to `dashboard`.
   - *No placeholder `"<Name> Studio"` business is created.*
3. **Onboarding Guard (Middleware / Dashboard Guard)**:
   - Any authenticated, verified merchant accessing `/dashboard*` who has **no active business** (or whose business lacks `business_type`) is redirected to `route('onboarding.business')` (e.g., `/dashboard/onboarding`).
   - Exceptions allowed without a business: `onboarding.*`, `logout`, `dashboard.profile*`, `dashboard.billing*` (optional, or keep billing accessible after onboarding).
   - Ensure invited staff/admin accounts already attached via `business_user` have `active_business_id` resolved automatically (if null, resolve first attached business) so they never get stuck in owner onboarding.
4. **Onboarding Setup Page** (`GET/POST /dashboard/onboarding`):
   - Renders 3 selectable visual cards describing each `business_type` with real-world examples and an explicit notice that the choice is **permanent**.
   - Dynamically updates category preset dropdown/chips + business name placeholder based on the selected type (e.g., *"Barber Rapi Studio"* vs *"Arena Padel Kemang"* vs *"Soklenn Cuci Sepatu"*).
   - Optional `phone` and `address` inputs.
   - Submitting creates the `Business`, attaches owner pivot (`role = owner`, `permissions = ['*']`), seeds default `OperatingHour` rows, ensures 14-day trial subscription via `PlanLimitService::ensureTrialSubscription()`, sets `active_business_id`, and redirects to `route('dashboard')`.

### 3.2 Multi-Business Creation (`/dashboard/businesses/create`)
- Shares the same business-type card selector + category preset component as Onboarding.
- Respects `PlanLimitService::canCreateBusiness($user)` and enforces immutable `business_type` on creation.

---

## 4. Technical Implementation Plan (By Area)

### Phase 1: Database Schema, Models & Seeders
- **Migrations**:
  - Add `business_type` (`string`, e.g., `'staff_appointment'`, `'space_booking'`, `'dropoff'`) to `businesses` table (`app/Models/Business.php`).
  - Add `unit_label` (`string`, default `'item'`) to `services` table (`app/Models/Service.php`), and optionally `unit_label` snapshot to `bookings` table (`app/Models/Booking.php`).
  - Backfill rule in migration (for safety even in dev): infer `business_type` from existing services (`dropoff` > `capacity` > `staff_appointment`).
- **Model Updates**:
  - `App\Models\Business`:
    - Define constants: `TYPE_STAFF_APPOINTMENT = 'staff_appointment'`, `TYPE_SPACE_BOOKING = 'space_booking'`, `TYPE_DROPOFF = 'dropoff'`, `TYPES = [...]`.
    - Add helper methods: `isStaffAppointment()`, `isSpaceBooking()`, `isDropoff()`, `serviceBookingMode()`, `serviceAssignmentMode()`, `supportsStaffScheduling()`, `supportsCommissions()`.
    - Replace or deprecate `primaryBookingMode()` so everything reads `$this->business_type` directly.
    - Make `defaultWhatsappTemplates(?string $businessType = null)` return tailored Indonesian defaults per `business_type`.
  - `App\Models\Service`:
    - Add `'unit_label'` to `$fillable` and define supported unit constants (`['item', 'pasang', 'kg', 'pcs', 'unit']` or validated whitelist).
- **Seeders**:
  - Refactor `database/seeders/DemoSeeder.php` and `database/seeders/ResponsiveQaSeeder.php` so each demo business has an explicit `business_type` (`staff_appointment`, `space_booking`, `dropoff`) and only services matching that business type.

### Phase 2: Auth, Onboarding & Middleware
- **Auth Refactor**:
  - Update `app/Http/Controllers/Auth/AuthController.php`: remove `business_name` & `business_category` validation from `register()`, remove `provisionNewOwner()` from both `register()` and `handleGoogleCallback()`.
  - Update `resources/js/pages/Auth/Register.tsx`: simplify form fields to account registration only.
- **Onboarding Flow**:
  - Add `OnboardingController` (or methods in `DashboardController`) with `GET /dashboard/onboarding` and `POST /dashboard/onboarding`.
  - Add middleware (e.g., `EnsureBusinessOnboarded` or integrate into `EnsureMerchantAccount` / route middleware group) to redirect verified merchants without a business to `onboarding.business` while letting staff/admin accounts resolve their attached business seamlessly.
  - Create `resources/js/pages/Dashboard/Onboarding.tsx` and extract a shared business type selector component reused by `resources/js/pages/Dashboard/Businesses/Create.tsx`.
  - Update `app/Http/Middleware/HandleInertiaRequests.php` and `resources/js/types/index.ts` (`BusinessSummary`): expose `business_type` (and remove/replace `primary_booking_mode`).

### Phase 3: Backend Controllers, Services & Notifications
- **`ServiceController.php`**:
  - Remove client-controlled `booking_mode` and `assignment_mode` overrides; force them server-side from `$business->serviceBookingMode()` and `$business->serviceAssignmentMode()`.
  - Validate `unit_label` when `$business->isDropoff()`.
- **`BookingController.php`**:
  - Remove `hasBothModes`, `modeCounts`, and `$modes` branching; determine behavior directly from `$business->business_type`.
  - Disable `calendar` view for `dropoff`; show it for `staff_appointment` and `space_booking`.
  - Guard `noShow` action if not applicable for `dropoff`.
  - Include `unit_label` in serialized booking data.
- **`StaffController.php`, `StaffScheduleController.php`, `CommissionController.php`**:
  - When `$business->isStaffAppointment()` is false:
    - `CommissionController`: abort `403` or `404` (`abort_unless($business->supportsCommissions(), 403)`).
    - `StaffScheduleController`: abort unless `$business->supportsStaffScheduling()`.
    - `StaffController`: force `commission_type = 'none'` and `commission_value = 0` for non-`staff_appointment` businesses, and skip seeding staff operating hours.
- **`SettingsController.php` & `DashboardController.php`**:
  - Do not allow editing `business_type` in Settings (immutable).
  - Return `business_type`-tailored `default_whatsapp_templates` and onboarding checklist flags (e.g., omit `has_staff` requirement for `space_booking` & `dropoff`).
- **Notifications & Reminders**:
  - Update `CustomerBookingStatusNotification.php`, `CustomerBookingReminderNotification.php`, `MerchantBookingAlertNotification.php`, `BookingNotificationService.php`, `TelegramNotificationService.php`, and `SendBookingReminders.php` so subjects, body lines, and placeholders adapt cleanly to `staff_appointment`, `space_booking`, and `dropoff` (including `unit_label`).
- **`SlotAvailabilityService.php`**:
  - Ensure all drop-off error messages use the service's `unit_label` (e.g., `"Sisa kuota pada tanggal tersebut hanya {$remaining} {$unitLabel}."`) instead of hardcoded `"item"`, and skip staff queries for `space_booking` & `dropoff`.

### Phase 4: Frontend Copywriting, Dashboard, Public Portal & Landing Page
- **Centralized Copywriting Dictionary**:
  - Create `resources/js/lib/businessType.ts` exporting per-`business_type` copy dictionaries (nav labels, page titles, CTA labels, form labels, empty states, status descriptions, category presets, WA template visibility).
- **Dashboard Pages**:
  - `resources/js/layouts/DashboardLayout.tsx`: dynamic sidebar & bottom-nav labels, hide `Komisi Staff` for non-`staff_appointment`, rename `Tim & Staff` → `Tim & Admin` for `space_booking` / `dropoff`.
  - `resources/js/pages/Dashboard/Index.tsx`: adaptive KPIs, onboarding checklist (2 steps for `space_booking`/`dropoff`, 3 steps for `staff_appointment`), recent items copy.
  - `resources/js/pages/Dashboard/Services/Form.tsx` & `Index.tsx`: remove `Tipe Penjadwalan Layanan` toggle and `Cara Membatasi Jadwal` dropdown; show only fields relevant to `activeBusiness.business_type` (including `unit_label` selector for `dropoff`).
  - `resources/js/pages/Dashboard/Bookings/Index.tsx` & `Create.tsx` & `Cancel.tsx` & `Reschedule.tsx`: remove dual-mode toggle (`hasBothModes`), apply adaptive copy & `unit_label`.
  - `resources/js/pages/Dashboard/Staff/*`: adapt UI to hide commission/personal schedule sections when `business_type !== 'staff_appointment'`.
  - `resources/js/pages/Dashboard/Schedule/Index.tsx`: adapt info banner and labels per `business_type`.
  - `resources/js/pages/Dashboard/Settings/Index.tsx` & `resources/js/lib/whatsappTemplates.ts`: show locked business type badge (read-only), hide irrelevant booking rules (H-2h reminder, minute lead time, no-show DP for `dropoff`), filter WA template tabs (`ready_for_pickup` only for `dropoff`) & placeholders (`{staff_name}` only for `staff_appointment`).
- **Public Portal (`/b/{slug}`)**:
  - `resources/js/pages/Public/BusinessHome.tsx`: adaptive CTA & service summary badges (`unit_label` for drop-off, capacity for space booking, duration for appointment).
  - `resources/js/pages/Public/BookingPortal.tsx`, `BookingStatus.tsx`, `InvoiceLookup.tsx`: step headers, quantity stepper with `unit_label`, staff step only for `staff_appointment`, adaptive labels on invoice & status tracker.
- **Marketing Landing Page (`/`)**:
  - `resources/js/pages/Landing.tsx`: update hero copy, vertical pills, outcome sections, and FAQ so all three business types (`staff_appointment`, `space_booking`, and `dropoff` such as Laundry & Cuci Sepatu) are equally represented.

### Phase 5: Verification & Test Suite
- Update existing PHPUnit feature tests (`tests/Feature/JanjiyanBookingTest.php`, `DropoffBookingModeTest.php`, `BusinessHomePageTest.php`, `MerchantProductivityAndCommissionTest.php`, `PanelPermissionsTest.php`, `Phase1SecurityTest.php`, `Phase2FeaturesTest.php`, etc.) to align with the new registration → onboarding flow and locked `business_type`.
- Add new feature tests verifying:
  - Email registration & Google OAuth redirect new owners to onboarding before accessing dashboard.
  - Invited staff bypass onboarding.
  - `business_type` cannot be mutated via Settings or Service forms.
  - `ServiceController` enforces mode from `business_type` even if tampered in POST/PUT payload.
  - `CommissionController` & `StaffScheduleController` reject non-`staff_appointment` businesses.
  - Custom `unit_label` validation and quota messages on `dropoff`.
- Run full verification after changes:
  - `php artisan test`
  - Typecheck & Vite build (`npm run build` / `npx tsc --noEmit`)
  - Playwright E2E checks if applicable.
