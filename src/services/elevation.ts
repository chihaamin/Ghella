import type { LatLng } from "@/types/land"

import { cacheKey, cached, getJson, roundCoord } from "./http"
import type { FetchOptions } from "./http"

/** The ground does not move. */
const TTL_MS = 90 * 24 * 60 * 60 * 1000

/** Open-Meteo accepts at most 100 coordinates in one call. */
const MAX_POINTS = 100

/**
 * Decimal places kept for BOTH the request and the cache key, deliberately
 * finer than the 3 dp everything else in this layer uses.
 *
 * These points are not a location lookup, they are a measuring stencil: slope
 * is the elevation DIFFERENCE across a 120 m offset, and `lib/agronomy` divides
 * by that nominal 120 m. Snapping to 3 dp (~111 m) moves each point by up to
 * 55 m and distorts the two axes by different amounts — measured worst case
 * over the real stencil is a 39 % error north-south against 26 % east-west, so
 * a true 5.0 % grade reports as 6.95 % and the aspect rotates by an octant. At
 * 5 dp (~1.1 m) the worst-case distortion of a 240 m baseline is under 1 %.
 *
 * Key and request use the same rounding on purpose: a coarser key would serve
 * one parcel's elevations for another parcel's stencil, which is the same bug
 * wearing a different hat.
 */
const STENCIL_DECIMALS = 5

interface ElevationResponse {
  elevation?: (number | null)[]
}

/**
 * Ground elevation in metres for each point, in the order given.
 *
 * One batched request for the whole set: the slope stencil asks for five points
 * at once, and five round trips on a weak connection is four too many. Slope
 * itself is not computed here — that belongs to lib/agronomy, which knows the
 * spacing the points were sampled at.
 */
export async function fetchElevations(
  points: LatLng[],
  options?: FetchOptions
): Promise<number[]> {
  if (points.length === 0) return []
  if (points.length > MAX_POINTS) {
    throw new Error(`Elevation can only be read for ${MAX_POINTS} points at a time.`)
  }

  const rounded = points.map(([lat, lon]) => [
    roundCoord(lat, STENCIL_DECIMALS),
    roundCoord(lon, STENCIL_DECIMALS),
  ])
  const key = cacheKey("elevation", ...rounded.flat())

  return cached(key, TTL_MS, async () => {
    const lats = rounded.map(point => point[0]).join(",")
    const lons = rounded.map(point => point[1]).join(",")
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`
    const raw = await getJson<ElevationResponse>(url, options)

    const values = raw.elevation
    // A short or gappy answer would silently skew slope rather than fail, so it
    // is rejected outright and the caller reports terrain as unknown.
    if (!Array.isArray(values) || values.length !== points.length) {
      throw new Error("The elevation service answered with the wrong number of readings.")
    }
    return values.map(value => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("The elevation service left a gap over this land.")
      }
      return value
    })
  })
}
