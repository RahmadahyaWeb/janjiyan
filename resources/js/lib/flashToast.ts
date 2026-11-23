import { toast } from 'sonner';

export interface FlashPayload {
    success?: string;
    error?: string;
    warning?: string;
    info?: string;
}

export function emitFlashToasts(flash?: FlashPayload | null): void {
    if (!flash) {
        return;
    }

    if (flash.success) {
        toast.success(flash.success);
    }
    if (flash.error) {
        toast.error(flash.error);
    }
    if (flash.warning) {
        toast.warning(flash.warning);
    }
    if (flash.info) {
        toast.info(flash.info);
    }
}
