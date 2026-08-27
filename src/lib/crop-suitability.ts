/**
 * Scores a site against the bundled FAO EcoCrop envelopes and ranks the crops
 * that fit it.
 *
 * Two rules shape everything below.
 *
 * 1. MISSING DATA IS NOT A BAD SCORE. Each dimension becomes a `MatchFactor`
 *    only when the site actually supplies the reading it needs, and `score` is
 *    the weighted mean of the factors that are PRESENT, with their weights
 *    renormalised to sum to 1. A parcel with unknown soil is therefore judged
 *    honestly on its climate instead of being punished for a soil probe that
 *    never answered. This is the crux of the design: the app runs offline on a
 *    phone in a field, so half-known sites are the normal case, not the edge
 *    case.
 *
 * 2. GRADED RAMPS, NEVER STEPS. Full marks anywhere inside the optimal band,
 *    then a straight line down to 0 at the absolute limit, and 0 past it. A
 *    site one degree outside the optimum should lose a point, not the crop.
 *
 * `blockers` sit outside the score: they are the hard stops a farmer would
 * want shouted at them, and any crop carrying one is rated "unsuitable" no
 * matter how well it scored on everything else.
 */

import type {
  ClimateNormals,
  CropMatch,
  CropRating,
  MatchFactor,
  MonthlyNormal,
  SoilSample,
  Terrain,
  TextureClass,
} from "@/types/land"
import type { CropEnvelope } from "@/data/ecocrop"
import { ECOCROP } from "@/data/ecocrop"
import { monthDayLabel as formatMonthDay } from "@/lib/agronomy"
import { fmt } from "@/lib/utils"

export interface SiteConditions {
  climate: ClimateNormals | null
  soil: SoilSample
  terrain: Terrain | null
  latitude: number
}

/**
 * Base importance of each dimension. These never reach the UI as-is — only
 * the factors present get through, and their weights are divided by their own
 * sum so the survivors always add up to 1.
 */
const BASE_WEIGHT = {
  temperature: 0.3,
  rainfall: 0.2,
  soil: 0.15,
  ph: 0.1,
  frost: 0.15,
  season: 0.1,
} as const

/**
 * Where each texture class sits in the USDA triangle, as `[sand %, clay %]` at
 * the middle of its wedge.
 *
 * Two coordinates, not one. Texture varies along two INDEPENDENT axes —
 * how coarse the mineral skeleton is, and how much clay binds it — and a single
 * coarse-to-fine ordering collapses them onto one line, where they collide: a
 * sandy clay loam (60 % sand) lands further from sand than a silt does, so a
 * groundnut used to be told a pure silt suited it better than a sandy clay
 * loam. Distance in the plane keeps the graded ramp without that inversion.
 */
const TEXTURE_CENTROID: Record<TextureClass, [number, number]> = {
  sand: [92, 3],
  "loamy sand": [82, 6],
  "sandy loam": [65, 10],
  loam: [40, 18],
  "silt loam": [21, 14],
  silt: [7, 5],
  "sandy clay loam": [60, 27],
  "clay loam": [33, 34],
  "silty clay loam": [10, 34],
  "sandy clay": [52, 42],
  "silty clay": [7, 47],
  clay: [22, 58],
}

/**
 * Distance in the triangle at which a soil scores zero for a crop. Roughly the
 * span from the sand corner to the clay corner, so opposite corners are a rout
 * and a neighbouring class is a deduction of twenty-odd points.
 */
const TEXTURE_MAX_DISTANCE = 70

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Days elapsed before the 1st of each month in a non-leap year. */
const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

/** A crop is treated as perennial once its cycle spans most of a year. */
const PERENNIAL_DAYS = 300

/**
 * How far outside its absolute pH band a crop has to be before that becomes a
 * hard stop. A modelled SoilGrids pH carries roughly ±0.5 of uncertainty, so
 * telling a farmer their ground is unusable because it read 7.6 against a
 * limit of 7.5 would be false precision. The score still ramps to 0 at the
 * limit — only the shouted blocker waits for a real overshoot.
 */
const PH_BLOCK_MARGIN = 0.3

/**
 * How far below the coldest month's AVERAGE low to reckon on a hard winter, °C.
 *
 * `MonthlyNormal.tMinC` is a ten-year mean of daily minima, but `tempAbsC[0]`
 * is an absolute: the night that kills the tree. Comparing one to the other
 * reads ten to fifteen degrees optimistic and would let an olive through in a
 * place whose Januaries routinely touch -10 °C. Seven degrees is about the gap
 * between a mean January low and the average annual extreme minimum — the same
 * quantity a USDA hardiness zone is drawn on.
 */
const HARD_WINTER_MARGIN_C = 7

/* ── small helpers ───────────────────────────────────────────── */

function clamp(n: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, n))
}

/** Every factor score is an integer 0–100, so the bars in the UI line up. */
function pct(n: number) {
  return Math.round(clamp(Number.isFinite(n) ? n : 0))
}

/** Reject NaN/Infinity/null in one place, so a half-parsed API reply can't score. */
function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function monthAbbr(month: number) {
  return MONTH_ABBR[(((month - 1) % 12) + 12) % 12]
}

function deg(n: number) {
  return `${Math.round(n)} °C`
}

/** "20–27 °C", but "-9 to 45 °C" once a dash would read as a minus sign. */
function degRange([lo, hi]: [number, number]) {
  const a = Math.round(lo)
  const b = Math.round(hi)
  return a < 0 ? `${a} to ${b} °C` : `${a}–${b} °C`
}

function mm(n: number) {
  return `${fmt(n)} mm`
}

function mmRange([lo, hi]: [number, number]) {
  return `${fmt(lo)}–${fmt(hi)} mm`
}

/** "sandy loam, loam or silt loam" — capped at three so the sentence stays readable. */
function joinList(items: string[]) {
  const head = items.slice(0, 3)
  if (head.length === 0) return "most soils"
  if (head.length === 1) return head[0]
  return `${head.slice(0, -1).join(", ")} or ${head[head.length - 1]}`
}

/**
 * "12-08" → "Dec 8", or null on anything that is not a real month-day.
 *
 * The formatting itself belongs to `lib/agronomy`, which pins the date to UTC
 * so a phone west of Greenwich does not render frost dates a day early and
 * survives the trimmed ICU builds cheap Android handsets ship with. All this
 * wrapper adds is the null the callers below want in place of its em dash,
 * because "no date" here has to leave a sentence out rather than print a gap.
 */
function monthDayLabel(md: string | null): string | null {
  const label = formatMonthDay(md)
  return label === "—" ? null : label
}

/** "12-08" → 342, day-of-year in a non-leap year. Null when unparseable. */
function monthDayToDoy(md: string | null): number | null {
  if (!md) return null
  const parts = md.split("-")
  if (parts.length !== 2) return null
  const month = Number(parts[0])
  const day = Number(parts[1])
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return CUM_DAYS[month - 1] + day
}

/**
 * The graded ramp every numeric factor uses: 100 inside `opt`, sliding
 * linearly to 0 at the matching edge of `abs`, and 0 outside it.
 */
function ramp(value: number, opt: [number, number], abs: [number, number]) {
  const [optLo, optHi] = opt
  const [absLo, absHi] = abs
  if (value >= optLo && value <= optHi) return 100
  if (value < optLo) {
    if (value <= absLo || optLo <= absLo) return 0
    return Math.round(((value - absLo) / (optLo - absLo)) * 100)
  }
  if (value >= absHi || absHi <= optHi) return 0
  return Math.round(((absHi - value) / (absHi - optHi)) * 100)
}

function meanTempC(m: MonthlyNormal) {
  return (m.tMinC + m.tMaxC) / 2
}

/**
 * The mean-temperature band the crop can actually GROW in, `[floor, ceiling]`.
 *
 * The ceiling is `tempAbsC[1]`, which means what it says. The floor is NOT
 * `tempAbsC[0]`: for a perennial that number is the temperature that kills the
 * tree, ten to twenty degrees below the one at which it stops growing. Feeding
 * the kill temperature to the ramp is what let a grapevine score 59 on a 4.6 °C
 * annual mean, sit at a flat 100 for season length, and print "-15 to 40 °C" to
 * the farmer as if it were a growing range. Annuals are unaffected — for them
 * the two numbers really are the same, and `tempGrowMinC` is left unset.
 *
 * The `tempOptC[0] - 5` fallback only bites if a perennial is ever added to the
 * table without its own floor: too strict rather than too generous, on purpose.
 */
function growthBandC(envelope: CropEnvelope): [number, number] {
  const explicit = num(envelope.tempGrowMinC)
  const floor =
    explicit ?? (envelope.cycleDays >= PERENNIAL_DAYS ? envelope.tempOptC[0] - 5 : envelope.tempAbsC[0])
  return [floor, envelope.tempAbsC[1]]
}

/** Monthly normals, cleaned of unusable rows and put in calendar order. */
function usableMonths(climate: ClimateNormals | null): MonthlyNormal[] {
  if (!climate || !Array.isArray(climate.monthly)) return []
  return climate.monthly
    .filter((m) => num(m.tMinC) !== null && num(m.tMaxC) !== null && num(m.month) !== null)
    .slice()
    .sort((a, b) => a.month - b.month)
}

/* ── temperature fit ─────────────────────────────────────────── */

interface TempWindow {
  meanC: number
  /** 1–12. */
  startMonth: number
  /** Length in whole months. */
  months: number
  score: number
}

interface TempFit {
  best: TempWindow
  warmestMeanC: number
  coolestMeanC: number
}

/**
 * Slides a window as long as the crop's cycle around the calendar and keeps
 * the best-scoring position.
 *
 * Scoring an annual against the *annual* mean would be nonsense — a maize crop
 * does not care what January is like if it is sown in May. So the temperature
 * factor asks the only question that matters: is there a stretch of the year,
 * long enough to finish this crop, that sits in its band? The warmest and
 * coolest windows come back too, because those are what a "too cold here"
 * blocker has to quote to be believable.
 */
function tempFit(months: MonthlyNormal[], envelope: CropEnvelope): TempFit | null {
  const n = months.length
  if (n === 0) return null
  const span = Math.min(n, Math.max(1, Math.round(envelope.cycleDays / 30.4)))
  const band = growthBandC(envelope)
  let best: TempWindow | null = null
  let warmest = -Infinity
  let coolest = Infinity
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let k = 0; k < span; k++) sum += meanTempC(months[(i + k) % n])
    const meanC = sum / span
    if (meanC > warmest) warmest = meanC
    if (meanC < coolest) coolest = meanC
    const score = ramp(meanC, envelope.tempOptC, band)
    if (!best || score > best.score) best = { meanC, startMonth: months[i].month, months: span, score }
  }
  if (!best) return null
  return { best, warmestMeanC: warmest, coolestMeanC: coolest }
}

/** Rough days per year whose mean temperature the crop can grow at all in. */
function growableDays(months: MonthlyNormal[], envelope: CropEnvelope) {
  if (months.length === 0) return 0
  const [floor, ceiling] = growthBandC(envelope)
  const inRange = months.filter((m) => meanTempC(m) >= floor && meanTempC(m) <= ceiling).length
  return Math.round((inRange / months.length) * 365)
}

/* ── soil fit ────────────────────────────────────────────────── */

/**
 * 100 on a texture the crop likes, then a straight ramp down over the distance
 * to the nearest liked class in the texture triangle — so sandy loam against a
 * crop that wants loam is a deduction, and clay against a crop that wants sand
 * is a rout.
 */
function textureScore(texture: TextureClass, liked: TextureClass[]) {
  const here = TEXTURE_CENTROID[texture]
  if (!here) return 50
  let nearest = Infinity
  for (const t of liked) {
    const there = TEXTURE_CENTROID[t]
    if (!there) continue
    nearest = Math.min(nearest, Math.hypot(there[0] - here[0], there[1] - here[1]))
  }
  // A crop with no recognised soil preference gets a neutral 50 rather than a
  // zero it has done nothing to earn.
  if (!Number.isFinite(nearest)) return 50
  return pct(100 * (1 - nearest / TEXTURE_MAX_DISTANCE))
}

/* ── the public API ──────────────────────────────────────────── */

/** Bands the whole app reads scores in. Blockers override this — see `matchCrops`. */
export function ratingFromScore(score: number): CropRating {
  if (score >= 75) return "excellent"
  if (score >= 60) return "good"
  if (score >= 40) return "marginal"
  return "unsuitable"
}

/**
 * Months (1–12) it makes sense to plant this crop at this site: the monthly
 * normal sits inside the crop's OPTIMAL temperature band, and — for anything a
 * frost kills — the sowing falls AFTER the last spring frost and the whole
 * cycle still finishes before the first autumn one.
 *
 * Both ends of the frost window matter, and only checking the far one is worse
 * than checking neither: a 110-day potato on a steppe site with frost to 25 May
 * and a 15 September deadline passes the deadline test in May and is then the
 * only month offered, so the app's single sowing recommendation lands inside
 * the frost season it just printed on the card above.
 *
 * `latitude` flips the hemisphere. Where the climate record knows its frost
 * dates they already carry the right sense of the year and are used directly;
 * `latitude` only decides the fallback midwinter (mid-January north of the
 * equator, mid-July south of it) for sites that report frost without dates.
 *
 * Returns [] when there is no climate to reason from — an empty planting
 * window is the honest answer offline, not a guess.
 */
export function plantingMonthsFor(
  envelope: CropEnvelope,
  climate: ClimateNormals | null,
  latitude: number,
): number[] {
  const months = usableMonths(climate)
  if (months.length === 0) return []

  const [optLo, optHi] = envelope.tempOptC
  const warmEnough = months.filter((m) => meanTempC(m) >= optLo && meanTempC(m) <= optHi)
  if (!envelope.frostSensitive || !climate) return warmEnough.map((m) => m.month)

  const risk = climate.frost?.risk ?? "none"
  if (risk === "none") return warmEnough.map((m) => m.month)

  // Prefer the recorded first autumn frost; fall back to the hemisphere's
  // midwinter when frost is known to happen but the date was never resolved.
  const midwinterDoy = latitude >= 0 ? CUM_DAYS[0] + 15 : CUM_DAYS[6] + 15
  const deadline = monthDayToDoy(climate.frost?.firstAutumnFrost ?? null) ?? midwinterDoy
  const lastSpring = monthDayToDoy(climate.frost?.lastSpringFrost ?? null)
  // Length of the frost-free arc. Measured forward from the spring date so a
  // southern season that crosses New Year still comes out positive.
  const frostFreeSpan = lastSpring === null ? null : arc(lastSpring, deadline)

  return warmEnough
    .filter((m) => {
      const sowDoy = CUM_DAYS[m.month - 1] + 1
      if (arc(sowDoy, deadline) < envelope.cycleDays) return false
      // The sowing must already be past the last spring frost: inside the arc
      // that runs from it to the autumn deadline, not before its start.
      if (lastSpring === null || frostFreeSpan === null) return true
      return arc(lastSpring, sowDoy) <= frostFreeSpan
    })
    .map((m) => m.month)
}

/** Days from `from` to `to` going forward round a 365-day year. */
function arc(from: number, to: number): number {
  return (((to - from) % 365) + 365) % 365
}

/**
 * Ranks every bundled crop against the site, best first, capped at `limit`.
 *
 * Works with `climate: null` and `soil.source === "unknown"`: crops for which
 * NOTHING can be measured are dropped rather than scored at zero, so an
 * offline parcel returns an empty list instead of a page of confident-looking
 * nonsense.
 */
export function matchCrops(site: SiteConditions, limit = 12): CropMatch[] {
  const matches: CropMatch[] = []
  for (const envelope of ECOCROP) {
    const match = scoreCrop(envelope, site)
    if (match) matches.push(match)
  }
  matches.sort(bestFirst)
  return matches.slice(0, Math.max(0, limit))
}

/** Blocked crops sink below everything scoreable; ties break by name so the list is stable. */
function bestFirst(a: CropMatch, b: CropMatch) {
  const blocked = (a.blockers.length > 0 ? 1 : 0) - (b.blockers.length > 0 ? 1 : 0)
  if (blocked !== 0) return blocked
  if (b.score !== a.score) return b.score - a.score
  return a.name.localeCompare(b.name)
}

/* ── scoring one crop ────────────────────────────────────────── */

function scoreCrop(envelope: CropEnvelope, site: SiteConditions): CropMatch | null {
  const { climate, soil, terrain, latitude } = site
  const months = usableMonths(climate)
  const factors: MatchFactor[] = []
  const blockers: string[] = []
  const perennial = envelope.cycleDays >= PERENNIAL_DAYS
  const slopePct = terrain ? num(terrain.slopePct) : null

  /* temperature — scored on the best window of the year, not the annual mean */
  const fit = tempFit(months, envelope)
  if (fit) {
    const { best } = fit
    const where =
      best.months >= 12
        ? "the year here averages"
        : `its best ${best.months}-month stretch here (${monthAbbr(best.startMonth)}–${monthAbbr(
            best.startMonth + best.months - 1,
          )}) averages`
    factors.push({
      key: "temperature",
      label: "Temperature",
      score: best.score,
      weight: BASE_WEIGHT.temperature,
      note: `Wants ${degRange(envelope.tempOptC)}; ${where} ${deg(best.meanC)}.`,
    })
    // Against the GROWTH floor, not the kill temperature: a tree that survives
    // -15 °C still makes no wood in a year that never reaches 10 °C.
    if (fit.warmestMeanC < growthBandC(envelope)[0]) {
      blockers.push(
        `Too cold: it grows at ${degRange(envelope.tempOptC)} and the warmest stretch of the year here averages ${deg(fit.warmestMeanC)}.`,
      )
    } else if (fit.coolestMeanC > envelope.tempAbsC[1]) {
      blockers.push(
        `Too hot: it grows at ${degRange(envelope.tempOptC)} and even the mildest stretch here averages ${deg(fit.coolestMeanC)}.`,
      )
    }
  }

  /* rainfall — what falls out of the sky, before anyone opens a valve */
  const rain = climate ? num(climate.annualRainMm) : null
  if (rain !== null) {
    factors.push({
      key: "rainfall",
      label: "Rainfall",
      score: ramp(rain, envelope.rainOptMm, envelope.rainAbsMm),
      weight: BASE_WEIGHT.rainfall,
      note: `Wants ${mmRange(envelope.rainOptMm)} a year; this site gets ${mm(rain)}.`,
    })
    if (rain < envelope.rainAbsMm[0]) {
      blockers.push(
        `Needs at least ${mm(envelope.rainAbsMm[0])} a season; this site gets ${mm(rain)}, so it only works under irrigation.`,
      )
    } else if (rain > envelope.rainAbsMm[1]) {
      blockers.push(
        `Too wet: ${mm(rain)} a year against the ${mm(envelope.rainAbsMm[1])} this crop can take before disease takes over.`,
      )
    }
  }

  /* soil texture — the farmer's own reading outranks the model's guess upstream */
  if (soil.texture) {
    const steep = slopePct !== null && slopePct > 15 && !perennial
    factors.push({
      key: "soil",
      label: "Soil",
      score: textureScore(soil.texture, envelope.textures),
      weight: BASE_WEIGHT.soil,
      note: steep
        ? `Likes ${joinList(envelope.textures)}; yours is ${soil.texture}, on a ${Math.round(slopePct)}% slope that will erode under a row crop.`
        : `Likes ${joinList(envelope.textures)}; yours is ${soil.texture}.`,
    })
  }

  /* pH */
  const ph = num(soil.ph)
  if (ph !== null) {
    factors.push({
      key: "ph",
      label: "Soil pH",
      score: ramp(ph, envelope.phOpt, envelope.phAbs),
      weight: BASE_WEIGHT.ph,
      note: `Happiest at pH ${envelope.phOpt[0].toFixed(1)}–${envelope.phOpt[1].toFixed(1)}; your soil is pH ${ph.toFixed(1)}.`,
    })
    if (ph < envelope.phAbs[0] - PH_BLOCK_MARGIN) {
      blockers.push(
        `Soil pH ${ph.toFixed(1)} is below this crop's floor of ${envelope.phAbs[0].toFixed(1)} — lime the ground before you sow.`,
      )
    } else if (ph > envelope.phAbs[1] + PH_BLOCK_MARGIN) {
      blockers.push(
        `Soil pH ${ph.toFixed(1)} is past this crop's ceiling of ${envelope.phAbs[1].toFixed(1)}; it will starve of iron and zinc whatever you feed it.`,
      )
    }
  }

  /* frost — a different question for an annual that dies and a tree that doesn't */
  if (climate) {
    const frost = climate.frost
    const risk = frost?.risk ?? "none"
    const frostFree = num(frost?.frostFreeDays ?? null)
    const first = monthDayLabel(frost?.firstAutumnFrost ?? null)
    const last = monthDayLabel(frost?.lastSpringFrost ?? null)
    const frostWindow = last && first ? ` (${last} to ${first})` : ""

    if (envelope.frostSensitive) {
      if (frostFree === null) {
        // Null frost-free days means the record found no frost at all.
        factors.push({
          key: "frost",
          label: "Frost",
          score: risk === "none" ? 100 : 50,
          weight: BASE_WEIGHT.frost,
          note:
            risk === "none"
              ? "One frost ends it, and this site has no frost on record."
              : "One frost ends it, and this site sees frost, but the dates are not known.",
        })
      } else {
        const margin = frostFree - envelope.cycleDays
        factors.push({
          key: "frost",
          label: "Frost",
          score: pct((margin / 45) * 100),
          weight: BASE_WEIGHT.frost,
          note: `One frost ends it. It needs ${envelope.cycleDays} days and this site is frost-free for ${frostFree}${frostWindow}.`,
        })
        if (margin < 0) {
          blockers.push(
            `Frost-sensitive and needs ${envelope.cycleDays} days in the ground; this site is frost-free for only ${frostFree} days${frostWindow}.`,
          )
        }
      }
    } else if (perennial) {
      // A tree lives through winter, so what matters is the coldest night it
      // meets — not the average of a month of them. The normals only carry the
      // average, so the design low is that minus a hard-winter margin; scoring
      // the mean directly is what let an olive pass in a place whose real
      // Januaries reach -10 °C.
      const coldestMean = months.length > 0 ? Math.min(...months.map((m) => m.tMinC)) : null
      const absLo = envelope.tempAbsC[0]
      if (coldestMean !== null) {
        const designLow = coldestMean - HARD_WINTER_MARGIN_C
        factors.push({
          key: "frost",
          label: "Winter cold",
          score: pct(((designLow - absLo) / 5) * 100),
          weight: BASE_WEIGHT.frost,
          note: `Survives down to ${deg(absLo)}; the coldest month here averages a low of ${deg(coldestMean)}, so reckon on about ${deg(designLow)} in a hard winter.`,
        })
        if (designLow < absLo) {
          blockers.push(
            `A hard winter here reaches about ${deg(designLow)}, below the ${deg(absLo)} that kills ${envelope.name.toLowerCase()}.`,
          )
        }
      }
    } else {
      factors.push({
        key: "frost",
        label: "Frost",
        score: 100,
        weight: BASE_WEIGHT.frost,
        note: "Takes light frost, so the frost window here is not a limit for it.",
      })
    }
  }

  /* season length — enough days at a temperature it can actually grow at */
  if (months.length > 0) {
    const days = growableDays(months, envelope)
    factors.push({
      key: "season",
      label: "Season length",
      score: pct((days / envelope.cycleDays) * 100),
      weight: BASE_WEIGHT.season,
      note: `Needs ${envelope.cycleDays} days; about ${days} days a year here sit inside its ${degRange(growthBandC(envelope))} growing range.`,
    })
  }

  /* terrain is a hard stop rather than a factor: no score saves a 35% slope */
  if (slopePct !== null && slopePct > 30 && !perennial) {
    blockers.push(
      `Slope is ${Math.round(slopePct)}% — too steep to work an annual crop safely. Terrace it, or plant a tree crop that holds the soil.`,
    )
  }

  // Nothing measurable means nothing to say. Better an empty list than a
  // ranking built out of thin air.
  if (factors.length === 0) return null

  // Renormalise the surviving weights to sum to 1, so the site is scored on
  // what is known rather than penalised for what is missing.
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
  const normalised: MatchFactor[] = factors.map((f) => ({ ...f, weight: f.weight / totalWeight }))
  const score = pct(normalised.reduce((sum, f) => sum + f.score * f.weight, 0))

  return {
    id: envelope.id,
    name: envelope.name,
    family: envelope.family,
    category: envelope.category,
    score,
    rating: blockers.length > 0 ? "unsuitable" : ratingFromScore(score),
    cycleDays: envelope.cycleDays,
    waterNeedMm: envelope.waterNeedMm,
    plantingMonths: plantingMonthsFor(envelope, climate, latitude),
    factors: normalised,
    blockers,
  }
}
