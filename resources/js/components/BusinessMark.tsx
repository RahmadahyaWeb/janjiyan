import { cn } from '@/lib/utils';

// Full class strings so Tailwind keeps them; tokens live in app.css.
const MONOGRAM_CLASSES = [
    'bg-monogram-1-surface text-monogram-1-text',
    'bg-monogram-2-surface text-monogram-2-text',
    'bg-monogram-3-surface text-monogram-3-text',
];

/** Shop logo, or a two-letter monogram. `branded` paints the monogram in the shop color (needs brandVars on an ancestor). */
export function BusinessMark({
    name,
    logoUrl,
    branded = false,
    className,
}: {
    name: string;
    logoUrl: string | null;
    branded?: boolean;
    className?: string;
}) {
    if (logoUrl) {
        return (
            <img
                src={logoUrl}
                alt={`Logo ${name}`}
                className={cn('shrink-0 rounded-[30%] bg-canvas object-cover outline-1 -outline-offset-1 outline-black/10', className)}
            />
        );
    }

    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const words = name.trim().split(/\s+/);
    const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();

    return (
        <div
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center rounded-[30%] font-semibold',
                branded ? 'bg-(--brand) text-(--on-brand)' : MONOGRAM_CLASSES[hash % MONOGRAM_CLASSES.length],
                className
            )}
        >
            {initials}
        </div>
    );
}
