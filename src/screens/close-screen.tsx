import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { fadeUp } from "@/lib/motion"
import { fmt } from "@/lib/utils"
import { useApp } from "@/store/app-store"

/** The plan figures the actuals are measured against. */
const PLAN = { profit: 35900, yield: 42, price: 1.55 } as const
/** 0.8 ha at $13,260/ha of inputs, plus 25% for labour and pumping. */
const AREA = 0.8
const COST_PER_HA = 13260

function Stepper({
  label,
  sub,
  value,
  onDown,
  onUp,
}: {
  label: string
  sub: string
  value: string
  onDown: () => void
  onUp: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-[13.5px] font-semibold">{label}</span>
        <span className="text-[11px] text-muted">{sub}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onDown}
          className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] bg-chip font-display text-lg font-bold active:scale-95"
        >
          −
        </button>
        <span className="min-w-[52px] text-center font-display text-xl font-bold">
          {value}
        </span>
        <button
          type="button"
          onClick={onUp}
          className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] bg-chip font-display text-lg font-bold active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  )
}

function StepEntry() {
  const { t } = useT()
  const clYield = useApp((s) => s.clYield)
  const clPrice = useApp((s) => s.clPrice)
  const bumpYield = useApp((s) => s.bumpYield)
  const bumpPrice = useApp((s) => s.bumpPrice)
  const set = useApp((s) => s.set)

  return (
    <>
      <div className="font-display text-[22px] leading-[1.2] font-semibold">{t.clTitle}</div>
      <div className="-mt-1.5 text-[13px] leading-[1.5] text-muted">{t.clSub}</div>

      <div className="flex flex-col gap-[13px] rounded-[14px] border border-line bg-card p-3.5">
        <Stepper
          label={t.clYield}
          sub={`${t.clPredicted} 42.0`}
          value={clYield.toFixed(1)}
          onDown={() => bumpYield(-0.5)}
          onUp={() => bumpYield(0.5)}
        />
        <Stepper
          label={t.clPrice}
          sub={`${t.clForecastWas} 1.55`}
          value={clPrice.toFixed(2)}
          onDown={() => bumpPrice(-0.05)}
          onUp={() => bumpPrice(0.05)}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">{t.clPhotos}</span>
          <div className="flex gap-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                className="flex size-[74px] cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[11px] border-2 border-dashed border-line-dash text-muted"
              >
                <span className="text-xl font-bold">+</span>
                <span className="font-mono text-[9.5px] font-semibold">
                  {t.clPhoto} {n}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button variant="sun" onClick={() => set({ cl: 1 })}>
        {t.clUnlock}
      </Button>
    </>
  )
}

function ComparisonRow({
  label,
  plan,
  actual,
  planWidth,
  actualWidth,
  delta,
}: {
  label: string
  plan: string
  actual: string
  planWidth: string
  actualWidth: string
  delta: string
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[12px] font-semibold text-sand">
        <span>{label}</span>
        <span className="font-mono text-[11px] font-bold text-[#e8b08a]">{delta}</span>
      </div>

      <div className="flex items-center gap-[7px]">
        <span className="w-[52px] font-mono text-[10px] text-sand">{t.clPlan}</span>
        <div className="h-[7px] flex-1 rounded-[4px] bg-surface/14">
          <div className="h-full rounded-[4px] bg-sand" style={{ width: planWidth }} />
        </div>
        <span className="w-[58px] text-end font-mono text-[11.5px] font-bold text-sand">
          {plan}
        </span>
      </div>

      <div className="flex items-center gap-[7px]">
        <span className="w-[52px] font-mono text-[10px] text-cream">{t.clActual}</span>
        <div className="h-[7px] flex-1 rounded-[4px] bg-surface/14">
          <motion.div
            className="h-full rounded-[4px] bg-sun"
            initial={{ width: 0 }}
            animate={{ width: actualWidth }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="w-[58px] text-end font-mono text-[11.5px] font-bold">{actual}</span>
      </div>
    </div>
  )
}

function StepReport() {
  const { t, pick } = useT()
  const clYield = useApp((s) => s.clYield)
  const clPrice = useApp((s) => s.clPrice)

  const netActual = clYield * AREA * 1000 * clPrice - AREA * COST_PER_HA * 1.25

  const rows = [
    {
      label: pick("Net profit ($)", "Profit net ($)", "صافي الربح ($)"),
      plan: "$35,900",
      actual: `$${fmt(netActual)}`,
      planWidth: "96%",
      actualWidth: `${Math.min(netActual / PLAN.profit, 1) * 96}%`,
      delta: "−13%",
    },
    {
      label: pick("Yield (t/ha)", "Rendement (t/ha)", "المردود (طن/هك)"),
      plan: "42.0",
      actual: clYield.toFixed(1),
      planWidth: "96%",
      actualWidth: `${(clYield / PLAN.yield) * 96}%`,
      delta: `${clYield >= PLAN.yield ? "+" : ""}${Math.round((clYield / PLAN.yield - 1) * 100)}%`,
    },
    {
      label: pick("Price ($/kg)", "Prix ($/kg)", "السعر ($/كغ)"),
      plan: "1.55",
      actual: clPrice.toFixed(2),
      planWidth: "96%",
      actualWidth: `${(clPrice / PLAN.price) * 96}%`,
      delta: `${Math.round((clPrice / PLAN.price - 1) * 100)}%`,
    },
  ]

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3.5 rounded-[18px] bg-ink px-4 py-[18px] text-surface"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-sun">
          {t.clReportTag}
        </span>
        <div className="flex size-10 -rotate-4 flex-col items-center justify-center rounded-[9px] border-2 border-sun">
          <svg width="16" height="16" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke={C.sun} strokeWidth="4" />
            <path
              d="M28 13 C28 13 39 26 39 33 A11 11 0 0 1 17 33 C17 26 28 13 28 13 Z"
              fill={C.sun}
            />
          </svg>
          <span className="font-mono text-[5px] font-bold tracking-[0.18em] text-sun">
            GHELLA
          </span>
        </div>
      </div>

      <div className="font-display text-xl leading-[1.2] font-semibold">{t.clReportTitle}</div>

      <div className="flex flex-col gap-[9px]">
        {rows.map((r) => (
          <ComparisonRow key={r.label} {...r} />
        ))}
      </div>

      <div className="flex gap-[9px]">
        <div className="flex flex-1 flex-col gap-0.5 rounded-xl border-[1.5px] border-water bg-water/20 px-[11px] py-2.5">
          <span className="font-mono text-[9.5px] font-bold text-water-light">
            {t.clWaterSaved}
          </span>
          <span className="font-display text-xl font-bold text-water-light">450 m³</span>
          <span className="text-[10.5px] text-water-pale">{t.clWaterSub}</span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 rounded-xl border-[1.5px] border-sun bg-sun/16 px-[11px] py-2.5">
          <span className="font-mono text-[9.5px] font-bold text-sun">{t.clWps}</span>
          <span className="font-display text-xl font-bold text-cream">
            10.8 <span className="text-[11px]">{t.decUnit}</span>
          </span>
          <span className="text-[10.5px] text-[#d9c89a]">{t.clWpsSub}</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[10px] bg-surface/8 px-3 py-[9px]">
        <span className="text-[12px] font-semibold">{t.clSprayLog}</span>
        <span className="cursor-pointer font-mono text-[11px] font-bold text-sun">
          {t.clExport} ↧
        </span>
      </div>

      <div className="text-center text-[11.5px] leading-[1.5] text-sand">{t.clCommunity}</div>

      <div className="flex gap-2">
        <Button variant="light" size="md" className="flex-1 rounded-[10px]">
          {t.clShare}
        </Button>
        <Button variant="outlineOnDark" size="md" className="flex-1 rounded-[10px]">
          {t.clPrint}
        </Button>
      </div>
    </motion.div>
  )
}

export function CloseScreen() {
  const cl = useApp((s) => s.cl)

  return (
    <div className="flex flex-col gap-[13px] pt-1">
      <AnimatePresence mode="wait">
        <motion.div key={cl} className="flex flex-col gap-[13px]">
          {cl === 0 ? <StepEntry /> : <StepReport />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
