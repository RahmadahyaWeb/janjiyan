<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Services\TelegramNotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(! $business || $user->hasBusinessPermission($business, 'manage_settings'), 403);
        $rawToken = $business ? trim((string) ($business->telegram_bot_token ?? '')) : '';

        return Inertia::render('Dashboard/Settings/Index', [
            'business' => $business ? [
                'id' => $business->id,
                'name' => $business->name,
                'slug' => $business->slug,
                'category' => $business->category,
                'description' => $business->description,
                'qr_poster_subtitle' => $business->qr_poster_subtitle,
                'phone' => $business->phone,
                'address' => $business->address,
                'timezone' => $business->timezone,
                'dp_expiry_minutes' => $business->dp_expiry_minutes,
                'min_booking_lead_minutes' => (int) ($business->min_booking_lead_minutes ?? 15),
                'max_booking_advance_days' => (int) ($business->max_booking_advance_days ?? 60),
                'reminder_h1_enabled' => (bool) ($business->reminder_h1_enabled ?? true),
                'reminder_h2_enabled' => (bool) ($business->reminder_h2_enabled ?? true),
                'whatsapp_templates' => $business->resolvedWhatsappTemplates(),
                'default_whatsapp_templates' => Business::defaultWhatsappTemplates(),
                'telegram_notifications_enabled' => (bool) ($business->telegram_notifications_enabled ?? false),
                'telegram_chat_id' => $business->telegram_chat_id ?? '',
                'has_telegram_bot_token' => $rawToken !== '',
                'telegram_bot_token_hint' => $rawToken !== '' ? '••••'.substr($rawToken, -4) : null,
                'no_show_require_full_dp' => (bool) ($business->no_show_require_full_dp ?? false),
                'no_show_dp_threshold' => (int) ($business->no_show_dp_threshold ?? 2),
                'is_active' => (bool) $business->is_active,
                'is_owner' => (int) $business->owner_id === (int) $user->id,
                'bank_accounts' => $business->bank_accounts ?? [],
                'qris_url' => $business->qris_path ? Storage::url($business->qris_path) : null,
                'logo_url' => $business->logo_path ? Storage::url($business->logo_path) : null,
                'brand_color' => $business->brand_color,
                'cover_url' => $business->cover_path ? Storage::url($business->cover_path) : null,
            ] : null,
            'galleries' => $business
                ? $business->galleries()->get()->map(fn ($g) => [
                    'id' => $g->id,
                    'image_url' => Storage::url($g->image_path),
                    'caption' => $g->caption,
                ])->values()
                : [],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_settings'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['required', 'alpha_dash', 'max:80', Rule::unique('businesses', 'slug')->ignore($business->id)],
            'category' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'qr_poster_subtitle' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'timezone' => ['required', 'string', 'timezone', 'max:60'],
            'dp_expiry_minutes' => ['required', 'integer', 'min:15', 'max:1440'],
            'min_booking_lead_minutes' => ['sometimes', 'integer', 'min:0', 'max:10080'],
            'max_booking_advance_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'reminder_h1_enabled' => ['sometimes', 'boolean'],
            'reminder_h2_enabled' => ['sometimes', 'boolean'],
            'whatsapp_templates' => ['sometimes', 'nullable', 'array'],
            'whatsapp_templates.reminder' => ['nullable', 'string', 'max:1500'],
            'whatsapp_templates.dp_verified' => ['nullable', 'string', 'max:1500'],
            'whatsapp_templates.confirmed' => ['nullable', 'string', 'max:1500'],
            'whatsapp_templates.ready_for_pickup' => ['nullable', 'string', 'max:1500'],
            'whatsapp_templates.follow_up' => ['nullable', 'string', 'max:1500'],
            'telegram_notifications_enabled' => ['sometimes', 'boolean'],
            'telegram_bot_token' => ['nullable', 'string', 'max:200', 'regex:/^\d+:[A-Za-z0-9_-]{20,}$/'],
            'clear_telegram_token' => ['sometimes', 'boolean'],
            'telegram_chat_id' => ['nullable', 'string', 'max:64', 'regex:/^-?\d{5,20}$/'],
            'no_show_require_full_dp' => ['sometimes', 'boolean'],
            'no_show_dp_threshold' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'bank_accounts' => ['nullable', 'array'],
            'bank_accounts.*.bank_name' => ['required', 'string', 'max:50'],
            'bank_accounts.*.account_number' => ['required', 'string', 'max:50'],
            'bank_accounts.*.account_holder' => ['required', 'string', 'max:100'],
            'qris_image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'remove_qris' => ['nullable', 'boolean'],
            'logo_image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remove_logo' => ['nullable', 'boolean'],
            'brand_color' => ['sometimes', 'nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'cover_image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_cover' => ['nullable', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $qrisPath = $business->qris_path;
        if ($request->boolean('remove_qris') && $qrisPath) {
            Storage::disk('public')->delete($qrisPath);
            $qrisPath = null;
        }
        if ($request->hasFile('qris_image')) {
            if ($qrisPath) {
                Storage::disk('public')->delete($qrisPath);
            }
            $qrisPath = $request->file('qris_image')->store('qris', 'public');
        }

        $logoPath = $business->logo_path;
        if ($request->boolean('remove_logo') && $logoPath) {
            Storage::disk('public')->delete($logoPath);
            $logoPath = null;
        }
        if ($request->hasFile('logo_image')) {
            if ($logoPath) {
                Storage::disk('public')->delete($logoPath);
            }
            $logoPath = $request->file('logo_image')->store('logos', 'public');
        }

        $coverPath = $business->cover_path;
        if ($request->boolean('remove_cover') && $coverPath) {
            Storage::disk('public')->delete($coverPath);
            $coverPath = null;
        }
        if ($request->hasFile('cover_image')) {
            if ($coverPath) {
                Storage::disk('public')->delete($coverPath);
            }
            $coverPath = $request->file('cover_image')->store('covers', 'public');
        }

        $telegramBotToken = $business->telegram_bot_token;
        if ($request->boolean('clear_telegram_token')) {
            $telegramBotToken = null;
        } elseif (! empty($validated['telegram_bot_token'])) {
            $telegramBotToken = trim((string) $validated['telegram_bot_token']);
        }

        $telegramEnabled = array_key_exists('telegram_notifications_enabled', $validated)
            ? (bool) $validated['telegram_notifications_enabled']
            : (bool) ($business->telegram_notifications_enabled ?? false);

        if ($request->boolean('clear_telegram_token')) {
            $telegramEnabled = false;
        }

        $whatsappTemplates = $business->whatsapp_templates;
        if (array_key_exists('whatsapp_templates', $validated) && is_array($validated['whatsapp_templates'])) {
            $defaults = Business::defaultWhatsappTemplates();
            $sanitizedTemplates = [];
            foreach (array_keys($defaults) as $key) {
                $val = isset($validated['whatsapp_templates'][$key])
                    ? trim((string) $validated['whatsapp_templates'][$key])
                    : '';
                if ($val !== '') {
                    $sanitizedTemplates[$key] = $val;
                }
            }
            $whatsappTemplates = $sanitizedTemplates;
        }

        $business->update([
            'name' => $validated['name'],
            'slug' => strtolower($validated['slug']),
            'category' => $validated['category'],
            'description' => $validated['description'] ?? null,
            'qr_poster_subtitle' => array_key_exists('qr_poster_subtitle', $validated)
                ? (trim((string) ($validated['qr_poster_subtitle'] ?? '')) ?: null)
                : $business->qr_poster_subtitle,
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'] ?? null,
            'timezone' => $validated['timezone'],
            'dp_expiry_minutes' => $validated['dp_expiry_minutes'],
            'min_booking_lead_minutes' => array_key_exists('min_booking_lead_minutes', $validated)
                ? (int) $validated['min_booking_lead_minutes']
                : (int) ($business->min_booking_lead_minutes ?? 15),
            'max_booking_advance_days' => array_key_exists('max_booking_advance_days', $validated)
                ? (int) $validated['max_booking_advance_days']
                : (int) ($business->max_booking_advance_days ?? 60),
            'reminder_h1_enabled' => array_key_exists('reminder_h1_enabled', $validated)
                ? (bool) $validated['reminder_h1_enabled']
                : (bool) ($business->reminder_h1_enabled ?? true),
            'reminder_h2_enabled' => array_key_exists('reminder_h2_enabled', $validated)
                ? (bool) $validated['reminder_h2_enabled']
                : (bool) ($business->reminder_h2_enabled ?? true),
            'whatsapp_templates' => $whatsappTemplates,
            'telegram_notifications_enabled' => $telegramEnabled,
            'telegram_bot_token' => $telegramBotToken,
            'telegram_chat_id' => array_key_exists('telegram_chat_id', $validated)
                ? ($validated['telegram_chat_id'] ? trim((string) $validated['telegram_chat_id']) : null)
                : $business->telegram_chat_id,
            'no_show_require_full_dp' => array_key_exists('no_show_require_full_dp', $validated)
                ? (bool) $validated['no_show_require_full_dp']
                : (bool) ($business->no_show_require_full_dp ?? false),
            'no_show_dp_threshold' => array_key_exists('no_show_dp_threshold', $validated)
                ? (int) $validated['no_show_dp_threshold']
                : (int) ($business->no_show_dp_threshold ?? 2),
            'bank_accounts' => $validated['bank_accounts'] ?? [],
            'qris_path' => $qrisPath,
            'logo_path' => $logoPath,
            'cover_path' => $coverPath,
            'brand_color' => array_key_exists('brand_color', $validated)
                ? ($validated['brand_color'] ? strtolower($validated['brand_color']) : null)
                : $business->brand_color,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $business->is_active,
        ]);

        return back()->with('success', 'Pengaturan bisnis berhasil disimpan.');
    }

    public function testTelegram(Request $request, TelegramNotificationService $telegramService): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_settings'), 403);

        $result = $telegramService->sendTestMessage($business);

        return back()->with($result['ok'] ? 'success' : 'error', $result['message']);
    }

    public function updateQrSubtitle(Request $request): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_settings'), 403);

        $validated = $request->validate([
            'qr_poster_subtitle' => ['nullable', 'string', 'max:120'],
        ]);

        $subtitle = trim((string) ($validated['qr_poster_subtitle'] ?? ''));

        $business->update([
            'qr_poster_subtitle' => $subtitle !== '' ? $subtitle : null,
        ]);

        return back()->with('success', 'Sub-headline poster QR berhasil disimpan.');
    }
}
