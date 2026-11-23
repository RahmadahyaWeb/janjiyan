import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface ColorInputProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  fallbackColor?: string
  placeholder?: string
  pickerAriaLabel?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  className?: string
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function ColorInput({
  id,
  value,
  onValueChange,
  fallbackColor = "#141414",
  placeholder = "#16423c",
  pickerAriaLabel = "Pilih warna sendiri",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  className,
}: ColorInputProps) {
  const validHex = HEX_COLOR_RE.test(value) ? value : fallbackColor

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        className="relative inline-flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-sm border border-control-border bg-field p-1 focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
        aria-label={pickerAriaLabel}
      >
        <span
          aria-hidden="true"
          className="size-full rounded-[6px] border border-black/10"
          style={{ backgroundColor: validHex }}
        />
        <input
          type="color"
          aria-label={pickerAriaLabel}
          value={validHex}
          onChange={(event) => onValueChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        id={id}
        placeholder={placeholder}
        maxLength={7}
        value={value}
        onChange={(event) => onValueChange(event.target.value.trim())}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className="h-10 font-mono text-sm uppercase"
      />
    </div>
  )
}

export { ColorInput }
