<!DOCTYPE html>
<html lang="id">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>@yield('code') — @yield('title') | Janjiyan</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <style>
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                min-height: 100vh;
                background: #ffffff;
                color: #141414;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
                -webkit-font-smoothing: antialiased;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 24px;
            }
            main {
                width: 100%;
                max-width: 480px;
                text-align: center;
            }
            .brand {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
                color: #141414;
                font-weight: 600;
                font-size: 18px;
                margin-bottom: 32px;
                border-radius: 9999px;
                padding: 4px 8px;
            }
            .brand:focus-visible, .btn:focus-visible {
                outline: 2px solid #141414;
                outline-offset: 2px;
            }
            .squircle {
                width: 34px;
                height: 34px;
                border-radius: 30%;
                background: #141414;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .card {
                background: #f3f3f3;
                border-radius: 24px;
                padding: 36px 28px;
            }
            .code {
                display: inline-block;
                background: #ffffff;
                color: #141414;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                font-variant-numeric: tabular-nums;
                font-size: 13px;
                font-weight: 600;
                padding: 6px 14px;
                border-radius: 9999px;
                margin-bottom: 16px;
            }
            h1 {
                font-size: 28px;
                line-height: 1.2;
                font-weight: 650;
                margin-bottom: 12px;
            }
            p {
                font-size: 15px;
                line-height: 1.6;
                color: #525252;
                margin-bottom: 28px;
            }
            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: center;
            }
            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 44px;
                padding: 0 22px;
                border-radius: 9999px;
                font-size: 14px;
                font-weight: 600;
                text-decoration: none;
                cursor: pointer;
                border: 1px solid transparent;
                transition: background-color 150ms ease-out, transform 150ms ease-out;
            }
            .btn:active { transform: scale(0.96); }
            .btn-primary {
                background: #141414;
                color: #ffffff;
            }
            .btn-primary:hover { background: #262626; }
            .btn-outline {
                background: #ffffff;
                color: #141414;
                border-color: #8c8c8c;
            }
            .btn-outline:hover { background: #f3f3f3; }
        </style>
    </head>
    <body>
        <main>
            <a href="/" class="brand" aria-label="Kembali ke beranda Janjiyan">
                <span class="squircle">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M17.8 5.0 V13.2 A5.9 5.9 0 0 1 6.0 13.2 V9.0 A3.9 3.9 0 1 1 13.8 9.0 V11.4" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                        <circle cx="9.9" cy="9.0" r="1.8" fill="#2b7fff" />
                    </svg>
                </span>
                <span>Janjiyan</span>
            </a>

            <div class="card">
                <span class="code">Error @yield('code')</span>
                <h1>@yield('title')</h1>
                <p>@yield('message')</p>
                <div class="actions">
                    @yield('actions')
                </div>
            </div>
        </main>
    </body>
</html>
