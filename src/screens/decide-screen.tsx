import { AnimatePresence, motion } from "framer-motion"

import { WarningIcon } from "@/components/ghella/icons"
import { SectionLabel, ScreenTitle } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BUDGET_BANDS,
  SEASON_BUDGET,
  SORT_ORDERS,
  VARIETIES,
  WATER_CAPACITY,
  sortLabels,
  type Variety,
} from "@/data/varieties"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { expand, fadeUp, listStagger } from "@/lib/motion"
import { cn, fmt } from "@/lib/utils"
import { useApp, type SortKey, type VarietyId } from "@/store/app-store"

/** Water-profit score, drawn as a drop filling from the bottom. */
function ScoreDrop({ id, wps }: { id: VarietyId; wps: number }) {
  const { t } = useT()
  const clipId = `dcp-${id}`
  const fillY = 51 - Math.min(wps / 12, 1) * 42
  const label = wps > 8.5 ? C.surface : C.ink

  return (
    <div className="flex w-[76px] flex-none flex-col items-center gap-[3px]">
      <svg width="64" height="64" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="26" fill="#f2f0e6" stroke={C.ink} strokeWidth="2" />
        <path
          d="M28 9 C28 9 42 26 42 35 A14 14 0 0 1 14 35 C14 26 28 9 28 9 Z"
          fill="none"
          stroke={C.waterPale}
          strokeWidth="2"
        />
        <clipPath id={clipId}>
          <motion.rect
            x="10"
            width="36"
            height="42"
            initial={{ y: 51 }}
            animate={{ y: fillY }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </clipPath>
        <path
          d="M28 9 C28 9 42 26 42 35 A14 14 0 0 1 14 35 C14 26 28 9 28 9 Z"
          fill={C.water}
          clipPath={`url(#${clipId})`}
        />
        <text
          x="28"
          y="31"
          textAnchor="middle"
          style={{ font: "700 13px 'Space Grotesk',sans-serif" }}
          fill={label}
        >
          {wps.toFixed(1)}
        </text>
        <text
          x="28"
          y="41"
          textAnchor="middle"
          style={{ font: "700 5.5px 'Space Mono',monospace" }}
          fill={label}
        >
          {t.decUnit}
        </text>
      </svg>
      <span className="text-center font-mono text-[9px] leading-[1.25] font-bold text-water-deep">
        {t.decWps}
      </span>
    </div>
  )
}

function VarietyCard({ id, v }: { id: VarietyId; v: Variety }) {
  const { t, lang, pick } = useT()
  const open = useApp((s) => s.open) === id
  const toggle = useApp((s) => s.toggleVariety)
  const commit = useApp((s) => s.commitVariety)
  const budBand = useApp((s) => s.bud)

  const inputCost = SEASON_BUDGET[id][1]
  const band = BUDGET_BANDS[budBand]
  const overBudget = inputCost > band.cap
  const budgetWarn = overBudget
    ? `Inputs ≈ $${fmt(inputCost)} — above your ${band.label} budget`
    : ""

  const warn = budgetWarn || v.warn
  const severe = Boolean(budgetWarn) || v.warnLvl === "red"

  const plantWord = pick("Plant within ", "Planter sous ", "ازرع خلال ")
  const cycleWord = pick("cycle ", "cycle ", "دورة ")
  const dayUnit = pick(" d", " j", " يوم")
  const urgent = v.plantD <= 12

  const waterMath =
    pick("Water: needs ", "Water: needs ", "الماء: يحتاج ") +
    `${fmt(v.water)} m³ · ` +
    pick("you have 4,200 m³", "you have 4,200 m³", "متاح لديك 4,200 م³") +
    (v.water <= WATER_CAPACITY ? " ✓" : " ✕")

  return (
    <motion.div
      variants={fadeUp}
      layout
      className={cn(
        "overflow-hidden rounded-[15px] border-[1.5px] bg-card transition-colors",
        open ? "border-leaf" : "border-line"
      )}
    >
      <button
        type="button"
        onClick={() => toggle(id)}
        className="flex w-full cursor-pointer gap-3 px-3.5 pt-[13px] pb-[11px] text-start"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
          <div className="flex flex-col gap-px">
            <span className="font-mono text-[10.5px] font-bold tracking-[0.12em] text-earth">
              {v.crop}
            </span>
            <span className="font-display text-[19px] leading-[1.1] font-bold">{v.name}</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-display text-[15px] font-bold">{v.profit}</span>
            <span className="text-[11.5px] whitespace-nowrap text-muted">{t.decNet}</span>
          </div>

          <div className="text-[11px] text-muted">{v.forecastLine}</div>

          <div className="flex flex-wrap gap-[5px]">
            <Badge variant={urgent ? "sun" : "water"}>
              {plantWord}
              {v.plantD}
              {dayUnit}
            </Badge>
            <Badge variant="neutral">
              {cycleWord}
              {v.cycle}
              {dayUnit}
            </Badge>
            {v.badges.map((b) => (
              <Badge key={b} variant="leaf">
                {b}
              </Badge>
            ))}
          </div>
        </div>

        <ScoreDrop id={id} wps={v.wps} />
      </button>

      {warn && (
        <div
          className={cn(
            "mx-3.5 mb-2.5 flex items-start gap-[7px] rounded-[9px] px-2.5 py-[7px]",
            severe ? "bg-clay-tint" : "bg-sun-tint"
          )}
        >
          <span className="mt-px flex-none">
            <WarningIcon size={13} stroke={severe ? C.clay : C.sunInk} strokeWidth={2.6} />
          </span>
          <span
            className={cn(
              "text-[11.5px] leading-[1.4] font-semibold",
              severe ? "text-clay" : "text-sun-ink"
            )}
          >
            {warn}
          </span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            variants={expand}
            initial="hidden"
            animate="show"
            exit="exit"
            className="overflow-hidden border-t-[1.5px] border-dashed border-line"
          >
            <div className="flex flex-col gap-2.5 px-3.5 py-3">
              <SectionLabel>{t.decWhy}</SectionLabel>

              {v.bars.map((b) => {
                const strong = b.n >= 75
                const mid = b.n >= 55
                const color = strong ? C.leaf : mid ? C.sun : C.clay
                const fg = strong ? "text-leaf" : mid ? "text-sun-ink" : "text-clay"
                return (
                  <div key={b.k} className="flex flex-col gap-[3px]">
                    <div className="flex justify-between text-[12px] font-semibold">
                      <span>{b.k}</span>
                      <span className={cn("font-mono text-[11px] font-bold", fg)}>{b.n}</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-[4px] bg-chip">
                      <motion.div
                        className="h-full rounded-[4px]"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${b.n}%` }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                      />
                    </div>
                    <div className="text-[11px] leading-[1.4] text-muted">{b.note}</div>
                  </div>
                )
              })}

              <div className="rounded-[9px] bg-water-tint px-[11px] py-2 text-[12px] leading-[1.45] font-semibold text-water-deep">
                {waterMath}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="leaf"
                  size="md"
                  className="flex-1 rounded-[10px]"
                  onClick={() =>
                    commit(
                      id,
                      lang === "ar"
                        ? "أُنشئت الخطة والميزانية — 34 مهمة حتى الحصاد"
                        : "Season plan + budget created — 34 tasks to harvest"
                    )
                  }
                >
                  {t.decCommit}
                </Button>
                <Button variant="outline" size="md" className="rounded-[10px]">
                  {t.decCompare}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <button
            key="peek"
            type="button"
            onClick={() => toggle(id)}
            className="flex w-full cursor-pointer justify-between border-t border-[#f0ecdd] px-3.5 py-2 text-[12px] font-bold text-water"
          >
            <span>{t.decWhy}</span>
            <span>▾</span>
          </button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function DecideScreen() {
  const { t, lang } = useT()
  const sort = useApp((s) => s.sort)
  const set = useApp((s) => s.set)
  const budBand = useApp((s) => s.bud)

  const labels = sortLabels(lang)
  const order = SORT_ORDERS[sort]

  return (
    <div className="flex flex-col gap-3 pt-1">
      <ScreenTitle>{t.decTitle}</ScreenTitle>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="ink" size="md">
          {t.pNorth} · 0.8 ha
        </Badge>
        <Badge variant="neutral" size="md">
          {t.decWell}
        </Badge>
        <Badge variant="neutral" size="md">
          {t.decSeason}
        </Badge>
        <Badge variant="sunOutline" size="md">
          BUDGET {BUDGET_BANDS[budBand].label.toUpperCase()}
        </Badge>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5">
        {(Object.keys(SORT_ORDERS) as SortKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => set({ sort: k })}
            className={cn(
              "flex-none cursor-pointer rounded-[9px] border-[1.5px] px-[11px] py-[7px] text-[12px] font-bold transition-colors",
              sort === k
                ? "border-ink bg-ink text-cream"
                : "border-line-strong bg-card text-ink-muted"
            )}
          >
            {labels[k]}
          </button>
        ))}
      </div>

      <motion.div
        key={sort}
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-[11px]"
      >
        {order.map((id) => (
          <VarietyCard key={id} id={id} v={VARIETIES[id]} />
        ))}
      </motion.div>

      <div className="px-0.5 pb-1.5 text-[11.5px] leading-[1.5] text-muted">{t.decFoot}</div>
    </div>
  )
}
