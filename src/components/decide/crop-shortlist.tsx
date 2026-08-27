/**
 * The location-driven variety shortlist.
 *
 * Where the demo Decide screen always shows the same five scripted variety
 * cards, this component generates cards from the SELECTED PARCEL'S own top
 * crop matches — so a Tunisian field shortlists what suits Tunisia, a Spanish
 * field Spain, a Kenyan field Kenya. The agronomy (score, factors, blockers)
 * comes in via `matches`, already irrigation-adjusted by the screen; the
 * money comes from each crop's EcoCrop economics envelope, upgraded to a live
 * market price wherever the parcel's country publishes one (EU agri-food
 * portal for EU fruit & veg, FAO FPMA elsewhere — the screen's price map
 * carries whichever answered).
 *
 * The card is a deliberate visual clone of the demo `VarietyCard`: same drop,
 * fonts, paddings and chip styles, so switching between a demo parcel and a
 * real one reads as the data changing, never the UI. `ScoreDrop` and
 * `priceMonth` therefore LIVE here and are re-exported to the screen — one
 * definition, pixel-identical by construction rather than by discipline.
 *
 * Every card carries a "Plan the harvest" button that snapshots the figures
 * the card is showing into a `PlannedCropPlan` — the calendar then renders a
 * real crop-specific season from that frozen picture. The demo variety flow
 * (commitVariety on the scripted decide cards) is untouched and separate.
 */

import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import type { JSX } from "react"

import { WarningIcon } from "@/components/ghella/icons"
import { SectionLabel } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ECOCROP } from "@/data/ecocrop"
import { BUDGET_BANDS } from "@/data/varieties"
import { useLocalCurrency, type LocalCurrency } from "@/hooks/use-local-currency"
import type { Lang } from "@/i18n/dict"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { expand, fadeUp, listStagger } from "@/lib/motion"
import { cn, fmt } from "@/lib/utils"
import { useApp, type SortKey } from "@/store/app-store"
import { useParcels } from "@/store/parcel-store"
import type { CropMatch, CropRating, MarketPrice, Parcel } from "@/types/land"

/* ── Shared card furniture (extracted from decide-screen) ────── */

/** "2026-01" → "Jan 2026" in the reader's language. Noon keeps the label on the first of the month in every timezone. */
export function priceMonth(month: string, lang: Lang): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(
    lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en",
    { month: "short", year: "numeric" }
  )
}

/**
 * The published local figure, verbatim: Intl's own minor-unit default (2 dp
 * for EUR, 3 for TND) so a Tunisian series shows the exact millimes the
 * market board printed. Falls back to code-prefixed digits when Intl does not
 * know the currency — same posture as `useLocalCurrency`'s formatters.
 */
function publishedPerKg(value: number, currency: string, lang: Lang): string {
  const locale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
  try {
    return `${new Intl.NumberFormat(locale, { style: "currency", currency }).format(value)}/kg`
  } catch {
    return `${currency} ${value.toFixed(2)}/kg`
  }
}

/** Water-profit score, drawn as a drop filling from the bottom. */
export function ScoreDrop({ id, wps }: { id: string; wps: number }) {
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

/* ── Selection and economics ─────────────────────────────────── */

/**
 * The crops that earn a card: nothing blocked, nothing rated unsuitable, top
 * 8 by score. Exported because the screen needs the SAME list to know which
 * crop ids to fetch prices for — two copies of this filter would drift.
 */
export function selectShortlist(matches: CropMatch[]): CropMatch[] {
  return matches
    .filter((m) => m.rating !== "unsuitable" && m.blockers.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}

/** id → envelope, built once — the shortlist joins against it on every sort. */
const ENVELOPE_BY_ID = new Map(ECOCROP.map((e) => [e.id, e]))

/**
 * Rating → badge tint, the same green→blue→amber→red ladder
 * `components/land/crop-matches.tsx` paints its rating badges with. Copied
 * rather than imported because that module keeps it private and is not this
 * change's to edit — keep the two in step.
 */
const RATING_BADGE: Record<CropRating, "leaf" | "water" | "sun" | "clay"> = {
  excellent: "leaf",
  good: "water",
  marginal: "sun",
  unsuitable: "clay",
}

interface CardEconomics {
  /** The observed price used, or null when the card fell back to indicative. */
  live: MarketPrice | null
  /** $/kg actually used in the arithmetic — live if present, else reference. */
  usedPrice: number
  /** Gross revenue in USD — kept so the plan snapshot never re-derives it. */
  revenue: number
  net: number
  cost: number
  waterM3: number
  /** $/m³ — net over season water. Can go negative; the drop clamps at 0. */
  wps: number
}

interface ShortlistRow {
  crop: CropMatch
  econ: CardEconomics
}

/**
 * Join each shortlisted match to its economics for THIS parcel's area.
 *
 * Revenue is indicative yield × the best price we have — a live market
 * observation when the country publishes one, the envelope's reference price
 * when it does not; the card's price line says which. Water uses the crop's
 * agronomic season need (1 mm over 1 ha = 10 m³), so the water-profit drop is
 * comparable across crops and countries alike.
 */
function buildRows(
  matches: CropMatch[],
  prices: Record<string, MarketPrice | null>,
  areaHa: number
): ShortlistRow[] {
  const rows: ShortlistRow[] = []
  for (const crop of selectShortlist(matches)) {
    // Matches are scored FROM the envelope table, so the join always lands —
    // but a missing row must cost one card, never a crash.
    const envelope = ENVELOPE_BY_ID.get(crop.id)
    if (!envelope) continue
    const live = prices[crop.id] ?? null
    const usedPrice = live?.usdPerKg ?? envelope.refPriceUsdPerKg
    const revenue = envelope.yieldTHa * 1000 * areaHa * usedPrice
    const cost = envelope.inputCostUsdPerHa * areaHa
    const net = revenue - cost
    const waterM3 = crop.waterNeedMm * 10 * areaHa
    // Guard the division: a degenerate zero-water row must not score Infinity.
    const wps = waterM3 > 0 ? net / waterM3 : 0
    rows.push({
      crop,
      econ: { live, usedPrice, revenue, net, cost, waterM3, wps },
    })
  }
  return rows
}

/**
 * The demo screen ships pre-computed orders per sort chip; real cards have to
 * earn theirs. Sorts are stable, so ties keep the score-ranked order.
 */
function sortRows(rows: ShortlistRow[], sort: SortKey): ShortlistRow[] {
  const sorted = rows.slice()
  if (sort === "wps") sorted.sort((a, b) => b.econ.wps - a.econ.wps)
  else if (sort === "profit") sorted.sort((a, b) => b.econ.net - a.econ.net)
  else if (sort === "water") sorted.sort((a, b) => a.econ.waterM3 - b.econ.waterM3)
  else if (sort === "cycle") sorted.sort((a, b) => a.crop.cycleDays - b.crop.cycleDays)
  // "risk": the agronomic score IS the risk measure — best fit, least risk.
  else sorted.sort((a, b) => b.crop.score - a.crop.score)
  return sorted
}

/* ── One card ────────────────────────────────────────────────── */

/**
 * A single shortlist card — a pixel-clone of the demo `VarietyCard`, fed by a
 * real `CropMatch` and real economics instead of scripted figures.
 */
function ShortlistCard({
  row,
  parcel,
  local,
  open,
  onToggle,
}: {
  row: ShortlistRow
  parcel: Parcel
  /** The field-country money formatter — every payout figure goes through it. */
  local: LocalCurrency
  open: boolean
  onToggle: () => void
}) {
  const { t, lang, pick } = useT()
  const planCrop = useApp((s) => s.planCrop)
  const setPlannedVariety = useParcels((s) => s.setPlannedVariety)
  const budBand = useApp((s) => s.bud)

  const { crop, econ } = row
  const areaHa = parcel.areaHa

  // Money follows the FIELD's country — a Tunisian parcel earns dinars, not
  // dollars. Intl signs a loss itself, however the locale writes a minus.
  const profitTxt = local.formatMoney(econ.net)
  const areaTxt = areaHa.toFixed(1)
  const netCaption = pick(
    `net · your ${areaTxt} ha`,
    `net · vos ${areaTxt.replace(".", ",")} ha`,
    `صافي · ${areaTxt} هك`
  )

  // Honesty line under the money: a live price names its market, month and
  // source; the fallback admits it is indicative with no local series. When
  // the series is published in the field's own currency, show the EXACT
  // published figure rather than a round trip through USD and back — the
  // farmer recognises that number from the market board, and two conversions
  // would drift it by a millime or two.
  const perKgTxt =
    econ.live && econ.live.currency === local.code
      ? publishedPerKg(econ.live.localPerKg, econ.live.currency, lang)
      : local.formatPerKg(econ.usedPrice)
  const priceLine = econ.live
    ? `@ ${perKgTxt} · ${econ.live.market}, ` +
      `${priceMonth(econ.live.month, lang)} · ${econ.live.source}`
    : `@ ${perKgTxt} · ${t.decIndicative} · ${t.decNoSeries}`

  // Same budget gate as the demo cards: costs scale with the real area, and
  // the same band cap decides when to shout. The COMPARISON stays in USD —
  // BUDGET_BANDS are USD data — only the displayed figure is localized.
  const band = BUDGET_BANDS[budBand]
  const budgetWarn =
    econ.cost > band.cap
      ? `Inputs ≈ ${local.formatMoney(econ.cost)} — above your ${band.label} budget`
      : ""

  const monthShort = (m: number) =>
    new Date(2026, m - 1, 1).toLocaleString(lang, { month: "short" })
  const monthsTxt =
    crop.plantingMonths.slice(0, 3).map(monthShort).join(" · ") +
    (crop.plantingMonths.length > 3 ? " …" : "")

  const cycleWord = pick("cycle ", "cycle ", "دورة ")
  const dayUnit = pick(" d", " j", " يوم")

  const ratingLabel: Record<CropRating, string> = {
    excellent: t.ldRatingExcellent,
    good: t.ldRatingGood,
    marginal: t.ldRatingMarginal,
    unsuitable: t.ldRatingUnsuitable,
  }

  // No well capacity to compare against here — a real parcel's source is a
  // stated type, not a metered volume — so the strip states the need alone.
  const waterMath =
    pick("Water: needs ", "Water: needs ", "الماء: يحتاج ") + `${fmt(econ.waterM3)} m³`

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
        onClick={onToggle}
        className="flex w-full cursor-pointer gap-3 px-3.5 pt-[13px] pb-[11px] text-start"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
          <div className="flex flex-col gap-px">
            <span className="font-mono text-[10.5px] font-bold tracking-[0.12em] text-earth">
              {crop.category.toUpperCase()}
            </span>
            <span className="font-display text-[19px] leading-[1.1] font-bold">{crop.name}</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-display text-[15px] font-bold">{profitTxt}</span>
            <span className="text-[11.5px] whitespace-nowrap text-muted">{netCaption}</span>
          </div>

          <div className="text-[11px] text-muted">{priceLine}</div>

          <div className="flex flex-wrap gap-[5px]">
            {crop.plantingMonths.length > 0 && (
              <Badge variant="leaf">
                {t.ldPlantIn} {monthsTxt}
              </Badge>
            )}
            <Badge variant="neutral">
              {cycleWord}
              {crop.cycleDays}
              {dayUnit}
            </Badge>
            <Badge variant={RATING_BADGE[crop.rating]}>{ratingLabel[crop.rating]}</Badge>
          </div>
        </div>

        {/* Deliberately still USD $/m³: the drop is a comparative score across
            crops and countries, not a payout — converting it would re-rank
            nothing and cost the cross-country comparability. */}
        <ScoreDrop id={crop.id} wps={Math.max(0, econ.wps)} />
      </button>

      {budgetWarn && (
        <div className="mx-3.5 mb-2.5 flex items-start gap-[7px] rounded-[9px] bg-clay-tint px-2.5 py-[7px]">
          <span className="mt-px flex-none">
            <WarningIcon size={13} stroke={C.clay} strokeWidth={2.6} />
          </span>
          <span className="text-[11.5px] leading-[1.4] font-semibold text-clay">
            {budgetWarn}
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

              {crop.factors.map((f) => {
                const n = Math.round(f.score)
                const strong = n >= 75
                const mid = n >= 55
                const color = strong ? C.leaf : mid ? C.sun : C.clay
                const fg = strong ? "text-leaf" : mid ? "text-sun-ink" : "text-clay"
                return (
                  <div key={f.key} className="flex flex-col gap-[3px]">
                    <div className="flex justify-between text-[12px] font-semibold">
                      <span>{f.label}</span>
                      <span className={cn("font-mono text-[11px] font-bold", fg)}>{n}</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-[4px] bg-chip">
                      <motion.div
                        className="h-full rounded-[4px]"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${n}%` }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                      />
                    </div>
                    <div className="text-[11px] leading-[1.4] text-muted">{f.note}</div>
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
                  onClick={() => {
                    // Snapshot the EXACT figures this card is showing — the
                    // calendar must render the numbers the farmer said yes
                    // to, never a later price refresh.
                    planCrop(
                      {
                        cropId: crop.id,
                        name: crop.name,
                        cycleDays: crop.cycleDays,
                        waterNeedMm: crop.waterNeedMm,
                        areaHa: parcel.areaHa,
                        revenueUsd: econ.revenue,
                        costUsd: econ.cost,
                        usedPriceUsd: econ.usedPrice,
                        priceLive: !!econ.live,
                        currency: local.code,
                        fxRate: local.rate,
                        parcelName: parcel.name,
                      },
                      pick(
                        `Season plan created — ${crop.name} to harvest in ~${crop.cycleDays} days`,
                        `Plan de saison créé — ${crop.name}, récolte dans ~${crop.cycleDays} jours`,
                        `أُنشئت خطة الموسم — ${crop.name}، الحصاد بعد ~${crop.cycleDays} يومًا`
                      )
                    )
                    // Rotation and recommendations read the committed crop
                    // off the parcel itself, not the calendar's snapshot.
                    setPlannedVariety(parcel.id, crop.id)
                  }}
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
          <button
            key="peek"
            type="button"
            onClick={onToggle}
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

/* ── The shortlist ───────────────────────────────────────────── */

/**
 * The real-parcel replacement for the demo variety list: up to eight cards
 * from this parcel's own top matches, sorted by the screen's existing sort
 * chips, entering with the same stagger the demo list uses.
 */
export function CropShortlist({
  parcel,
  matches,
  prices,
  sort,
}: {
  parcel: Parcel
  /** Already irrigation-adjusted by the screen. */
  matches: CropMatch[]
  /** Live prices by crop id; a null means "no series" and falls back. */
  prices: Record<string, MarketPrice | null>
  sort: SortKey
}): JSX.Element {
  // One open at a time, like every accordion in the app — the open body is
  // the whole story and two of them open is a wall.
  const [openId, setOpenId] = useState<string | null>(null)

  // Every card shows money in the FIELD's currency — the parcel's country,
  // not the reader's locale, decides what a harvest actually sells in.
  const local = useLocalCurrency(parcel.analysis?.place?.countryCode ?? null)

  const rows = useMemo(
    () => buildRows(matches, prices, parcel.areaHa),
    [matches, prices, parcel.areaHa]
  )
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort])

  return (
    // Keyed on the sort so a chip tap re-runs the entrance stagger, exactly
    // as the demo list behaves. openId lives above the key, so the open card
    // stays open across re-sorts.
    <motion.div
      key={sort}
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-[11px]"
    >
      {sorted.map((row) => (
        <ShortlistCard
          key={row.crop.id}
          row={row}
          parcel={parcel}
          local={local}
          open={openId === row.crop.id}
          onToggle={() =>
            setOpenId((cur) => (cur === row.crop.id ? null : row.crop.id))
          }
        />
      ))}
    </motion.div>
  )
}
