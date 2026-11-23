# Janjiyan UI Pages Inventory

This document lists and groups all UI pages in the Janjiyan application, mapped to their corresponding routes in `routes/web.php` and page components in `resources/js/pages/` and `resources/views/`.

**Summary:**
- **38 Inertia/React pages** (`resources/js/pages/`)
- **5 Blade HTTP error pages** + **1 Inertia root shell** (`resources/views/`)

---

## 1. Public Marketing & Legal (3 Pages)

Public-facing pages accessible without authentication.

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Landing Page | `GET /` | `home` | `resources/js/pages/Landing.tsx` | — |
| Terms & Conditions | `GET /terms` | `legal.terms` | `resources/js/pages/Legal/Terms.tsx` | — |
| Privacy Policy | `GET /privacy` | `legal.privacy` | `resources/js/pages/Legal/Privacy.tsx` | — |

---

## 2. Public Booking Portal & Customer Flow (6 Pages)

Customer-facing pages under `/b/{slug}` for viewing business profiles, booking appointments, checking invoices/status, and submitting reviews.

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Business Public Home | `GET /b/{slug}` | `public.booking` | `resources/js/pages/Public/BusinessHome.tsx` | — |
| Public Booking Form | `GET /b/{slug}/pesan` | `public.booking.form` | `resources/js/pages/Public/BookingPortal.tsx` | Clear |
| Booking Status & Invoice | `GET /b/{slug}/booking/{code}`<br>`GET /b/{slug}/invoice/{token}` | `public.booking.status`<br>`public.booking.invoice` | `resources/js/pages/Public/BookingStatus.tsx` | — |
| Customer Invoice Lookup | `GET /b/{slug}/invoices` | `public.booking.invoices` | `resources/js/pages/Public/InvoiceLookup.tsx` | — |
| Public Review Submission | `GET /b/{slug}/review` | `public.review.show` | `resources/js/pages/Public/ReviewSubmit.tsx` | — |
| Business Unavailable | *(Rendered when business is inactive/suspended)* | — | `resources/js/pages/Public/BusinessUnavailable.tsx` | — |

---

## 3. Authentication (5 Pages)

Authentication, registration, password reset, and email verification pages.

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Login | `GET /login` | `login` | `resources/js/pages/Auth/Login.tsx` | — |
| Register | `GET /register` | `register` | `resources/js/pages/Auth/Register.tsx` | — |
| Forgot Password | `GET /forgot-password` | `password.request` | `resources/js/pages/Auth/ForgotPassword.tsx` | — |
| Reset Password | `GET /reset-password/{token}` | `password.reset` | `resources/js/pages/Auth/ResetPassword.tsx` | — |
| Verify Email Notice | `GET /email/verify` | `verification.notice` | `resources/js/pages/Auth/VerifyEmail.tsx` | — |

---

## 4. Merchant Dashboard (20 Pages)

Authenticated merchant workspace under `/dashboard` (`auth`, `verified`, `merchant`, and `onboarded` middleware).

### 4.1 Onboarding & Business Management (2 Pages)

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Business Onboarding | `GET /dashboard/onboarding` | `onboarding.business` | `resources/js/pages/Dashboard/Onboarding.tsx` | — |
| Create New Business | `GET /dashboard/businesses/create` | `dashboard.businesses.create` | `resources/js/pages/Dashboard/Businesses/Create.tsx` | — |

### 4.2 Overview & Booking Operations (5 Pages)

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Dashboard Overview | `GET /dashboard` | `dashboard` | `resources/js/pages/Dashboard/Index.tsx` | — |
| Bookings List | `GET /dashboard/bookings` | `dashboard.bookings` | `resources/js/pages/Dashboard/Bookings/Index.tsx` | — |
| Create Booking | `GET /dashboard/bookings/create` | `dashboard.bookings.create` | `resources/js/pages/Dashboard/Bookings/Create.tsx` | — |
| Reschedule Booking | `GET /dashboard/bookings/{booking}/reschedule` | `dashboard.bookings.reschedule.edit` | `resources/js/pages/Dashboard/Bookings/Reschedule.tsx` | — |
| Cancel Booking | `GET /dashboard/bookings/{booking}/cancel` | `dashboard.bookings.cancel.edit` | `resources/js/pages/Dashboard/Bookings/Cancel.tsx` | — |

### 4.3 Services, Staff & Schedules (6 Pages)

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Services & Add-ons List | `GET /dashboard/services` | `dashboard.services` | `resources/js/pages/Dashboard/Services/Index.tsx` | — |
| Create / Edit Service | `GET /dashboard/services/create`<br>`GET /dashboard/services/{service}/edit` | `dashboard.services.create`<br>`dashboard.services.edit` | `resources/js/pages/Dashboard/Services/Form.tsx` | — |
| Staff List | `GET /dashboard/staff` | `dashboard.staff` | `resources/js/pages/Dashboard/Staff/Index.tsx` | — |
| Create / Edit Staff | `GET /dashboard/staff/create`<br>`GET /dashboard/staff/{staff}/edit` | `dashboard.staff.create`<br>`dashboard.staff.edit` | `resources/js/pages/Dashboard/Staff/Form.tsx` | — |
| Staff Schedule & Time-Off | `GET /dashboard/staff/{staff}/schedule`<br>`GET /dashboard/staff/{staff}/schedule/manage` | `dashboard.staff.schedule.show`<br>`dashboard.staff.schedule.edit` | `resources/js/pages/Dashboard/Staff/Schedule.tsx` | — |
| Business Hours & Holidays | `GET /dashboard/schedule` | `dashboard.schedule` | `resources/js/pages/Dashboard/Schedule/Index.tsx` | — |

### 4.4 Customers, Reviews & Commissions (4 Pages)

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Customers List (CRM) | `GET /dashboard/customers` | `dashboard.customers` | `resources/js/pages/Dashboard/Customers/Index.tsx` | — |
| Customer Detail | `GET /dashboard/customers/{customer}` | `dashboard.customers.show` | `resources/js/pages/Dashboard/Customers/Show.tsx` | — |
| Reviews Management | `GET /dashboard/reviews` | `dashboard.reviews` | `resources/js/pages/Dashboard/Reviews/Index.tsx` | — |
| Staff Commissions Report | `GET /dashboard/commissions` | `dashboard.commissions` | `resources/js/pages/Dashboard/Commissions/Index.tsx` | — |

### 4.5 Settings, Profile & Billing (3 Pages)

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Business Settings | `GET /dashboard/settings` | `dashboard.settings` | `resources/js/pages/Dashboard/Settings/Index.tsx` | — |
| Account Profile | `GET /dashboard/profile` | `dashboard.profile` | `resources/js/pages/Dashboard/Profile/Index.tsx` | — |
| Subscription & Billing | `GET /dashboard/billing` | `dashboard.billing` | `resources/js/pages/Dashboard/Billing/Index.tsx` | — |

---

## 5. Superadmin Panel (4 Pages)

Restricted panel under `/admin` (`superadmin` middleware) for platform administration.

| Page | Route | Route Name | Component | Status |
| --- | --- | --- | --- | --- |
| Superadmin Dashboard | `GET /admin` | `admin.index` | `resources/js/pages/Admin/Index.tsx` | — |
| Extend User Trial | `GET /admin/users/{user}/trial` | `admin.users.trial.edit` | `resources/js/pages/Admin/ExtendTrial.tsx` | — |
| Activate User Plan | `GET /admin/users/{user}/plan` | `admin.users.plan.edit` | `resources/js/pages/Admin/ActivatePlan.tsx` | — |
| Suspend / Unsuspend Business | `GET /admin/businesses/{business}/suspend` | `admin.businesses.suspend.edit` | `resources/js/pages/Admin/SuspendBusiness.tsx` | — |

---

## 6. Blade Views & Error Pages

Server-rendered Blade templates for the Inertia root shell and HTTP error pages.

| Purpose | View File |
| --- | --- |
| Inertia Root HTML Shell | `resources/views/app.blade.php` |
| Error Layout | `resources/views/errors/layout.blade.php` |
| 403 Forbidden | `resources/views/errors/403.blade.php` |
| 404 Not Found | `resources/views/errors/404.blade.php` |
| 419 Page Expired | `resources/views/errors/419.blade.php` |
| 500 Server Error | `resources/views/errors/500.blade.php` |
| 503 Service Unavailable | `resources/views/errors/503.blade.php` |
