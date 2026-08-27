import { textureFromFractions, waterHoldingFromTexture } from "@/lib/agronomy"
import type { SoilSample } from "@/types/land"

import { cacheKey, cached, getJson, rateLimiter, roundCoord } from "./http"
import type { FetchOptions } from "./http"

/** Soil does not change on any timescale a season cares about. */
const TTL_MS = 365 * 24 * 60 * 60 * 1000

/** SoilGrids takes 2–5 s when healthy; past this it is almost certainly rate-limited. */
// Healthy latency is 2-5 s but the tail regularly reaches past 12 s; one
// request per parcel makes the longer wait worth it.
const TIMEOUT_MS = 15_000

/**
 * SoilGrids allows roughly five requests a minute, so requests are spaced at
 * one per thirteen seconds.
 *
 * The queue is not optional politeness. Reopening the app re-analyses every
 * mid-flight parcel at once, and going over the limit makes SoilGrids HANG
 * rather than answer 429 — so a six-parcel burst times out six times, caches
 * nothing, and does it again on the next reload. Six parcels trickling take
 * about a minute, which is slow but converges; the burst never does.
 */
const queued = rateLimiter(13_000)

const PROPERTIES = ["clay", "sand", "silt", "phh2o", "soc"] as const
const DEPTHS = ["0-5cm", "5-15cm"] as const

const NO_READING_NOTE =
  "No soil survey covers this exact spot — tell us your soil texture and we'll sharpen every score."

interface SoilGridsDepth {
  values?: { mean?: number | null } | null
}

interface SoilGridsLayer {
  name?: string
  unit_measure?: { d_factor?: number } | null
  depths?: SoilGridsDepth[]
}

interface SoilGridsResponse {
  properties?: { layers?: SoilGridsLayer[] } | null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * One property, averaged over whatever depths came back, in real units.
 *
 * SoilGrids ships integers scaled by `d_factor` to save bytes — 266 is 26.6 %
 * clay, 76 is pH 7.6 — so dividing is not optional. `null` means the model has
 * no reading at this pixel, which is a normal answer over towns and water.
 */
function layerMean(layers: SoilGridsLayer[], name: string): number | null {
  const layer = layers.find(candidate => candidate.name === name)
  if (!layer) return null
  const factor = layer.unit_measure?.d_factor || 1
  const readings = (layer.depths ?? [])
    .map(depth => depth.values?.mean)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (readings.length === 0) return null
  const total = readings.reduce((sum, value) => sum + value, 0)
  return total / readings.length / factor
}

/**
 * Rescale the three mineral fractions to sum to exactly 100.
 *
 * SoilGrids models sand, silt and clay independently, so their means land near
 * but rarely on 100 %. The texture triangle assumes they sum to 100, and a 97 %
 * total quietly drags a reading across a class boundary — hence the rescale.
 */
function normaliseFractions(
  sand: number | null,
  silt: number | null,
  clay: number | null
): { sand: number; silt: number; clay: number } | null {
  if (sand === null || silt === null || clay === null) return null
  const total = sand + silt + clay
  if (total <= 0) return null
  return {
    sand: round1((sand / total) * 100),
    silt: round1((silt / total) * 100),
    clay: round1((clay / total) * 100),
  }
}

function unknownSample(): SoilSample {
  return {
    source: "unknown",
    sandPct: null,
    siltPct: null,
    clayPct: null,
    ph: null,
    socGkg: null,
    texture: null,
    waterHoldingMmPerM: null,
    note: NO_READING_NOTE,
  }
}

/**
 * Texture, pH and organic carbon for a point, from the ISRIC SoilGrids model.
 *
 * The whole shape of this function is set by how fragile that service is: one
 * request per call and never two at once — the limit is about five a minute and
 * going over it makes requests hang rather than fail, so calls are serialised
 * through a module-level pacer — no retries for the same reason, a hard 12 s
 * deadline, and a year-long cache so a given field is asked about once.
 *
 * A pixel with no reading at all — built-up land, water, a bad tile — comes back
 * as `source: "unknown"` with a note, not an exception: that is a normal answer
 * and the farmer can supply the texture themselves. Only transport failures
 * throw, and the caller decides what that means for the rest of the analysis.
 */
export async function fetchSoil(
  lat: number,
  lon: number,
  options?: FetchOptions
): Promise<SoilSample> {
  const rlat = roundCoord(lat)
  const rlon = roundCoord(lon)

  return cached(cacheKey("soil", rlat, rlon), TTL_MS, async () => {
    const query = [
      `lon=${rlon}`,
      `lat=${rlat}`,
      ...PROPERTIES.map(property => `property=${property}`),
      ...DEPTHS.map(depth => `depth=${depth}`),
      "value=mean",
    ].join("&")
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?${query}`
    const raw = await queued(
      () =>
        getJson<SoilGridsResponse>(url, {
          ...options,
          timeoutMs: options?.timeoutMs ?? TIMEOUT_MS,
          retries: options?.retries ?? 0,
        }),
      options?.signal
    )

    // A reply with no layers at all is a broken reply — a captive portal, a
    // proxy answering 200 `{}`, a half-written body — NOT the documented "no
    // reading at this pixel", which comes back as layers full of nulls. The
    // difference matters because the second is cached for a year: mistaking one
    // for the other would take soil away from this field until next season.
    const layers = raw.properties?.layers
    if (!Array.isArray(layers) || layers.length === 0) {
      throw new Error("The soil service sent no layers for this place.")
    }

    const sand = layerMean(layers, "sand")
    const silt = layerMean(layers, "silt")
    const clay = layerMean(layers, "clay")
    const ph = layerMean(layers, "phh2o")
    const soc = layerMean(layers, "soc")

    if (sand === null && silt === null && clay === null && ph === null && soc === null) {
      return unknownSample()
    }

    const mix = normaliseFractions(sand, silt, clay)
    const texture = mix ? textureFromFractions(mix.sand, mix.silt, mix.clay) : null
    return {
      source: "soilgrids",
      sandPct: mix ? mix.sand : null,
      siltPct: mix ? mix.silt : null,
      clayPct: mix ? mix.clay : null,
      ph: ph === null ? null : round1(ph),
      socGkg: soc === null ? null : round1(soc),
      texture,
      waterHoldingMmPerM: texture ? waterHoldingFromTexture(texture) : null,
      note: null,
    }
  })
}
