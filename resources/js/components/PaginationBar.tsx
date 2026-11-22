import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface PaginationBarProps {
    pagination: PaginationMeta | null | undefined;
}

export function PaginationBar({ pagination }: PaginationBarProps) {
    if (!pagination || pagination.last_page <= 1) {
        return null;
    }

    const goTo = (url: string | null) => {
        if (!url) return;
        router.visit(url, { preserveState: true, preserveScroll: true });
    };

    return (
        <div className="flex flex-col gap-2.5 rounded-md border border-hairline-soft bg-canvas px-4 py-3 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
            <p className="tabular-nums">
                Menampilkan <span className="font-semibold text-ink">{pagination.from ?? 0}</span>–
                <span className="font-semibold text-ink">{pagination.to ?? 0}</span> dari{' '}
                <span className="font-semibold text-ink">{pagination.total}</span> data
            </p>
            <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 px-2.5 text-xs sm:gap-1.5 sm:px-4 sm:text-sm"
                    disabled={!pagination.prev_page_url}
                    onClick={() => goTo(pagination.prev_page_url)}
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Sebelumnya
                </Button>
                <span className="shrink-0 px-1 font-mono text-xs whitespace-nowrap tabular-nums text-ink sm:px-2">
                    {pagination.current_page} / {pagination.last_page}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 px-2.5 text-xs sm:gap-1.5 sm:px-4 sm:text-sm"
                    disabled={!pagination.next_page_url}
                    onClick={() => goTo(pagination.next_page_url)}
                >
                    Berikutnya
                    <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}
