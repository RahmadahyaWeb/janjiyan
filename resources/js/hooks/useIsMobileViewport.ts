import * as React from 'react';

/** Returns true when the viewport matches Tailwind's `< sm` breakpoint (`max-width: 639px`). */
export function useIsMobileViewport(): boolean {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mediaQuery = window.matchMedia('(max-width: 639px)');
        const sync = () => setIsMobile(mediaQuery.matches);
        sync();
        mediaQuery.addEventListener('change', sync);
        return () => mediaQuery.removeEventListener('change', sync);
    }, []);

    return isMobile;
}
