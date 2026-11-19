<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\BusinessGallery;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class GalleryController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_settings'), 403);

        if ($business->galleries()->count() >= 12) {
            return back()->with('error', 'Maksimal 12 foto portofolio per bisnis.');
        }

        $validated = $request->validate([
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'caption' => ['nullable', 'string', 'max:160'],
        ]);

        $path = $request->file('image')->store('galleries', 'public');
        $nextOrder = ((int) $business->galleries()->max('sort_order')) + 1;

        $business->galleries()->create([
            'image_path' => $path,
            'caption' => $validated['caption'] ?? null,
            'sort_order' => $nextOrder,
        ]);

        return back()->with('success', 'Foto portofolio berhasil ditambahkan.');
    }

    public function destroy(Request $request, BusinessGallery $gallery): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(
            $business && $gallery->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_settings'),
            403
        );

        if ($gallery->image_path) {
            Storage::disk('public')->delete($gallery->image_path);
        }

        $gallery->delete();

        return back()->with('success', 'Foto portofolio berhasil dihapus.');
    }
}
