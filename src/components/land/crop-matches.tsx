import { useState } from "react"
import type { JSX } from "react"

import { AnimatePresence, motion } from "framer-motion"

import { NoteStrip, SectionLabel } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { expand, fadeUp, listStagger } from "@/lib/motion"
import { cn, fmt } from "@/lib/utils"
import type { CropMatch, CropRating } from "@/types/land"

/** Rating → badge tint, the same green→blue→amber→red ladder the app uses. */
const RATING_BADGE: Record<CropRating, "leaf" | "water" | "sun" | "clay"> = {
  excellent: "leaf",
  good: "water",
  marginal: "sun",
  unsuitable: "clay",
}

/** Rating → the score bar fill, matching the badge beside it. */
const RATING_BAR: Record<CropRating, string> = {
  excellent: "bg-leaf",
  good: "bg-water",
  marginal: "bg-sun",
  unsuitable: "bg-clay",
}

/**
 * Ranked crop matches for a parcel, as an accordion — one open at a time,
 * because the open body is the whole story (factor bars in the Decide
 * screen "Why this score" style, planting chips, hard blockers) and two of
 * them open is a wall. Shows the top `initial` crops until the farmer asks
 * for more. Pure presentation: ranking and scoring happened upstream in
 * `lib/crop-suitability`.
 */
export function CropMatches({
  crops,
  initial = 5,
  onPick,
}: {
  crops: CropMatch[]
  initial?: number
  onPick?: (crop: CropMatch) => void
}): JSX.Element {
  const { t, lang } = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? crops : crops.slice(0, initial)

  const ratingLabel: Record<CropRating, string> = {
    excellent: t.ldRatingExcellent,
    good: t.ldRatingGood,
    marginal: t.ldRatingMarginal,
    unsuitable: t.ldRatingUnsuitable,
  }

  const monthShort = (m: number) =>
    new Date(2026, m - 1, 1).toLocaleString(lang, { month: "short" })

  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col rounded-[13px] border border-line bg-card"
    >
      <div className="flex flex-col gap-1 px-3.5 pt-3 pb-2.5">
        <SectionLabel>{t.ldCrops}</SectionLabel>
        <div className="text-[11.5px] leading-[1.45] text-muted">{t.ldCropsSub}</div>
      </div>

      <motion.div
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col"
      >
        {visible.map((crop) => {
          const open = openId === crop.id
          return (
            <motion.div key={crop.id} variants={fadeUp} className="border-t border-line">
              <button
                type="button"
                onClick={() => setOpenId((cur) => (cur === crop.id ? null : crop.id))}
                className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2.5 text-start"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-[14.5px] leading-tight font-bold">
                    {crop.name}
                  </span>
                  <span className="truncate font-mono text-[10.5px] text-muted-2">
                    {crop.family}
                  </span>
                </span>
                <span className="ms-auto flex flex-none items-center gap-1.5">
                  <Badge variant={RATING_BADGE[crop.rating]} size="xs">
                    {ratingLabel[crop.rating]}
                  </Badge>
                  <Progress
                    value={crop.score}
                    trackHeight={5}
                    className="w-16"
                    indicatorClassName={RATING_BAR[crop.rating]}
                  />
                  <span className="w-6 text-end font-mono text-[11px] font-bold">
                    {Math.round(crop.score)}
                  </span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="body"
                    variants={expand}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="overflow-hidden border-t-[1.5px] border-dashed border-line"
                  >
                    <div className="flex flex-col gap-2.5 px-3.5 py-3">
                      {crop.factors.map((factor) => {
                        // Same thresholds as the Decide screen bars, so a 60
                        // looks the same everywhere in the app.
                        const strong = factor.score >= 75
                        const mid = factor.score >= 55
                        const color = strong ? C.leaf : mid ? C.sun : C.clay
                        const fg = strong ? "text-leaf" : mid ? "text-sun-ink" : "text-clay"
                        return (
                          <div key={factor.key} className="flex flex-col gap-[3px]">
                            <div className="flex justify-between text-[12px] font-semibold">
                              <span>{factor.label}</span>
                              <span className={cn("font-mono text-[11px] font-bold", fg)}>
                                {Math.round(factor.score)}
                              </span>
                            </div>
                            <div className="h-[7px] overflow-hidden rounded-[4px] bg-chip">
                              <motion.div
                                className="h-full rounded-[4px]"
                                style={{ background: color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${factor.score}%` }}
                                transition={{ duration: 0.45, ease: "easeOut" }}
                              />
                            </div>
                            <div className="text-[11px] leading-[1.4] text-muted">
                              {factor.note}
                            </div>
                          </div>
                        )
                      })}

                      <div className="flex flex-wrap gap-1.5">
                        {crop.plantingMonths.length > 0 && (
                          <Badge variant="leaf" size="xs">
                            {t.ldPlantIn} {crop.plantingMonths.map(monthShort).join(" · ")}
                          </Badge>
                        )}
                        <Badge variant="neutral" size="xs">
                          {t.ldCycle} {crop.cycleDays} d
                        </Badge>
                        <Badge variant="water" size="xs">
                          {t.ldWaterNeed} {fmt(crop.waterNeedMm)} mm
                        </Badge>
                      </div>

                      {crop.blockers.length > 0 && (
                        <NoteStrip tone="clay" className="items-start">
                          <span className="flex flex-col gap-[3px]">
                            <span className="font-mono text-[9.5px] font-bold tracking-[0.12em]">
                              {t.ldBlockers}
                            </span>
                            {crop.blockers.map((blocker) => (
                              <span
                                key={blocker}
                                className="text-[11.5px] leading-[1.45] font-semibold"
                              >
                                {blocker}
                              </span>
                            ))}
                          </span>
                        </NoteStrip>
                      )}

                      {onPick && (
                        <Button variant="outline" size="sm" onClick={() => onPick(crop)}>
                          {t.rcOpenDecide}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </motion.div>

      {crops.length > initial && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="w-full cursor-pointer border-t border-line px-3.5 py-2.5 text-center text-[12.5px] font-bold text-leaf"
        >
          {showAll ? t.ldShowLess : t.ldShowMore}
        </button>
      )}
    </motion.div>
  )
}
