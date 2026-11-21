<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Business;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EmailVerificationController extends Controller
{
    public function notice(Request $request): RedirectResponse|Response
    {
        if ($request->user()->hasVerifiedEmail()) {
            return $this->postVerificationRedirect($request);
        }

        return Inertia::render('Auth/VerifyEmail', [
            'status' => $request->session()->get('status'),
        ]);
    }

    public function verify(EmailVerificationRequest $request): RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return $this->postVerificationRedirect($request);
        }

        $request->fulfill();

        return $this->postVerificationRedirect($request)
            ->with('success', 'Email berhasil diverifikasi! Selamat datang di Janjiyan.');
    }

    public function send(Request $request): RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return $this->postVerificationRedirect($request);
        }

        try {
            $request->user()->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'Gagal mengirim email verifikasi. Coba lagi beberapa saat lagi.');
        }

        return back()->with('status', 'Tautan verifikasi baru telah dikirim ke alamat email Anda.');
    }

    private function postVerificationRedirect(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->is_superadmin) {
            return redirect()->route('admin.index');
        }

        $business = $user->resolveActiveBusiness();

        if (! $business || ! in_array($business->business_type, Business::TYPES, true)) {
            return redirect()->route('onboarding.business');
        }

        return redirect()->intended(route('dashboard'));
    }
}
