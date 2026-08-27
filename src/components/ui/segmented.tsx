import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

export type SegmentedOption<T extends string> = { value: T; label: string }

/**
 * The chip-tray segmented control used for the calendar views and the
 * language picker. The active pill is a shared layout element so switching
 * tabs slides rather than jumps.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  layoutId,
  className,
  itemClassName,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  layoutId: string
  className?: string
  itemClassName?: string
}) {
  return (
    <div className={cn("flex rounded-[9px] bg-chip p-[3px]", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "relative cursor-pointer rounded-[7px] px-[9px] py-[6px] font-sans text-[12px] font-bold transition-colors",
              active ? "text-cream" : "text-ink-muted",
              itemClassName
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[7px] bg-ink"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
