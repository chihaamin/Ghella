import { fmt } from "@/lib/utils"
import type {
  ClimateNormals,
  ClimateZone,
  ClimateZoneId,
  DailySeries,
  FrostWindow,
  MonthlyNormal,
  Sky,
  Terrain,
  TextureClass,
  WaterBudget,
} from "@/types/land"

/**
 * Raw measurements → the agronomic facts the app shows.
 *
 * Everything here is pure: same numbers in, same answer out, no fetching and
 * no clock. The services layer owns the network; this file only has to survive
 * what the network hands it, which on a farm phone is regularly a short array,
 * a `null` where a number was promised, or nothing at all. So every exported
 * function has a defined answer for garbage input — an analysis that keeps
 * going and says "unknown" beats one that throws halfway down the screen.
 */

/* ── Small shared helpers ────────────────────────────────────── */

/** Length of an array the network may have handed us short, or not at all. */
function countOf(values: readonly unknown[]): number {
  return Array.isArray(values) ? values.length : 0
}

/** True when a value the types promise is a number really is one. */
function isNum(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value)
}

/** One decimal place — the precision a farmer reads, and small in storage. */
function round1(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0
}

/** Whole units, guarding the NaN an empty average would produce. */
function round0(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0
}

/**
 * Middle value of a sample, averaging the two middles on an even count.
 *
 * Used instead of a mean wherever one freak year would otherwise drag a date
 * across half a month.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/* ── Soil texture ────────────────────────────────────────────── */

/**
 * Nudge three fractions onto whole percentages that still sum to 100.
 *
 * Texture classes are drawn on whole percentages, but SoilGrids reports a
 * decimal: a sample at 26.6 % clay is a clay loam to a soil lab, yet falls a
 * fraction short of the triangle's 27 % boundary if compared as-is. Rounding
 * first — leftover point to the largest remainder, so the three still total
 * 100 — puts boundary samples on the side the lab would put them.
 */
function toWholePercents(sand: number, silt: number, clay: number): [number, number, number] {
  const total = sand + silt + clay
  const scaled = [(sand / total) * 100, (silt / total) * 100, (clay / total) * 100]
  const whole: [number, number, number] = [
    Math.floor(scaled[0]),
    Math.floor(scaled[1]),
    Math.floor(scaled[2]),
  ]
  const byRemainder = [0, 1, 2].sort((a, b) => scaled[b] - whole[b] - (scaled[a] - whole[a]))
  const short = 100 - (whole[0] + whole[1] + whole[2])
  for (let i = 0; i < short; i++) whole[byRemainder[i % 3]] += 1
  return whole
}

/**
 * USDA soil texture class from the three mineral fractions.
 *
 * The inputs are normalised to sum to 100 first, so a SoilGrids pixel reading
 * 44 / 34 / 20 — 98 %, the usual rounding loss — still lands in the right
 * class. The chain below is the standard USDA triangle in its published order:
 * each test may assume every test above it failed, which is why the later ones
 * read shorter than the textbook definitions. Checked exhaustively against all
 * 5,151 integer triples that sum to 100 — every one hits a class, so the
 * closing `loam` is unreachable and exists only to satisfy the return type.
 */
export function textureFromFractions(sandPct: number, siltPct: number, clayPct: number): TextureClass {
  const usable = [sandPct, siltPct, clayPct].every((v) => isNum(v) && v >= 0)
  const total = sandPct + siltPct + clayPct
  // No reading, or a nonsense one: hand back the middle of the triangle. The
  // caller decides whether to show it — `SoilSample.texture` is nullable and
  // `SoilSample.note` is where "we could not tell" belongs.
  if (!usable || total <= 0) return "loam"

  const [sand, silt, clay] = toWholePercents(sandPct, siltPct, clayPct)

  if (silt + 1.5 * clay < 15) return "sand"
  if (silt + 2 * clay < 30) return "loamy sand"
  if ((clay >= 7 && clay < 20 && sand > 52) || (clay < 7 && silt < 50)) return "sandy loam"
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam"
  if (silt >= 50 && clay < 27 && (clay >= 12 || silt < 80)) return "silt loam"
  if (silt >= 80 && clay < 12) return "silt"
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandy clay loam"
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clay loam"
  if (clay >= 27 && clay < 40 && sand <= 20) return "silty clay loam"
  if (clay >= 35 && sand > 45) return "sandy clay"
  if (clay >= 40 && silt >= 40) return "silty clay"
  if (clay >= 40 && sand <= 45 && silt < 40) return "clay"
  return "loam"
}

/**
 * Plant-available water — field capacity minus wilting point — in mm per metre
 * of root depth.
 *
 * Class midpoints of the FAO-56 / USDA-NRCS ranges, which run roughly
 * 55–75 mm/m for sand, 150–190 mm/m for the loams and 180–200 mm/m for silt.
 * Clay sits below silt loam here even though it holds far more total water:
 * most of that water is bound tighter than roots can pull, so what the crop
 * can actually drink peaks in the silts, not at the clay corner.
 */
const WATER_HOLDING_MM_PER_M: Record<TextureClass, number> = {
  sand: 60,
  "loamy sand": 90,
  "sandy loam": 120,
  loam: 170,
  "silt loam": 190,
  silt: 200,
  "sandy clay loam": 140,
  "clay loam": 160,
  "silty clay loam": 180,
  "sandy clay": 130,
  "silty clay": 150,
  clay: 150,
}

/** Plant-available water for a texture, mm per metre of root depth. */
export function waterHoldingFromTexture(texture: TextureClass): number {
  return WATER_HOLDING_MM_PER_M[texture] ?? WATER_HOLDING_MM_PER_M.loam
}

/** Display names — a table rather than string surgery, so i18n can swap it. */
const TEXTURE_LABEL: Record<TextureClass, string> = {
  sand: "Sand",
  "loamy sand": "Loamy sand",
  "sandy loam": "Sandy loam",
  loam: "Loam",
  "silt loam": "Silt loam",
  silt: "Silt",
  "sandy clay loam": "Sandy clay loam",
  "clay loam": "Clay loam",
  "silty clay loam": "Silty clay loam",
  "sandy clay": "Sandy clay",
  "silty clay": "Silty clay",
  clay: "Clay",
}

/** "sandy loam" → "Sandy loam". */
export function textureLabel(texture: TextureClass): string {
  return TEXTURE_LABEL[texture] ?? TEXTURE_LABEL.loam
}

/* ── Climate ─────────────────────────────────────────────────── */

const ZONES: Record<ClimateZoneId, ClimateZone> = {
  arid: {
    id: "arid",
    label: "Arid · desert",
    note: "Rain will not carry a crop to harvest here — everything grown is grown on irrigation.",
  },
  "semi-arid": {
    id: "semi-arid",
    label: "Semi-arid · steppe",
    note: "Rain alone will not finish a summer crop — plan for irrigation.",
  },
  "dry-subhumid": {
    id: "dry-subhumid",
    label: "Dry sub-humid · grassland",
    note: "Winter rain carries a crop most years, but summer plantings still need water on hand.",
  },
  humid: {
    id: "humid",
    label: "Humid · woodland",
    note: "Rain covers most of the season; irrigation is a top-up for the dry spells.",
  },
  "per-humid": {
    id: "per-humid",
    label: "Per-humid · rainforest",
    note: "Water is rarely the limit here — drainage and disease pressure decide the season.",
  },
}

/**
 * UNEP aridity index (AI = P / PET) and the zone it falls in.
 *
 * The index is rounded to three decimals and the bands are read off that same
 * rounded number, so the zone shown never disagrees with the figure printed
 * next to it.
 */
export function classifyAridity(
  annualRainMm: number,
  annualEt0Mm: number
): { index: number; zone: ClimateZone } {
  // Without a usable PET there is nothing to divide by. We fall back to the
  // driest band on purpose: over-planning irrigation costs money, under-
  // planning it costs the crop.
  if (!isNum(annualRainMm) || !isNum(annualEt0Mm) || annualRainMm < 0 || annualEt0Mm <= 0) {
    return { index: 0, zone: ZONES.arid }
  }
  const index = Math.round((annualRainMm / annualEt0Mm) * 1000) / 1000
  if (index < 0.2) return { index, zone: ZONES.arid }
  if (index < 0.5) return { index, zone: ZONES["semi-arid"] }
  if (index < 0.65) return { index, zone: ZONES["dry-subhumid"] }
  if (index <= 1) return { index, zone: ZONES.humid }
  return { index, zone: ZONES["per-humid"] }
}

/** Twelve zeroed months, so the UI can always map over a full year. */
function zeroedMonths(): MonthlyNormal[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    tMinC: 0,
    tMaxC: 0,
    rainMm: 0,
    et0Mm: 0,
  }))
}

/**
 * Ten-ish years of daily archive rows → the normals every other module reads.
 *
 * Annual figures are totals divided by the whole years covered, not daily
 * means scaled up, so a series that starts mid-January is not quietly
 * inflated. Days whose temperature came back null — archive gaps are common at
 * the edges of the record — are skipped for the temperature statistics but
 * still counted for rain, which the provider reports separately.
 *
 * `latitude` is optional and only reaches the frost window, where it settles
 * which half of the year winter sits in. Pass it wherever it is to hand: the
 * frost record alone can be read the wrong way round on a marginal site, and
 * that swaps the spring and autumn dates a planting window is built on.
 */
export function climateNormalsFrom(series: DailySeries, latitude?: number): ClimateNormals {
  const n = Math.min(
    countOf(series?.time),
    countOf(series?.tMaxC),
    countOf(series?.tMinC),
    countOf(series?.rainMm),
    countOf(series?.et0Mm),
    countOf(series?.sunSeconds)
  )

  if (n === 0) {
    const { index, zone } = classifyAridity(0, 0)
    return {
      years: 0,
      annualRainMm: 0,
      annualEt0Mm: 0,
      aridityIndex: index,
      zone,
      meanTempC: 0,
      sunHoursPerYear: 0,
      gddBase10: 0,
      frost: { firstAutumnFrost: null, lastSpringFrost: null, frostFreeDays: null, risk: "none" },
      monthly: zeroedMonths(),
    }
  }

  const calendarYears = new Set<string>()
  const rainByMonth = new Array<number>(12).fill(0)
  const et0ByMonth = new Array<number>(12).fill(0)
  const tMinByMonth = new Array<number>(12).fill(0)
  const tMaxByMonth = new Array<number>(12).fill(0)
  const tempDaysByMonth = new Array<number>(12).fill(0)

  let rainTotal = 0
  let et0Total = 0
  let sunSecondsTotal = 0
  let meanTempTotal = 0
  let gddTotal = 0
  let tempDays = 0

  for (let i = 0; i < n; i++) {
    const date = series.time[i]
    if (typeof date !== "string" || date.length < 10) continue
    const month = Number(date.slice(5, 7))
    if (!Number.isInteger(month) || month < 1 || month > 12) continue
    const m = month - 1
    calendarYears.add(date.slice(0, 4))

    const rain = series.rainMm[i]
    if (isNum(rain) && rain >= 0) {
      rainTotal += rain
      rainByMonth[m] += rain
    }

    const et0 = series.et0Mm[i]
    if (isNum(et0) && et0 >= 0) {
      et0Total += et0
      et0ByMonth[m] += et0
    }

    const sun = series.sunSeconds[i]
    if (isNum(sun) && sun >= 0) sunSecondsTotal += sun

    const tMax = series.tMaxC[i]
    const tMin = series.tMinC[i]
    if (isNum(tMax) && isNum(tMin)) {
      const dayMean = (tMax + tMin) / 2
      meanTempTotal += dayMean
      // GDD base 10: only warmth above 10 °C counts, and a cold day adds
      // nothing rather than a negative.
      gddTotal += Math.max(0, dayMean - 10)
      tempDays += 1
      tMinByMonth[m] += tMin
      tMaxByMonth[m] += tMax
      tempDaysByMonth[m] += 1
    }
  }

  // What annual totals get divided by. Distinct calendar years is the honest
  // headline, but a run that spills three days into a new January would
  // otherwise divide ten years of rain by eleven — so cap it at the whole years
  // the day count can actually support, and never let it reach zero.
  //
  // NEAREST, not floor. A full ten-year window is 3652 days about five times in
  // six (leap years decide), and `services/weather` drops any day with a null
  // reading, so floor(3652 / 365.25) = 9 would inflate every annual total by
  // 11 % on most fetch dates. The cap below is what keeps the rounding honest:
  // a genuine eleven-year record still reports 11 because both terms agree.
  const spanYears = Math.round(n / 365.25)
  // Sub-year records take the same path rather than a special case: the minimum
  // is one whole year, never `calendarYears.size`, which for a ten-month record
  // that crosses New Year is 2 and would halve every figure on this page.
  const years = Math.max(1, Math.min(calendarYears.size, spanYears))

  const annualRainMm = round0(rainTotal / years)
  const annualEt0Mm = round0(et0Total / years)
  const { index, zone } = classifyAridity(annualRainMm, annualEt0Mm)

  const monthly: MonthlyNormal[] = Array.from({ length: 12 }, (_, m) => ({
    month: m + 1,
    tMinC: tempDaysByMonth[m] > 0 ? round1(tMinByMonth[m] / tempDaysByMonth[m]) : 0,
    tMaxC: tempDaysByMonth[m] > 0 ? round1(tMaxByMonth[m] / tempDaysByMonth[m]) : 0,
    // A monthly TOTAL averaged over the years, not a daily mean — this is the
    // number a farmer weighs against a crop's water need for that month.
    rainMm: round1(rainByMonth[m] / years),
    et0Mm: round1(et0ByMonth[m] / years),
  }))

  return {
    years,
    annualRainMm,
    annualEt0Mm,
    aridityIndex: index,
    zone,
    meanTempC: tempDays > 0 ? round1(meanTempTotal / tempDays) : 0,
    sunHoursPerYear: round0(sunSecondsTotal / 3600 / years),
    gddBase10: round0(gddTotal / years),
    frost: frostWindowFrom(series.time.slice(0, n), series.tMinC.slice(0, n), latitude),
    monthly,
  }
}

/* ── Frost ───────────────────────────────────────────────────── */

/** Days before the 1st of each month in a fixed 365-day calendar. */
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
const DAYS_IN_YEAR = 365
/** Day 1–182 is the first half of the (possibly rotated) year. */
const HALF_YEAR = 182
/** 1 July in the fixed calendar — where a mid-year-winter site starts its year. */
const SOUTHERN_PIVOT = MONTH_START[6] + 1

/**
 * "YYYY-MM-DD" → day of a fixed 365-day year, or null if it is not a date.
 *
 * Deliberately string maths rather than `new Date(...)`: parsing an ISO date on
 * a phone west of Greenwich lands on the previous day at local midnight, which
 * would shift every frost date by one. 29 February collapses onto 1 March, the
 * same slot — exactly what is wanted when averaging a date across leap and
 * common years.
 */
function dayOfYear(date: string): number | null {
  if (typeof date !== "string" || date.length < 10) return null
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  return MONTH_START[month - 1] + day
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

/** Day of the fixed year → "MM-DD". */
function monthDayFromDoy(doy: number): string {
  const d = Math.min(DAYS_IN_YEAR, Math.max(1, Math.round(doy)))
  for (let m = 11; m >= 0; m--) {
    if (d > MONTH_START[m]) return `${pad2(m + 1)}-${pad2(d - MONTH_START[m])}`
  }
  return "01-01"
}

/** Rotate a day of the year so `offset` becomes day 1; offset 1 is identity. */
function rotate(doy: number, offset: number): number {
  return ((doy - offset + DAYS_IN_YEAR) % DAYS_IN_YEAR) + 1
}

/** Inverse of `rotate`. */
function unrotate(rotated: number, offset: number): number {
  return ((rotated - 1 + offset - 1) % DAYS_IN_YEAR) + 1
}

/** Below this many frost days the distribution is noise, not a season. */
const HEMISPHERE_MIN_FROST_DAYS = 30
/**
 * Share of frost days that must fall in 1 Apr – 30 Sep before the record alone
 * is allowed to call a site southern. A real mid-year winter puts nearly all of
 * them there; a bare majority is what a northern site with a cold late spring
 * produces, and acting on that inverts its seasons.
 */
const HEMISPHERE_MAJORITY = 0.75
/** Within this of the equator the sign of the latitude decides nothing useful. */
const EQUATORIAL_BAND_DEG = 5

/**
 * Does winter sit in the middle of the calendar year at this site?
 *
 * Latitude answers it outright wherever it is known and the site is clear of
 * the equator. Only without that does the frost distribution get a say, and
 * then only on a sample big enough to be a pattern — under thirty frost days
 * across the record a couple of late-spring frosts would otherwise flip the
 * whole year over.
 */
function midYearWinter(
  latitude: number | undefined,
  frostDays: number,
  midYearFrosts: number
): boolean {
  if (typeof latitude === "number" && Number.isFinite(latitude)) {
    if (Math.abs(latitude) >= EQUATORIAL_BAND_DEG) return latitude < 0
  }
  return (
    frostDays >= HEMISPHERE_MIN_FROST_DAYS &&
    midYearFrosts >= frostDays * HEMISPHERE_MAJORITY
  )
}

/**
 * The frost window for a site, from daily minimum temperatures.
 *
 * A frost day is tMin ≤ 0 °C. Within each frost year the last spring frost is
 * the latest frost day in the first half, the first autumn frost the earliest
 * in the second half, and the reported dates are the MEDIAN of those across
 * years — one freak May frost should not move a planting date for a decade.
 *
 * Southern hemisphere: winter sits mid-year there, so a January–June /
 * July–December split would cut the frost season in half and report both dates
 * out of the same winter. Such a site has its calendar rotated to start on
 * 1 July, the same first-half / second-half work runs in that frame, and the
 * answer is rotated back. The assumption is one frost season per year, which
 * holds anywhere a crop is worth planting.
 *
 * WHICH hemisphere is decided by `latitude` when the caller knows it, and only
 * falls back to the frost record otherwise. Reading the record alone is
 * genuinely unsafe: a northern site whose frost clusters in late spring can put
 * over half its frost days inside 1 April – 30 September and trip the southern
 * pivot, which swaps the two dates and roughly halves `frostFreeDays`. The
 * fallback is therefore also gated on a real sample — a handful of April
 * frosts in ten years must not be allowed to invert the seasons, and neither
 * must a bare majority of them.
 */
export function frostWindowFrom(
  dates: string[],
  tMinC: number[],
  latitude?: number
): FrostWindow {
  const n = Math.min(countOf(dates), countOf(tMinC))
  const noFrost: FrostWindow = {
    firstAutumnFrost: null,
    lastSpringFrost: null,
    frostFreeDays: null,
    risk: "none",
  }
  if (n === 0) return noFrost

  const doys: number[] = []
  const years: string[] = []
  const froze: boolean[] = []
  let frostDays = 0
  let midYearFrosts = 0

  for (let i = 0; i < n; i++) {
    const date = dates[i]
    const doy = dayOfYear(date)
    if (doy === null) continue
    const tMin = tMinC[i]
    const isFrost = isNum(tMin) && tMin <= 0
    doys.push(doy)
    years.push(date.slice(0, 4))
    froze.push(isFrost)
    if (!isFrost) continue
    frostDays += 1
    // 1 April – 30 September: the half of the calendar a southern winter lives in.
    if (doy >= 92 && doy <= 273) midYearFrosts += 1
  }

  if (doys.length === 0) return noFrost
  // Never froze across the whole record: the entire year is frost-free.
  if (frostDays === 0) return { ...noFrost, frostFreeDays: DAYS_IN_YEAR }

  const offset = midYearWinter(latitude, frostDays, midYearFrosts) ? SOUTHERN_PIVOT : 1
  const frostDaysPerYear = new Map<string, number>()
  const springs = new Map<string, number>()
  const autumns = new Map<string, number>()

  for (let i = 0; i < doys.length; i++) {
    const doy = doys[i]
    // On a rotated calendar the frost year starts in July, so January–June
    // days belong to the season that began the previous summer.
    const key = offset === 1 || doy >= offset ? years[i] : `${Number(years[i]) - 1}`
    frostDaysPerYear.set(key, frostDaysPerYear.get(key) ?? 0)
    if (!froze[i]) continue
    frostDaysPerYear.set(key, (frostDaysPerYear.get(key) ?? 0) + 1)
    const rotated = rotate(doy, offset)
    if (rotated <= HALF_YEAR) {
      springs.set(key, Math.max(springs.get(key) ?? 0, rotated))
    } else {
      autumns.set(key, Math.min(autumns.get(key) ?? DAYS_IN_YEAR, rotated))
    }
  }

  const springValues = [...springs.values()]
  const autumnValues = [...autumns.values()]
  const lastSpringRot = springValues.length > 0 ? Math.round(median(springValues)) : null
  const firstAutumnRot = autumnValues.length > 0 ? Math.round(median(autumnValues)) : null

  // Frost days in a typical year, counting frost-free years as zero. Fifteen
  // is where a site needs real protection rather than a watchful eye.
  const typicalFrostDays = median([...frostDaysPerYear.values()])

  return {
    lastSpringFrost:
      lastSpringRot === null ? null : monthDayFromDoy(unrotate(lastSpringRot, offset)),
    firstAutumnFrost:
      firstAutumnRot === null ? null : monthDayFromDoy(unrotate(firstAutumnRot, offset)),
    // Measured in the rotated frame, where autumn always follows spring, so a
    // southern season that crosses New Year still comes out positive.
    frostFreeDays:
      lastSpringRot === null || firstAutumnRot === null ? null : firstAutumnRot - lastSpringRot,
    risk: typicalFrostDays >= 15 ? "hard" : "light",
  }
}

/* ── Terrain ─────────────────────────────────────────────────── */

const OCTANTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const

/**
 * Slope and aspect from the 5-point elevation stencil
 * `[centre, north, east, south, west]` that `geo.samplePointsAround` builds.
 *
 * Central differences over the stencil give the two partial derivatives, and
 * the slope is their magnitude as a percent grade. The gradient points UPHILL,
 * so the aspect — the way the ground falls, which is what decides frost
 * drainage and afternoon sun — is the compass bearing of its negative. Under
 * 0.5 % that direction is noise in the elevation model rather than a real lie
 * of the land, so it is reported as null.
 */
export function slopeFromStencil(elevations: number[], radiusM: number): Terrain {
  const centre = countOf(elevations) > 0 && isNum(elevations[0]) ? elevations[0] : 0
  const flat: Terrain = { elevationM: centre, slopePct: 0, aspect: null }
  if (countOf(elevations) < 5 || !isNum(radiusM) || radiusM <= 0) return flat

  const north = elevations[1]
  const east = elevations[2]
  const south = elevations[3]
  const west = elevations[4]
  if (!isNum(north) || !isNum(east) || !isNum(south) || !isNum(west)) return flat

  const dzdy = (north - south) / (2 * radiusM)
  const dzdx = (east - west) / (2 * radiusM)
  // Round before the aspect test so a slope printed as "0.5 %" always has a
  // direction beside it, and one printed as "0.4 %" never does.
  const slopePct = round1(Math.hypot(dzdx, dzdy) * 100)
  if (slopePct < 0.5) return { elevationM: centre, slopePct, aspect: null }

  const bearing = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI
  const octant = Math.round(((bearing + 360) % 360) / 45) % 8
  return { elevationM: centre, slopePct, aspect: OCTANTS[octant] }
}

/* ── Sky ─────────────────────────────────────────────────────── */

/**
 * WMO weather code → the three-way icon the app draws.
 *
 * Snow, hail and thunder all fold into "rain" because `Sky` has no fourth
 * state and, for the question the icon answers — can I work the field today —
 * falling water and falling snow mean the same thing. Fog (45, 48) stays
 * "cloud": grey, but dry.
 */
export function skyFromWmoCode(code: number): Sky {
  if (!isNum(code) || code < 0) return "cloud"
  if (code <= 1) return "sun"
  if (code <= 48) return "cloud"
  return "rain"
}

/* ── Dates ───────────────────────────────────────────────────── */

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * "12-08" → "Dec 8". Null, or anything that is not a month-day, → "—".
 *
 * The reference year is a leap year and the formatter is pinned to UTC: build
 * the date any other way and a phone set west of Greenwich renders "12-08" as
 * "Dec 7". The catch is not defensive padding — a trimmed ICU build, common on
 * cheap Android handsets, throws `RangeError` on a locale tag it does not
 * carry, and a frost date is too useful to lose over a missing locale.
 */
export function monthDayLabel(monthDay: string | null, locale = "en-US"): string {
  if (typeof monthDay !== "string" || !/^\d{2}-\d{2}$/.test(monthDay)) return "—"
  const month = Number(monthDay.slice(0, 2))
  const day = Number(monthDay.slice(3, 5))
  if (month < 1 || month > 12 || day < 1 || day > MONTH_LENGTHS[month - 1]) return "—"
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    return formatter.format(new Date(Date.UTC(2000, month - 1, day)))
  } catch {
    return `${MONTH_ABBR[month - 1]} ${day}`
  }
}

/* ── Water ───────────────────────────────────────────────────── */

/** The one sentence printed under the water figures. */
function budgetNote(seasonNeedM3: number, availableM3: number | null): string {
  if (seasonNeedM3 <= 0) return "Not enough information yet to size this season's water."
  if (availableM3 === null) {
    return `This season needs about ${fmt(seasonNeedM3)} m³; no water source on file yet.`
  }
  const deficit = seasonNeedM3 - availableM3
  if (deficit > 0) {
    return `Short by ${fmt(deficit)} m³ — the season needs ${fmt(seasonNeedM3)} m³ and the source gives ${fmt(availableM3)} m³.`
  }
  // Under a 15 % margin one hot week eats the buffer, so it is called tight
  // rather than covered.
  if (availableM3 >= seasonNeedM3 * 1.15) {
    return `Comfortably covered — ${fmt(seasonNeedM3)} m³ needed against ${fmt(availableM3)} m³ available.`
  }
  return `Tight — ${fmt(seasonNeedM3)} m³ needed against ${fmt(availableM3)} m³ available, with little to spare.`
}

/**
 * Season water need for a parcel, weighed against what the source delivers.
 *
 * Both volumes are rounded to whole m³ before the deficit is taken, so the
 * three numbers in the note always add up on screen.
 */
export function waterBudget(input: {
  seasonNeedMm: number
  areaHa: number
  availableM3: number | null
}): WaterBudget {
  const seasonNeedMm = isNum(input?.seasonNeedMm) && input.seasonNeedMm > 0 ? input.seasonNeedMm : 0
  const areaHa = isNum(input?.areaHa) && input.areaHa > 0 ? input.areaHa : 0
  const available = input?.availableM3
  const availableM3 =
    available !== null && available !== undefined && isNum(available) && available >= 0
      ? Math.round(available)
      : null

  // 1 mm of water over 1 ha is 10 m³ — 0.001 m of depth × 10,000 m².
  const seasonNeedM3 = Math.round(seasonNeedMm * areaHa * 10)

  return {
    seasonNeedMm: round1(seasonNeedMm),
    seasonNeedM3,
    availableM3,
    deficitM3: availableM3 === null ? null : Math.max(0, seasonNeedM3 - availableM3),
    note: budgetNote(seasonNeedM3, availableM3),
  }
}
