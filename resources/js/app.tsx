import '../css/app.css';

import ErrorBoundary from '@/components/ErrorBoundary';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'sonner';

const appName = import.meta.env.VITE_APP_NAME || 'Janjiyan';

router.on('httpException', (event) => {
    event.preventDefault();
    toast.error('Terjadi gangguan pada server. Silakan coba beberapa saat lagi.');
});

router.on('networkError', (event) => {
    event.preventDefault();
    toast.error('Gagal terhubung ke server. Periksa koneksi internet Anda.');
});

router.on('success', (event) => {
    const flash = (event.detail.page.props as { flash?: { error?: string } }).flash;
    if (flash?.error) {
        toast.error(flash.error);
    }
});

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>('./pages/**/*.tsx'),
        ).then((mod) => mod.default),
    setup({ el, App, props }) {
        if (!el) return;
        createRoot(el).render(
            <ErrorBoundary>
                <App {...props} />
                <Toaster position="top-right" richColors closeButton />
            </ErrorBoundary>,
        );
    },
    progress: {
        color: '#0066ff',
    },
});
