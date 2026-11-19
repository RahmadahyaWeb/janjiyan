<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        @php
            $appName = config('app.name', 'Janjiyan');
            $seoTitle = $seo['title'] ?? "{$appName} — Sistem booking dan DP untuk bisnis jasa";
            $seoDescription = $seo['description'] ?? 'Atur janji temu lebih pasti lewat link di bio Instagram atau poster QR di meja kasir. DP masuk langsung ke rekening kamu tanpa potongan, lengkap dengan pengingat otomatis. Gratis 14 hari.';
            $seoImage = $seo['image'] ?? url('/og-default.png');
            $seoUrl = $seo['url'] ?? url()->current();
            $seoNoindex = (bool) ($seo['noindex'] ?? false)
                || request()->routeIs('dashboard', 'dashboard.*', 'admin.*', 'login', 'register', 'password.*', 'verification.*');
        @endphp
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#141414" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="{{ $appName }}" />
        <link rel="manifest" href="/manifest.json" />
        @if ($seoNoindex)
            <meta head-key="robots" name="robots" content="noindex, nofollow" />
        @endif
        <title inertia>{{ $seoTitle }}</title>
        <link head-key="canonical" rel="canonical" href="{{ $seoUrl }}" />
        <meta head-key="description" name="description" content="{{ $seoDescription }}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="{{ $appName }}" />
        <meta head-key="og:title" property="og:title" content="{{ $seoTitle }}" />
        <meta head-key="og:description" property="og:description" content="{{ $seoDescription }}" />
        <meta head-key="og:image" property="og:image" content="{{ $seoImage }}" />
        <meta head-key="og:url" property="og:url" content="{{ $seoUrl }}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta head-key="twitter:title" name="twitter:title" content="{{ $seoTitle }}" />
        <meta head-key="twitter:description" name="twitter:description" content="{{ $seoDescription }}" />
        <meta head-key="twitter:image" name="twitter:image" content="{{ $seoImage }}" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
            href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Inter:opsz,wght@14..32,300..700&display=swap"
            rel="stylesheet"
        />
        @auth
            @routes
        @else
            @routes('public')
        @endauth
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="bg-canvas text-ink font-sans antialiased selection:bg-ink selection:text-canvas">
        @inertia
        <script>
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
            }
        </script>
    </body>
</html>
