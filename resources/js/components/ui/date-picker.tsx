import * as React from "react"
import { format, isAfter, isBefore, startOfDay } from "date-fns"
import { id as idLocale } from "date-fns/locale"
import { Calendar as CalendarIcon, X } from "lucide-react"
import type { Matcher } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

/** Parses a `YYYY-MM-DD` string into a local Date without UTC timezone drift. */
export function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined
  }
  return parsed
}

/** Formats a local Date into a `YYYY-MM-DD` string. */
export function formatIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

/** Formats a `YYYY-MM-DD` string into short Indonesian display format (e.g. `23 Nov 2026`). */
export function formatDatePickerDisplay(value: string | null | undefined): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return ""
  return format(parsed, "d MMM yyyy", { locale: idLocale })
}

export interface DatePickerTriggerState {
  open: boolean
  formattedDate: string
  hasValue: boolean
  disabled: boolean
}

export interface DatePickerProps {
  id?: string
  value?: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  required?: boolean
  className?: string
  wrapperClassName?: string
  align?: "start" | "center" | "end"
  dialogTitle?: string
  calendarDisabled?: Matcher | Matcher[]
  "aria-label"?: string
  "aria-invalid"?: boolean
  renderTrigger?: (state: DatePickerTriggerState) => React.ReactElement
}

function DatePicker({
  id,
  value = "",
  onChange,
  min,
  max,
  placeholder = "Pilih tanggal",
  clearable = false,
  disabled = false,
  required = false,
  className,
  wrapperClassName,
  align = "start",
  dialogTitle = "Pilih Tanggal",
  calendarDisabled,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  renderTrigger,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobileViewport()

  const selectedDate = React.useMemo(() => parseIsoDate(value), [value])
  const minDate = React.useMemo(() => parseIsoDate(min), [min])
  const maxDate = React.useMemo(() => parseIsoDate(max), [max])
  const formattedDate = React.useMemo(
    () => (selectedDate ? format(selectedDate, "d MMM yyyy", { locale: idLocale }) : ""),
    [selectedDate]
  )

  const disabledMatchers = React.useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = []
    if (minDate) matchers.push({ before: minDate })
    if (maxDate) matchers.push({ after: maxDate })
    if (calendarDisabled) {
      if (Array.isArray(calendarDisabled)) {
        matchers.push(...calendarDisabled)
      } else {
        matchers.push(calendarDisabled)
      }
    }
    return matchers
  }, [minDate, maxDate, calendarDisabled])

  const today = startOfDay(new Date())
  const isTodayAllowed =
    (!minDate || !isBefore(today, startOfDay(minDate))) &&
    (!maxDate || !isAfter(today, startOfDay(maxDate)))

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      if (clearable) {
        onChange("")
        setOpen(false)
      }
      return
    }
    onChange(formatIsoDate(date))
    setOpen(false)
  }

  const handleToday = () => {
    if (!isTodayAllowed) return
    onChange(formatIsoDate(today))
    setOpen(false)
  }

  const handleClear = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    onChange("")
    setOpen(false)
  }

  const calendarNode = (
    <div className="flex flex-col">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleSelect}
        defaultMonth={selectedDate ?? minDate ?? today}
        disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
        required={!clearable}
        className={cn(isMobile && "w-full p-2")}
      />
      {(isTodayAllowed || (clearable && selectedDate)) && (
        <div className="flex items-center justify-between gap-2 border-t border-hairline-soft px-3 py-2">
          {isTodayAllowed ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-xs font-semibold text-ink"
              onClick={handleToday}
            >
              Hari Ini
            </Button>
          ) : (
            <span />
          )}
          {clearable && selectedDate && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-xs font-medium text-mute hover:text-ink"
              onClick={() => handleClear()}
            >
              Hapus
            </Button>
          )}
        </div>
      )}
    </div>
  )

  const renderDefaultButton = (onMobileClick?: () => void) => (
    <button
      id={id}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onMobileClick}
      className={cn(
        "flex h-12 w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm border border-control-border bg-field px-3 py-2 text-left text-base text-ink transition-shadow outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ink",
        ariaInvalid && "ring-2 ring-destructive",
        clearable && selectedDate && !disabled && "pr-8",
        className
      )}
    >
      <CalendarIcon className="size-4 shrink-0 text-mute" aria-hidden="true" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate tabular-nums",
          !selectedDate && "text-ash"
        )}
      >
        {formattedDate || placeholder}
      </span>
    </button>
  )

  const clearButton =
    !renderTrigger && clearable && selectedDate && !disabled ? (
      <button
        type="button"
        aria-label="Hapus tanggal"
        onClick={handleClear}
        className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-mute transition-colors hover:bg-bone hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
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
      value={value}
      onChange={() => {}}
      className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px -translate-x-1/2 opacity-0"
    />
  ) : null

  if (isMobile) {
    const customTrigger = renderTrigger
      ? renderTrigger({
          open,
          formattedDate,
          hasValue: Boolean(selectedDate),
          disabled,
        })
      : null

    return (
      <div className={cn("relative min-w-0", !renderTrigger && "w-full", wrapperClassName)}>
        {customTrigger ? (
          React.cloneElement(
            customTrigger as React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>,
            {
              onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
                ;(
                  customTrigger.props as React.ButtonHTMLAttributes<HTMLButtonElement>
                ).onClick?.(event)
                if (!disabled && !event.defaultPrevented) {
                  setOpen(true)
                }
              },
            }
          )
        ) : (
          renderDefaultButton(() => !disabled && setOpen(true))
        )}
        {clearButton}
        {hiddenRequiredInput}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-[min(22rem,calc(100vw-2rem))] gap-2 rounded-md p-4">
            <DialogHeader className="text-left">
              <DialogTitle className="text-base font-semibold text-ink">
                {dialogTitle}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Pilih tanggal dari kalender
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">{calendarNode}</div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className={cn("relative min-w-0", !renderTrigger && "w-full", wrapperClassName)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {renderTrigger
            ? renderTrigger({
                open,
                formattedDate,
                hasValue: Boolean(selectedDate),
                disabled,
              })
            : renderDefaultButton()}
        </PopoverTrigger>
        <PopoverContent align={align} className="w-auto overflow-hidden">
          {calendarNode}
        </PopoverContent>
      </Popover>
      {clearButton}
      {hiddenRequiredInput}
    </div>
  )
}

export { DatePicker }
