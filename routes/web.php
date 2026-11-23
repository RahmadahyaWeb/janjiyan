<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Dashboard\BillingController;
use App\Http\Controllers\Dashboard\BookingController;
use App\Http\Controllers\Dashboard\BusinessController;
use App\Http\Controllers\Dashboard\CommissionController;
use App\Http\Controllers\Dashboard\CustomerController;
use App\Http\Controllers\Dashboard\DashboardController;
use App\Http\Controllers\Dashboard\GalleryController;
use App\Http\Controllers\Dashboard\NotificationController;
use App\Http\Controllers\Dashboard\OnboardingController;
use App\Http\Controllers\Dashboard\ProfileController;
use App\Http\Controllers\Dashboard\ReviewController;
use App\Http\Controllers\Dashboard\ScheduleController;
use App\Http\Controllers\Dashboard\ServiceAddonController;
use App\Http\Controllers\Dashboard\ServiceController;
use App\Http\Controllers\Dashboard\SettingsController;
use App\Http\Controllers\Dashboard\StaffController;
use App\Http\Controllers\Dashboard\StaffScheduleController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\LegalController;
use App\Http\Controllers\PublicBookingController;
use App\Http\Controllers\PublicReviewController;
use App\Http\Controllers\Webhooks\MayarWebhookController;
use Illuminate\Support\Facades\Route;

// Public Marketing Landing Page
Route::get('/', [LandingController::class, 'index'])->name('home');
Route::get('/sitemap.xml', [LandingController::class, 'sitemap'])->name('sitemap');
Route::get('/terms', [LegalController::class, 'terms'])->name('legal.terms');
Route::get('/privacy', [LegalController::class, 'privacy'])->name('legal.privacy');

// Payment Gateway Webhooks (CSRF-exempt via bootstrap/app.php)
Route::post('/webhooks/mayar', [MayarWebhookController::class, 'handle'])
    ->middleware('throttle:120,1')
    ->name('webhooks.mayar');

// Public Booking Portal (/b/{slug})
Route::prefix('b/{slug}')->group(function () {
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

// Authentication
Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:auth-login')
        ->name('login.attempt');
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register'])
        ->middleware('throttle:auth-register')
        ->name('register.store');

    Route::get('/forgot-password', [PasswordResetController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetController::class, 'store'])
        ->middleware('throttle:auth-password-reset')
        ->name('password.email');
    Route::get('/reset-password/{token}', [PasswordResetController::class, 'edit'])->name('password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'update'])
        ->middleware('throttle:auth-password-reset')
        ->name('password.update');

    Route::get('/auth/google', [AuthController::class, 'redirectToGoogle'])
        ->middleware('throttle:auth-oauth')
        ->name('auth.google');
    Route::get('/auth/google/callback', [AuthController::class, 'handleGoogleCallback'])
        ->middleware('throttle:auth-oauth')
        ->name('auth.google.callback');
});

Route::middleware('auth')->group(function () {
    Route::get('/email/verify', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'send'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
});

// Business Onboarding (accessible before a merchant has created/joined a business)
Route::middleware(['auth', 'verified', 'merchant'])->prefix('dashboard')->group(function () {
    Route::get('/onboarding', [OnboardingController::class, 'show'])->name('onboarding.business');
    Route::post('/onboarding', [OnboardingController::class, 'store'])->name('onboarding.business.store');
});

// Merchant Dashboard
Route::middleware(['auth', 'verified', 'merchant', 'onboarded'])->prefix('dashboard')->group(function () {
    // Read-only & account/billing routes (remain accessible during soft-lock)
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/businesses/create', [BusinessController::class, 'create'])->name('dashboard.businesses.create');
    Route::post('/businesses/switch', [DashboardController::class, 'switchBusiness'])->name('dashboard.businesses.switch');
    Route::delete('/businesses/{business}', [DashboardController::class, 'destroyBusiness'])->name('dashboard.businesses.destroy');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('dashboard.profile');
    Route::put('/profile', [ProfileController::class, 'update'])->name('dashboard.profile.update');
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->name('dashboard.profile.password');

    Route::get('/bookings', [BookingController::class, 'index'])->name('dashboard.bookings');
    Route::get('/bookings/create', [BookingController::class, 'create'])->name('dashboard.bookings.create');
    Route::get('/bookings/{booking}/reschedule', [BookingController::class, 'editReschedule'])->name('dashboard.bookings.reschedule.edit');
    Route::get('/bookings/{booking}/cancel', [BookingController::class, 'editCancel'])->name('dashboard.bookings.cancel.edit');
    Route::get('/bookings/slots', [BookingController::class, 'slots'])->name('dashboard.bookings.slots');
    Route::get('/bookings/{booking}/proof', [BookingController::class, 'proof'])->name('dashboard.bookings.proof');
    Route::get('/cashier/summary', [BookingController::class, 'cashierSummary'])->name('dashboard.cashier.summary');

    Route::get('/services', [ServiceController::class, 'index'])->name('dashboard.services');
    Route::get('/services/create', [ServiceController::class, 'create'])->name('dashboard.services.create');
    Route::get('/services/{service}/edit', [ServiceController::class, 'edit'])->name('dashboard.services.edit');
    Route::get('/staff', [StaffController::class, 'index'])->name('dashboard.staff');
    Route::get('/staff/create', [StaffController::class, 'create'])->name('dashboard.staff.create');
    Route::get('/staff/{staff}/edit', [StaffController::class, 'edit'])->name('dashboard.staff.edit');
    Route::get('/staff/{staff}/schedule/manage', [StaffScheduleController::class, 'edit'])->name('dashboard.staff.schedule.edit');
    Route::get('/staff/{staff}/schedule', [StaffScheduleController::class, 'show'])->name('dashboard.staff.schedule.show');
    Route::get('/staff/{staff}/calendar.ics', [StaffController::class, 'calendarIcs'])->name('dashboard.staff.calendar.ics');
    Route::get('/commissions', [CommissionController::class, 'index'])->name('dashboard.commissions');
    Route::get('/schedule', [ScheduleController::class, 'index'])->name('dashboard.schedule');
    Route::get('/customers', [CustomerController::class, 'index'])->name('dashboard.customers');
    Route::get('/customers/lookup', [CustomerController::class, 'lookup'])->name('dashboard.customers.lookup');
    Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('dashboard.customers.show');
    Route::get('/reviews', [ReviewController::class, 'index'])->name('dashboard.reviews');
    Route::get('/settings', [SettingsController::class, 'index'])->name('dashboard.settings');

    Route::get('/notifications', [NotificationController::class, 'index'])->name('dashboard.notifications.index');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead'])->name('dashboard.notifications.read-all');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->name('dashboard.notifications.read');

    Route::get('/billing', [BillingController::class, 'index'])->name('dashboard.billing');
    Route::post('/billing/checkout', [BillingController::class, 'checkout'])
        ->middleware('throttle:billing-checkout')
        ->name('dashboard.billing.checkout');
    Route::post('/billing/invoices/{invoice}/check', [BillingController::class, 'checkInvoice'])
        ->middleware('throttle:billing-checkout')
        ->name('dashboard.billing.check-invoice');
    Route::post('/billing/switch', [BillingController::class, 'switchPlan'])->name('dashboard.billing.switch');

    // Operational write & export routes (soft-locked when subscription expired or business suspended)
    Route::middleware('writable.subscription')->group(function () {
        Route::post('/businesses', [BusinessController::class, 'store'])->name('dashboard.businesses.store');

        Route::post('/bookings', [BookingController::class, 'store'])->name('dashboard.bookings.store');
        Route::post('/bookings/{booking}/reschedule', [BookingController::class, 'reschedule'])->name('dashboard.bookings.reschedule');
        Route::patch('/bookings/{booking}/status', [BookingController::class, 'updateStatus'])->name('dashboard.bookings.status');
        Route::post('/bookings/{booking}/verify-dp', [BookingController::class, 'verifyDp'])->name('dashboard.bookings.verify-dp');
        Route::post('/bookings/{booking}/items', [BookingController::class, 'adjustItems'])->name('dashboard.bookings.items.update');
        Route::post('/bookings/{booking}/payments', [BookingController::class, 'recordPayment'])->name('dashboard.bookings.payments.store');
        Route::get('/cashier/export/csv', [BookingController::class, 'exportCashierCsv'])
            ->middleware('throttle:dashboard-export')
            ->name('dashboard.cashier.export');
        Route::get('/bookings/export/csv', [BookingController::class, 'exportCsv'])
            ->middleware('throttle:dashboard-export')
            ->name('dashboard.bookings.export');

        Route::post('/services', [ServiceController::class, 'store'])->name('dashboard.services.store');
        Route::put('/services/{service}', [ServiceController::class, 'update'])->name('dashboard.services.update');
        Route::delete('/services/{service}', [ServiceController::class, 'destroy'])->name('dashboard.services.destroy');

        Route::post('/addons', [ServiceAddonController::class, 'store'])->name('dashboard.addons.store');
        Route::put('/addons/{addon}', [ServiceAddonController::class, 'update'])->name('dashboard.addons.update');
        Route::delete('/addons/{addon}', [ServiceAddonController::class, 'destroy'])->name('dashboard.addons.destroy');

        Route::post('/staff', [StaffController::class, 'store'])->name('dashboard.staff.store');
        Route::put('/staff/{staff}', [StaffController::class, 'update'])->name('dashboard.staff.update');
        Route::delete('/staff/{staff}', [StaffController::class, 'destroy'])->name('dashboard.staff.destroy');
        Route::put('/staff/{staff}/schedule', [StaffScheduleController::class, 'updateHours'])->name('dashboard.staff.schedule.update');
        Route::post('/staff/{staff}/time-offs', [StaffScheduleController::class, 'storeTimeOff'])->name('dashboard.staff.time-offs.store');
        Route::delete('/staff/{staff}/time-offs/{timeOff}', [StaffScheduleController::class, 'destroyTimeOff'])->name('dashboard.staff.time-offs.destroy');

        Route::put('/schedule/hours', [ScheduleController::class, 'updateHours'])->name('dashboard.schedule.hours');
        Route::post('/schedule/holidays', [ScheduleController::class, 'storeHoliday'])->name('dashboard.schedule.holidays.store');
        Route::delete('/schedule/holidays/{holiday}', [ScheduleController::class, 'destroyHoliday'])->name('dashboard.schedule.holidays.destroy');

        Route::patch('/customers/{customer}', [CustomerController::class, 'update'])->name('dashboard.customers.update');
        Route::post('/customers/{customer}/merge', [CustomerController::class, 'merge'])->name('dashboard.customers.merge');
        Route::get('/customers/export/csv', [CustomerController::class, 'exportCsv'])
            ->middleware('throttle:dashboard-export')
            ->name('dashboard.customers.export');

        Route::get('/commissions/export/csv', [CommissionController::class, 'exportCsv'])
            ->middleware('throttle:dashboard-export')
            ->name('dashboard.commissions.export');

        Route::post('/settings', [SettingsController::class, 'update'])->name('dashboard.settings.update');
        Route::patch('/settings/qr-subtitle', [SettingsController::class, 'updateQrSubtitle'])->name('dashboard.settings.qr-subtitle');
        Route::patch('/settings/review-subtitle', [SettingsController::class, 'updateReviewSubtitle'])->name('dashboard.settings.review-subtitle');
        Route::post('/settings/telegram/test', [SettingsController::class, 'testTelegram'])
            ->middleware('throttle:5,1')
            ->name('dashboard.settings.telegram.test');
        Route::post('/settings/gallery', [GalleryController::class, 'store'])->name('dashboard.settings.gallery.store');
        Route::delete('/settings/gallery/{gallery}', [GalleryController::class, 'destroy'])->name('dashboard.settings.gallery.destroy');
    });
});

// Superadmin Panel
Route::middleware(['auth', 'verified', 'superadmin', 'throttle:admin-actions'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::get('/', [AdminController::class, 'index'])->name('index');
        Route::get('/users/{user}/trial', [AdminController::class, 'editTrial'])->name('users.trial.edit');
        Route::post('/users/{user}/extend-trial', [AdminController::class, 'extendTrial'])->name('users.extend-trial');
        Route::get('/users/{user}/plan', [AdminController::class, 'editPlan'])->name('users.plan.edit');
        Route::post('/users/{user}/activate-plan', [AdminController::class, 'activatePlan'])->name('users.activate-plan');
        Route::get('/businesses/{business}/suspend', [AdminController::class, 'editSuspend'])->name('businesses.suspend.edit');
        Route::post('/businesses/{business}/suspend', [AdminController::class, 'suspendBusiness'])->name('businesses.suspend');
        Route::post('/businesses/{business}/unsuspend', [AdminController::class, 'unsuspendBusiness'])->name('businesses.unsuspend');
    });
