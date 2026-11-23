import { UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StaffOption } from './types';

interface StaffSelectionStepProps {
    label: string;
    staffList: StaffOption[];
    selectedStaffId: number | null;
    onSelectStaff: (staffId: number | null) => void;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function StaffSelectionStep({
    label,
    staffList,
    selectedStaffId,
    onSelectStaff,
}: StaffSelectionStepProps) {
    return (
        <section aria-labelledby="step-staff-heading" id="step-staff" className="scroll-mt-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="step-staff-heading" className="text-lg font-semibold text-ink">
                    {label}
                </h2>
                <span className="text-xs text-mute">
                    &ldquo;Siapa saja&rdquo; memberi pilihan jam terbanyak
                </span>
            </div>

            <div className="flex flex-wrap gap-2.5" role="group" aria-label="Pilih staff">
                <button
                    type="button"
                    aria-pressed={selectedStaffId === null}
                    onClick={() => onSelectStaff(null)}
                    className={cn(
                        'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                        selectedStaffId === null
                            ? 'bg-ink text-canvas'
                            : 'bg-bone text-ink hover:bg-hairline-soft'
                    )}
                >
                    <UserCheck className="size-4 shrink-0" aria-hidden="true" />
                    <span>Siapa saja yang tersedia</span>
                </button>

                {staffList.map((staff) => {
                    const active = selectedStaffId === staff.id;
                    return (
                        <button
                            key={staff.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelectStaff(staff.id)}
                            className={cn(
                                'inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2.5 rounded-full py-1.5 pr-4 pl-2 text-left text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                active
                                    ? 'bg-ink text-canvas'
                                    : 'bg-bone text-ink hover:bg-hairline-soft'
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                    active ? 'bg-canvas text-ink' : 'bg-canvas text-ink ring-1 ring-hairline'
                                )}
                            >
                                {getInitials(staff.name)}
                            </span>
                            <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                <span>{staff.name}</span>
                                {staff.title && (
                                    <span
                                        className={cn(
                                            'text-xs font-normal',
                                            active ? 'text-on-dark-mute' : 'text-mute'
                                        )}
                                    >
                                        · {staff.title}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
