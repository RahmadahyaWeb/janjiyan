import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface HorizontalScrollContainerProps {
    as?: 'div' | 'aside';
    ariaLabel?: string;
    role?: string;
    className?: string;
    wrapperClassName?: string;
    fadeBreakpointClass?: string;
    showScrollCue?: boolean;
    children: ReactNode;
}

/**
 * Horizontal scroll strip with dynamic leading/trailing fade and chevron cues when off-screen items exist.
 */
export function HorizontalScrollContainer({
    as: Tag = 'div',
    ariaLabel,
    role,
    className,
    wrapperClassName,
    fadeBreakpointClass = '',
    showScrollCue = true,
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
        if (!el) return;

        let cancelled = false;
        document.fonts?.ready.then(() => {
            if (!cancelled) syncScrollEdges();
        });

        let observer: ResizeObserver | undefined;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(syncScrollEdges);
            observer.observe(el);
            if (el.firstElementChild) {
                observer.observe(el.firstElementChild);
            }
        } else {
            window.addEventListener('resize', syncScrollEdges);
        }

        return () => {
            cancelled = true;
            if (observer) {
                observer.disconnect();
            } else {
                window.removeEventListener('resize', syncScrollEdges);
            }
        };
    }, [syncScrollEdges]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(syncScrollEdges);
        return () => window.cancelAnimationFrame(frame);
    }, [children, syncScrollEdges]);

    return (
        <div className={cn('relative min-w-0', wrapperClassName)}>
            <Tag
                ref={scrollerRef}
                aria-label={ariaLabel}
                role={role}
                onScroll={syncScrollEdges}
                className={cn(
                    'touch-pan-x overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    className
                )}
            >
                {children}
            </Tag>

            {canScrollLeft && (
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute inset-y-0 left-0 flex w-8 items-center justify-start bg-gradient-to-r from-canvas from-20% via-canvas/75 to-transparent pl-1',
                        fadeBreakpointClass
                    )}
                >
                    {showScrollCue && (
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-canvas/95 text-mute ring-1 ring-hairline-soft">
                            <ChevronLeft className="size-3.5" />
                        </span>
                    )}
                </div>
            )}
            {canScrollRight && (
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-canvas from-20% via-canvas/75 to-transparent pr-1',
                        fadeBreakpointClass
                    )}
                >
                    {showScrollCue && (
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-canvas/95 text-mute ring-1 ring-hairline-soft">
                            <ChevronRight className="size-3.5" />
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
