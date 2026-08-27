import type { Place } from "@/types/land"

import { cacheKey, cached, getJson, rateLimiter, roundCoord } from "./http"
import type { FetchOptions } from "./http"

/** Place names change about as often as borders do. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Nominatim's usage policy is one request per second, per application. */
const MIN_GAP_MS = 1100

/**
 * Two parcels analysed at once trickle instead of bursting — a burst gets the
 * whole app rate-limited, and a blocked geocoder takes the region name away
 * from every later parcel too. A cache hit never enters the queue.
 */
const queued = rateLimiter(MIN_GAP_MS)

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  hamlet?: string
  county?: string
  state?: string
  region?: string
  country?: string
  country_code?: string
}

interface NominatimReverse {
  error?: string
  address?: NominatimAddress
}

function toPlace(raw: NominatimReverse, lat: number, lon: number): Place {
  const address = raw.address ?? {}
  const locality =
    address.city ?? address.town ?? address.village ?? address.hamlet ?? null
  const region = address.state ?? address.region ?? null
  const county = address.county ?? null
  const country = address.country ?? null

  // "Fresno County, California" — county and region carry the most meaning for
  // a farmer; country alone is the honest fallback when that is all there is.
  const known = [county, region, country].filter((part): part is string => Boolean(part))
  const label =
    known.slice(0, 2).join(", ") || locality || `${lat.toFixed(2)}, ${lon.toFixed(2)}`

  return {
    country,
    countryCode: address.country_code ? address.country_code.toUpperCase() : null,
    region,
    county,
    locality,
    label,
  }
}

/**
 * Name the region a point falls in, via OpenStreetMap Nominatim.
 *
 * Coordinates are rounded to 2 dp (~1 km) before both the request and the cache
 * key, so re-drawing a parcel a few metres over reuses the same answer and the
 * rate-limited service is asked once per village rather than once per tap.
 *
 * Retries default to NONE here, unlike everywhere else. One queued slot has to
 * mean one request: `getJson`'s own retry fires 400 ms after the first attempt,
 * inside the slot the pacer already stamped, which puts two requests well
 * inside Nominatim's one-per-second policy and earns the whole app a 429.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  options?: FetchOptions
): Promise<Place> {
  const rlat = roundCoord(lat, 2)
  const rlon = roundCoord(lon, 2)

  return cached(cacheKey("geocode", rlat, rlon), TTL_MS, async () => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${rlat}&lon=${rlon}&zoom=10`
    const raw = await queued(
      () => getJson<NominatimReverse>(url, { ...options, retries: options?.retries ?? 0 }),
      options?.signal
    )
    // Nominatim answers HTTP 200 with `{ error }` both for a point it cannot
    // name (mid-ocean) and for one it refused to look up. Throwing keeps a
    // transient refusal out of a 30-day cache; the caller carries on unnamed.
    if (raw.error) throw new Error("This spot has no name in the map data.")
    return toPlace(raw, rlat, rlon)
  })
}
