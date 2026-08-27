/**
 * EUR → USD, for pricing sources that publish in euros.
 *
 * The EU agri-food portal (see `services/prices`) quotes everything in €/100Kg
 * while the rest of the app speaks USD/kg, so a single spot rate bridges the
 * two. Frankfurter republishes the ECB daily reference rate, key-free and
 * CORS-open — note the `.dev` host: `frankfurter.app` 301-redirects there, and
 * going direct saves the hop. The rate moves ~0.1% a day, so a 24 h cache is
 * effectively exact for our purpose.
 *
 * Like everything price-adjacent, this never throws: a produce price is
 * decoration on a variety card, and losing one to a missing FX quote would be
 * absurd when the observation error on the price itself (which variety, which
 * week, which market) dwarfs any plausible FX drift. Hence the hardcoded
 * fallback below — deliberately NOT surfaced differently in the UI, for the
 * same reason.
 */

import { cacheKey, cached, getJson } from "./http"
import type { FetchOptions } from "./http"

const FX_URL = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD"

const DAY_MS = 24 * 60 * 60 * 1000

/** ECB reference rates update once a business day; a day of staleness is exact enough. */
const FX_TTL_MS = DAY_MS

/**
 * Used when Frankfurter is unreachable and no cached rate survives. A rough
 * multi-year EUR/USD midpoint — within ~10% of any rate seen this decade,
 * which is far inside the error bar of a weekly national-average produce price.
 */
const FALLBACK_EUR_USD = 1.08

/** EUR/USD has lived inside this band for its whole life; outside it the feed is broken. */
const MIN_PLAUSIBLE = 0.5
const MAX_PLAUSIBLE = 2

/** Only the fields read — Frankfurter also echoes `amount`, `base` and `date`. */
interface FrankfurterLatest {
  rates?: { USD?: number }
}

/**
 * Today's EUR→USD rate, cached 24 h, or the documented constant when the
 * network and the cache both come up empty. Never throws — see module note.
 */
export async function eurToUsd(options?: FetchOptions): Promise<number> {
  try {
    return await cached(cacheKey("fx", "EUR", "USD"), FX_TTL_MS, async () => {
      const raw = await getJson<FrankfurterLatest>(FX_URL, options)
      const rate = raw.rates?.USD
      // Throwing here (rather than returning the fallback) lets `cached` serve
      // a stale-but-real rate first; the constant is strictly the last resort.
      if (
        typeof rate !== "number" ||
        !Number.isFinite(rate) ||
        rate < MIN_PLAUSIBLE ||
        rate > MAX_PLAUSIBLE
      ) {
        throw new Error("Frankfurter answered without a plausible USD rate")
      }
      return rate
    })
  } catch {
    return FALLBACK_EUR_USD
  }
}
