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
 * the card is showing into a plan draft and opens the shared setup sheet
 * (soil prepared? which steps? start date?) — the answers complete the
 * `PlannedCropPlan` and the calendar renders a real crop-specific season
 * from that frozen picture. One sheet instance lives at the shortlist level,
 * not per card. The demo variety flow (commitVariety on the scripted decide
 * cards) is untouched and separate.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { JSX } from "react"
import { Animated, Easing, Pressable, Text, View } from "react-native"
import Svg, { Circle, ClipPath, Defs, Path, Rect } from "react-native-svg"

import {
  PlanSetupSheet,
  type PlanDraft,
  type PlanSetupResult,
} from "@/components/decide/plan-setup-sheet"
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
import { animateLayout, FadeUp } from "@/lib/motion"
import { fmt } from "@/lib/utils"
import { useApp, type SortKey } from "@/store/app-store"
import { useParcels } from "@/store/parcel-store"
import { useFF } from "@/theme/fonts"
import type {
  CropCategory,
  CropMatch,
  CropRating,
  MarketPrice,
  Parcel,
} from "@/types/land"

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

/**
 * JS-driven tween for an SVG attribute the Animated driver cannot reach —
 * the web card's `motion.rect` y-animation, re-rendered per frame instead.
 */
function useTweenedNumber(target: number, from: number): number {
  const [value, setValue] = useState(from)
  const anim = useRef(new Animated.Value(from)).current
  useEffect(() => {
    const sub = anim.addListener(({ value: v }) => setValue(v))
    Animated.timing(anim, {
      toValue: target,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
    return () => anim.removeListener(sub)
  }, [anim, target])
  return value
}

/** Water-profit score, drawn as a drop filling from the bottom. */
export function ScoreDrop({ id, wps }: { id: string; wps: number }) {
  const { t } = useT()
  const ff = useFF()
  const clipId = `dcp-${id}`
  const fillY = 51 - Math.min(wps / 12, 1) * 42
  const label = wps > 8.5 ? C.surface : C.ink

  // The web card animates the clip rect from the bottom (y 51) up to fillY.
  const y = useTweenedNumber(fillY, 51)

  return (
    <View style={{ width: 76, flexDirection: "column", alignItems: "center", gap: 3 }}>
      <View style={{ width: 64, height: 64 }}>
        <Svg width={64} height={64} viewBox="0 0 56 56">
          <Circle cx={28} cy={28} r={26} fill="#f2f0e6" stroke={C.ink} strokeWidth={2} />
          <Path
            d="M28 9 C28 9 42 26 42 35 A14 14 0 0 1 14 35 C14 26 28 9 28 9 Z"
            fill="none"
            stroke={C.waterPale}
            strokeWidth={2}
          />
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={10} y={y} width={36} height={42} />
            </ClipPath>
          </Defs>
          <Path
            d="M28 9 C28 9 42 26 42 35 A14 14 0 0 1 14 35 C14 26 28 9 28 9 Z"
            fill={C.water}
            clipPath={`url(#${clipId})`}
          />
        </Svg>
        {/* SVG <text> with a custom font is flaky across platforms (see
            icons.tsx) — overlay RN Text at the web card's baseline spots. */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, width: 64, height: 64 }}
        >
          <Text
            style={{
              position: "absolute",
              top: 23,
              width: 64,
              textAlign: "center",
              fontFamily: ff.display.bold,
              fontSize: 15,
              lineHeight: 15,
              color: label,
            }}
          >
            {wps.toFixed(1)}
          </Text>
          <Text
            style={{
              position: "absolute",
              top: 42,
              width: 64,
              textAlign: "center",
              fontFamily: ff.mono.bold,
              fontSize: 6.5,
              lineHeight: 7,
              color: label,
            }}
          >
            {t.decUnit}
          </Text>
        </View>
      </View>
      <Text
        style={{
          textAlign: "center",
          fontFamily: ff.mono.bold,
          fontSize: 9,
          lineHeight: 11,
          color: C.waterDeep,
        }}
      >
        {t.decWps}
      </Text>
    </View>
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

/** The web card's factor bar, its width easing out to the score. */
function FactorBar({ pct, color }: { pct: number; color: string }) {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [progress])
  return (
    <View
      style={{
        height: 7,
        overflow: "hidden",
        borderRadius: 4,
        backgroundColor: C.chip,
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 4,
          backgroundColor: color,
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", `${pct}%`],
          }),
        }}
      />
    </View>
  )
}

/** Single-side dashed borders don't render on iOS — clip a full dashed box. */
function DashedDivider() {
  return (
    <View style={{ height: 1.5, overflow: "hidden" }}>
      <View
        style={{
          height: 6,
          borderWidth: 1.5,
          borderColor: C.line,
          borderStyle: "dashed",
          borderRadius: 0.01,
        }}
      />
    </View>
  )
}

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
  onPlan,
}: {
  row: ShortlistRow
  parcel: Parcel
  /** The field-country money formatter — every payout figure goes through it. */
  local: LocalCurrency
  open: boolean
  onToggle: () => void
  /** Hands the frozen draft up to the shortlist's shared setup sheet. */
  onPlan: (draft: PlanDraft, cropName: string, category: CropCategory | null) => void
}) {
  const { t, lang, pick, isRtl } = useT()
  const ff = useFF()
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

  /**
   * Snapshot the EXACT figures this card is showing — the calendar must
   * render the numbers the farmer said yes to, never a later price refresh.
   * Nothing commits yet: the draft goes up to the shortlist's setup sheet,
   * which asks about soil and start date before creating the plan. Shared by
   * the always-visible collapsed action and the expanded panel.
   */
  const planThisCrop = () => {
    onPlan(
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
      crop.name,
      crop.category
    )
  }

  const row_ = { flexDirection: isRtl ? "row-reverse" : "row" } as const
  const startAlign = { textAlign: isRtl ? "right" : "left" } as const

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: open ? C.leaf : C.line,
        backgroundColor: C.card,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={[
          row_,
          {
            width: "100%",
            gap: 12,
            paddingHorizontal: 14,
            paddingTop: 13,
            paddingBottom: 11,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0, flexDirection: "column", gap: 7 }}>
          <View style={{ flexDirection: "column", gap: 1 }}>
            <Text
              style={[
                startAlign,
                {
                  fontFamily: ff.mono.bold,
                  fontSize: 10.5,
                  letterSpacing: 10.5 * 0.12,
                  color: C.earth,
                },
              ]}
            >
              {crop.category.toUpperCase()}
            </Text>
            <Text
              style={[
                startAlign,
                {
                  fontFamily: ff.display.bold,
                  fontSize: 19,
                  lineHeight: 21,
                  color: C.ink,
                },
              ]}
            >
              {crop.name}
            </Text>
          </View>

          <View style={[row_, { flexWrap: "wrap", alignItems: "baseline", gap: 6 }]}>
            <Text style={{ fontFamily: ff.display.bold, fontSize: 15, color: C.ink }}>
              {profitTxt}
            </Text>
            {/* whitespace-nowrap: the caption moves to the next line whole. */}
            <Text
              style={{
                flexShrink: 0,
                fontFamily: ff.sans.regular,
                fontSize: 11.5,
                color: C.muted,
              }}
            >
              {netCaption}
            </Text>
          </View>

          <Text
            style={[
              startAlign,
              { fontFamily: ff.sans.regular, fontSize: 11, color: C.muted },
            ]}
          >
            {priceLine}
          </Text>

          <View style={[row_, { flexWrap: "wrap", gap: 5 }]}>
            {crop.plantingMonths.length > 0 && (
              <Badge variant="leaf">{`${t.ldPlantIn} ${monthsTxt}`}</Badge>
            )}
            <Badge variant="neutral">{`${cycleWord}${crop.cycleDays}${dayUnit}`}</Badge>
            <Badge variant={RATING_BADGE[crop.rating]}>{ratingLabel[crop.rating]}</Badge>
          </View>
        </View>

        {/* Deliberately still USD $/m³: the drop is a comparative score across
            crops and countries, not a payout — converting it would re-rank
            nothing and cost the cross-country comparability. */}
        <ScoreDrop id={crop.id} wps={Math.max(0, econ.wps)} />
      </Pressable>

      {budgetWarn ? (
        <View
          style={[
            row_,
            {
              marginHorizontal: 14,
              marginBottom: 10,
              alignItems: "flex-start",
              gap: 7,
              borderRadius: 9,
              backgroundColor: C.clayTint,
              paddingHorizontal: 10,
              paddingVertical: 7,
            },
          ]}
        >
          <View style={{ marginTop: 1, flexShrink: 0 }}>
            <WarningIcon size={13} stroke={C.clay} strokeWidth={2.6} />
          </View>
          <Text
            style={[
              startAlign,
              {
                flex: 1,
                fontFamily: ff.sans.semibold,
                fontSize: 11.5,
                lineHeight: 16,
                color: C.clay,
              },
            ]}
          >
            {budgetWarn}
          </Text>
        </View>
      ) : null}

      {open ? (
        <View style={{ overflow: "hidden" }}>
          <DashedDivider />
          <View
            style={{
              flexDirection: "column",
              gap: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <SectionLabel style={startAlign}>{t.decWhy}</SectionLabel>

            {crop.factors.map((f) => {
              const n = Math.round(f.score)
              const strong = n >= 75
              const mid = n >= 55
              const color = strong ? C.leaf : mid ? C.sun : C.clay
              const fg = strong ? C.leaf : mid ? C.sunInk : C.clay
              return (
                <View key={f.key} style={{ flexDirection: "column", gap: 3 }}>
                  <View style={[row_, { justifyContent: "space-between" }]}>
                    <Text
                      style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.ink }}
                    >
                      {f.label}
                    </Text>
                    <Text style={{ fontFamily: ff.mono.bold, fontSize: 11, color: fg }}>
                      {n}
                    </Text>
                  </View>
                  <FactorBar pct={n} color={color} />
                  <Text
                    style={[
                      startAlign,
                      {
                        fontFamily: ff.sans.regular,
                        fontSize: 11,
                        lineHeight: 15,
                        color: C.muted,
                      },
                    ]}
                  >
                    {f.note}
                  </Text>
                </View>
              )
            })}

            <View
              style={{
                borderRadius: 9,
                backgroundColor: C.waterTint,
                paddingHorizontal: 11,
                paddingVertical: 8,
              }}
            >
              <Text
                style={[
                  startAlign,
                  {
                    fontFamily: ff.sans.semibold,
                    fontSize: 12,
                    lineHeight: 17,
                    color: C.waterDeep,
                  },
                ]}
              >
                {waterMath}
              </Text>
            </View>

            <View style={[row_, { gap: 8 }]}>
              <Button
                variant="leaf"
                size="md"
                style={{ flex: 1, borderRadius: 10 }}
                onPress={planThisCrop}
              >
                {t.decPlanHarvest}
              </Button>
              <Button variant="outline" size="md" style={{ borderRadius: 10 }}>
                {t.decCompare}
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            row_,
            {
              alignItems: "center",
              gap: 8,
              borderTopWidth: 1,
              borderTopColor: "#f0ecdd",
              paddingHorizontal: 14,
              paddingVertical: 8,
            },
          ]}
        >
          {/* The plan action must be reachable the moment a farmer presses
              a card — not buried under the factor bars of the open panel. */}
          <Button
            variant="leaf"
            size="sm"
            style={{ flex: 1, borderRadius: 8 }}
            onPress={planThisCrop}
          >
            {t.decPlanHarvest}
          </Button>
          <Pressable
            onPress={onToggle}
            style={[
              row_,
              {
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 8,
                paddingVertical: 6,
              },
            ]}
          >
            <Text style={{ fontFamily: ff.sans.bold, fontSize: 12, color: C.water }}>
              {t.decWhy}
            </Text>
            <Text style={{ fontFamily: ff.sans.bold, fontSize: 12, color: C.water }}>
              ▾
            </Text>
          </Pressable>
        </View>
      )}
    </View>
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
  const { pick } = useT()
  const planCrop = useApp((s) => s.planCrop)
  const setPlannedVariety = useParcels((s) => s.setPlannedVariety)

  // One open at a time, like every accordion in the app — the open body is
  // the whole story and two of them open is a wall.
  const [openId, setOpenId] = useState<string | null>(null)

  // The draft a card stashed while the setup sheet asks its three questions.
  // One sheet for the whole list — a sheet per card would mount eight.
  const [pending, setPending] = useState<{
    draft: PlanDraft
    cropName: string
    category: CropCategory | null
  } | null>(null)

  // Every card shows money in the FIELD's currency — the parcel's country,
  // not the reader's locale, decides what a harvest actually sells in.
  const local = useLocalCurrency(parcel.analysis?.place?.countryCode ?? null)

  const rows = useMemo(
    () => buildRows(matches, prices, parcel.areaHa),
    [matches, prices, parcel.areaHa]
  )
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort])

  /** The sheet's answers complete the stashed draft into a committed plan. */
  const createPlan = (setup: PlanSetupResult) => {
    if (!pending) return
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

  return (
    <>
      {/* Keyed on the sort so a chip tap re-runs the entrance stagger,
          exactly as the demo list behaves. openId lives above the key, so
          the open card stays open across re-sorts. */}
      <View key={sort} style={{ flexDirection: "column", gap: 11 }}>
        {sorted.map((row, i) => (
          <FadeUp key={row.crop.id} delay={i * 50}>
            <ShortlistCard
              row={row}
              parcel={parcel}
              local={local}
              open={openId === row.crop.id}
              onToggle={() => {
                animateLayout()
                setOpenId((cur) => (cur === row.crop.id ? null : row.crop.id))
              }}
              onPlan={(draft, cropName, category) =>
                setPending({ draft, cropName, category })
              }
            />
          </FadeUp>
        ))}
      </View>

      <PlanSetupSheet
        open={pending != null}
        cropName={pending?.cropName ?? ""}
        category={pending?.category ?? null}
        cycleDays={pending?.draft.cycleDays ?? null}
        onClose={() => setPending(null)}
        onCreate={createPlan}
      />
    </>
  )
}
