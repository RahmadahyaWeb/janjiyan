import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  const isAutoWidth = /\bw-auto\b/.test(className ?? "")

  return (
    <div
      className={cn(
        "relative inline-flex min-w-0 items-center",
        isAutoWidth ? "w-auto shrink-0" : "w-full"
      )}
    >
      <select
        data-slot="native-select"
        className={cn(
          "h-12 w-full min-w-0 appearance-none truncate rounded-sm border border-control-border bg-field py-2 pr-9 pl-4 text-base font-semibold leading-normal text-ink transition-shadow outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:ring-2 focus-visible:ring-ink",
          "aria-invalid:ring-2 aria-invalid:ring-destructive",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 size-4 shrink-0 text-mute"
        aria-hidden="true"
      />
    </div>
  )
}

export { NativeSelect }
