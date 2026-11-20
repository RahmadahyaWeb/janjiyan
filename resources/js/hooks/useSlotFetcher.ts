import { useEffect, useRef, useState } from 'react';

export interface SlotItem {
    time: string;
    available_capacity: number;
    available_staff_ids: number[];
}

export interface DropoffAvailability {
    available: boolean;
    reason: string | null;
    remaining_capacity: number;
    total_capacity: number;
    open_time: string | null;
    close_time: string | null;
    estimated_ready_date: string | null;
    turnaround_days: number;
    supports_pickup: boolean;
}

interface CacheEntry {
    slots: SlotItem[];
    dropoff: DropoffAvailability | null;
    fetchedAt: number;
}

const CACHE_TTL_MS = 20_000;
const INDICATOR_DELAY_MS = 150;
const slotCache = new Map<string, CacheEntry>();

interface UseSlotFetcherOptions {
    url: string | null;
    enabled: boolean;
    onResolved?: (slots: SlotItem[], dropoff: DropoffAvailability | null) => void;
}

interface UseSlotFetcherResult {
    slots: SlotItem[];
    dropoff: DropoffAvailability | null;
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
    const [dropoff, setDropoff] = useState<DropoffAvailability | null>(null);
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
                setDropoff(null);
                setHasLoaded(false);
                hasLoadedRef.current = false;
            }
            return;
        }

        const cached = slotCache.get(url);
        const hasFreshCache = Boolean(cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS);

        if (cached && hasFreshCache) {
            setSlots(cached.slots);
            setDropoff(cached.dropoff);
            setHasLoaded(true);
            hasLoadedRef.current = true;
            onResolvedRef.current?.(cached.slots, cached.dropoff);
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
            .then((res) => (res.ok ? res.json() : { slots: [], dropoff: null }))
            .then((data: { slots?: SlotItem[]; dropoff?: DropoffAvailability | null }) => {
                if (controller.signal.aborted) return;
                const nextSlots = Array.isArray(data.slots) ? data.slots : [];
                const nextDropoff = data.dropoff ?? null;
                slotCache.set(url, { slots: nextSlots, dropoff: nextDropoff, fetchedAt: Date.now() });
                setSlots(nextSlots);
                setDropoff(nextDropoff);
                setHasLoaded(true);
                hasLoadedRef.current = true;
                onResolvedRef.current?.(nextSlots, nextDropoff);
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                if (!hasLoadedRef.current) {
                    setSlots([]);
                    setDropoff(null);
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
        dropoff,
        hasLoaded,
        showInitialLoading,
        showRefreshing,
    };
}
