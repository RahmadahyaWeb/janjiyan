import * as React from "react"
import { cn } from "@/lib/utils"

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-12 w-full min-w-0 rounded-sm border border-control-border bg-field px-4 text-base font-semibold text-ink transition-shadow outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:ring-2 focus-visible:ring-ink",
        "aria-invalid:ring-2 aria-invalid:ring-destructive",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { NativeSelect }
