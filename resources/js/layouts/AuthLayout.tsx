import { Link } from '@inertiajs/react';
import { ReactNode } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';

interface AuthLayoutProps {
    skipLabel: string;
    children: ReactNode;
}

/**
 * Minimal centered single-column layout for authentication pages.
 */
export default function AuthLayout({ skipLabel, children }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col justify-between bg-canvas px-6 py-8 text-ink sm:py-12">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                {skipLabel}
            </a>

            <header className="mx-auto flex w-full max-w-[400px] items-center justify-between">
                <Link
                    href={route('home')}
                    aria-label="Beranda Janjiyan"
                    className="inline-flex min-h-8 items-center rounded-full px-1 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    <JanjiyanLogo />
                </Link>
            </header>

            <main id="main-content" tabIndex={-1} className="mx-auto my-auto w-full max-w-[400px] py-10 outline-none">
                {children}
            </main>

            <footer className="mx-auto w-full max-w-[400px] text-center text-xs text-ash">
                © {new Date().getFullYear()} Janjiyan
            </footer>
        </div>
    );
}
