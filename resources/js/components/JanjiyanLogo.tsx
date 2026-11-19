import { cn } from '@/lib/utils';

interface JanjiyanLogoProps {
    dark?: boolean;
    size?: 'sm' | 'md' | 'lg';
    compactMobile?: boolean;
    className?: string;
}

export function JanjiyanLogo({ dark = false, size = 'md', compactMobile = false, className }: JanjiyanLogoProps) {
    const boxSize = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-10' : 'size-8';
    const iconSize = size === 'sm' ? 'size-5' : size === 'lg' ? 'size-7' : 'size-6';
    const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';
    const accentColor = dark ? '#005ce6' : '#2b7fff';

    return (
        <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
            <span
                className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-[30%] font-semibold tracking-tight',
                    boxSize,
                    dark ? 'bg-canvas text-ink' : 'bg-ink text-canvas'
                )}
            >
                <svg
                    viewBox="0 0 24 24"
                    className={iconSize}
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d="M17.8 5.0 V13.2 A5.9 5.9 0 0 1 6.0 13.2 V9.0 A3.9 3.9 0 1 1 13.8 9.0 V11.4"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle cx="9.9" cy="9.0" r="1.8" fill={accentColor} />
                </svg>
            </span>
            <span
                className={cn(
                    'font-semibold tracking-normal',
                    textSize,
                    dark ? 'text-on-dark' : 'text-ink',
                    compactMobile && 'hidden sm:inline'
                )}
            >
                Janjiyan
            </span>
        </span>
    );
}
