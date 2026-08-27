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

/* ── USD → everything ────────────────────────────────────────── */

const USD_RATES_URL = "https://open.er-api.com/v6/latest/USD"

/**
 * Second publisher of the same daily data, mirrored on jsDelivr. It answers
 * with LOWERCASE codes under a `usd` key — normalized below so the two feeds
 * are interchangeable to callers.
 */
const USD_RATES_FALLBACK_URL =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json"

/** Both feeds carry 150+ codes; fewer than this and we got an error page, not a rate table. */
const MIN_RATE_CODES = 20

/** Only the fields read — er-api also echoes update times and attribution. */
interface ErApiLatest {
  result?: string
  rates?: Record<string, unknown>
}

/** The jsDelivr shape: `{ date, usd: { tnd: 2.89, … } }`, lowercase keys. */
interface FawazUsd {
  usd?: Record<string, unknown>
}

/**
 * Keep only finite positive numbers, uppercase every key, and refuse a table
 * too small to be real. Throwing (rather than returning a stump) is what lets
 * the primary hand over to the fallback, and the fallback to `cached`'s stale
 * entry — the same last-resort ladder `eurToUsd` climbs.
 */
function sanitizeRates(raw: Record<string, unknown> | undefined): Record<string, number> {
  const rates: Record<string, number> = {}
  if (raw && typeof raw === "object") {
    for (const [code, value] of Object.entries(raw)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        rates[code.toUpperCase()] = value
      }
    }
  }
  if (Object.keys(rates).length < MIN_RATE_CODES) {
    throw new Error("FX feed answered without a usable rate table")
  }
  // USD → USD is definitionally 1; spelling it out saves callers a special case.
  rates.USD = 1
  return rates
}

/**
 * USD → every ISO-4217 code the feeds publish (always including `USD: 1`),
 * cached 24 h, or null when both publishers and the cache come up empty.
 * Never throws — a local-currency figure is a courtesy on a card, and the UI
 * falls back to plain USD without one.
 *
 * Primary is open.er-api.com; the jsDelivr mirror answers when it cannot.
 * Both live under ONE cache key: a rate table is a rate table, and a fallback
 * answer today should still be tomorrow's stale-but-real table. The two agree
 * to ~0.1%, far inside the error bar of the produce prices this converts.
 */
export async function usdRates(
  options?: FetchOptions
): Promise<Record<string, number> | null> {
  try {
    return await cached(cacheKey("fx", "USD", "all"), FX_TTL_MS, async () => {
      try {
        const raw = await getJson<ErApiLatest>(USD_RATES_URL, {
          timeoutMs: 10_000,
          ...options,
        })
        if (raw.result !== "success") {
          throw new Error("open.er-api answered without success")
        }
        return sanitizeRates(raw.rates)
      } catch (e) {
        // An unmount is not a feed failure: let it out untouched instead of
        // burning a second request the component no longer wants.
        if (e instanceof Error && e.name === "AbortError") throw e
        const raw = await getJson<FawazUsd>(USD_RATES_FALLBACK_URL, {
          timeoutMs: 10_000,
          ...options,
        })
        return sanitizeRates(raw.usd)
      }
    })
  } catch {
    return null
  }
}
