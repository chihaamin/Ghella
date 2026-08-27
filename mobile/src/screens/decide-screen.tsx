import { useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native"

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
import { FadeUp, animateLayout } from "@/lib/motion"
import { fmt, money } from "@/lib/utils"
import { useFF } from "@/theme/fonts"
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

/** The web card's animated factor bar: a 7px track filling to `pct`%. */
function BarFill({ pct, color }: { pct: number; color: string }) {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progress, {
      toValue: pct,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      // Percentage width cannot ride the native driver.
      useNativeDriver: false,
    }).start()
  }, [progress, pct])
  return (
    <View
      style={{
        height: 7,
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: C.chip,
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 4,
          backgroundColor: color,
          width: progress.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  )
}

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
  const { t, lang, pick, isRtl } = useT()
  const ff = useFF()
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

  const row = { flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const) }
  const alignStart = { textAlign: isRtl ? ("right" as const) : ("left" as const) }
  const doToggle = () => {
    animateLayout()
    toggle(id)
  }

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
        onPress={doToggle}
        style={{
          ...row,
          gap: 12,
          paddingHorizontal: 14,
          paddingTop: 13,
          paddingBottom: 11,
        }}
      >
        <View style={{ flex: 1, flexDirection: "column", gap: 7 }}>
          <View style={{ flexDirection: "column", gap: 1 }}>
            <Text
              style={{
                fontFamily: ff.mono.bold,
                fontSize: 10.5,
                letterSpacing: 1.26,
                color: C.earth,
                ...alignStart,
              }}
            >
              {v.crop}
            </Text>
            <Text
              style={{
                fontFamily: ff.display.bold,
                fontSize: 19,
                lineHeight: 21,
                color: C.ink,
                ...alignStart,
              }}
            >
              {v.name}
            </Text>
          </View>

          <View style={{ ...row, flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
            <Text style={{ fontFamily: ff.display.bold, fontSize: 15, color: C.ink }}>
              {profitTxt}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: ff.sans.regular, fontSize: 11.5, color: C.muted }}
            >
              {netCaption}
            </Text>
          </View>

          <Text
            style={{
              fontFamily: ff.sans.regular,
              fontSize: 11,
              color: C.muted,
              ...alignStart,
            }}
          >
            {forecastTxt}
          </Text>

          <View style={{ ...row, flexWrap: "wrap", gap: 5 }}>
            <Badge variant={urgent ? "sun" : "water"}>
              {`${plantWord}${v.plantD}${dayUnit}`}
            </Badge>
            <Badge variant="neutral">{`${cycleWord}${v.cycle}${dayUnit}`}</Badge>
            {v.badges.map((b) => (
              <Badge key={b} variant="leaf">
                {b}
              </Badge>
            ))}
          </View>
        </View>

        <ScoreDrop id={id} wps={wpsShown} />
      </Pressable>

      {warn && (
        <View
          style={{
            ...row,
            marginHorizontal: 14,
            marginBottom: 10,
            alignItems: "flex-start",
            gap: 7,
            borderRadius: 9,
            paddingHorizontal: 10,
            paddingVertical: 7,
            backgroundColor: severe ? C.clayTint : C.sunTint,
          }}
        >
          <View style={{ marginTop: 1 }}>
            <WarningIcon size={13} stroke={severe ? C.clay : C.sunInk} strokeWidth={2.6} />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: ff.sans.semibold,
              fontSize: 11.5,
              lineHeight: 16,
              color: severe ? C.clay : C.sunInk,
              ...alignStart,
            }}
          >
            {warn}
          </Text>
        </View>
      )}

      {open ? (
        <View
          style={{
            overflow: "hidden",
            borderTopWidth: 1.5,
            borderStyle: "dashed",
            borderColor: C.line,
          }}
        >
          <View
            style={{
              flexDirection: "column",
              gap: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <SectionLabel style={alignStart}>{t.decWhy}</SectionLabel>

            {bars.map((b) => {
              const strong = b.n >= 75
              const mid = b.n >= 55
              const color = strong ? C.leaf : mid ? C.sun : C.clay
              const fg = strong ? C.leaf : mid ? C.sunInk : C.clay
              return (
                <View key={b.k} style={{ flexDirection: "column", gap: 3 }}>
                  <View style={{ ...row, justifyContent: "space-between" }}>
                    <Text
                      style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.ink }}
                    >
                      {b.k}
                    </Text>
                    <Text style={{ fontFamily: ff.mono.bold, fontSize: 11, color: fg }}>
                      {b.n}
                    </Text>
                  </View>
                  <BarFill pct={b.n} color={color} />
                  <Text
                    style={{
                      fontFamily: ff.sans.regular,
                      fontSize: 11,
                      lineHeight: 15,
                      color: C.muted,
                      ...alignStart,
                    }}
                  >
                    {b.note}
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
                style={{
                  fontFamily: ff.sans.semibold,
                  fontSize: 12,
                  lineHeight: 17,
                  color: C.waterDeep,
                  ...alignStart,
                }}
              >
                {waterMath}
              </Text>
            </View>

            <View style={{ ...row, gap: 8 }}>
              <Button
                variant="leaf"
                size="md"
                style={{ flex: 1, borderRadius: 10 }}
                onPress={planHarvest}
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
          style={{
            ...row,
            alignItems: "center",
            gap: 8,
            borderTopWidth: 1,
            borderColor: "#f0ecdd",
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          {/* Reachable on press — not buried below the factor bars. */}
          <Button
            variant="leaf"
            size="sm"
            style={{ flex: 1, borderRadius: 8 }}
            onPress={planHarvest}
          >
            {t.decPlanHarvest}
          </Button>
          <Pressable
            onPress={doToggle}
            style={{
              ...row,
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 8,
              paddingVertical: 6,
            }}
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

/** Uppercased chip label for a stated water source. */
const WATER_CHIP: Record<string, string> = {
  drip: "DRIP",
  sprinkler: "SPRINKLER",
  flood: "FLOOD / FURROW",
  rainfed: "RAINFED",
}

export function DecideScreen() {
  const { t, lang, pick, isRtl } = useT()
  const ff = useFF()
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
    hasReal ? shortlist.map((m: CropMatch) => m.id) : PRICEABLE
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

  const noteStyle = {
    fontFamily: ff.sans.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.muted,
    textAlign: isRtl ? ("right" as const) : ("left" as const),
  }

  return (
    <View style={{ flexDirection: "column", gap: 12, paddingTop: 4 }}>
      <ScreenTitle style={{ textAlign: isRtl ? "right" : "left" }}>{title}</ScreenTitle>

      <View
        style={{
          flexDirection: isRtl ? "row-reverse" : "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
        }}
      >
        {parcel && hasReal ? (
          <>
            <Badge variant="ink" size="md">
              {`${parcel.name} · ${parcel.areaHa.toFixed(1)} ha`}
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
              {`${t.pNorth} · 0.8 ha`}
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
          {`BUDGET ${BUDGET_BANDS[budBand].label.toUpperCase()}`}
        </Badge>
      </View>

      {/* The parcel's own ranked matches — climate, soil, region and frost
          calendar of THIS land, before any variety economics. */}
      {hasReal && (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.card,
            padding: 14,
          }}
        >
          <CropMatches crops={matches} initial={4} />
        </View>
      )}

      {hasReal && (
        <SectionLabel
          style={{ paddingTop: 4, textAlign: isRtl ? "right" : "left" }}
        >
          {anyPrice ? t.decShortlistLive : t.decShortlist}
        </SectionLabel>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{
          flexDirection: "row",
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 2,
        }}
      >
        {(Object.keys(SORT_ORDERS) as SortKey[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => set({ sort: k })}
            style={{
              borderRadius: 9,
              borderWidth: 1.5,
              paddingHorizontal: 11,
              paddingVertical: 7,
              borderColor: sort === k ? C.ink : C.lineStrong,
              backgroundColor: sort === k ? C.ink : C.card,
            }}
          >
            <Text
              style={{
                fontFamily: ff.sans.bold,
                fontSize: 12,
                color: sort === k ? C.cream : C.inkMuted,
              }}
            >
              {labels[k]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* With an analysed parcel the cards are generated from ITS own top
          matches — a Tunisian field shortlists what suits Tunisia, a Spanish
          field Spain. The scripted demo varieties only render where no
          analysis exists to replace them. */}
      {parcel && hasReal ? (
        <CropShortlist parcel={parcel} matches={matches} prices={prices} sort={sort} />
      ) : (
        <View key={sort} style={{ flexDirection: "column", gap: 11 }}>
          {order.map((id, i) => (
            <FadeUp key={id} delay={i * 50}>
              <VarietyCard
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
            </FadeUp>
          ))}
        </View>
      )}

      {/* FPMA observes retail/wholesale in a city market, not the farm gate —
          the one honesty note the live numbers must carry. */}
      {liveShown && (
        <Text style={{ paddingHorizontal: 2, ...noteStyle }}>{t.decFarmGate}</Text>
      )}

      <Text style={{ paddingHorizontal: 2, paddingBottom: 6, ...noteStyle }}>
        {t.decFoot}
      </Text>

      <PlanSetupSheet
        open={pending != null}
        cropName={pending?.cropName ?? ""}
        category={pending?.category ?? null}
        cycleDays={pending?.draft.cycleDays ?? null}
        onClose={() => setPending(null)}
        onCreate={createPlan}
      />
    </View>
  )
}
