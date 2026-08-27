/**
 * The three-question sheet between "Plan the harvest" and a committed plan.
 *
 * Pressing the button used to commit a season instantly, anchored on "today"
 * — which silently scheduled soil prep a farmer may have finished weeks ago,
 * on dates before they even meant to start. This sheet asks the only three
 * things the generic plan actually bends around: is the soil prepared, which
 * prep steps are already done, and when work begins. The card supplies the
 * frozen economics draft; the answers fill the three fields the calendar's
 * phase generator shapes itself by.
 *
 * Mechanics are a deliberate clone of `edit-parcel-sheet`: an absolute
 * overlay INSIDE the phone frame (never `fixed` — the app lives in a device
 * frame), a y-spring panel under AnimatePresence.
 */

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import type { JSX } from "react"
import { ar as arLocale, enUS, fr as frLocale } from "react-day-picker/locale"

import { SectionLabel } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { dateOfIso, isoOfDate } from "@/hooks/use-calendar"
import { useT } from "@/i18n/use-t"
import { recommendedPrep } from "@/lib/generic-plan"
import { springy } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { PlannedCropPlan, PrepStepId } from "@/store/app-store"
import type { CropCategory } from "@/types/land"

/** The card's frozen economics — everything but the three answers this sheet asks. */
export type PlanDraft = Omit<PlannedCropPlan, "startIso" | "soilPrepared" | "prepDone">

export interface PlanSetupResult {
  startIso: string
  soilPrepared: boolean
  prepDone: PrepStepId[]
}

/** Chip order mirrors the field sequence: break ground before you feed it. */
const PREP_STEPS: PrepStepId[] = ["plough", "manure", "fertiliser", "beds", "irrigation"]

/** Green when picked, hairline when not — onboarding's choice-card outline. */
const pickBorder = (on: boolean) => (on ? "border-leaf" : "border-line")

type WhenChoice = "today" | "week" | "pick"

export function PlanSetupSheet(props: {
  open: boolean
  cropName: string
  category: CropCategory | null
  /** Cycle length, so annual "fruit" (melon) gets bed/fertiliser advice. */
  cycleDays?: number | null
  onClose: () => void
  onCreate: (setup: PlanSetupResult) => void
}): JSX.Element | null {
  const { open, cropName, category, cycleDays = null, onClose, onCreate } = props
  const { t, lang, dir } = useT()

  const [soilPrepared, setSoilPrepared] = useState(false)
  const [prepDone, setPrepDone] = useState<PrepStepId[]>([])
  const [whenChoice, setWhenChoice] = useState<WhenChoice>("today")
  const [pickedIso, setPickedIso] = useState<string | null>(null)

  // Every opening is a fresh crop and a fresh conversation — yesterday's
  // answers about another card's soil must not leak into this one.
  useEffect(() => {
    if (open) {
      setSoilPrepared(false)
      setPrepDone([])
      setWhenChoice("today")
      setPickedIso(null)
    }
  }, [open])

  const stepLabel: Record<PrepStepId, string> = {
    plough: t.psPlough,
    manure: t.psManure,
    fertiliser: t.psFertiliser,
    beds: t.psBeds,
    irrigation: t.psIrrigation,
  }

  const recommended = recommendedPrep(category, cycleDays)

  const toggleStep = (step: PrepStepId) =>
    setPrepDone((cur) =>
      cur.includes(step) ? cur.filter((s) => s !== step) : [...cur, step]
    )

  // Local noon keeps every date on the day the farmer sees, whatever the
  // timezone does at midnight — same posture as the calendar hook.
  const todayIso = isoOfDate(new Date())
  const weekDate = dateOfIso(todayIso)
  weekDate.setDate(weekDate.getDate() + 7)
  const startIso =
    whenChoice === "today"
      ? todayIso
      : whenChoice === "week"
        ? isoOfDate(weekDate)
        : (pickedIso ?? todayIso)

  const locale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
  const startLine = dateOfIso(startIso).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const dpLocale = lang === "fr" ? frLocale : lang === "ar" ? arLocale : enUS

  const whenChips: { id: WhenChoice; label: string }[] = [
    { id: "today", label: t.psToday },
    { id: "week", label: t.psNextWeek },
    { id: "pick", label: t.psPickDate },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="absolute inset-0 z-40 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            key="panel"
            className="absolute inset-x-0 bottom-0 z-50 flex max-h-[80%] flex-col gap-4 overflow-auto rounded-t-[18px] bg-surface p-4"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springy}
          >
            <div className="flex flex-col gap-1">
              <SectionLabel>{t.psTitle}</SectionLabel>
              <span className="font-display text-[18px] leading-[1.15] font-bold">
                {cropName}
              </span>
            </div>

            {/* Q1 — is the soil already prepared? */}
            <div className="flex flex-col gap-2">
              <SectionLabel className="text-[12px] tracking-[0.1em]">
                {t.psSoilQ}
              </SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[false, true].map((yes) => (
                  <button
                    key={String(yes)}
                    type="button"
                    onClick={() => setSoilPrepared(yes)}
                    className={cn(
                      "cursor-pointer rounded-[11px] border-[2.5px] bg-card px-[11px] py-3 text-center text-[13px] font-semibold transition-colors",
                      pickBorder(soilPrepared === yes)
                    )}
                  >
                    {yes ? t.psYes : t.psNo}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2 — only when the soil is ready: what is already done? */}
            {soilPrepared && (
              <div className="flex flex-col gap-2">
                <SectionLabel className="text-[12px] tracking-[0.1em]">
                  {t.psWhatDone}
                </SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {PREP_STEPS.map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => toggleStep(step)}
                      className={cn(
                        "cursor-pointer rounded-[10px] border-[2.5px] bg-card px-2.5 py-[8px] text-[12px] font-semibold transition-colors",
                        pickBorder(prepDone.includes(step))
                      )}
                    >
                      {stepLabel[step]}
                    </button>
                  ))}
                </div>

                <SectionLabel className="pt-1 text-[10px]">
                  {t.psRecommended}
                </SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {recommended.map((step) => (
                    <Badge key={step} variant="leaf" size="xs">
                      {stepLabel[step]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* The consequence of Q1, said out loud before the date is asked. */}
            <div className="rounded-[9px] bg-leaf-tint px-[11px] py-2 text-[12px] leading-[1.45] font-semibold text-leaf-deep">
              {/* With recommended steps unticked, planting is NOT day 1 —
                  the gaps note is the honest one. */}
              {soilPrepared
                ? recommended.some((step) => !prepDone.includes(step))
                  ? t.psGapsNote
                  : t.psReadyNote
                : t.psSoilFirstNote}
            </div>

            {/* Q3 — when does work begin? */}
            <div className="flex flex-col gap-2">
              <SectionLabel className="text-[12px] tracking-[0.1em]">
                {t.psWhenQ}
              </SectionLabel>
              <div className="flex gap-2">
                {whenChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setWhenChoice(chip.id)}
                    className={cn(
                      "flex-1 cursor-pointer rounded-[10px] border-[2.5px] bg-card px-1.5 py-[9px] text-center text-[12px] font-semibold transition-colors",
                      pickBorder(whenChoice === chip.id)
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {whenChoice === "pick" && (
                <div className="rounded-[11px] border border-line bg-card p-2">
                  <Calendar
                    mode="single"
                    selected={dateOfIso(startIso)}
                    onSelect={(d) => d && setPickedIso(isoOfDate(d))}
                    defaultMonth={dateOfIso(startIso)}
                    disabled={{ before: dateOfIso(todayIso) }}
                    locale={dpLocale}
                    dir={dir}
                  />
                </div>
              )}

              <div className="text-[12.5px] font-semibold">{startLine}</div>
            </div>

            <Button
              variant="leaf"
              size="lg"
              onClick={() => onCreate({ startIso, soilPrepared, prepDone })}
            >
              {t.psCreate}
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
