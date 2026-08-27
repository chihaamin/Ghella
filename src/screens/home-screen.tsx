import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"

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
import { applyIrrigation } from "@/lib/crop-suitability"
import { polygonAreaHa, polygonCentroid } from "@/lib/geo"
import { expand, fadeUp, listStagger, pulse } from "@/lib/motion"
import { buildRecommendations } from "@/lib/recommendations"
import { fmt } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import { selectFocusParcel, useParcels } from "@/store/parcel-store"
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
  const { t } = useT()
  const { current } = forecast

  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-ink px-3.5 py-3 text-surface">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-sand">
          {t.ldFeelsIn}
        </span>
        <span className="font-display text-[24px] leading-none font-bold">
          {Math.round(current.tempC)}°
        </span>
      </div>

      {current.sky === "sun" && <SunIcon />}
      {current.sky === "cloud" && <CloudIcon />}
      {current.sky === "rain" && <RainIcon />}

      <div className="flex flex-col gap-0.5 text-[11px] text-sand">
        <span>
          {Math.round(current.humidityPct)}% {t.ldHumidity}
        </span>
        <span>
          {Math.round(current.windKph)} km/h {t.ldWind}
        </span>
      </div>

      {placeLabel && (
        <span className="ms-auto max-w-[38%] text-end font-mono text-[10px] font-bold leading-tight text-sun">
          {placeLabel}
        </span>
      )}
    </div>
  )
}

/** The "inspect your leaves" nudge that opens the disease flow. */
function RiskCard() {
  const { t } = useT()
  const goDisease = useApp((s) => s.goDisease)

  return (
    <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-sun-deep bg-sun-tint px-[13px] py-3">
      <div className="flex items-center gap-[9px]">
        <span className="flex size-[26px] flex-none items-center justify-center rounded-lg bg-sun-deep">
          <WarningIcon />
        </span>
        <div className="text-[13.5px] leading-[1.35]">
          <b>{t.riskTitle}</b>
          <div className="text-[12px] text-sun-ink">{t.riskWhy}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ink" size="md" className="flex-1 rounded-[9px]" onClick={goDisease}>
          {t.riskCta}
        </Button>
        <Button variant="outline" size="md" className="rounded-[9px]">
          {t.riskLater}
        </Button>
      </div>
    </div>
  )
}

/** What the farmer sees before any land exists: draw first, everything follows. */
function EmptyLand() {
  const { t } = useT()
  const goOnboard = useApp((s) => s.goOnboard)

  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-line-strong bg-card px-5 py-[26px] text-center">
      <span className="flex size-[54px] items-center justify-center rounded-full bg-leaf-tint">
        <PinIcon />
      </span>
      <div className="font-display text-[18px] font-semibold">{t.ldNoParcels}</div>
      <div className="max-w-[280px] text-[12.5px] leading-[1.55] text-muted">
        {t.ldNoParcelsSub}
      </div>
      <Button variant="ink" onClick={goOnboard}>
        {t.ldDrawFirst}
      </Button>
    </div>
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
  const { t } = useT()
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

  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col rounded-[13px] border border-line bg-card px-3.5 py-3"
    >
      <button type="button" onClick={onToggle} className="flex cursor-pointer flex-col gap-1.5 text-start">
        <div className="flex items-center gap-[9px]">
          <span
            className="size-[11px] flex-none rounded-[3.5px]"
            style={{ background: parcel.color }}
          />
          <span className="font-display text-[15px] font-bold">{parcel.name}</span>
          <span className="ms-auto font-mono text-[11px] font-bold text-muted">
            {parcel.areaHa.toFixed(1)} ha
          </span>
        </div>

        {parcel.analysisState === "loading" && (
          <div className="flex flex-col gap-1.5">
            <motion.span {...pulse} className="font-mono text-[11px] text-muted">
              {progressLabel || t.ldAnalyzing}
            </motion.span>
            {/* Indeterminate: the pipeline reports stages, not a smooth 0–100. */}
            <div className="h-1 overflow-hidden rounded-[3px] bg-chip">
              <motion.div
                className="h-full w-1/3 rounded-[3px] bg-leaf"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {parcel.analysisState === "ready" && summary && (
          <div className="text-[12px] leading-[1.45] text-muted">{summary}</div>
        )}
      </button>

      {parcel.analysisState === "error" && (
        <div className="flex items-center gap-2 pt-1.5">
          <span className="min-w-0 flex-1 text-[11px] leading-[1.45] text-muted">
            {t.ldAnalysisFailed}
            {parcel.analysisError ? ` — ${parcel.analysisError}` : ""}
          </span>
          <Button variant="ghost" size="sm" className="flex-none" onClick={onRetry}>
            {t.ldRetry}
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            variants={expand}
            initial="hidden"
            animate="show"
            exit="exit"
            className="overflow-hidden"
          >
            <motion.div
              variants={listStagger}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-2.5 pt-2.5"
            >
              <motion.div variants={fadeUp} className="grid grid-cols-3 gap-[9px]">
                <Stat
                  label={t.ldArea}
                  value={`${(analysis?.geometry.areaHa ?? parcel.areaHa).toFixed(2)} ha`}
                  className="bg-chip-2"
                  valueClassName="text-[15px]"
                />
                <Stat
                  label={t.ldPerimeter}
                  value={analysis ? `${Math.round(analysis.geometry.perimeterM)} m` : "—"}
                  className="bg-chip-2"
                  valueClassName="text-[15px]"
                />
                <Stat
                  label={t.ldRegion}
                  value={analysis?.place?.label ?? "—"}
                  className="bg-chip-2"
                  valueClassName="text-[12px] leading-snug"
                />
              </motion.div>

              {analysis?.terrain && (
                <motion.div variants={fadeUp}>
                  <TerrainStrip terrain={analysis.terrain} />
                </motion.div>
              )}

              {analysis?.climate && (
                <motion.div variants={fadeUp}>
                  <ClimatePanel climate={analysis.climate} />
                </motion.div>
              )}

              {analysis && (
                <motion.div variants={fadeUp}>
                  <SoilPanel
                    soil={analysis.soil}
                    farmerTexture={parcel.soilTexture}
                    onConfirm={onEdit}
                  />
                </motion.div>
              )}

              {analysis && analysis.crops.length > 0 && (
                <motion.div variants={fadeUp}>
                  <CropMatches
                    crops={matchesFor(parcel)}
                    onPick={() => go("decide")}
                  />
                </motion.div>
              )}

              {budget && (
                <motion.div variants={fadeUp} className="flex flex-col gap-2">
                  <SectionLabel>{t.ldWaterBudget}</SectionLabel>
                  <div className="grid grid-cols-3 gap-[9px]">
                    <Stat
                      label={t.ldSeasonNeed}
                      value={`${fmt(budget.seasonNeedM3)} m³`}
                      className="bg-chip-2"
                      valueClassName="text-[15px]"
                    />
                    <Stat
                      label={t.ldAvailable}
                      value={budget.availableM3 !== null ? `${fmt(budget.availableM3)} m³` : "—"}
                      className="bg-water-tint"
                      labelClassName="text-water-deep"
                      valueClassName="text-[15px] text-water-deep"
                    />
                    <Stat
                      label={t.ldDeficit}
                      value={shortfall ? `${fmt(budget.deficitM3 ?? 0)} m³` : "—"}
                      className={shortfall ? "bg-clay-tint" : "bg-chip-2"}
                      labelClassName={shortfall ? "text-clay" : undefined}
                      valueClassName={shortfall ? "text-[15px] text-clay" : "text-[15px]"}
                    />
                  </div>
                  <NoteStrip tone={shortfall ? "clay" : "water"}>{budget.note}</NoteStrip>
                </motion.div>
              )}

              {analysis && (
                <motion.div variants={fadeUp}>
                  <SourcesNote
                    issues={analysis.issues}
                    fetchedAt={analysis.fetchedAt}
                    onRetry={onRetry}
                  />
                </motion.div>
              )}

              <motion.div variants={fadeUp} className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
                  {t.epTitle}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-clay hover:bg-clay-tint"
                  onClick={() => {
                    // A parcel is real land plus its cached analysis; make the
                    // farmer say it twice before it is gone.
                    if (window.confirm(`${t.epDelete}: ${parcel.name}?`)) {
                      removeParcel(parcel.id)
                    }
                  }}
                >
                  {t.epDelete}
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * "My land" — the real-time view of the farmer's actual parcels: live weather
 * at the focus point, the live map, ranked recommendations, and one expandable
 * card per parcel wired to the open-data analysis pipeline.
 */
export function HomeScreen() {
  const { t } = useT()
  const planned = useApp((s) => s.planned)
  const treated = useApp((s) => s.treated)
  const goOnboard = useApp((s) => s.goOnboard)
  const go = useApp((s) => s.go)
  const toast = useApp((s) => s.toast)
  const locatedAt = useApp((s) => s.locatedAt)
  const hasPlan = planned !== null

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
  const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null)

  const editParcel = parcels.find((p) => p.id === editId) ?? null

  const openEdit = (id: string) => {
    setEditId(id)
    setEditOpen(true)
  }

  const toggleParcel = (id: string) => {
    selectParcel(id)
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
    rings.forEach((ring, i) => {
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
    <div className="flex flex-col gap-3.5 pt-1">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-2xl leading-[1.1] font-semibold">{t.greet}</div>
        <div className="font-mono text-[11px] font-bold text-muted">{t.seasonChip}</div>
      </div>

      {/* Skipped silently while the forecast loads — no skeleton furniture. */}
      {focusPoint && forecast && (
        <LiveWeatherCard
          forecast={forecast}
          placeLabel={focusParcel?.analysis?.place?.label ?? null}
        />
      )}

      <WeatherStrip latlng={focusPoint} />
      <FrostBanner />

      <AnimatePresence>
        {!treated && hasPlan && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <RiskCard />
          </motion.div>
        )}
      </AnimatePresence>

      {parcels.length > 0 ? (
        <>
          <LiveLandMap
            parcels={parcels}
            selectedId={selectedParcelId}
            onSelect={selectParcel}
            splitPreview={splitPreview ?? undefined}
            heightPx={230}
          />

          <AnimatePresence>
            {splitPreview && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col gap-2 rounded-[13px] border-[1.5px] border-leaf bg-card px-[13px] py-[11px]"
              >
                <div className="flex items-baseline gap-2">
                  <SectionLabel className="text-leaf-deep">{t.rcSplitPreview}</SectionLabel>
                  <span className="ms-auto font-mono text-[11px] font-bold text-muted">
                    {splitPreview.rings.map((ring) => polygonAreaHa(ring).toFixed(1)).join(" / ")} ha
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="leaf" size="sm" className="flex-1" onClick={applySplit}>
                    {t.rcApplySplit}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSplitPreview(null)}>
                    {t.rcCancel}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <EmptyLand />
      )}

      <RecommendationsPanel recommendations={recommendations} onAction={onRecAction} />

      <motion.div
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-[9px]"
      >
        {parcels.map((parcel) => (
          <ParcelCard
            key={parcel.id}
            parcel={parcel}
            open={openId === parcel.id}
            progressLabel={analysisProgress[parcel.id]?.label}
            onToggle={() => toggleParcel(parcel.id)}
            onEdit={() => openEdit(parcel.id)}
            onRetry={() => void analyze(parcel.id)}
          />
        ))}

        <motion.button
          variants={fadeUp}
          type="button"
          onClick={goOnboard}
          className="cursor-pointer rounded-[13px] border-[1.5px] border-dashed border-line-dash p-[13px] text-center text-[13.5px] font-bold text-leaf"
        >
          + {t.addParcel}
        </motion.button>
      </motion.div>

      {editParcel && (
        <EditParcelSheet
          parcel={editParcel}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}
