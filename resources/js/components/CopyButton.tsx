import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
    value: string;
    label: string;
    className?: string;
}

/** Small "Salin" pill that copies a value (e.g. bank account number) to the clipboard. */
export function CopyButton({ value, label, className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            try {
                await navigator.clipboard.writeText(value);
            } catch {
                // In-app browsers (e.g. Instagram webview) often block the Clipboard API; fall back to execCommand.
                const ta = document.createElement('textarea');
                ta.value = value;
                ta.setAttribute('readonly', '');
                ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                ta.remove();
                if (!ok) throw new Error('copy failed');
            }
            setCopied(true);
            toast.success(`${label} disalin`);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Gagal menyalin, salin manual ya.');
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={`Salin ${label}`}
            className={cn(
                'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                className
            )}
        >
            {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? 'Tersalin' : 'Salin'}
        </button>
    );
}
