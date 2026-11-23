import { router } from '@inertiajs/react';
import {
    Bell,
    CalendarCheck2,
    CheckCheck,
    CreditCard,
    ReceiptText,
    Sparkles,
    Star,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildCsrfHeaders } from '@/lib/csrf';
import { cn } from '@/lib/utils';
import type { InAppNotificationItem, NotificationCategory } from '@/types';

interface NotificationBellProps {
    initialUnreadCount?: number;
    activeBusinessId?: number | null;
    triggerClassName?: string;
}

const POLL_INTERVAL_MS = 30_000;
const VISIBILITY_REFETCH_GAP_MS = 15_000;

function formatRelativeTime(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diffSeconds < 60) return 'Baru saja';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hr lalu`;

    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function getCategoryMeta(category: NotificationCategory) {
    switch (category) {
        case 'booking_new':
            return { Icon: CalendarCheck2, tone: 'bg-electric/10 text-electric' };
        case 'dp_uploaded':
            return { Icon: ReceiptText, tone: 'bg-warning-soft text-warning' };
        case 'review_new':
            return { Icon: Star, tone: 'bg-bone text-ink' };
        case 'billing_activated':
            return { Icon: CreditCard, tone: 'bg-success-soft text-success' };
        case 'billing_trial_extended':
            return { Icon: Sparkles, tone: 'bg-electric/10 text-electric' };
        default:
            return { Icon: Bell, tone: 'bg-bone text-ink' };
    }
}

export function NotificationBell({
    initialUnreadCount = 0,
    activeBusinessId = null,
    triggerClassName,
}: NotificationBellProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const [items, setItems] = useState<InAppNotificationItem[]>([]);

    const knownIdsRef = useRef<Set<string> | null>(null);
    const lastFetchedAtRef = useRef<number>(0);

    useEffect(() => {
        setUnreadCount(initialUnreadCount);
    }, [initialUnreadCount]);

    const fetchNotifications = useCallback(async (options?: { announceNew?: boolean }) => {
        const announceNew = options?.announceNew ?? false;
        try {
            setLoading((prev) => (items.length === 0 ? true : prev));
            const res = await fetch(route('dashboard.notifications.index'), {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            if (!res.ok) return;

            const payload = (await res.json()) as {
                unread_count?: number;
                items?: InAppNotificationItem[];
            };

            const nextItems = Array.isArray(payload.items) ? payload.items : [];
            const nextUnread = typeof payload.unread_count === 'number' ? payload.unread_count : 0;

            if (knownIdsRef.current !== null && announceNew) {
                const newlyArrived = nextItems.filter(
                    (item) => item.read_at === null && !knownIdsRef.current?.has(item.id)
                );
                if (newlyArrived.length === 1) {
                    toast.info(newlyArrived[0].title, {
                        description: newlyArrived[0].message,
                    });
                } else if (newlyArrived.length > 1) {
                    toast.info(`${newlyArrived.length} notifikasi baru masuk`, {
                        description: newlyArrived[0].title,
                    });
                }
            }

            knownIdsRef.current = new Set(nextItems.map((item) => item.id));
            lastFetchedAtRef.current = Date.now();
            setItems(nextItems);
            setUnreadCount(nextUnread);
        } catch {
            // Silent fail for background polling
        } finally {
            setLoading(false);
        }
    }, [items.length]);

    useEffect(() => {
        knownIdsRef.current = null;
        void fetchNotifications({ announceNew: false });
    }, [activeBusinessId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void fetchNotifications({ announceNew: true });
            }
        }, POLL_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (
                document.visibilityState === 'visible' &&
                Date.now() - lastFetchedAtRef.current >= VISIBILITY_REFETCH_GAP_MS
            ) {
                void fetchNotifications({ announceNew: true });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchNotifications]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
            void fetchNotifications({ announceNew: false });
        }
    };

    const handleItemClick = (item: InAppNotificationItem) => {
        const wasUnread = item.read_at === null;
        if (wasUnread) {
            const nowIso = new Date().toISOString();
            setItems((prev) =>
                prev.map((row) => (row.id === item.id ? { ...row, read_at: nowIso } : row))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));

            fetch(route('dashboard.notifications.read', item.id), {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers: buildCsrfHeaders(),
            }).catch(() => {});
        }

        setOpen(false);
        if (item.action_url && item.action_url.startsWith('/')) {
            router.visit(item.action_url);
        }
    };

    const handleMarkAllRead = async () => {
        if (markingAll || unreadCount === 0) return;
        setMarkingAll(true);

        const nowIso = new Date().toISOString();
        setItems((prev) => prev.map((row) => (row.read_at ? row : { ...row, read_at: nowIso })));
        setUnreadCount(0);

        try {
            const res = await fetch(route('dashboard.notifications.read-all'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: buildCsrfHeaders(),
            });
            if (res.ok) {
                toast.success('Semua notifikasi ditandai telah dibaca.');
            }
        } catch {
            toast.error('Gagal memperbarui status notifikasi.');
        } finally {
            setMarkingAll(false);
        }
    };

    const unreadLabel =
        unreadCount > 0 ? `Notifikasi (${unreadCount} belum dibaca)` : 'Notifikasi';

    return (
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={unreadLabel}
                    className={cn(
                        'relative inline-flex cursor-pointer items-center justify-center rounded-full bg-bone text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                        triggerClassName ?? 'size-9'
                    )}
                >
                    <Bell className="size-4" aria-hidden="true" />
                    {unreadCount > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute -top-0.5 -right-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-electric px-1 py-0.5 text-[10px] leading-none font-semibold text-canvas tabular-nums ring-2 ring-canvas"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-[360px] max-w-[calc(100vw-2rem)] rounded-md border-hairline-soft p-0 shadow-none"
            >
                <div className="flex items-center justify-between gap-2 border-b border-divider px-4 py-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-ink">Notifikasi</h2>
                        {unreadCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-electric/10 px-2 py-0.5 text-[11px] font-semibold text-electric tabular-nums">
                                {unreadCount} baru
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            disabled={markingAll}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-mute transition-colors hover:bg-bone hover:text-ink disabled:opacity-50"
                        >
                            <CheckCheck className="size-3.5" aria-hidden="true" />
                            <span>Tandai dibaca</span>
                        </button>
                    )}
                </div>

                <div className="max-h-[380px] overflow-y-auto overscroll-contain p-1.5">
                    {loading && items.length === 0 ? (
                        <div className="space-y-2 p-2">
                            <div className="h-14 animate-pulse rounded-xl bg-bone" />
                            <div className="h-14 animate-pulse rounded-xl bg-bone" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-bone text-mute">
                                <Bell className="size-4" aria-hidden="true" />
                            </div>
                            <p className="mt-2.5 text-sm font-semibold text-ink">Belum ada notifikasi</p>
                            <p className="mt-0.5 text-xs text-mute">
                                Pesanan baru, bukti DP, ulasan, dan info paket akan muncul di sini.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {items.map((item) => {
                                const { Icon, tone } = getCategoryMeta(item.category);
                                const isUnread = item.read_at === null;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleItemClick(item)}
                                        className={cn(
                                            'flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                            isUnread
                                                ? 'bg-bone/80 hover:bg-bone'
                                                : 'hover:bg-bone/60'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                                                tone
                                            )}
                                        >
                                            <Icon className="size-4" aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-start justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        'text-xs leading-snug text-ink',
                                                        isUnread ? 'font-semibold' : 'font-medium'
                                                    )}
                                                >
                                                    {item.title}
                                                </span>
                                                {isUnread && (
                                                    <span
                                                        aria-label="Belum dibaca"
                                                        className="mt-1 size-2 shrink-0 rounded-full bg-electric"
                                                    />
                                                )}
                                            </span>
                                            {item.message && (
                                                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-mute">
                                                    {item.message}
                                                </span>
                                            )}
                                            <span className="mt-1 block text-[11px] text-ash">
                                                {formatRelativeTime(item.created_at)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
