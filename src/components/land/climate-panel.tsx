import type { JSX } from "react"

import { motion } from "framer-motion"
import type { Variants } from "framer-motion"

import { SectionLabel, Stat } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { useT } from "@/i18n/use-t"
import { monthDayLabel } from "@/lib/agronomy"
import { fadeUp, listStagger } from "@/lib/motion"
import { fmt } from "@/lib/utils"
import type { ClimateNormals, ClimateZoneId } from "@/types/land"

/**
 * Zone → badge tint. Dry zones read amber like the sun chips, the middle
 * band earth, wet zones water — so the badge colour alone tells the farmer
 * which side of "needs irrigation" this land sits on.
 */
const ZONE_BADGE: Record<ClimateZoneId, "sun" | "earth" | "water"> = {
  arid: "sun",
  "semi-arid": "sun",
  "dry-subhumid": "earth",
  humid: "water",
  "per-humid": "water",
}

/**
 * One rain bar growing to its month's share of the wettest month. The 2 %
 * floor keeps a bone-dry month visible as a sliver rather than vanishing —
 * "almost nothing" and "nothing rendered" read very differently.
 */
const barGrow: Variants = {
  hidden: { height: 0 },
  show: (pct: number) => ({
    height: `${Math.max(2, pct)}%`,
    transition: { duration: 0.35, ease: "easeOut" },
  }),
}

/**
 * Climate card for one parcel — the 10-year normals a planting decision hangs
 * on: rain vs evaporative demand, sun, growing degree days, the frost window
 * and a 12-month rain profile. Pure presentation: every number arrives
 * pre-computed on `ClimateNormals` and is only rounded for display here.
 */
export function ClimatePanel({ climate }: { climate: ClimateNormals }): JSX.Element {
  const { t, lang, isRtl } = useT()
  const { frost } = climate

  // The wettest month sets the chart scale; the 1 floor keeps a rainless
  // desert from dividing by zero.
  const maxRain = Math.max(1, ...climate.monthly.map((m) => m.rainMm))

  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col gap-2.5 rounded-[13px] border border-line bg-card px-3.5 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t.ldClimate}</SectionLabel>
        <Badge variant={ZONE_BADGE[climate.zone.id]} size="sm">
          {climate.zone.label}
        </Badge>
      </div>

      <div className="text-[11.5px] leading-[1.45] text-muted">{climate.zone.note}</div>

      <div className="grid grid-cols-2 gap-1.5">
        <Stat
          className="bg-chip-2"
          label={t.ldAnnualRain}
          value={`${fmt(climate.annualRainMm)} mm`}
        />
        <Stat
          className="bg-chip-2"
          label={t.ldEt0}
          value={`${fmt(climate.annualEt0Mm)} mm`}
        />
        <Stat
          className="bg-chip-2"
          label={t.ldSunHours}
          // Rounded to tens — the trailing digit of "3 187 h" is noise.
          value={`${fmt(Math.round(climate.sunHoursPerYear / 10) * 10)} h`}
        />
        <Stat
          className="bg-chip-2"
          label={t.ldGdd}
          value={`${fmt(climate.gddBase10)} °C·d`}
        />
      </div>

      <div className="flex items-baseline justify-between gap-2 rounded-[10px] bg-chip-2 px-[11px] py-[9px]">
        <span className="font-mono text-[9.5px] font-bold text-muted">{t.ldFrostWindow}</span>
        <span className="text-end">
          <span className="font-display text-[13px] font-bold">
            {frost.risk !== "none"
              ? `${monthDayLabel(frost.firstAutumnFrost, lang)} ${isRtl ? "←" : "→"} ${monthDayLabel(frost.lastSpringFrost, lang)}`
              : t.ldNoFrost}
          </span>
          {frost.frostFreeDays !== null && (
            <span className="ms-1.5 text-[10.5px] text-muted-2">
              {frost.frostFreeDays} {t.ldFrostFree}
            </span>
          )}
        </span>
      </div>

      {/* 12-month rain profile — heights are relative to the wettest month,
          so the shape of the year reads instantly even where totals are low. */}
      <div className="flex flex-col gap-1 pt-0.5">
        <motion.div
          variants={listStagger}
          initial="hidden"
          animate="show"
          className="flex h-[52px] items-end gap-[3px]"
        >
          {climate.monthly.map((m) => (
            <motion.div
              key={m.month}
              variants={barGrow}
              custom={(m.rainMm / maxRain) * 100}
              className="flex-1 rounded-t-[3px] bg-water"
            />
          ))}
        </motion.div>
        <div className="flex gap-[3px]">
          {climate.monthly.map((m) => (
            <span
              key={m.month}
              className="flex-1 text-center font-mono text-[8.5px] text-muted-2"
            >
              {new Date(2026, m.month - 1, 1).toLocaleString(lang, { month: "narrow" })}
            </span>
          ))}
        </div>
      </div>

      <div className="font-mono text-[9.5px] text-muted">{t.ldClimateYears}</div>
    </motion.div>
  )
}
