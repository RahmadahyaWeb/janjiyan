import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Button } from '@/components/ui/button';
import type { PageProps } from '@/types';

interface PublicLegalLayoutProps {
    title: string;
    description: string;
    children: ReactNode;
}

export default function PublicLegalLayout({ title, description, children }: PublicLegalLayoutProps) {
    const { auth } = usePage<PageProps>().props;

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <Head title={title}>
                <meta head-key="description" name="description" content={description} />
            </Head>

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke konten utama
            </a>

            <header className="sticky top-4 z-50 px-3 sm:px-4">
                <nav
                    aria-label="Navigasi legal"
                    className="mx-auto flex min-h-14 max-w-4xl flex-wrap items-center justify-between gap-2 rounded-[24px] bg-bone px-3 py-2 sm:h-14 sm:flex-nowrap sm:rounded-full sm:px-6 sm:py-0"
                >
                    <Link
                        href={route('home')}
                        className="inline-flex min-h-9 shrink-0 items-center rounded-full px-1 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                        aria-label="Beranda Janjiyan"
                    >
                        <JanjiyanLogo size="sm" compactMobile />
                    </Link>

                    <div className="flex items-center gap-1 text-xs font-semibold sm:gap-1.5 sm:text-sm">
                        <Link
                            href={route('legal.terms')}
                            aria-current={route().current('legal.terms') ? 'page' : undefined}
                            className={`inline-flex min-h-9 items-center rounded-full px-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-3 ${
                                route().current('legal.terms') ? 'bg-ink text-canvas' : 'text-ink hover:bg-canvas'
                            }`}
                        >
                            Ketentuan
                        </Link>
                        <Link
                            href={route('legal.privacy')}
                            aria-current={route().current('legal.privacy') ? 'page' : undefined}
                            className={`inline-flex min-h-9 items-center rounded-full px-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-3 ${
                                route().current('legal.privacy') ? 'bg-ink text-canvas' : 'text-ink hover:bg-canvas'
                            }`}
                        >
                            Privasi
                        </Link>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                        {auth.user ? (
                            <Button asChild size="sm" className="px-3 text-xs sm:px-4 sm:text-sm">
                                <Link href={route('dashboard')}>Dashboard</Link>
                            </Button>
                        ) : (
                            <Button asChild size="sm" className="px-3 text-xs sm:px-4 sm:text-sm">
                                <Link href={route('register')}>Mulai Gratis</Link>
                            </Button>
                        )}
                    </div>
                </nav>
            </header>

            <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-5 py-14 outline-none sm:px-6 sm:py-20">
                {children}
            </main>

            <footer className="mt-12 rounded-t-[24px] bg-dark px-6 py-12 text-on-dark sm:px-12">
                <div className="mx-auto flex max-w-4xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
                    <JanjiyanLogo dark size="md" />
                    <div className="flex flex-wrap gap-6 text-sm text-on-dark-mute">
                        <Link
                            href={route('home')}
                            className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none"
                        >
                            Beranda
                        </Link>
                        <Link
                            href={route('legal.terms')}
                            className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none"
                        >
                            Syarat &amp; Ketentuan
                        </Link>
                        <Link
                            href={route('legal.privacy')}
                            className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none"
                        >
                            Kebijakan Privasi
                        </Link>
                    </div>
                </div>
                <div className="mx-auto mt-8 max-w-4xl border-t border-white/10 pt-6 text-xs text-on-dark-mute">
                    © {new Date().getFullYear()} Janjiyan. Seluruh hak cipta dilindungi.
                </div>
            </footer>
        </div>
    );
}
