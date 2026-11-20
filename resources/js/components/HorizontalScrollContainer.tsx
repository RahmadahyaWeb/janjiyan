import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface HorizontalScrollContainerProps {
    as?: 'div' | 'aside';
    ariaLabel?: string;
    role?: string;
    className?: string;
    wrapperClassName?: string;
    fadeBreakpointClass?: string;
    children: ReactNode;
}

/**
 * Horizontal scroll strip with dynamic leading/trailing fade cues when off-screen items exist.
 */
export function HorizontalScrollContainer({
    as: Tag = 'div',
    ariaLabel,
    role,
    className,
    wrapperClassName,
    fadeBreakpointClass = '',
    children,
}: HorizontalScrollContainerProps) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const syncScrollEdges = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        // Bring the current item (nav page / pressed tab) into view so mobile users see where they are.
        const active = el?.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"]');
        if (el && active && el.scrollWidth > el.clientWidth) {
            const elBox = el.getBoundingClientRect();
            const activeBox = active.getBoundingClientRect();
            el.scrollLeft += activeBox.left - elBox.left - (elBox.width - activeBox.width) / 2;
        }
        syncScrollEdges();
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(syncScrollEdges);
        observer.observe(el);
        return () => observer.disconnect();
    }, [syncScrollEdges]);

    return (
        <div className={cn('relative min-w-0', wrapperClassName)}>
            <Tag
                ref={scrollerRef}
                aria-label={ariaLabel}
                role={role}
                onScroll={syncScrollEdges}
                className={cn('overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
            >
                {children}
            </Tag>

            {canScrollLeft && (
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-canvas via-canvas/85 to-transparent',
                        fadeBreakpointClass
                    )}
                />
            )}
            {canScrollRight && (
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-canvas via-canvas/85 to-transparent',
                        fadeBreakpointClass
                    )}
                />
            )}
        </div>
    );
}
