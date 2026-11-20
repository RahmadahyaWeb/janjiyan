import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { useLockBodyScroll } from "@/components/ui/scroll-lock"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  useLockBodyScroll(true)

  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 block overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y bg-black/50 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const [keyboardPadding, setKeyboardPadding] = React.useState(0)

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return
    const vv = window.visualViewport
    const syncKeyboardGap = () => {
      const gap = Math.round(window.innerHeight - vv.height)
      setKeyboardPadding(gap > 140 ? gap + 24 : 0)
    }
    syncKeyboardGap()
    vv.addEventListener("resize", syncKeyboardGap)
    return () => {
      vv.removeEventListener("resize", syncKeyboardGap)
    }
  }, [])

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay>
        <div
          className="flex min-h-full w-full items-center justify-center p-4 sm:p-6"
          style={keyboardPadding > 0 ? { paddingBottom: `${keyboardPadding}px` } : undefined}
        >
          <DialogPrimitive.Content
            data-slot="dialog-content"
            onPointerDownOutside={(event) => {
              const originalEvent = event.detail.originalEvent as PointerEvent | MouseEvent | undefined
              const target = originalEvent?.target as HTMLElement | null
              if (
                target?.getAttribute("data-slot") === "dialog-overlay" &&
                originalEvent &&
                "clientX" in originalEvent &&
                originalEvent.clientX >= target.clientWidth
              ) {
                event.preventDefault()
                return
              }
              onPointerDownOutside?.(event)
            }}
            className={cn(
              "relative z-50 flex w-full max-w-full flex-col gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none [&>*]:min-w-0 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95 sm:max-w-lg",
              className
            )}
            {...props}
          >
            {showCloseButton && (
              <DialogPrimitive.Close
                data-slot="dialog-close"
                aria-label="Tutup dialog"
                className="absolute top-4 right-4 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full opacity-70 ring-offset-background transition-opacity hover:bg-bone hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              >
                <XIcon aria-hidden="true" />
                <span className="sr-only">Tutup</span>
              </DialogPrimitive.Close>
            )}
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogOverlay>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 pr-10 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Tutup</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-snug font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
