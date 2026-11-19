import { useEffect, useRef, useState } from 'react';

export interface SlotItem {
    time: string;
    available_capacity: number;
    available_staff_ids: number[];
}

interface CacheEntry {
    slots: SlotItem[];
    fetchedAt: number;
}

const CACHE_TTL_MS = 20_000;
const INDICATOR_DELAY_MS = 150;
const slotCache = new Map<string, CacheEntry>();

interface UseSlotFetcherOptions {
    url: string | null;
    enabled: boolean;
    onResolved?: (slots: SlotItem[]) => void;
}

interface UseSlotFetcherResult {
    slots: SlotItem[];
    hasLoaded: boolean;
    showInitialLoading: boolean;
    showRefreshing: boolean;
}

export function useSlotFetcher({
    url,
    enabled,
    onResolved,
}: UseSlotFetcherOptions): UseSlotFetcherResult {
    const [slots, setSlots] = useState<SlotItem[]>([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [showInitialLoading, setShowInitialLoading] = useState(false);
    const [showRefreshing, setShowRefreshing] = useState(false);

    const hasLoadedRef = useRef(false);
    const onResolvedRef = useRef(onResolved);
    onResolvedRef.current = onResolved;

    useEffect(() => {
        if (!enabled || !url) {
            setShowInitialLoading(false);
            setShowRefreshing(false);
            if (!enabled) {
                setSlots([]);
                setHasLoaded(false);
                hasLoadedRef.current = false;
            }
            return;
        }

        const cached = slotCache.get(url);
        const hasFreshCache = Boolean(cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS);

        if (cached && hasFreshCache) {
            setSlots(cached.slots);
            setHasLoaded(true);
            hasLoadedRef.current = true;
            onResolvedRef.current?.(cached.slots);
        }

        const controller = new AbortController();
        const isFirstLoad = !hasLoadedRef.current;

        const delayTimer = window.setTimeout(() => {
            if (controller.signal.aborted) return;
            if (isFirstLoad) {
                setShowInitialLoading(true);
            } else {
                setShowRefreshing(true);
            }
        }, INDICATOR_DELAY_MS);

        fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : { slots: [] }))
            .then((data: { slots?: SlotItem[] }) => {
                if (controller.signal.aborted) return;
                const nextSlots = Array.isArray(data.slots) ? data.slots : [];
                slotCache.set(url, { slots: nextSlots, fetchedAt: Date.now() });
                setSlots(nextSlots);
                setHasLoaded(true);
                hasLoadedRef.current = true;
                onResolvedRef.current?.(nextSlots);
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                if (!hasLoadedRef.current) {
                    setSlots([]);
                    setHasLoaded(true);
                    hasLoadedRef.current = true;
                }
            })
            .finally(() => {
                window.clearTimeout(delayTimer);
                if (!controller.signal.aborted) {
                    setShowInitialLoading(false);
                    setShowRefreshing(false);
                }
            });

        return () => {
            window.clearTimeout(delayTimer);
            controller.abort();
        };
    }, [url, enabled]);

    return {
        slots,
        hasLoaded,
        showInitialLoading,
        showRefreshing,
    };
}
