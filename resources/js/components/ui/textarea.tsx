import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-sm border border-control-border bg-field px-4 py-3 text-base text-ink transition-[color,box-shadow] outline-none placeholder:text-ash focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
