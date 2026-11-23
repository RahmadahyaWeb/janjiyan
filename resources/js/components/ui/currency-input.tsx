import * as React from "react"

import { cn } from "@/lib/utils"

function formatThousandId(value: number | "" | string | null | undefined): string {
  if (value === "" || value === null || value === undefined) return ""
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/\D+/g, ""))
  if (!Number.isFinite(numeric)) return ""
  if (String(value).trim() === "") return ""
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.trunc(numeric)))
}

export interface CurrencyInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "type" | "value" | "onChange" | "inputMode" | "min" | "max"
  > {
  value: number | "" | string
  onValueChange: (value: number | "") => void
  min?: number
  max?: number
  showPrefix?: boolean
  wrapperClassName?: string
}

function CurrencyInput({
  value,
  onValueChange,
  min,
  max,
  showPrefix = true,
  className,
  wrapperClassName,
  placeholder,
  ...props
}: CurrencyInputProps) {
  const formattedValue = React.useMemo(() => formatThousandId(value), [value])
  const formattedPlaceholder = React.useMemo(() => {
    if (!placeholder) return undefined
    if (/^\d+$/.test(placeholder)) {
      return formatThousandId(Number(placeholder))
    }
    return placeholder
  }, [placeholder])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D+/g, "")
    if (!digits) {
      onValueChange("")
      return
    }
    let parsed = Number(digits)
    if (!Number.isFinite(parsed)) {
      onValueChange("")
      return
    }
    if (typeof max === "number" && parsed > max) {
      parsed = max
    }
    if (typeof min === "number" && parsed < min && digits.length >= String(min).length) {
      parsed = min
    }
    onValueChange(parsed)
  }

  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      {showPrefix && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-semibold text-mute select-none"
        >
          Rp
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        data-slot="currency-input"
        value={formattedValue}
        placeholder={formattedPlaceholder}
        onChange={handleChange}
        className={cn(
          "h-12 w-full min-w-0 max-w-full rounded-sm border border-control-border bg-field px-4 py-3 text-base text-ink tabular-nums transition-shadow outline-none selection:bg-ink selection:text-canvas placeholder:text-ash disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ink",
          "aria-invalid:ring-2 aria-invalid:ring-destructive",
          showPrefix && "pl-10",
          className
        )}
        {...props}
      />
    </div>
  )
}

export { CurrencyInput }
