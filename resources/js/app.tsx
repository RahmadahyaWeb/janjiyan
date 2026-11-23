import '../css/app.css';

import ErrorBoundary from '@/components/ErrorBoundary';
import { emitFlashToasts, type FlashPayload } from '@/lib/flashToast';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { type ComponentType, useEffect } from 'react';
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
    const flash = (event.detail.page.props as { flash?: FlashPayload }).flash;
    emitFlashToasts(flash);
});

let initialFlashHandled = false;

function InitialFlashEffect({ flash }: { flash?: FlashPayload }) {
    useEffect(() => {
        if (initialFlashHandled) {
            return;
        }
        initialFlashHandled = true;
        emitFlashToasts(flash);
    }, [flash]);

    return null;
}

// Reload starts at top: Inertia would otherwise restore the last saved scroll from history.state.
const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
if (navEntry?.type === 'reload' && window.history.state) {
    window.history.replaceState({ ...window.history.state, documentScrollPosition: { top: 0, left: 0 } }, '');
}

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>('./pages/**/*.tsx'),
        ).then((mod) => mod.default),
    setup({ el, App, props }) {
        if (!el) return;
        const initialFlash = (props.initialPage.props as { flash?: FlashPayload }).flash;

        createRoot(el).render(
            <ErrorBoundary>
                <App {...props} />
                <InitialFlashEffect flash={initialFlash} />
                <Toaster
                    position="top-right"
                    richColors
                    closeButton
                    toastOptions={{
                        className: 'print:hidden font-sans',
                    }}
                />
            </ErrorBoundary>,
        );
    },
    progress: {
        color: '#005ce6',
    },
});
