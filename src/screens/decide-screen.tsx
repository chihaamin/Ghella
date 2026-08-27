import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"

import {
  CropShortlist,
  ScoreDrop,
  priceMonth,
  selectShortlist,
} from "@/components/decide/crop-shortlist"
import {
  PlanSetupSheet,
  type PlanDraft,
  type PlanSetupResult,
} from "@/components/decide/plan-setup-sheet"
import { WarningIcon } from "@/components/ghella/icons"
import { CropMatches } from "@/components/land/crop-matches"
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
import { useLocalCurrency, type LocalCurrency } from "@/hooks/use-local-currency"
import { useMarketPrices } from "@/hooks/use-market-prices"
import { useT } from "@/i18n/use-t"
import { ECOCROP } from "@/data/ecocrop"
import { applyIrrigation } from "@/lib/crop-suitability"
import { C } from "@/lib/colors"
import { expand, fadeUp, listStagger } from "@/lib/motion"
import { cn, fmt, money } from "@/lib/utils"
import { useApp, type SortKey, type VarietyId } from "@/store/app-store"
import { selectFocusParcel, useParcels } from "@/store/parcel-store"
import type { CropCategory, CropMatch, MarketPrice, Parcel } from "@/types/land"

/**
 * Each demo variety's crop in the EcoCrop table, so a variety card can carry
 * the REAL agronomic scores for the selected parcel — and, where FAO FPMA
 * publishes a series for the parcel's country, a live market price too.
 */
const VARIETY_CROP: Record<VarietyId, string> = {
  rg: "tomato",
  fz: "tomato",
  bk: "sweet-pepper",
  gr: "onion",
  mz: "melon",
}

/** The distinct crops on the shortlist — one FPMA lookup per crop, not per card. */
const PRICEABLE = [...new Set(Object.values(VARIETY_CROP))]

/**
 * The area every demo figure is written for. SEASON_BUDGET dollars and the
 * variety water volumes are all "per 0.8 ha", so live economics must divide
 * by this before scaling to a real parcel's area.
 */
const DEMO_AREA_HA = 0.8

/**
 * Honest card economics from a live FPMA price and the parcel's true area:
 * indicative yield × observed price, against the demo input costs rescaled
 * from their 0.8 ha basis. `wps` is the water-profit the drop displays — a
 * loss clamps to 0 because the drop only draws 0..12.
 */
function liveEconomics(
  id: VarietyId,
  v: Variety,
  price: MarketPrice,
  areaHa: number
): { net: number; cost: number; wps: number } {
  const yieldKg = v.yieldTHa * 1000 * areaHa
  const revenue = yieldKg * price.usdPerKg
  // Demo costs are stated for the 0.8 ha demo parcel — per-ha first, then scale.
  const costPerHa = SEASON_BUDGET[id][1] / DEMO_AREA_HA
  const cost = costPerHa * areaHa
  const net = revenue - cost
  // The demo water figures are m³ per 0.8 ha too; same rescale, and a guard
  // so a degenerate zero-water row can never divide the score to Infinity.
  const waterM3 = (v.water / DEMO_AREA_HA) * areaHa
  const wps = waterM3 > 0 ? Math.max(0, net / waterM3) : 0
  return { net, cost, wps }
}

// ScoreDrop and priceMonth moved to components/decide/crop-shortlist.tsx so
// the demo VarietyCard and the real CropShortlist share one pixel-identical
// definition; they are imported back above.

function VarietyCard({
  id,
  v,
  real,
  price = null,
  areaHa = null,
  parcel = null,
  local = null,
  onPlan,
}: {
  id: VarietyId
  v: Variety
  /** The REAL match for this variety's crop on the selected parcel, when one exists. */
  real?: CropMatch
  /** Live FPMA price for this variety's crop, when the country has a series. */
  price?: MarketPrice | null
  /** The selected parcel's true area, ha — the demo economics assume 0.8 ha. */
  areaHa?: number | null
  /** The parcel a real plan would attach to; null keeps the scripted demo. */
  parcel?: Parcel | null
  /** Field-country currency, for freezing a real plan's money display. */
  local?: LocalCurrency | null
  /** Hands the frozen draft up to the screen's shared setup sheet. */
  onPlan: (draft: PlanDraft, cropName: string, category: CropCategory | null) => void
}) {
  const { t, lang, pick } = useT()
  const open = useApp((s) => s.open) === id
  const toggle = useApp((s) => s.toggleVariety)
  const commit = useApp((s) => s.commitVariety)
  const budBand = useApp((s) => s.bud)

  /**
   * One button, the right plan either way: with a real parcel the variety
   * stashes a frozen snapshot and opens the screen's setup sheet, exactly
   * like a shortlist crop; without one the scripted demo commit stays
   * INSTANT — the demo has no real dates to ask about.
   */
  const planHarvest = () => {
    if (!parcel || !local) {
      commit(
        id,
        lang === "ar"
          ? "أُنشئت الخطة والميزانية — 34 مهمة حتى الحصاد"
          : "Season plan + budget created — 34 tasks to harvest"
      )
      return
    }
    const cropId = VARIETY_CROP[id]
    const envelope = ECOCROP.find((e) => e.id === cropId)
    const area = parcel.areaHa
    const usedPrice = econ
      ? econ.price.usdPerKg
      : (envelope?.refPriceUsdPerKg ?? 0)
    const revenue = v.yieldTHa * 1000 * area * usedPrice
    const cost = (SEASON_BUDGET[id][1] / DEMO_AREA_HA) * area
    onPlan(
      {
        cropId,
        name: v.name,
        cycleDays: v.cycle,
        // Demo water is m³ over the 0.8 ha demo parcel; the envelope's mm
        // figure is the real thing when we have it.
        waterNeedMm:
          envelope?.waterNeedMm ?? Math.round(v.water / DEMO_AREA_HA / 10),
        areaHa: area,
        revenueUsd: revenue,
        costUsd: cost,
        usedPriceUsd: usedPrice,
        priceLive: econ != null,
        currency: local.code,
        fxRate: local.rate,
        parcelName: parcel.name,
      },
      v.name,
      envelope?.category ?? null
    )
  }

  // Live economics need BOTH a price series and a real area; with either one
  // missing the card renders the scripted demo figures untouched.
  const econ =
    price != null && areaHa != null && areaHa > 0
      ? { price, areaHa, ...liveEconomics(id, v, price, areaHa) }
      : null

  // The U+2212 minus keeps a loss in the same type run as a gain: "−$1,234".
  const profitTxt = econ
    ? econ.net < 0
      ? `−${money(-econ.net)}`
      : money(econ.net)
    : v.profit
  const areaTxt = econ ? econ.areaHa.toFixed(1) : ""
  const netCaption = econ
    ? pick(
        `net · your ${areaTxt} ha`,
        `net · vos ${areaTxt.replace(".", ",")} ha`,
        `صافي · ${areaTxt} هك`
      )
    : t.decNet
  const forecastTxt = econ
    ? `@ $${econ.price.usdPerKg.toFixed(2)}/kg · ${econ.price.market} ` +
      `${econ.price.priceType}, ${priceMonth(econ.price.month, lang)} · ${econ.price.source}`
    : v.forecastLine
  const wpsShown = econ ? econ.wps : v.wps

  // Live costs scale with the real area; the same budget-band cap applies.
  const inputCost = econ ? econ.cost : SEASON_BUDGET[id][1]
  const band = BUDGET_BANDS[budBand]
  const overBudget = inputCost > band.cap
  const budgetWarn = overBudget
    ? `Inputs ≈ $${fmt(inputCost)} — above your ${band.label} budget`
    : ""

  // With a real analysis the card warns from the parcel's actual blockers
  // (frost calendar, heat, disease-wet); the scripted demo warning only
  // survives when no analysis exists to replace it.
  const realWarn = real ? (real.blockers[0] ?? "") : ""
  const warn = budgetWarn || (real ? realWarn : v.warn)
  const severe = Boolean(budgetWarn) || (real ? Boolean(realWarn) : v.warnLvl === "red")

  // Same rule for the "why this score" bars: the parcel's factors, or the
  // demo triples as the deep-link fallback.
  const bars = real
    ? real.factors.map((f) => ({ k: f.label, n: Math.round(f.score), note: f.note }))
    : v.bars

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
            <span className="font-display text-[15px] font-bold">{profitTxt}</span>
            <span className="text-[11.5px] whitespace-nowrap text-muted">{netCaption}</span>
          </div>

          <div className="text-[11px] text-muted">{forecastTxt}</div>

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

        <ScoreDrop id={id} wps={wpsShown} />
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

              {bars.map((b) => {
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
                  onClick={planHarvest}
                >
                  {t.decPlanHarvest}
                </Button>
                <Button variant="outline" size="md" className="rounded-[10px]">
                  {t.decCompare}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div
            key="peek"
            className="flex items-center gap-2 border-t border-[#f0ecdd] px-3.5 py-2"
          >
            {/* Reachable on press — not buried below the factor bars. */}
            <Button
              variant="leaf"
              size="sm"
              className="flex-1 rounded-[8px]"
              onClick={planHarvest}
            >
              {t.decPlanHarvest}
            </Button>
            <button
              type="button"
              onClick={() => toggle(id)}
              className="flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-[12px] font-bold text-water"
            >
              <span>{t.decWhy}</span>
              <span>▾</span>
            </button>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** Uppercased chip label for a stated water source. */
const WATER_CHIP: Record<string, string> = {
  drip: "DRIP",
  sprinkler: "SPRINKLER",
  flood: "FLOOD / FURROW",
  rainfed: "RAINFED",
}

export function DecideScreen() {
  const { t, lang, pick } = useT()
  const sort = useApp((s) => s.sort)
  const set = useApp((s) => s.set)
  const budBand = useApp((s) => s.bud)
  const planCrop = useApp((s) => s.planCrop)
  const setPlannedVariety = useParcels((s) => s.setPlannedVariety)

  // The variety draft waiting on the setup sheet's three answers. One sheet
  // for the whole screen — the shortlist branch carries its own instance.
  const [pending, setPending] = useState<{
    draft: PlanDraft
    cropName: string
    category: CropCategory | null
  } | null>(null)

  // The parcel this screen decides FOR. Everything real hangs off its
  // analysis; without one (prototype deep links, analysis still running) the
  // screen falls back to the scripted demo wholesale.
  const parcel = useParcels(selectFocusParcel)
  const analysis = parcel?.analysis ?? null

  // Stored matches assume rain-fed; a stated water source lifts the rain
  // constraint at read time. Rain-fed and unstated both read the sky as-is.
  const irrigated = parcel?.waterSource != null && parcel.waterSource !== "rainfed"
  const matches = useMemo(
    () => (analysis ? applyIrrigation(analysis.crops, irrigated) : []),
    [analysis, irrigated]
  )
  const matchByCrop = useMemo(
    () => new Map(matches.map((m) => [m.id, m])),
    [matches]
  )
  // "Real" means real CARDS: an analysis whose every match is blocked would
  // render an empty shortlist, so those parcels fall back to the variety
  // cards — which can still plan a real harvest on the parcel.
  const shortlist = useMemo(() => selectShortlist(matches), [matches])
  const hasReal = shortlist.length > 0

  // Market prices for whichever cards will actually render: with a real
  // analysis, THIS parcel's own top-8 shortlist crops (EU portal or FPMA,
  // whichever covers the country — an unpriceable id just resolves null);
  // without one, the five demo varieties' crops. Every miss is a null, and
  // the card that misses falls back to its indicative or demo price.
  const countryCode = analysis?.place?.countryCode ?? null
  const local = useLocalCurrency(countryCode)
  const { prices } = useMarketPrices(
    countryCode,
    hasReal ? shortlist.map((m) => m.id) : PRICEABLE
  )
  const anyPrice = Object.values(prices).some((p) => p != null)
  // A price only RENDERS live when a real area exists to scale it against.
  const liveShown = anyPrice && parcel != null && hasReal

  const labels = sortLabels(lang)
  const order = SORT_ORDERS[sort]

  /** The sheet's answers complete the stashed draft into a committed plan. */
  const createPlan = (setup: PlanSetupResult) => {
    if (!pending || !parcel) return
    const { draft } = pending
    planCrop(
      { ...draft, ...setup },
      pick(
        `Season plan created — ${draft.name} to harvest in ~${draft.cycleDays} days`,
        `Plan de saison créé — ${draft.name}, récolte dans ~${draft.cycleDays} jours`,
        `أُنشئت خطة الموسم — ${draft.name}، الحصاد بعد ~${draft.cycleDays} يومًا`
      )
    )
    // Rotation and recommendations read the committed crop off the parcel
    // itself, not the calendar's snapshot.
    setPlannedVariety(parcel.id, draft.cropId)
    setPending(null)
  }

  const title =
    parcel && hasReal
      ? pick(
          `What should ${parcel.name} grow?`,
          `Que planter sur ${parcel.name} ?`,
          `ماذا تزرع ${parcel.name}؟`
        )
      : t.decTitle

  return (
    <div className="flex flex-col gap-3 pt-1">
      <ScreenTitle>{title}</ScreenTitle>

      <div className="flex flex-wrap items-center gap-1.5">
        {parcel && hasReal ? (
          <>
            <Badge variant="ink" size="md">
              {parcel.name} · {parcel.areaHa.toFixed(1)} ha
            </Badge>
            {analysis?.place?.label && (
              <Badge variant="neutral" size="md">
                {analysis.place.label.toUpperCase()}
              </Badge>
            )}
            {parcel.waterSource && (
              <Badge variant="neutral" size="md">
                {WATER_CHIP[parcel.waterSource]}
              </Badge>
            )}
          </>
        ) : (
          <>
            <Badge variant="ink" size="md">
              {t.pNorth} · 0.8 ha
            </Badge>
            <Badge variant="neutral" size="md">
              {t.decWell}
            </Badge>
            <Badge variant="neutral" size="md">
              {t.decSeason}
            </Badge>
          </>
        )}
        <Badge variant="sunOutline" size="md">
          BUDGET {BUDGET_BANDS[budBand].label.toUpperCase()}
        </Badge>
      </div>

      {/* The parcel's own ranked matches — climate, soil, region and frost
          calendar of THIS land, before any variety economics. */}
      {hasReal && (
        <div className="rounded-[14px] border border-line bg-card p-3.5">
          <CropMatches crops={matches} initial={4} />
        </div>
      )}

      {hasReal && (
        <SectionLabel className="pt-1">
          {anyPrice ? t.decShortlistLive : t.decShortlist}
        </SectionLabel>
      )}

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

      {/* With an analysed parcel the cards are generated from ITS own top
          matches — a Tunisian field shortlists what suits Tunisia, a Spanish
          field Spain. The scripted demo varieties only render where no
          analysis exists to replace them. */}
      {parcel && hasReal ? (
        <CropShortlist parcel={parcel} matches={matches} prices={prices} sort={sort} />
      ) : (
        <motion.div
          key={sort}
          variants={listStagger}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-[11px]"
        >
          {order.map((id) => (
            <VarietyCard
              key={id}
              id={id}
              v={VARIETIES[id]}
              real={matchByCrop.get(VARIETY_CROP[id])}
              price={prices[VARIETY_CROP[id]] ?? null}
              areaHa={parcel && analysis ? parcel.areaHa : null}
              parcel={analysis ? parcel : null}
              local={local}
              onPlan={(draft, cropName, category) =>
                setPending({ draft, cropName, category })
              }
            />
          ))}
        </motion.div>
      )}

      {/* FPMA observes retail/wholesale in a city market, not the farm gate —
          the one honesty note the live numbers must carry. */}
      {liveShown && (
        <div className="px-0.5 text-[11.5px] leading-[1.5] text-muted">{t.decFarmGate}</div>
      )}

      <div className="px-0.5 pb-1.5 text-[11.5px] leading-[1.5] text-muted">{t.decFoot}</div>

      <PlanSetupSheet
        open={pending != null}
        cropName={pending?.cropName ?? ""}
        category={pending?.category ?? null}
        cycleDays={pending?.draft.cycleDays ?? null}
        onClose={() => setPending(null)}
        onCreate={createPlan}
      />
    </div>
  )
}
