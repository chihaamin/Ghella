import { AnimatePresence, motion } from "framer-motion"
import { useRef } from "react"

import { DropBadge, PinIcon, WaterDrop } from "@/components/ghella/icons"
import { ParcelMap, type ParcelMapHandle } from "@/components/ghella/parcel-map"
import { SectionLabel } from "@/components/ghella/primitives"
import { Button } from "@/components/ui/button"
import {
  ANALYSIS_LINES,
  PARCEL_COLORS,
  PARCEL_FACTS,
  SALINITY,
  SALINITY_SHORT,
  SOILS,
  WATER_ESTIMATES,
  WATER_SHORT,
  WATER_SOURCES,
} from "@/data/onboarding"
import { BUDGET_BANDS } from "@/data/varieties"
import { useT } from "@/i18n/use-t"
import { fadeUp, pop, pulse } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useApp } from "@/store/app-store"

/** Green when picked, hairline when not — the shared "choice card" outline. */
const pickBorder = (on: boolean) => (on ? "border-leaf" : "border-line")

function LocatePrompt() {
  const { t } = useT()
  const allowLocate = useApp((s) => s.allowLocate)

  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-line-strong bg-card px-5 py-[26px] text-center">
      <span className="flex size-[54px] items-center justify-center rounded-full bg-leaf-tint">
        <PinIcon />
      </span>
      <div className="font-display text-lg font-semibold">{t.locTitle}</div>
      <div className="max-w-[280px] text-[12.5px] leading-[1.55] text-muted">
        {t.locSub}
      </div>
      <Button variant="ink" onClick={allowLocate}>
        {t.locBtn}
      </Button>
      <div className="cursor-pointer text-[12.5px] font-semibold text-muted">
        {t.locAlt}
      </div>
    </div>
  )
}

function StepDraw() {
  const { t } = useT()
  const located = useApp((s) => s.located)
  const pts = useApp((s) => s.pts)
  const startAnalysis = useApp((s) => s.startAnalysis)
  const mapApi = useRef<ParcelMapHandle>(null)
  const ready = pts.length >= 3

  return (
    <>
      <div className="font-display text-[22px] leading-[1.15] font-semibold">
        {t.obTitle}
      </div>
      <div className="-mt-2 text-[13px] leading-[1.5] text-muted">{t.obSub}</div>

      {!located ? (
        <LocatePrompt />
      ) : (
        <>
          <ParcelMap ref={mapApi} />
          <div className="flex gap-2">
            <Button
              variant={ready ? "ink" : "disabled"}
              className="flex-1 transition-colors"
              onClick={() => ready && startAnalysis()}
            >
              {t.obConfirm}
            </Button>
            <Button
              variant="outline"
              className="w-auto border-line-dash px-3.5 text-ink-muted"
              onClick={() => mapApi.current?.useDetected()}
            >
              {t.obDetect}
            </Button>
          </div>
        </>
      )}
    </>
  )
}

function StepAnalyzing() {
  const { t } = useT()
  const anLine = useApp((s) => s.anLine)

  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-[22px] text-center">
      <motion.div {...pulse}>
        <DropBadge />
      </motion.div>
      <div className="font-display text-xl font-semibold">{t.obAnalyzing}</div>
      <motion.div {...pulse} className="font-mono text-[13px] text-muted">
        {ANALYSIS_LINES[Math.min(anLine, ANALYSIS_LINES.length - 1)]}
      </motion.div>
      <div className="h-[7px] w-[220px] overflow-hidden rounded-[4px] bg-line">
        <motion.div
          className="h-full rounded-[4px] bg-leaf"
          initial={{ width: "4%" }}
          animate={{ width: "96%" }}
          transition={{ duration: 2.3, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function StepParcelCard() {
  const { t } = useT()
  const set = useApp((s) => s.set)

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3.5"
    >
      <div className="flex flex-col gap-3.5 rounded-2xl bg-ink px-[18px] pt-[18px] pb-4 text-surface">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-sun">
            {t.obCardTag}
          </span>
          <span className="size-3 rounded-[4px] bg-leaf-light" />
        </div>

        <div className="flex items-baseline gap-2.5">
          <motion.span
            variants={pop}
            initial="hidden"
            animate="show"
            className="font-display text-[44px] leading-none font-bold"
          >
            1.42
          </motion.span>
          <span className="font-display text-base font-bold text-sand">ha</span>
          <span className="ms-auto font-display text-[15px] font-semibold">
            {t.obParcelName}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-[9px]">
          {PARCEL_FACTS.map((f) => (
            <div
              key={f.k}
              className="flex flex-col gap-0.5 rounded-[10px] bg-surface/8 px-[11px] py-[9px]"
            >
              <span className="font-mono text-[9.5px] font-bold tracking-[0.1em] text-sand">
                {f.k}
              </span>
              <span className="text-[13.5px] font-semibold text-surface">{f.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[12.5px] leading-[1.5] text-muted">{t.obRevealNote}</div>
      <Button variant="leaf" onClick={() => set({ ob: 3 })}>
        {t.obRefineCta}
      </Button>
    </motion.div>
  )
}

function StepRefine() {
  const { t } = useT()
  const soil = useApp((s) => s.soil)
  const wsrc = useApp((s) => s.wsrc)
  const sal = useApp((s) => s.sal)
  const bud = useApp((s) => s.bud)
  const set = useApp((s) => s.set)

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4"
    >
      <div className="font-display text-xl font-semibold">{t.obRefineTitle}</div>

      {/* 1 — soil texture */}
      <div className="flex flex-col gap-2">
        <SectionLabel className="text-[12px] tracking-[0.1em]">1 · {t.obSoil}</SectionLabel>
        <div className="flex gap-2">
          {SOILS.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => set({ soil: i })}
              className={cn(
                "flex-1 cursor-pointer overflow-hidden rounded-[11px] border-[2.5px] bg-card transition-colors",
                pickBorder(soil === i)
              )}
            >
              <div className="h-[54px]" style={{ background: s.tex }} />
              <div className="px-2 py-[7px] text-center text-[11.5px] font-semibold">
                {s.name}
              </div>
            </button>
          ))}
        </div>
        <div className="text-[11.5px] text-muted">{t.obSoilHint}</div>
      </div>

      {/* 2 — irrigation */}
      <div className="flex flex-col gap-2">
        <SectionLabel className="text-[12px] tracking-[0.1em]">2 · {t.obWater}</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {WATER_SOURCES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => set({ wsrc: i })}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-[11px] border-[2.5px] bg-card px-[11px] py-2.5 text-start transition-colors",
                pickBorder(wsrc === i)
              )}
            >
              <span className="text-[13px] font-semibold">{s.name}</span>
              <span className="text-[11px] text-muted">{s.sub}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-[10px] bg-water-tint px-3 py-[9px]">
          <WaterDrop />
          <span className="text-[12.5px] font-semibold text-water-deep">
            {WATER_ESTIMATES[wsrc]}
          </span>
        </div>
      </div>

      {/* 3 — salinity */}
      <div className="flex flex-col gap-2">
        <SectionLabel className="text-[12px] tracking-[0.1em]">3 · {t.obSal}</SectionLabel>
        <div className="flex gap-2">
          {SALINITY.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => set({ sal: i })}
              className={cn(
                "flex-1 cursor-pointer rounded-[10px] border-[2.5px] bg-card px-1.5 py-[9px] text-center text-[12px] font-semibold transition-colors",
                pickBorder(sal === i)
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* 4 — budget */}
      <div className="flex flex-col gap-2">
        <SectionLabel className="text-[12px] tracking-[0.1em]">4 · {t.obBudget}</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {BUDGET_BANDS.map((b, i) => (
            <button
              key={b.label}
              type="button"
              onClick={() => set({ bud: i })}
              className={cn(
                "cursor-pointer rounded-[10px] border-[2.5px] bg-card px-1.5 py-[9px] text-center text-[12.5px] font-semibold transition-colors",
                pickBorder(bud === i)
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="text-[11.5px] text-muted">{t.obBudgetHint}</div>
      </div>

      <Button variant="leaf" onClick={() => set({ ob: 4 })}>
        {t.obSave}
      </Button>
    </motion.div>
  )
}

function StepDone() {
  const { t, lang } = useT()
  const wsrc = useApp((s) => s.wsrc)
  const sal = useApp((s) => s.sal)
  const bud = useApp((s) => s.bud)
  const pcolor = useApp((s) => s.pcolor)
  const set = useApp((s) => s.set)
  const go = useApp((s) => s.go)
  const toast = useApp((s) => s.toast)

  const summary = `Sandy loam · ${WATER_SHORT[wsrc]} · ${SALINITY_SHORT[sal]} · budget ${
    BUDGET_BANDS[bud].label
  } · 1.42 ha next to ${lang === "fr" ? "Colline" : "Hill"}`

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3.5"
    >
      <div className="font-display text-xl font-semibold">{t.obDoneTitle}</div>

      <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="size-3.5 rounded-[4px]"
            style={{ background: PARCEL_COLORS[pcolor] }}
          />
          <span className="font-display text-lg font-bold">{t.obParcelName}</span>
          <span className="ms-auto font-mono text-[12px] font-bold text-muted">1.42 ha</span>
        </div>

        <div className="flex gap-2">
          {PARCEL_COLORS.map((v, i) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ pcolor: i })}
              className={cn(
                "size-[30px] cursor-pointer rounded-[9px] border-[2.5px] transition-colors",
                pcolor === i ? "border-ink" : "border-transparent"
              )}
              style={{ background: v }}
              aria-label={`Parcel colour ${i + 1}`}
            />
          ))}
        </div>

        <div className="text-[12.5px] leading-[1.5] text-muted">{summary}</div>
      </div>

      <Button
        variant="ink"
        onClick={() => {
          toast(
            lang === "ar"
              ? "حُفظت الأرض — روزنامتك جاهزة"
              : "Land saved — your calendar is ready"
          )
          go("cal")
        }}
      >
        {t.obFinish}
      </Button>
    </motion.div>
  )
}

export function OnboardScreen() {
  const ob = useApp((s) => s.ob)

  return (
    <div className="flex flex-col gap-3.5 pt-1">
      <AnimatePresence mode="wait">
        <motion.div key={ob} className="flex flex-col gap-3.5">
          {ob === 0 && <StepDraw />}
          {ob === 1 && <StepAnalyzing />}
          {ob === 2 && <StepParcelCard />}
          {ob === 3 && <StepRefine />}
          {ob === 4 && <StepDone />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
