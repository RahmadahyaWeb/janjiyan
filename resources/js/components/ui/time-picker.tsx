import * as React from "react"
import { Clock, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, "0"))
const MINUTE_STEPS = Array.from({ length: 12 }, (_, idx) => String(idx * 5).padStart(2, "0"))

function normalizeTimeValue(value: string | null | undefined): string {
  if (!value) return ""
  const match = /^(\d{2}):(\d{2})/.exec(value.trim())
  if (!match) return ""
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return ""
  return `${match[1]}:${match[2]}`
}

export interface TimePickerProps {
  id?: string
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  required?: boolean
  className?: string
  wrapperClassName?: string
  align?: "start" | "center" | "end"
  dialogTitle?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

function TimePicker({
  id,
  value = "",
  onChange,
  placeholder = "--:--",
  clearable = false,
  disabled = false,
  required = false,
  className,
  wrapperClassName,
  align = "start",
  dialogTitle = "Pilih Jam",
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobileViewport()

  const normalizedValue = React.useMemo(() => normalizeTimeValue(value), [value])
  const [selectedHour, selectedMinute] = React.useMemo(() => {
    if (!normalizedValue) return ["", ""]
    return normalizedValue.split(":")
  }, [normalizedValue])

  const minuteOptions = React.useMemo(() => {
    if (!selectedMinute || MINUTE_STEPS.includes(selectedMinute)) {
      return MINUTE_STEPS
    }
    return [...MINUTE_STEPS, selectedMinute].sort()
  }, [selectedMinute])

  const handleHourSelect = (hour: string) => {
    const nextMinute = selectedMinute || "00"
    onChange(`${hour}:${nextMinute}`)
  }

  const handleMinuteSelect = (minute: string) => {
    const nextHour = selectedHour || "09"
    onChange(`${nextHour}:${minute}`)
    setOpen(false)
  }

  const handleClear = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    onChange("")
    setOpen(false)
  }

  const pickerPanel = (
    <div className="flex flex-col bg-canvas">
      <div className="grid grid-cols-2 divide-x divide-hairline-soft">
        <div className="flex flex-col">
          <div className="border-b border-hairline-soft px-3 py-1.5 text-center text-[0.7rem] font-semibold tracking-wide text-mute uppercase">
            Jam
          </div>
          <div className="grid max-h-56 w-28 grid-cols-2 gap-1 overflow-y-auto overscroll-contain p-2 sm:w-24">
            {HOURS.map((hour) => {
              const active = hour === selectedHour
              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleHourSelect(hour)}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center justify-center rounded-xs text-xs font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none",
                    active
                      ? "bg-ink font-semibold text-canvas"
                      : "text-ink hover:bg-bone"
                  )}
                >
                  {hour}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="border-b border-hairline-soft px-3 py-1.5 text-center text-[0.7rem] font-semibold tracking-wide text-mute uppercase">
            Menit
          </div>
          <div className="grid max-h-56 w-28 grid-cols-2 gap-1 overflow-y-auto overscroll-contain p-2 sm:w-24">
            {minuteOptions.map((minute) => {
              const active = minute === selectedMinute
              return (
                <button
                  key={minute}
                  type="button"
                  onClick={() => handleMinuteSelect(minute)}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center justify-center rounded-xs text-xs font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none",
                    active
                      ? "bg-ink font-semibold text-canvas"
                      : "text-ink hover:bg-bone"
                  )}
                >
                  {minute}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hairline-soft px-3 py-2">
        {clearable && normalizedValue ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-xs font-medium text-mute hover:text-ink"
            onClick={() => handleClear()}
          >
            Hapus
          </Button>
        ) : (
          <span className="text-xs font-medium tabular-nums text-mute">
            {normalizedValue ? `${normalizedValue} WIB/Lokal` : "Format 24 jam"}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-xs font-semibold text-ink"
          onClick={() => setOpen(false)}
        >
          Selesai
        </Button>
      </div>
    </div>
  )

  const triggerButton = (onMobileClick?: () => void) => (
    <button
      id={id}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onMobileClick}
      className={cn(
        "flex h-12 w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm border border-control-border bg-field px-3 py-2 text-left text-base text-ink transition-shadow outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ink",
        ariaInvalid && "ring-2 ring-destructive",
        clearable && normalizedValue && !disabled && "pr-8",
        className
      )}
    >
      <Clock className="size-3.5 shrink-0 text-mute" aria-hidden="true" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate tabular-nums",
          !normalizedValue && "text-ash"
        )}
      >
        {normalizedValue || placeholder}
      </span>
    </button>
  )

  const clearButton =
    clearable && normalizedValue && !disabled ? (
      <button
        type="button"
        aria-label="Hapus jam"
        onClick={handleClear}
        className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-mute transition-colors hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    ) : null

  const hiddenRequiredInput = required ? (
    <input
      type="text"
      tabIndex={-1}
      aria-hidden="true"
      readOnly
      required
      value={normalizedValue}
      onChange={() => {}}
      className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px -translate-x-1/2 opacity-0"
    />
  ) : null

  if (isMobile) {
    return (
      <div className={cn("relative w-full min-w-0", wrapperClassName)}>
        {triggerButton(() => !disabled && setOpen(true))}
        {clearButton}
        {hiddenRequiredInput}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-[min(20rem,calc(100vw-2rem))] gap-2 rounded-md p-4">
            <DialogHeader className="text-left">
              <DialogTitle className="text-base font-semibold text-ink">
                {dialogTitle}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Pilih jam dan menit
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">{pickerPanel}</div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton()}</PopoverTrigger>
        <PopoverContent align={align} className="w-auto overflow-hidden">
          {pickerPanel}
        </PopoverContent>
      </Popover>
      {clearButton}
      {hiddenRequiredInput}
    </div>
  )
}

export { TimePicker }
