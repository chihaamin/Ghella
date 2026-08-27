import type { JSX } from "react"

import { motion } from "framer-motion"

import { useT } from "@/i18n/use-t"
import { fadeUp } from "@/lib/motion"
import { cn, fmt } from "@/lib/utils"
import type { Terrain } from "@/types/land"

/**
 * Terrain in one line — elevation, slope, aspect. Deliberately not a card:
 * three numbers do not earn a border, so it sits between the panels as a
 * quiet divided strip. Aspect is null on flat ground and reads "flat"
 * rather than leaving a hole.
 */
export function TerrainStrip({ terrain }: { terrain: Terrain }): JSX.Element {
  const { t } = useT()

  const cells = [
    { label: t.ldElevation, value: `${fmt(terrain.elevationM)} m` },
    { label: t.ldSlope, value: `${terrain.slopePct.toFixed(1)}%` },
    { label: t.ldAspect, value: terrain.aspect ?? t.ldFlat },
  ]

  return (
    <motion.div variants={fadeUp} className="flex items-center px-1">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          // Logical border-s so the dividers sit between cells in RTL too.
          className={cn("flex flex-1 flex-col gap-px", i > 0 && "border-s border-line ps-3")}
        >
          <span className="font-mono text-[9.5px] font-bold text-muted">{cell.label}</span>
          <span className="font-display text-[14px] font-bold">{cell.value}</span>
        </div>
      ))}
    </motion.div>
  )
}
