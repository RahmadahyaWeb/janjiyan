<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\User;
use App\Services\PlanLimitService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

class AuthController extends Controller
{
    public function showLogin(): Response
    {
        return Inertia::render('Auth/Login', [
            'googleEnabled' => filled(config('services.google.client_id')),
        ]);
    }

    public function login(Request $request): RedirectResponse|SymfonyResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors([
                'email' => 'Email atau kata sandi tidak sesuai.',
            ])->onlyInput('email');
        }

        $request->session()->regenerate();
        $target = redirect()->intended(route('dashboard'))->getTargetUrl();

        if ($request->header('X-Inertia')) {
            return Inertia::location($target);
        }

        return redirect()->to($target);
    }

    public function showRegister(): Response
    {
        return Inertia::render('Auth/Register', [
            'googleEnabled' => filled(config('services.google.client_id')),
        ]);
    }

    public function register(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'business_name' => ['required', 'string', 'max:120'],
            'business_category' => ['required', 'string', 'max:80'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        $this->provisionNewOwner($user, $validated['business_name'], $validated['business_category']);

        event(new Registered($user));

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('verification.notice')
            ->with('success', 'Akun berhasil dibuat! Silakan verifikasi email Anda melalui tautan yang kami kirimkan.');
    }

    public function redirectToGoogle(): RedirectResponse
    {
        if (! filled(config('services.google.client_id'))) {
            return redirect()->route('login')->with('error', 'Google OAuth belum dikonfigurasi di .env (GOOGLE_CLIENT_ID).');
        }

        return Socialite::driver('google')->redirect();
    }

    public function handleGoogleCallback(Request $request): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable) {
            return redirect()->route('login')->with('error', 'Autentikasi Google dibatalkan atau gagal.');
        }

        $rawUser = is_array($googleUser->user ?? null) ? $googleUser->user : [];
        $googleEmailVerified = (bool) ($rawUser['email_verified'] ?? $rawUser['verified_email'] ?? false);
        $googleEmail = strtolower(trim((string) $googleUser->getEmail()));

        if ($googleEmail === '') {
            return redirect()->route('login')->with('error', 'Akun Google Anda tidak memiliki alamat email yang valid.');
        }

        $user = User::where('google_id', $googleUser->getId())->first();

        if (! $user) {
            $existingByEmail = User::where('email', $googleEmail)->first();

            if ($existingByEmail) {
                if (! $googleEmailVerified) {
                    return redirect()->route('login')->with('error', 'Email Google Anda belum terverifikasi sehingga tidak dapat ditautkan otomatis ke akun yang sudah ada.');
                }

                $user = $existingByEmail;
            }
        }

        if (! $user) {
            if (! $googleEmailVerified) {
                return redirect()->route('login')->with('error', 'Email Google Anda harus terverifikasi untuk mendaftar akun baru.');
            }

            $user = User::create([
                'name' => $googleUser->getName() ?: 'Merchant Janjiyan',
                'email' => $googleEmail,
                'google_id' => $googleUser->getId(),
                'avatar_url' => $googleUser->getAvatar(),
                'email_verified_at' => now(),
            ]);

            $this->provisionNewOwner($user, $user->name.' Studio', 'Jasa & Layanan');
        } else {
            $user->update([
                'google_id' => $user->google_id ?: $googleUser->getId(),
                'avatar_url' => $googleUser->getAvatar() ?: $user->avatar_url,
                'email_verified_at' => $user->email_verified_at ?: ($googleEmailVerified ? now() : null),
            ]);
        }

        Auth::login($user, true);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function logout(Request $request): RedirectResponse|SymfonyResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->header('X-Inertia')) {
            return Inertia::location(route('home'));
        }

        return redirect()->route('home');
    }

    private function provisionNewOwner(User $user, string $businessName, string $category): void
    {
        app(PlanLimitService::class)->ensureTrialSubscription($user);

        $baseSlug = Str::slug($businessName) ?: 'bisnis';
        $slug = $baseSlug;
        $counter = 1;
        while (Business::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $business = Business::create([
            'owner_id' => $user->id,
            'name' => $businessName,
            'slug' => $slug,
            'category' => $category,
            'timezone' => 'Asia/Jakarta',
            'dp_expiry_minutes' => 120,
        ]);

        $business->users()->attach($user->id, [
            'role' => 'owner',
            'permissions' => json_encode(['*']),
        ]);
        $business->seedDefaultOperatingHours();

        $user->update(['active_business_id' => $business->id]);
    }
}
