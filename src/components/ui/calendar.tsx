import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

/**
 * shadcn/ui Calendar — a themed wrapper over react-day-picker, restyled to the
 * Ghella tokens (Space Grotesk numerals, mono weekday initials, ink-on-cream
 * selection) so it drops into the phone's cards like the hand-built grid it
 * replaces. Month and year navigate for real: chevrons step months across
 * year boundaries, and the caption offers month + year dropdowns.
 *
 * Pass `components.DayButton` to draw inside the day cells (the calendar
 * screen uses it for task dots).
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-full select-none", className)}
      classNames={{
        months: "relative flex flex-col",
        month: "w-full space-y-2",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "font-display text-[14px] font-bold",
        dropdowns:
          "flex items-center justify-center gap-1.5 font-display text-[14px] font-bold",
        dropdown_root: "relative rounded-[7px] bg-chip-2 px-1",
        dropdown: "absolute inset-0 cursor-pointer opacity-0",
        nav: "absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between",
        button_previous:
          "flex size-8 cursor-pointer items-center justify-center rounded-lg font-mono text-[13px] font-bold text-line-dash hover:bg-chip hover:text-ink",
        button_next:
          "flex size-8 cursor-pointer items-center justify-center rounded-lg font-mono text-[13px] font-bold text-line-dash hover:bg-chip hover:text-ink",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "flex-1 py-[3px] text-center font-mono text-[9.5px] font-bold text-line-dash uppercase",
        week: "flex w-full",
        day: "flex-1 p-0 text-center",
        today: "gh-cal-today",
        selected: "gh-cal-selected",
        outside: "opacity-35",
        disabled: "opacity-25",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        // The design's chevrons are typographic, not iconographic.
        Chevron: ({ orientation }) => (
          <span aria-hidden>
            {orientation === "left" ? "‹" : orientation === "right" ? "›" : "▾"}
          </span>
        ),
        ...props.components,
      }}
      {...props}
    />
  )
}

/**
 * The default day cell: date numeral with today/selected treatments matching
 * the app's chips. Screens that need richer cells (dots, badges) supply their
 * own DayButton and can reuse `dayButtonClass` for the shared styling.
 */
export function dayButtonClass(modifiers: {
  selected?: boolean
  today?: boolean
}): string {
  return cn(
    "flex aspect-[0.92] w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg transition-colors",
    modifiers.today && "bg-ink text-cream",
    modifiers.selected && !modifiers.today && "border-2 border-ink",
    !modifiers.selected && !modifiers.today && "hover:bg-chip/60"
  )
}

export { Calendar }
