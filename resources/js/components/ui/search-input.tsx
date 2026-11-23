import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  value: string
  onValueChange: (value: string) => void
  onClear?: () => void
  clearLabel?: string
  wrapperClassName?: string
}

function SearchInput({
  value,
  onValueChange,
  onClear,
  clearLabel = "Hapus pencarian",
  className,
  wrapperClassName,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mute"
        aria-hidden="true"
      />
      <input
        type="search"
        data-slot="search-input"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          "h-12 w-full min-w-0 max-w-full appearance-none rounded-sm border border-control-border bg-field py-2.5 pr-10 pl-10 text-base text-ink transition-shadow outline-none selection:bg-ink selection:text-canvas placeholder:text-ash disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ink",
          "aria-invalid:ring-2 aria-invalid:ring-destructive",
          className
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onValueChange("")
            onClear?.()
          }}
          aria-label={clearLabel}
          className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-mute transition-colors hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export { SearchInput }
