import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { BusinessMark } from '@/components/BusinessMark';
import { brandVars } from '@/lib/brand';
import { cn } from '@/lib/utils';

/** Round header button (icon on phones, icon + text from sm) that works on any shop color. */
export const headerActionClass =
    'inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-full ring-1 ring-(--on-band)/40 ring-inset text-sm font-semibold text-(--on-band) transition-colors hover:bg-(--on-band)/12 focus-visible:ring-2 focus-visible:ring-(--on-band) focus-visible:outline-none sm:w-auto sm:px-4';

/**
 * Shop-colored band at the top of the booking and invoice pages. It scrolls away with the page
 * (the booking page keeps its own sticky bottom bar), and links back to the shop home.
 */
export function BusinessHeader({
    business,
    label,
    widthClassName = 'max-w-6xl',
    children,
}: {
    business: { name: string; slug: string; logo_url?: string | null; brand_color?: string | null };
    label: string;
    /** Match the page's content column so the name lines up with it. */
    widthClassName?: string;
    children?: ReactNode;
}) {
    return (
        <header style={brandVars(business.brand_color)} className="rounded-b-md bg-(--band) text-(--on-band) print:hidden">
            <div className={cn('mx-auto px-3 pt-3 pb-4 sm:px-6 sm:pb-5', widthClassName)}>
                <div className="flex items-center gap-2">
                    <Link
                        href={route('public.booking', business.slug)}
                        aria-label={`Kembali ke ${business.name}`}
                        className={cn(headerActionClass, 'ring-0 bg-(--on-band)/14 sm:w-10 sm:px-0')}
                    >
                        <ChevronLeft className="size-5" aria-hidden="true" />
                    </Link>
                    <span className="flex-1" />
                    {children}
                </div>
                <div className="mt-2.5 flex items-center gap-3 px-1 sm:mt-3.5">
                    <BusinessMark
                        name={business.name}
                        logoUrl={business.logo_url ?? null}
                        className="size-11 border-2 border-(--on-band)/80 text-sm sm:size-13 sm:text-base"
                    />
                    <div className="min-w-0">
                        <p className="text-xs opacity-90 sm:text-sm">{label}</p>
                        <p className="text-lg leading-snug font-bold [overflow-wrap:anywhere] sm:text-2xl">{business.name}</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
