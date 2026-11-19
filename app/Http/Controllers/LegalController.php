<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class LegalController extends Controller
{
    public function terms(): Response
    {
        return Inertia::render('Legal/Terms', [
            'legal' => config('app.legal'),
        ])->withViewData('seo', [
            'title' => 'Syarat & Ketentuan — Janjiyan',
            'description' => 'Ketentuan penggunaan layanan SaaS reservasi online Janjiyan bagi merchant dan pelanggan.',
            'url' => route('legal.terms'),
        ]);
    }

    public function privacy(): Response
    {
        return Inertia::render('Legal/Privacy', [
            'legal' => config('app.legal'),
        ])->withViewData('seo', [
            'title' => 'Kebijakan Privasi — Janjiyan',
            'description' => 'Kebijakan pengelolaan, penyimpanan, dan perlindungan data pengguna pada platform Janjiyan.',
            'url' => route('legal.privacy'),
        ]);
    }
}
