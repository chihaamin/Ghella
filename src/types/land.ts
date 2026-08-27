/**
 * The contract every land-data module shares.
 *
 * Nothing in here fetches or computes — it only describes the shapes that the
 * services (`src/services`), the derivation helpers (`src/lib/geo`,
 * `src/lib/agronomy`, `src/lib/crop-suitability`, `src/lib/recommendations`)
 * and the store agree on. Change a shape here and every consumer's types move
 * with it.
 *
 * Data sources, all open and key-free:
 *   · OpenStreetMap Nominatim  — country / region / county for a point
 *   · Open-Meteo Forecast      — live conditions + 7-day outlook
 *   · Open-Meteo Archive       — 10 years of daily history → climate normals
 *   · Open-Meteo Elevation     — elevation, and slope from a 5-point stencil
 *   · ISRIC SoilGrids          — sand / silt / clay / pH / organic carbon
 *   · FAO EcoCrop (bundled)    — crop requirement envelopes, shipped as data
 */

/** `[latitude, longitude]`, the order Leaflet uses. */
export type LatLng = [number, number]

/** `[south, west, north, east]`. */
export type BBox = [number, number, number, number]

/* ── Geometry ────────────────────────────────────────────────── */

export interface Geometry {
  points: LatLng[]
  /** Geodesic area, hectares. */
  areaHa: number
  /** Perimeter, metres. */
  perimeterM: number
  centroid: LatLng
  bbox: BBox
}

/* ── Place ───────────────────────────────────────────────────── */

export interface Place {
  /** "United States" */
  country: string | null
  /** ISO-3166-1 alpha-2, upper case: "US" */
  countryCode: string | null
  /** First-level division: "California" */
  region: string | null
  /** Second-level division: "Fresno County" */
  county: string | null
  /** Nearest settlement: "Fresno" */
  locality: string | null
  /** Short human label, e.g. "Fresno County, California". */
  label: string
}

/* ── Soil ────────────────────────────────────────────────────── */

export type TextureClass =
  | "sand"
  | "loamy sand"
  | "sandy loam"
  | "loam"
  | "silt loam"
  | "silt"
  | "sandy clay loam"
  | "clay loam"
  | "silty clay loam"
  | "sandy clay"
  | "silty clay"
  | "clay"

/** Where a soil reading came from — the farmer always outranks the model. */
export type SoilSource = "soilgrids" | "farmer" | "unknown"

export interface SoilSample {
  source: SoilSource
  /** Percentages of the mineral fraction; null when unknown. */
  sandPct: number | null
  siltPct: number | null
  clayPct: number | null
  /** pH in water. */
  ph: number | null
  /** Soil organic carbon, g/kg. */
  socGkg: number | null
  texture: TextureClass | null
  /** Plant-available water, mm per metre of root depth. Derived from texture. */
  waterHoldingMmPerM: number | null
  /** Human note when detection failed, e.g. "No soil grid over built-up land". */
  note: string | null
}

/* ── Climate ─────────────────────────────────────────────────── */

export type ClimateZoneId =
  | "arid"
  | "semi-arid"
  | "dry-subhumid"
  | "humid"
  | "per-humid"

export interface ClimateZone {
  id: ClimateZoneId
  /** "Semi-arid · steppe" */
  label: string
  /** One sentence on what this means for growing. */
  note: string
}

export interface MonthlyNormal {
  /** 1–12 */
  month: number
  tMinC: number
  tMaxC: number
  rainMm: number
  et0Mm: number
}

export interface FrostWindow {
  /** ISO month-day, e.g. "12-08". Null where frost never occurs. */
  firstAutumnFrost: string | null
  lastSpringFrost: string | null
  frostFreeDays: number | null
  risk: "none" | "light" | "hard"
}

export interface ClimateNormals {
  /** How many complete years the normals average over. */
  years: number
  annualRainMm: number
  /** FAO-56 reference evapotranspiration, mm/yr. */
  annualEt0Mm: number
  /** UNEP aridity index, P / PET. */
  aridityIndex: number
  zone: ClimateZone
  meanTempC: number
  sunHoursPerYear: number
  /** Growing degree days, base 10 °C, annual. */
  gddBase10: number
  frost: FrostWindow
  monthly: MonthlyNormal[]
}

/* ── Live weather ────────────────────────────────────────────── */

export type Sky = "sun" | "cloud" | "rain"

export interface ForecastDay {
  /** ISO date. */
  date: string
  tMaxC: number
  tMinC: number
  rainMm: number
  /** WMO weather code. */
  code: number
  sky: Sky
  sunHours: number
  et0Mm: number
}

export interface CurrentConditions {
  tempC: number
  humidityPct: number
  precipMm: number
  windKph: number
  code: number
  sky: Sky
  /** ISO timestamp reported by the provider. */
  time: string
}

export interface Forecast {
  current: CurrentConditions
  days: ForecastDay[]
  /** When this app fetched it, ISO. */
  fetchedAt: string
  timezone: string
}

/**
 * Raw daily history, straight off the archive API. Parallel arrays, all the
 * same length — the handover format between `services/weather` (which fetches)
 * and `lib/agronomy` (which turns it into normals).
 */
export interface DailySeries {
  /** ISO dates, ascending. */
  time: string[]
  tMaxC: number[]
  tMinC: number[]
  rainMm: number[]
  et0Mm: number[]
  sunSeconds: number[]
}

/* ── Terrain ─────────────────────────────────────────────────── */

export interface Terrain {
  elevationM: number
  /** Percent grade across the parcel. */
  slopePct: number
  /** Compass direction the slope faces, or null on flat ground. */
  aspect: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | null
}

/* ── Crop matching ───────────────────────────────────────────── */

export type CropCategory =
  | "vegetable"
  | "cereal"
  | "legume"
  | "root"
  | "fruit"
  | "forage"
  | "oilseed"

/** One scored dimension of a crop match, shown as a labelled bar. */
export interface MatchFactor {
  key: "temperature" | "rainfall" | "soil" | "ph" | "season" | "frost"
  label: string
  /** 0–100. */
  score: number
  /** Relative importance, 0–1, summing to 1 across the factors present. */
  weight: number
  /** The sentence that explains the number. */
  note: string
}

export type CropRating = "excellent" | "good" | "marginal" | "unsuitable"

export interface CropMatch {
  id: string
  name: string
  /** Botanical family — used for rotation advice. */
  family: string
  category: CropCategory
  /** 0–100, weighted mean of `factors`. */
  score: number
  rating: CropRating
  cycleDays: number
  /** Season water demand, mm. */
  waterNeedMm: number
  /** Month numbers (1–12) when planting is sensible at this site. */
  plantingMonths: number[]
  factors: MatchFactor[]
  /** Hard stops, e.g. "Needs 700 mm; this site gets 285 mm". Empty when none. */
  blockers: string[]
}

/* ── Water ───────────────────────────────────────────────────── */

export interface WaterBudget {
  /** Crop water requirement over the season, mm. */
  seasonNeedMm: number
  /** The same, for this parcel's area, m³. */
  seasonNeedM3: number
  /** What the stated water source can deliver, m³, or null if unknown. */
  availableM3: number | null
  /** Positive when short of water. */
  deficitM3: number | null
  note: string
}

/* ── The analysis ────────────────────────────────────────────── */

/** A source that failed, so the UI can say what is missing and why. */
export interface AnalysisIssue {
  source: "place" | "climate" | "terrain" | "soil" | "forecast"
  message: string
}

export const LAND_ANALYSIS_VERSION = 1

export interface LandAnalysis {
  version: typeof LAND_ANALYSIS_VERSION
  geometry: Geometry
  place: Place | null
  climate: ClimateNormals | null
  terrain: Terrain | null
  soil: SoilSample
  /** Ranked best-first. */
  crops: CropMatch[]
  /** ISO timestamp. */
  fetchedAt: string
  issues: AnalysisIssue[]
}

/** Progress reporting while an analysis runs. */
export type AnalysisStage =
  | "geometry"
  | "place"
  | "climate"
  | "terrain"
  | "soil"
  | "crops"
  | "done"

export interface AnalysisProgress {
  stage: AnalysisStage
  /** 0–1. */
  progress: number
  /** The line shown under the spinner. */
  label: string
}

/* ── Parcels ─────────────────────────────────────────────────── */

export type WaterSourceId = "drip" | "sprinkler" | "flood" | "rainfed"
export type SalinityId = "none" | "slight" | "patches"

export type ParcelAnalysisState = "idle" | "loading" | "ready" | "error"

export interface Parcel {
  id: string
  name: string
  /** Hex, from the parcel palette. */
  color: string
  points: LatLng[]
  areaHa: number
  /** What the farmer told us — always outranks the model's guess. */
  soilTexture: TextureClass | null
  waterSource: WaterSourceId | null
  salinity: SalinityId | null
  /** Set once a variety is committed on the Decide screen. */
  plannedVarietyId: string | null
  /** Seeded around the farmer's location on first run; clearable. */
  demo: boolean
  createdAt: string
  analysis: LandAnalysis | null
  analysisState: ParcelAnalysisState
  analysisError: string | null
}

/* ── Recommendations ─────────────────────────────────────────── */

export type RecommendationKind =
  | "split"
  | "add-land"
  | "complete-info"
  | "water"
  | "rotation"
  | "crop"
  | "season"

export type RecommendationAction =
  | { type: "split"; parcelId: string; blocks: number; preview: LatLng[][] }
  | { type: "draw-parcel" }
  | { type: "edit-parcel"; parcelId: string; field: "soil" | "water" | "salinity" | "name" }
  | { type: "open-decide"; parcelId: string }
  | { type: "open-calendar" }

export interface Recommendation {
  id: string
  kind: RecommendationKind
  priority: "high" | "medium" | "low"
  title: string
  /** Two sentences at most: what to do, and why it pays. */
  body: string
  /** The measurable upside, e.g. "+18% water efficiency". */
  impact: string | null
  actionLabel: string | null
  action: RecommendationAction | null
}
