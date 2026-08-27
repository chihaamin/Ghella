import { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native"

import {
  CloudIcon,
  PinIcon,
  RainIcon,
  SunIcon,
  WarningIcon,
} from "@/components/ghella/icons"
import { NoteStrip, SectionLabel, Stat } from "@/components/ghella/primitives"
import { FrostBanner, WeatherStrip } from "@/components/ghella/weather-strip"
import { EditParcelSheet } from "@/components/land/edit-parcel-sheet"
import { LiveLandMap, type SplitPreview } from "@/components/land/live-map"
import { ClimatePanel } from "@/components/land/climate-panel"
import { CropMatches } from "@/components/land/crop-matches"
import { RecommendationsPanel } from "@/components/land/recommendations-panel"
import { SoilPanel } from "@/components/land/soil-panel"
import { SourcesNote } from "@/components/land/sources-note"
import { TerrainStrip } from "@/components/land/terrain-strip"
import { Button } from "@/components/ui/button"
import { useForecast } from "@/hooks/use-forecast"
import { useLandAnalysis } from "@/hooks/use-land-analysis"
import { useT } from "@/i18n/use-t"
import { textureLabel, waterBudget } from "@/lib/agronomy"
import { C } from "@/lib/colors"
import { applyIrrigation } from "@/lib/crop-suitability"
import { polygonAreaHa, polygonCentroid } from "@/lib/geo"
import { animateLayout, FadeUp, Pulse } from "@/lib/motion"
import { buildRecommendations } from "@/lib/recommendations"
import { fmt } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import { selectFocusParcel, useParcels } from "@/store/parcel-store"
import { useFF } from "@/theme/fonts"
import type {
  Forecast,
  LatLng,
  Parcel,
  Recommendation,
  WaterBudget,
  WaterSourceId,
} from "@/types/land"

/** Block suffixes when a split lands: "North · A", "North · B", … */
const BLOCK_LETTERS = "ABCDEF"

/**
 * Season water usable per source, m³ per parcel. Mirrors SEASON_DELIVERY in
 * `lib/recommendations` (which does not export it): drip is a 2 L/s well at
 * 6 h/day over a season net of downtime; sprinkler loses to wind and air;
 * flood leaves the ditch big but drains past the roots. Rainfed is null
 * because rain is a DEPTH, priced from the climate normals per parcel.
 */
const SEASON_USABLE_M3: Record<WaterSourceId, number | null> = {
  drip: 5200,
  sprinkler: 4600,
  flood: 6800,
  rainfed: null,
}

/**
 * The water budget shown in a parcel's detail: the top crop match's demand
 * against what the stated source delivers. Null — no block — whenever any leg
 * of that is unknown; an invented budget would be acted on.
 */
/**
 * The matches as THIS parcel should read them: stored rain-fed, re-read with
 * the rain constraint lifted when the farmer states an irrigation source.
 * Same adjustment the Decide screen applies, so the two never disagree.
 */
function matchesFor(parcel: Parcel) {
  const crops = parcel.analysis?.crops ?? []
  const irrigated =
    parcel.waterSource != null && parcel.waterSource !== "rainfed"
  return applyIrrigation(crops, irrigated)
}

function budgetFor(parcel: Parcel): WaterBudget | null {
  const source = parcel.waterSource
  const climate = parcel.analysis?.climate
  if (!source || !climate) return null

  const top = matchesFor(parcel)[0]
  const needMm = top && Number.isFinite(top.waterNeedMm) && top.waterNeedMm > 0 ? top.waterNeedMm : 0
  const areaHa = Number.isFinite(parcel.areaHa) && parcel.areaHa > 0 ? parcel.areaHa : 0
  if (needMm <= 0 || areaHa <= 0) return null

  let availableM3 = SEASON_USABLE_M3[source]
  if (availableM3 === null) {
    // Rain delivers a depth over every hectare: the cycle's share of the
    // annual total × area. Coarser than the month-walk in lib/recommendations,
    // but never hands a 110-day crop a full year of rain.
    const cycleDays = top && top.cycleDays > 0 ? top.cycleDays : 120
    availableM3 = Math.round(climate.annualRainMm * Math.min(cycleDays / 365, 1) * areaHa * 10)
  }

  return waterBudget({ seasonNeedMm: needMm, areaHa, availableM3 })
}

/** `ms-auto` under a manually flipped row: push to the row's far end. */
function msAuto(isRtl: boolean) {
  return isRtl ? { marginRight: "auto" as const } : { marginLeft: "auto" as const }
}

/**
 * The web card's indeterminate analysis bar: a 1/3-width leaf bar sweeping
 * x from -100% to 300% of its own width, forever. Rebuilt on Animated.
 */
function IndeterminateBar() {
  const [trackW, setTrackW] = useState(0)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [progress])

  const barW = trackW / 3
  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      style={{
        height: 4,
        borderRadius: 3,
        backgroundColor: C.chip,
        overflow: "hidden",
      }}
    >
      {trackW > 0 && (
        <Animated.View
          style={{
            height: "100%",
            width: barW,
            borderRadius: 3,
            backgroundColor: C.leaf,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-barW, trackW],
                }),
              },
            ],
          }}
        />
      )}
    </View>
  )
}

/**
 * The compact ink-dark live conditions row under the title: current temp, sky,
 * humidity, wind and where the reading is for. Renders nothing until the
 * forecast has actually arrived — a placeholder card would just be furniture.
 */
function LiveWeatherCard({
  forecast,
  placeLabel,
}: {
  forecast: Forecast
  placeLabel: string | null
}) {
  const { t, isRtl } = useT()
  const ff = useFF()
  const { current } = forecast

  return (
    <View
      style={{
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 14,
        backgroundColor: C.ink,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: "column", gap: 2 }}>
        <Text
          style={{
            fontFamily: ff.mono.bold,
            fontSize: 10,
            letterSpacing: 1.2,
            color: C.sand,
          }}
        >
          {t.ldFeelsIn}
        </Text>
        <Text
          style={{
            fontFamily: ff.display.bold,
            fontSize: 24,
            lineHeight: 24,
            color: C.surface,
          }}
        >
          {Math.round(current.tempC)}°
        </Text>
      </View>

      {current.sky === "sun" && <SunIcon />}
      {current.sky === "cloud" && <CloudIcon />}
      {current.sky === "rain" && <RainIcon />}

      <View style={{ flexDirection: "column", gap: 2 }}>
        <Text
          style={{
            fontFamily: ff.sans.regular,
            fontSize: 11,
            color: C.sand,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {Math.round(current.humidityPct)}% {t.ldHumidity}
        </Text>
        <Text
          style={{
            fontFamily: ff.sans.regular,
            fontSize: 11,
            color: C.sand,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {Math.round(current.windKph)} km/h {t.ldWind}
        </Text>
      </View>

      {placeLabel && (
        <Text
          style={[
            {
              maxWidth: "38%",
              textAlign: isRtl ? "left" : "right",
              fontFamily: ff.mono.bold,
              fontSize: 10,
              lineHeight: 13,
              color: C.sun,
            },
            msAuto(isRtl),
          ]}
        >
          {placeLabel}
        </Text>
      )}
    </View>
  )
}

/** The "inspect your leaves" nudge that opens the disease flow. */
function RiskCard() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const goDisease = useApp((s) => s.goDisease)

  return (
    <View
      style={{
        flexDirection: "column",
        gap: 8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: C.sunDeep,
        backgroundColor: C.sunTint,
        paddingHorizontal: 13,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          flexDirection: isRtl ? "row-reverse" : "row",
          alignItems: "center",
          gap: 9,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            backgroundColor: C.sunDeep,
          }}
        >
          <WarningIcon />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: ff.sans.bold,
              fontSize: 13.5,
              lineHeight: 18,
              color: C.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.riskTitle}
          </Text>
          <Text
            style={{
              fontFamily: ff.sans.regular,
              fontSize: 12,
              lineHeight: 16,
              color: C.sunInk,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.riskWhy}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 8 }}>
        <Button
          variant="ink"
          size="md"
          style={{ flex: 1, borderRadius: 9 }}
          onPress={goDisease}
        >
          {t.riskCta}
        </Button>
        <Button variant="outline" size="md" style={{ borderRadius: 9 }}>
          {t.riskLater}
        </Button>
      </View>
    </View>
  )
}

/** What the farmer sees before any land exists: draw first, everything follows. */
function EmptyLand() {
  const { t } = useT()
  const ff = useFF()
  const goOnboard = useApp((s) => s.goOnboard)

  return (
    <View
      style={{
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.lineStrong,
        backgroundColor: C.card,
        paddingHorizontal: 20,
        paddingVertical: 26,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 27,
          backgroundColor: C.leafTint,
        }}
      >
        <PinIcon />
      </View>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 18,
          color: C.ink,
          textAlign: "center",
        }}
      >
        {t.ldNoParcels}
      </Text>
      <Text
        style={{
          maxWidth: 280,
          fontFamily: ff.sans.regular,
          fontSize: 12.5,
          lineHeight: 19,
          color: C.muted,
          textAlign: "center",
        }}
      >
        {t.ldNoParcelsSub}
      </Text>
      <Button variant="ink" onPress={goOnboard}>
        {t.ldDrawFirst}
      </Button>
    </View>
  )
}

/**
 * One real parcel: the always-visible header row, a state line (analysing /
 * failed / one-line summary), and the accordion detail with everything the
 * analysis found. Clicking the card selects the parcel AND toggles the detail.
 */
function ParcelCard({
  parcel,
  open,
  progressLabel,
  onToggle,
  onEdit,
  onRetry,
}: {
  parcel: Parcel
  open: boolean
  progressLabel: string | undefined
  onToggle: () => void
  onEdit: () => void
  onRetry: () => void
}) {
  const { t, isRtl } = useT()
  const ff = useFF()
  const go = useApp((s) => s.go)
  const removeParcel = useParcels((s) => s.removeParcel)

  const analysis = parcel.analysis
  // The farmer's own texture outranks the model's guess everywhere.
  const texture = parcel.soilTexture ?? analysis?.soil.texture ?? null
  const summary = [
    analysis?.place?.label,
    texture ? textureLabel(texture) : null,
    analysis?.climate?.zone.label,
  ]
    .filter(Boolean)
    .join(" · ")

  const budget = budgetFor(parcel)
  const shortfall = budget?.deficitM3 != null && budget.deficitM3 > 0

  // Same stagger the web listStagger gave the visible detail children.
  let staggerIndex = 0
  const stagger = () => staggerIndex++ * 50

  return (
    <View
      style={{
        flexDirection: "column",
        borderRadius: 13,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.card,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Pressable onPress={onToggle} style={{ flexDirection: "column", gap: 6 }}>
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: 9,
          }}
        >
          <View
            style={{
              width: 11,
              height: 11,
              flexShrink: 0,
              borderRadius: 3.5,
              backgroundColor: parcel.color,
            }}
          />
          <Text
            style={{
              flexShrink: 1,
              fontFamily: ff.display.bold,
              fontSize: 15,
              color: C.ink,
            }}
          >
            {parcel.name}
          </Text>
          <Text
            style={[
              { fontFamily: ff.mono.bold, fontSize: 11, color: C.muted },
              msAuto(isRtl),
            ]}
          >
            {parcel.areaHa.toFixed(1)} ha
          </Text>
        </View>

        {parcel.analysisState === "loading" && (
          <View style={{ flexDirection: "column", gap: 6 }}>
            <Pulse>
              <Text
                style={{
                  fontFamily: ff.mono.regular,
                  fontSize: 11,
                  color: C.muted,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {progressLabel || t.ldAnalyzing}
              </Text>
            </Pulse>
            {/* Indeterminate: the pipeline reports stages, not a smooth 0–100. */}
            <IndeterminateBar />
          </View>
        )}

        {parcel.analysisState === "ready" && summary.length > 0 && (
          <Text
            style={{
              fontFamily: ff.sans.regular,
              fontSize: 12,
              lineHeight: 17,
              color: C.muted,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {summary}
          </Text>
        )}
      </Pressable>

      {parcel.analysisState === "error" && (
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: 8,
            paddingTop: 6,
          }}
        >
          <Text
            style={{
              minWidth: 0,
              flex: 1,
              fontFamily: ff.sans.regular,
              fontSize: 11,
              lineHeight: 16,
              color: C.muted,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.ldAnalysisFailed}
            {parcel.analysisError ? ` — ${parcel.analysisError}` : ""}
          </Text>
          <Button variant="ghost" size="sm" style={{ flexShrink: 0 }} onPress={onRetry}>
            {t.ldRetry}
          </Button>
        </View>
      )}

      {open && (
        <View style={{ flexDirection: "column", gap: 10, paddingTop: 10 }}>
          <FadeUp delay={stagger()}>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 9 }}>
              <Stat
                label={t.ldArea}
                value={`${(analysis?.geometry.areaHa ?? parcel.areaHa).toFixed(2)} ha`}
                style={{ flex: 1, backgroundColor: C.chip2 }}
                valueStyle={{ fontSize: 15 }}
              />
              <Stat
                label={t.ldPerimeter}
                value={analysis ? `${Math.round(analysis.geometry.perimeterM)} m` : "—"}
                style={{ flex: 1, backgroundColor: C.chip2 }}
                valueStyle={{ fontSize: 15 }}
              />
              <Stat
                label={t.ldRegion}
                value={analysis?.place?.label ?? "—"}
                style={{ flex: 1, backgroundColor: C.chip2 }}
                valueStyle={{ fontSize: 12, lineHeight: 17 }}
              />
            </View>
          </FadeUp>

          {analysis?.terrain && (
            <FadeUp delay={stagger()}>
              <TerrainStrip terrain={analysis.terrain} />
            </FadeUp>
          )}

          {analysis?.climate && (
            <FadeUp delay={stagger()}>
              <ClimatePanel climate={analysis.climate} />
            </FadeUp>
          )}

          {analysis && (
            <FadeUp delay={stagger()}>
              <SoilPanel
                soil={analysis.soil}
                farmerTexture={parcel.soilTexture}
                onConfirm={onEdit}
              />
            </FadeUp>
          )}

          {analysis && analysis.crops.length > 0 && (
            <FadeUp delay={stagger()}>
              <CropMatches
                crops={matchesFor(parcel)}
                onPick={() => go("decide")}
              />
            </FadeUp>
          )}

          {budget && (
            <FadeUp delay={stagger()}>
              <View style={{ flexDirection: "column", gap: 8 }}>
                <SectionLabel>{t.ldWaterBudget}</SectionLabel>
                <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 9 }}>
                  <Stat
                    label={t.ldSeasonNeed}
                    value={`${fmt(budget.seasonNeedM3)} m³`}
                    style={{ flex: 1, backgroundColor: C.chip2 }}
                    valueStyle={{ fontSize: 15 }}
                  />
                  <Stat
                    label={t.ldAvailable}
                    value={budget.availableM3 !== null ? `${fmt(budget.availableM3)} m³` : "—"}
                    style={{ flex: 1, backgroundColor: C.waterTint }}
                    labelStyle={{ color: C.waterDeep }}
                    valueStyle={{ fontSize: 15, color: C.waterDeep }}
                  />
                  <Stat
                    label={t.ldDeficit}
                    value={shortfall ? `${fmt(budget.deficitM3 ?? 0)} m³` : "—"}
                    style={{
                      flex: 1,
                      backgroundColor: shortfall ? C.clayTint : C.chip2,
                    }}
                    labelStyle={shortfall ? { color: C.clay } : undefined}
                    valueStyle={
                      shortfall
                        ? { fontSize: 15, color: C.clay }
                        : { fontSize: 15 }
                    }
                  />
                </View>
                <NoteStrip tone={shortfall ? "clay" : "water"}>{budget.note}</NoteStrip>
              </View>
            </FadeUp>
          )}

          {analysis && (
            <FadeUp delay={stagger()}>
              <SourcesNote
                issues={analysis.issues}
                fetchedAt={analysis.fetchedAt}
                onRetry={onRetry}
              />
            </FadeUp>
          )}

          <FadeUp delay={stagger()}>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 8 }}>
              <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={onEdit}>
                {t.epTitle}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                textStyle={{ color: C.clay }}
                onPress={() => {
                  // A parcel is real land plus its cached analysis; make the
                  // farmer say it twice before it is gone.
                  Alert.alert(`${t.epDelete}: ${parcel.name}?`, undefined, [
                    { text: t.rcCancel, style: "cancel" },
                    {
                      text: t.epDelete,
                      style: "destructive",
                      onPress: () => removeParcel(parcel.id),
                    },
                  ])
                }}
              >
                {t.epDelete}
              </Button>
            </View>
          </FadeUp>
        </View>
      )}
    </View>
  )
}

/**
 * "My land" — the real-time view of the farmer's actual parcels: live weather
 * at the focus point, the live map, ranked recommendations, and one expandable
 * card per parcel wired to the open-data analysis pipeline.
 */
export function HomeScreen() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const planned = useApp((s) => s.planned)
  const plannedCrop = useApp((s) => s.plannedCrop)
  const treated = useApp((s) => s.treated)
  const goOnboard = useApp((s) => s.goOnboard)
  const go = useApp((s) => s.go)
  const toast = useApp((s) => s.toast)
  const locatedAt = useApp((s) => s.locatedAt)
  // A generic season plan counts as having a plan, same as the demo variety.
  const hasPlan = planned !== null || plannedCrop !== null

  const parcels = useParcels((s) => s.parcels)
  const selectedParcelId = useParcels((s) => s.selectedParcelId)
  const selectParcel = useParcels((s) => s.selectParcel)
  const analysisProgress = useParcels((s) => s.analysisProgress)
  const focusParcel = useParcels(selectFocusParcel)

  // Wired ONCE for the whole screen: autoruns any parcel still "idle", and
  // `analyze` is what the retry buttons call.
  const { analyze } = useLandAnalysis()

  // NOTE: zero parcels is a DESIGNED state, even once `located` is true — do
  // not auto-seed demo parcels here. Earlier drafts seeded fake fields around
  // the farmer's fix and people mistook them for readings of their own land.
  const focusPoint = useMemo<LatLng | null>(() => {
    if (focusParcel && focusParcel.points.length >= 3) {
      return polygonCentroid(focusParcel.points)
    }
    return locatedAt
  }, [focusParcel, locatedAt])

  const { forecast } = useForecast(focusPoint)

  const recommendations = useMemo(
    () => buildRecommendations({ parcels, selectedParcelId, forecast }),
    [parcels, selectedParcelId, forecast]
  )

  /** Which parcel's accordion detail is open, if any. */
  const [openId, setOpenId] = useState<string | null>(null)
  /** Edit sheet target stays mounted while `editOpen` animates out. */
  const [editId, setEditId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [splitPreview, setSplitPreviewState] = useState<SplitPreview | null>(null)

  const editParcel = parcels.find((p) => p.id === editId) ?? null

  /** The split panel grows/shrinks the column — animate every flip. */
  const setSplitPreview = (next: SplitPreview | null) => {
    animateLayout()
    setSplitPreviewState(next)
  }

  const openEdit = (id: string) => {
    setEditId(id)
    setEditOpen(true)
  }

  const toggleParcel = (id: string) => {
    selectParcel(id)
    animateLayout()
    setOpenId((current) => (current === id ? null : id))
  }

  /** The screen owns dispatch — the panel only says which card was tapped. */
  const onRecAction = (rec: Recommendation) => {
    const action = rec.action
    if (!action) return
    switch (action.type) {
      case "split":
        selectParcel(action.parcelId)
        setSplitPreview({ parcelId: action.parcelId, rings: action.preview })
        break
      case "draw-parcel":
        goOnboard()
        break
      case "edit-parcel":
        selectParcel(action.parcelId)
        openEdit(action.parcelId)
        break
      case "open-decide":
        selectParcel(action.parcelId)
        go("decide")
        break
      case "open-calendar":
        go("cal")
        break
    }
  }

  const applySplit = () => {
    if (!splitPreview) return
    const store = useParcels.getState()
    const parent = store.parcels.find((p) => p.id === splitPreview.parcelId)
    if (!parent) {
      setSplitPreview(null)
      return
    }
    const rings = splitPreview.rings
    rings.forEach((ring: LatLng[], i: number) => {
      const block = store.addParcel({
        points: ring,
        areaHa: polygonAreaHa(ring),
        name: `${parent.name} · ${BLOCK_LETTERS[i] ?? i + 1}`,
        color: parent.color,
      })
      // Blocks are the same ground: the farmer's facts about the parent hold
      // for every child until they say otherwise.
      if (parent.soilTexture) store.setSoilTexture(block.id, parent.soilTexture)
      if (parent.waterSource) store.setWaterSource(block.id, parent.waterSource)
      if (parent.salinity) store.setSalinity(block.id, parent.salinity)
    })
    // The parent goes last so a mid-apply crash never loses land.
    store.removeParcel(parent.id)
    setSplitPreview(null)
    toast(`${t.rcApplySplit} · ${rings.length} ${t.rcBlocks}`)
  }

  return (
    <View style={{ flexDirection: "column", gap: 14, paddingTop: 4 }}>
      <View
        style={{
          flexDirection: isRtl ? "row-reverse" : "row",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontFamily: ff.display.semibold,
            fontSize: 24,
            lineHeight: 26,
            color: C.ink,
          }}
        >
          {t.greet}
        </Text>
        <Text style={{ fontFamily: ff.mono.bold, fontSize: 11, color: C.muted }}>
          {t.seasonChip}
        </Text>
      </View>

      {/* Skipped silently while the forecast loads — no skeleton furniture. */}
      {focusPoint && forecast && (
        <LiveWeatherCard
          forecast={forecast}
          placeLabel={focusParcel?.analysis?.place?.label ?? null}
        />
      )}

      <WeatherStrip latlng={focusPoint} />
      <FrostBanner />

      {!treated && hasPlan && (
        <FadeUp>
          <RiskCard />
        </FadeUp>
      )}

      {parcels.length > 0 ? (
        <>
          <LiveLandMap
            parcels={parcels}
            selectedId={selectedParcelId}
            onSelect={selectParcel}
            splitPreview={splitPreview ?? undefined}
            heightPx={230}
          />

          {splitPreview && (
            <FadeUp>
              <View
                style={{
                  flexDirection: "column",
                  gap: 8,
                  borderRadius: 13,
                  borderWidth: 1.5,
                  borderColor: C.leaf,
                  backgroundColor: C.card,
                  paddingHorizontal: 13,
                  paddingVertical: 11,
                }}
              >
                <View
                  style={{
                    flexDirection: isRtl ? "row-reverse" : "row",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <SectionLabel style={{ color: C.leafDeep }}>
                    {t.rcSplitPreview}
                  </SectionLabel>
                  <Text
                    style={[
                      { fontFamily: ff.mono.bold, fontSize: 11, color: C.muted },
                      msAuto(isRtl),
                    ]}
                  >
                    {splitPreview.rings.map((ring: LatLng[]) => polygonAreaHa(ring).toFixed(1)).join(" / ")} ha
                  </Text>
                </View>
                <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 8 }}>
                  <Button variant="leaf" size="sm" style={{ flex: 1 }} onPress={applySplit}>
                    {t.rcApplySplit}
                  </Button>
                  <Button variant="outline" size="sm" onPress={() => setSplitPreview(null)}>
                    {t.rcCancel}
                  </Button>
                </View>
              </View>
            </FadeUp>
          )}
        </>
      ) : (
        <EmptyLand />
      )}

      <RecommendationsPanel recommendations={recommendations} onAction={onRecAction} />

      <View style={{ flexDirection: "column", gap: 9 }}>
        {parcels.map((parcel, i) => (
          <FadeUp key={parcel.id} delay={i * 50}>
            <ParcelCard
              parcel={parcel}
              open={openId === parcel.id}
              progressLabel={analysisProgress[parcel.id]?.label}
              onToggle={() => toggleParcel(parcel.id)}
              onEdit={() => openEdit(parcel.id)}
              onRetry={() => void analyze(parcel.id)}
            />
          </FadeUp>
        ))}

        <FadeUp delay={parcels.length * 50}>
          <Pressable
            onPress={goOnboard}
            style={({ pressed }) => ({
              borderRadius: 13,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: C.lineDash,
              padding: 13,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: ff.sans.bold,
                fontSize: 13.5,
                color: C.leaf,
                textAlign: "center",
              }}
            >
              + {t.addParcel}
            </Text>
          </Pressable>
        </FadeUp>
      </View>

      {editParcel && (
        <EditParcelSheet
          parcel={editParcel}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </View>
  )
}
