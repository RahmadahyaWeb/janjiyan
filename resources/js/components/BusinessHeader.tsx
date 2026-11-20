import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { BusinessMark } from '@/components/BusinessMark';
import { brandVars } from '@/lib/brand';

/** Header button style that works on any shop color. */
export const headerActionClass =
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 ring-1 ring-(--on-brand)/40 ring-inset text-sm font-semibold text-(--on-brand) transition-colors hover:bg-(--on-brand)/12 focus-visible:ring-2 focus-visible:ring-(--on-brand) focus-visible:outline-none sm:px-4';

/** Sticky header in the shop color for the booking and invoice pages; links back to the shop home. */
export function BusinessHeader({
    business,
    children,
}: {
    business: { name: string; slug: string; logo_url?: string | null; brand_color?: string | null };
    children?: ReactNode;
}) {
    return (
        <header style={brandVars(business.brand_color)} className="sticky top-0 z-40 bg-(--brand) text-(--on-brand) print:hidden">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-2 sm:px-4">
                <Link
                    href={route('public.booking', business.slug)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1.5 pr-3 pl-1.5 focus-visible:ring-2 focus-visible:ring-(--on-brand) focus-visible:outline-none"
                >
                    <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
                    <span className="sr-only">Kembali ke halaman</span>
                    <BusinessMark name={business.name} logoUrl={business.logo_url ?? null} className="size-9 text-xs" />
                    <span className="truncate text-sm font-semibold sm:text-base">{business.name}</span>
                </Link>
                {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
            </div>
        </header>
    );
}
