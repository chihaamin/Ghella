import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** The small caps mono label that opens most sections. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] font-bold tracking-[0.12em] text-earth",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Screen title — Space Grotesk, semibold, tight leading. */
export function ScreenTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h1
      className={cn(
        "font-display text-[22px] leading-[1.15] font-semibold",
        className
      )}
    >
      {children}
    </h1>
  )
}

/** A key/value tile — the grey and tinted stat boxes used all over the app. */
export function Stat({
  label,
  value,
  sub,
  className,
  labelClassName,
  valueClassName,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  className?: string
  labelClassName?: string
  valueClassName?: string
}) {
  return (
    <div className={cn("flex flex-col gap-px rounded-[10px] px-[11px] py-[9px]", className)}>
      <span
        className={cn("font-mono text-[9.5px] font-bold text-muted", labelClassName)}
      >
        {label}
      </span>
      <span className={cn("font-display text-[17px] font-bold", valueClassName)}>
        {value}
      </span>
      {sub && <span className="text-[10.5px] text-muted-2">{sub}</span>}
    </div>
  )
}

/** Tinted note strip — water (blue), advisory (amber) or alert (clay). */
export function NoteStrip({
  tone = "water",
  icon,
  children,
  className,
}: {
  tone?: "water" | "sun" | "clay" | "neutral"
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  const tones = {
    water: "bg-water-tint text-water-deep",
    sun: "bg-chip-2 text-sun-ink-2",
    clay: "bg-clay-tint text-clay",
    neutral: "bg-chip-2 text-ink-soft",
  } as const
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[10px] px-[11px] py-[9px] text-[12px] leading-[1.5] font-semibold",
        tones[tone],
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  )
}
