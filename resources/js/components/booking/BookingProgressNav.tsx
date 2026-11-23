import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BookingStepKey = 'service' | 'schedule' | 'details';

export interface ProgressStepItem {
    key: BookingStepKey;
    number: string;
    label: string;
    completed: boolean;
    active: boolean;
    reachable: boolean;
}

interface BookingProgressNavProps {
    steps: ProgressStepItem[];
    onSelectStep: (key: BookingStepKey) => void;
}

export function BookingProgressNav({ steps, onSelectStep }: BookingProgressNavProps) {
    return (
        <nav aria-label="Tahapan pemesanan" className="mb-5 sm:mb-7">
            <ol className="grid grid-cols-3 gap-2">
                {steps.map((step) => (
                    <li key={step.key} className="min-w-0">
                        <button
                            type="button"
                            disabled={!step.reachable}
                            onClick={() => onSelectStep(step.key)}
                            aria-current={step.active ? 'step' : undefined}
                            className={cn(
                                'flex w-full min-w-0 flex-col gap-1.5 rounded-xs py-1 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                step.reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'block h-1.5 w-full rounded-full transition-colors duration-150',
                                    step.active
                                        ? 'bg-ink'
                                        : step.completed
                                          ? 'bg-ink/60'
                                          : 'bg-hairline'
                                )}
                            />
                            <span className="flex items-center gap-1.5 text-xs font-semibold">
                                <span
                                    className={cn(
                                        'inline-flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold',
                                        step.active
                                            ? 'bg-ink text-canvas'
                                            : step.completed
                                              ? 'bg-ink/15 text-ink'
                                              : 'bg-bone text-mute'
                                    )}
                                >
                                    {step.completed && !step.active ? (
                                        <Check className="size-2.5" aria-hidden="true" />
                                    ) : (
                                        step.number
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        'truncate',
                                        step.active || step.completed ? 'text-ink' : 'text-mute'
                                    )}
                                >
                                    {step.label}
                                </span>
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
