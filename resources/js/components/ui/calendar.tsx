import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"
import { id as idLocale } from "react-day-picker/locale"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = idLocale,
  weekStartsOn = 1,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays={showOutsideDays}
      locale={locale}
      weekStartsOn={weekStartsOn}
      className={cn("bg-canvas p-3 text-ink select-none", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 sm:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-8 rounded-full border-hairline bg-canvas p-0 text-ink hover:bg-bone aria-disabled:pointer-events-none aria-disabled:opacity-40",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-8 rounded-full border-hairline bg-canvas p-0 text-ink hover:bg-bone aria-disabled:pointer-events-none aria-disabled:opacity-40",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-8 w-full items-center justify-center px-9",
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          "text-sm font-semibold text-ink capitalize",
          defaultClassNames.caption_label
        ),
        dropdowns: cn(
          "flex h-8 w-full items-center justify-center gap-1.5 text-sm font-semibold",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-xs border border-hairline bg-canvas shadow-xs",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 cursor-pointer opacity-0",
          defaultClassNames.dropdown
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "w-9 flex-1 py-1 text-center text-[0.75rem] font-medium text-mute select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative aspect-square h-9 w-9 flex-1 p-0 text-center text-sm select-none",
          defaultClassNames.day
        ),
        day_button: cn(
          "inline-flex size-9 w-full cursor-pointer items-center justify-center rounded-full text-sm font-medium tabular-nums text-ink transition-colors hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none",
          "group-data-[today=true]/day:bg-bone group-data-[today=true]/day:font-semibold group-data-[today=true]/day:text-ink",
          "group-data-[selected=true]/day:bg-ink group-data-[selected=true]/day:font-semibold group-data-[selected=true]/day:text-canvas group-data-[selected=true]/day:hover:bg-body",
          "group-data-[outside=true]/day:text-stone group-data-[outside=true]/day:opacity-70",
          "group-data-[disabled=true]/day:pointer-events-none group-data-[disabled=true]/day:text-stone group-data-[disabled=true]/day:opacity-40",
          defaultClassNames.day_button
        ),
        selected: cn("bg-transparent", defaultClassNames.selected),
        today: cn("bg-transparent", defaultClassNames.today),
        outside: cn("text-stone", defaultClassNames.outside),
        disabled: cn("text-stone opacity-40", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        range_start: cn("rounded-l-full bg-bone", defaultClassNames.range_start),
        range_middle: cn("rounded-none bg-bone", defaultClassNames.range_middle),
        range_end: cn("rounded-r-full bg-bone", defaultClassNames.range_end),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className={cn("size-4", chevronClassName)}
                aria-hidden="true"
              />
            )
          }
          if (orientation === "right") {
            return (
              <ChevronRight
                className={cn("size-4", chevronClassName)}
                aria-hidden="true"
              />
            )
          }
          if (orientation === "up") {
            return (
              <ChevronUp
                className={cn("size-4", chevronClassName)}
                aria-hidden="true"
              />
            )
          }
          return (
            <ChevronDown
              className={cn("size-4", chevronClassName)}
              aria-hidden="true"
            />
          )
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
