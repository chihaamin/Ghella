/**
 * Live market prices, routed by the parcel's country.
 *
 * Two sources, tried in the order that matches their coverage:
 *
 *   · EU agri-food data portal — weekly fruit & vegetable prices for the 27
 *     EU member states, farm-gate and ex-packaging stages included. Tried
 *     first for EU countries only; everything it cannot answer (cereals,
 *     legumes, any non-EU parcel) falls through.
 *   · FAO GIEWS FPMA — retail/wholesale series observed in named markets,
 *     strong across Africa and the Middle East, nearly absent in Europe.
 *     The terminal step of the chain for everyone.
 *
 * The two are complementary by design: FPMA has Tunis tomatoes but no Spanish
 * ones, the EU portal is the reverse. An EU member gets both chances; Moldova
 * or Egypt goes straight to FPMA. Coverage gaps are expected, so absence is a
 * normal answer here, not a failure: this module resolves `null` for every
 * problem — unknown country, unmatched crop, dead network, even an abort —
 * because a price is decoration on a variety card, never a dependency. The
 * caller guards its own staleness; nothing downstream should ever have to
 * catch.
 */

import { iso3Of } from "@/data/iso3"
import type { MarketPrice } from "@/types/land"

import { eurToUsd } from "./fx"
import { cacheKey, cached, getJson, isHttpError, rateLimiter } from "./http"
import type { FetchOptions } from "./http"

/* ── Tuning ──────────────────────────────────────────────────── */

// The /giews/v4/price_module/... path 307-redirects to /global/; going there
// directly saves a round trip on connections that can least afford one.
const BASE = "https://fpma.fao.org/giews/v4/global/price_module/api/v1"

const DAY_MS = 24 * 60 * 60 * 1000

/** A country's catalogue of series changes rarely — new markets, not new prices. */
const SERIES_TTL_MS = 7 * DAY_MS

/** The datapoints gain at most one row a month; a day of staleness is invisible. */
const PRICE_TTL_MS = DAY_MS

/** FPMA can be slow from far away; the default 10 s cuts it too fine. */
// FPMA routinely takes 8 s+ for a cold series list when the service is
// degraded (measured live); a clipped fetch costs the farmer the price for a
// day of cache, so give it room. Prices are decoration — nothing blocks on it.
const PRICE_TIMEOUT_MS = 25_000

/** A country list can paginate; past 3 pages we have more series than we need. */
const MAX_SERIES_PAGES = 3

/** A series whose newest period ended over 24 months ago is history, not a price. */
const MAX_SERIES_AGE_MONTHS = 24

/** Newest-first datapoints to scan before conceding the series has no usable price. */
const MAX_DATAPOINT_SCAN = 12

/** Sanity ceiling — no staple crop retails at $50/kg; past it the unit mapping is wrong. */
const MAX_PLAUSIBLE_USD_PER_KG = 50

/**
 * One limiter across BOTH endpoints, so a Decide screen asking about four
 * crops at once turns into a polite drip instead of a burst FPMA might
 * throttle. 600 ms is invisible behind the cards' loading states.
 */
const politely = rateLimiter(600)

/* ── Crop → commodity matching ───────────────────────────────── */

/**
 * How one of our crop ids finds its FPMA series.
 *
 * `match` casts the net, `exclude` is a hard veto (melon must never pick up
 * "Watermelons"), and `avoid` is only a preference: wheat GRAIN beats wheat
 * FLOUR, but flour still beats showing nothing when it is the only series a
 * country publishes.
 */
interface CommodityRule {
  match: RegExp
  exclude?: RegExp
  avoid?: RegExp
}

// Both wheats and all three beans funnel to the same series — FPMA tracks the
// commodity, not the cultivar, so sharing one rule keeps them in lockstep.
const WHEAT_RULE: CommodityRule = { match: /wheat/i, avoid: /flour/i }
const BEAN_RULE: CommodityRule = { match: /bean|niébé|cowpea/i }

/** cropId (as `data/ecocrop` spells them) → how to find it in a commodity_name. */
const CROP_COMMODITY: Record<string, CommodityRule> = {
  tomato: { match: /tomato/i },
  "sweet-pepper": { match: /pepper|chilli|capsicum/i },
  onion: { match: /onion|shallot/i },
  melon: { match: /melon/i, exclude: /water\s*melon/i },
  watermelon: { match: /water\s*melon/i },
  potato: { match: /^potato|irish potato/i, exclude: /sweet/i },
  "sweet-potato": { match: /sweet\s*potato/i },
  "durum-wheat": WHEAT_RULE,
  "bread-wheat": WHEAT_RULE,
  barley: { match: /barley/i },
  maize: { match: /maize|corn/i, avoid: /flour|meal/i },
  rice: { match: /rice/i },
  chickpea: { match: /chickpea/i },
  lentil: { match: /lentil/i },
  "faba-bean": BEAN_RULE,
  "green-bean": BEAN_RULE,
  cowpea: BEAN_RULE,
  sorghum: { match: /sorghum/i },
  "pearl-millet": { match: /millet/i },
  groundnut: { match: /groundnut|peanut/i },
  "date-palm": { match: /date/i },
  "sugar-beet": { match: /sugar/i },
}

/* ── EU agri-food portal (fruit & vegetables, EU members only) ── */

/**
 * The 27 EU member states, ISO-3166-1 alpha-2. Membership decides routing —
 * the EU portal only answers for members, so asking it about Ukraine or
 * Morocco would be a guaranteed 404 spent from the rate budget.
 */
const EU_MEMBERS = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
])

/**
 * cropId → the portal's product name, exactly as `/pricesSupplyChain/products`
 * spells it (verified against the live list; lower-cased — the query parameter
 * is case-insensitive). Only fruit & vegetables exist here: cereals live under
 * a separate endpoint family this app does not use, so wheat/barley/etc. in
 * the EU simply fall through to FPMA like everywhere else. Note "cabbage" is
 * singular in the live list where its neighbours are plural.
 */
const EU_PRODUCT: Record<string, string> = {
  tomato: "tomatoes",
  "sweet-pepper": "peppers",
  onion: "onions",
  melon: "melons",
  watermelon: "water melons",
  "green-bean": "beans",
  cucumber: "cucumbers",
  courgette: "courgettes",
  eggplant: "egg plants",
  garlic: "garlic",
  carrot: "carrots",
  cabbage: "cabbage",
  cauliflower: "cauliflowers",
  lettuce: "lettuces",
  citrus: "oranges",
  strawberry: "strawberries",
}

/** The crop ids a price can even be asked for — the UI hides the feature elsewhere. */
export const PRICEABLE_CROPS: string[] = Array.from(
  new Set([...Object.keys(CROP_COMMODITY), ...Object.keys(EU_PRODUCT)])
)

/* ── Units ───────────────────────────────────────────────────── */

/**
 * measure_unit_label → kilograms per unit. Everything the app shows is per kg,
 * so a series sold in an unlisted unit ("Loaf", "Litre", "Bunch") is skipped
 * outright — a wrong division here would put a confidently wrong price on a
 * card, which is worse than no price.
 */
const KG_PER_UNIT: Record<string, number> = {
  kg: 1,
  "100 kg": 100,
  "50 kg": 50,
  tonne: 1000,
  mt: 1000,
  cwt: 50.8,
}

function kgFactorOf(label: unknown): number | null {
  if (typeof label !== "string") return null
  return KG_PER_UNIT[label.trim().toLowerCase()] ?? null
}

/* ── FPMA response shapes (only the fields read) ─────────────── */

interface FpmaSeries {
  uuid?: string
  commodity_name?: string
  market_name?: string
  price_type?: string
  currency?: string
  measure_unit_label?: string
  periodicity?: { period?: string; start_date?: string; end_date?: string }[]
}

interface FpmaSeriesPage {
  next?: string | null
  results?: FpmaSeries[]
}

interface FpmaDatapoint {
  date?: string
  price_value?: number | null
  price_value_dollar?: number | null
}

interface FpmaPriceResponse {
  uuid?: string
  datapoints?: FpmaDatapoint[]
}

/* ── Fetching ────────────────────────────────────────────────── */

/**
 * Every FPMA series a country publishes, all pages folded together and cached
 * a week per country — the catalogue is the expensive call, and it is the same
 * for every crop the screen asks about.
 */
async function fetchSeriesList(iso3: string, options?: FetchOptions): Promise<FpmaSeries[]> {
  return cached(cacheKey("fpma-series", iso3), SERIES_TTL_MS, async () => {
    const all: FpmaSeries[] = []
    let url: string | null = `${BASE}/FpmaSerieDomestic/?iso3_country_code=${iso3}&format=json`
    for (let page = 0; page < MAX_SERIES_PAGES && url; page += 1) {
      // Snapshot before the closure, with explicit types: `url` is reassigned
      // below from `raw`, whose inference flows through a closure capturing
      // this very snapshot — without annotations TS calls that a cycle.
      const pageUrl: string = url
      const raw: FpmaSeriesPage = await politely(
        () =>
          getJson<FpmaSeriesPage>(pageUrl, {
            ...options,
            timeoutMs: options?.timeoutMs ?? PRICE_TIMEOUT_MS,
          }),
        options?.signal
      )
      if (Array.isArray(raw.results)) all.push(...raw.results)
      // The API hands back an absolute URL for the next page, or null at the end.
      url = typeof raw.next === "string" && raw.next.length > 0 ? raw.next : null
    }
    return all
  })
}

/** A matched series with everything already validated for building a MarketPrice. */
interface Candidate {
  uuid: string
  market: string
  currency: string
  priceType: "retail" | "wholesale"
  kgFactor: number
  /** Epoch ms of the series' newest period end — the freshness tiebreaker. */
  endMs: number
  /** Matched the rule's `avoid` — usable, but only when nothing better exists. */
  avoided: boolean
}

/**
 * Pick the one series worth fetching datapoints for, or null.
 *
 * Order of preference: WHOLESALE over RETAIL (closer to what a farmer is
 * actually paid), then the most recently updated, then first-listed. Hard
 * gates come first — unknown unit, stale series, or missing fields disqualify
 * a series entirely rather than degrade the answer.
 */
function pickSeries(list: FpmaSeries[], rule: CommodityRule): Candidate | null {
  const staleBefore = new Date()
  staleBefore.setMonth(staleBefore.getMonth() - MAX_SERIES_AGE_MONTHS)

  const candidates: Candidate[] = []
  for (const series of list) {
    const name = series.commodity_name
    if (typeof name !== "string" || !rule.match.test(name)) continue
    if (rule.exclude && rule.exclude.test(name)) continue

    // Everything MarketPrice will need must actually be there.
    if (typeof series.uuid !== "string" || series.uuid.length === 0) continue
    if (typeof series.market_name !== "string") continue
    if (typeof series.currency !== "string") continue
    const priceType = series.price_type?.toLowerCase()
    if (priceType !== "retail" && priceType !== "wholesale") continue

    const kgFactor = kgFactorOf(series.measure_unit_label)
    if (kgFactor === null) continue

    // No parseable end date counts as stale: freshness we cannot prove is
    // freshness we do not have.
    const endMs = Date.parse(series.periodicity?.[0]?.end_date ?? "")
    if (!Number.isFinite(endMs) || endMs < staleBefore.getTime()) continue

    candidates.push({
      uuid: series.uuid,
      market: series.market_name,
      currency: series.currency,
      priceType,
      kgFactor,
      endMs,
      avoided: rule.avoid ? rule.avoid.test(name) : false,
    })
  }

  // The `avoid` preference: drop the flour-type series only when grain exists.
  const pool = candidates.some((c) => !c.avoided)
    ? candidates.filter((c) => !c.avoided)
    : candidates

  // Array.prototype.sort is stable (ES2019+), so ties keep the API's order.
  pool.sort((a, b) => {
    if (a.priceType !== b.priceType) return a.priceType === "wholesale" ? -1 : 1
    return b.endMs - a.endMs
  })
  return pool[0] ?? null
}

/**
 * The newest usable observation from a chosen series, or null.
 *
 * Newest first, at most `MAX_DATAPOINT_SCAN` deep: old rows have no USD
 * conversion and any row can be junk, so each is gated on both prices being
 * finite and the USD figure landing in a plausible per-kg band before it is
 * allowed onto a card.
 */
async function fetchLatestPrice(
  chosen: Candidate,
  options?: FetchOptions
): Promise<MarketPrice | null> {
  const raw = await cached(cacheKey("fpma-price", chosen.uuid), PRICE_TTL_MS, () =>
    politely(
      () =>
        getJson<FpmaPriceResponse>(`${BASE}/FpmaSeriePrice/${chosen.uuid}/?format=json`, {
          ...options,
          timeoutMs: options?.timeoutMs ?? PRICE_TIMEOUT_MS,
        }),
      options?.signal
    )
  )

  const points = Array.isArray(raw.datapoints) ? raw.datapoints : []
  for (const point of points.slice(0, MAX_DATAPOINT_SCAN)) {
    const usd = point.price_value_dollar
    const local = point.price_value
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) continue
    // Same plausibility gate as the dollar figure: a zero or negative local
    // price is a junk datapoint, and the UI prints localPerKg verbatim.
    if (typeof local !== "number" || !Number.isFinite(local) || local <= 0)
      continue
    if (typeof point.date !== "string" || point.date.length < 7) continue

    const usdPerKg = usd / chosen.kgFactor
    if (usdPerKg <= 0 || usdPerKg > MAX_PLAUSIBLE_USD_PER_KG) continue

    return {
      usdPerKg,
      localPerKg: local / chosen.kgFactor,
      currency: chosen.currency,
      market: chosen.market,
      priceType: chosen.priceType,
      month: point.date.slice(0, 7),
      seriesUuid: chosen.uuid,
      source: "FAO FPMA",
    }
  }
  return null
}

/* ── EU agri-food fetching ───────────────────────────────────── */

/**
 * The portal's real host answers with an EMPTY Access-Control-Allow-Origin
 * header, so the browser reaches it through this same-origin prefix that the
 * dev/preview servers (and any production host) rewrite to the real base —
 * see `vite.config.ts`. Non-browser callers (the self-check scripts) shim
 * `fetch` to expand the prefix instead.
 */
const EU_BASE = "/eu-agrifood/fruitAndVegetable/pricesSupplyChain"

/** Weekly data gains one row a week; a day of staleness is invisible. */
const EU_TTL_MS = DAY_MS

/** A national weekly price older than ~6 months describes a different season. */
const EU_MAX_ROW_AGE_MS = 183 * DAY_MS

/**
 * Its own limiter, not `politely`: the EU portal and FPMA are different hosts
 * with independent tempers, and chaining them through one queue would make a
 * Spanish parcel wait behind a Tunisian one for no protective benefit.
 */
const euPolitely = rateLimiter(400)

/** Only the fields read; rows also carry period/isRegulated etc. */
interface EuPriceRow {
  memberStateName?: string
  endDate?: string
  price?: string
  unit?: string
  productStage?: string
  market?: string
  variety?: string
}

/** A validated row, everything parsed and ready to be ranked. */
interface EuCandidate {
  eurPerKg: number
  /** 0 farm-gate, 1 ex-packaging, 2 anything else — the preference order. */
  stageRank: 0 | 1 | 2
  /** Epoch ms of the observation week's end. */
  endMs: number
  /** "YYYY-MM" of the same, precomputed while the date parts are in hand. */
  month: string
  nationalAvg: boolean
  stateName: string
  /** The row's variety, product prefix stripped — "Cherry/Special", "Round". */
  variety: string
  /** True for the portal's whole-product rows ("All types and varieties", weighted averages). */
  aggregate: boolean
}

/**
 * "€188.70" → 188.7. The portal quotes prices as strings with a currency sign
 * and (past a thousand) comma separators; the decimal is always a dot.
 */
function parseEuPrice(value: unknown): number | null {
  if (typeof value !== "string") return null
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** "23/08/2026" (DD/MM/YYYY, as the portal writes dates) → epoch ms, or null. */
function parseEuDate(value: unknown): number | null {
  if (typeof value !== "string") return null
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!m) return null
  const ms = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Number.isFinite(ms) ? ms : null
}

/**
 * One year of rows for one product in one member state, cached a day.
 * A 404 here is the portal's spelling of "no data for these parameters" —
 * absence, not failure — so it becomes an empty (and cacheable) list rather
 * than an error. Anything else propagates to the caller's catch.
 */
async function fetchEuRows(
  iso2: string,
  product: string,
  year: number,
  options?: FetchOptions
): Promise<EuPriceRow[]> {
  return cached(cacheKey("eu-agrifood", iso2, product, year), EU_TTL_MS, async () => {
    try {
      const url =
        `${EU_BASE}?memberStateCodes=${iso2}` +
        `&products=${encodeURIComponent(product)}&years=${year}`
      const raw = await euPolitely(
        () =>
          getJson<EuPriceRow[]>(url, {
            ...options,
            timeoutMs: options?.timeoutMs ?? PRICE_TIMEOUT_MS,
          }),
        options?.signal
      )
      return Array.isArray(raw) ? raw : []
    } catch (e) {
      if (isHttpError(e) && e.status === 404) return []
      throw e
    }
  })
}

/**
 * Rank a year's rows and keep the single best, or null.
 *
 * The portal is queried WITHOUT a productStages filter — stage coverage is
 * patchy per country, and filtering server-side would turn "no farm-gate row"
 * into "no price at all". Instead every stage comes back and the ranking
 * prefers the one closest to what a farmer is paid: farm-gate, then
 * ex-packaging, then whatever remains (retail-ish stages). Within a stage,
 * newest week first, then a national-average row over a single named market;
 * the variety-aware tie-break below settles the rest (multi-variety products
 * tie on all three of those every single week).
 * Hard gates first, as everywhere in this module: an unexpected unit or an
 * unparseable price/date disqualifies the row — a wrong division would put a
 * confidently wrong price on a card, which is worse than no price.
 */
function pickEuRow(rows: EuPriceRow[]): EuCandidate | null {
  const tooOldBefore = Date.now() - EU_MAX_ROW_AGE_MS

  const candidates: EuCandidate[] = []
  for (const row of rows) {
    // The portal's observed unit is uniformly "€/100Kg"; anything else means
    // an assumption broke, so the row is skipped rather than guessed at.
    if (typeof row.unit !== "string" || row.unit.trim().toLowerCase() !== "€/100kg") continue

    const eur = parseEuPrice(row.price)
    if (eur === null) continue

    const endMs = parseEuDate(row.endDate)
    if (endMs === null || endMs < tooOldBefore) continue

    const stage = typeof row.productStage === "string" ? row.productStage : ""
    const stageRank = /farm.?gate/i.test(stage) ? 0 : /ex.?packaging/i.test(stage) ? 1 : 2

    // "Tomatoes - Cherry/Special" → "Cherry/Special"; the product half repeats
    // what the query already said, the variety half is what varies row to row.
    const rawVariety = typeof row.variety === "string" ? row.variety : ""
    candidates.push({
      eurPerKg: eur / 100,
      stageRank,
      endMs,
      month: new Date(endMs).toISOString().slice(0, 7),
      nationalAvg: typeof row.market === "string" && /national average/i.test(row.market),
      stateName: typeof row.memberStateName === "string" ? row.memberStateName : "",
      variety: rawVariety.replace(/^[^-]+-\s*/, "").trim(),
      aggregate: /all types|all varieties|weighted average/i.test(rawVariety),
    })
  }

  candidates.sort((a, b) => {
    if (a.stageRank !== b.stageRank) return a.stageRank - b.stageRank
    if (a.endMs !== b.endMs) return b.endMs - a.endMs
    return Number(b.nationalAvg) - Number(a.nationalAvg)
  })
  const top = candidates[0]
  if (!top) return null

  // A full tie at the top is the NORM, not an edge case: every variety of a
  // product publishes one row per stage per week, all "National average", so
  // a variety-blind pick would crown whichever variety the portal happens to
  // list first — for tomatoes the premium Cherry/Special, 2–3× the bulk Round
  // price a farmer growing the generic crop would actually see. Within the
  // tied group an aggregate row ("All types and varieties", "National
  // weighted average…") is exactly the number wanted, so it wins outright;
  // failing that, the MEDIAN-priced variety stands in — the typical commodity,
  // neither the premium outlier nor a possibly distressed cheapest.
  const tied = candidates.filter(
    (c) =>
      c.stageRank === top.stageRank &&
      c.endMs === top.endMs &&
      c.nationalAvg === top.nationalAvg
  )
  const aggregate = tied.find((c) => c.aggregate)
  if (aggregate) return aggregate
  const byPrice = tied.slice().sort((a, b) => a.eurPerKg - b.eurPerKg)
  // Lower median on an even count: when in doubt, understate the revenue.
  return byPrice[Math.floor((byPrice.length - 1) / 2)] ?? null
}

/**
 * The freshest EU-portal price for a crop in a member state, or null.
 *
 * Null covers the same spectrum as the FPMA path: crop the portal does not
 * track, a 404-absence, an empty year, only-stale rows, or a dead network —
 * all of them mean "let the chain fall through to FPMA", so this function
 * never throws. The current year is asked first and the previous one only
 * when it comes back empty (early January would otherwise show nothing).
 */
async function fetchEuPrice(
  iso2: string,
  cropId: string,
  options?: FetchOptions
): Promise<MarketPrice | null> {
  const product = EU_PRODUCT[cropId]
  if (!product) return null

  try {
    const year = new Date().getFullYear()
    let chosen = pickEuRow(await fetchEuRows(iso2, product, year, options))
    if (!chosen) {
      chosen = pickEuRow(await fetchEuRows(iso2, product, year - 1, options))
    }
    if (!chosen) return null

    // The FX rate is fetched only once a row is worth converting; its own
    // fallback constant means an EU price is never lost to a missing rate.
    const usdPerKg = chosen.eurPerKg * (await eurToUsd(options))
    if (usdPerKg <= 0 || usdPerKg > MAX_PLAUSIBLE_USD_PER_KG) return null

    const stageLabel =
      chosen.stageRank === 0 ? "farm-gate" : chosen.stageRank === 1 ? "ex-packaging" : "market"

    // A specific variety must be named — quoting "Trusses" as if it were THE
    // tomato price would be quietly wrong. Aggregate rows need no caveat: the
    // whole-product average is exactly what the card claims to show.
    const varietyLabel =
      chosen.aggregate || chosen.variety.length === 0 ? "" : ` · ${chosen.variety}`

    return {
      usdPerKg,
      localPerKg: chosen.eurPerKg,
      currency: "EUR",
      // `market` carries the human story: which country, how close to the farm
      // the money was counted, and which variety when the portal quotes one —
      // e.g. "Spain · farm-gate · Round".
      market: `${chosen.stateName || iso2} · ${stageLabel}${varietyLabel}`,
      // Farm-gate and ex-packaging are producer-side prices; "wholesale" is
      // the nearest of MarketPrice's two flavours. Retail-ish stages say so.
      priceType: chosen.stageRank <= 1 ? "wholesale" : "retail",
      month: chosen.month,
      // The portal has no series uuid; a minted stable id keeps the field's
      // contract (same series → same key) without touching the MarketPrice type.
      seriesUuid: `eu-agrifood:${iso2}:${product}`,
      source: "EU agri-food",
    }
  } catch {
    return null
  }
}

/* ── The public chain ────────────────────────────────────────── */

/**
 * The freshest observed market price for a crop in a country, or null.
 *
 * `countryCode` is ISO-2 as `Place.countryCode` carries it, and it routes the
 * chain: an EU member tries the EU portal first and falls through to FPMA
 * when the portal has nothing; everyone else goes straight to FPMA. Null
 * means "no price to show" for ANY reason — country not covered, crop not
 * tracked, series stale, network dead, request aborted — and that is
 * deliberate: unlike the rest of the services this one never throws, not even
 * an abort, because the consuming hook treats null as absence and guards
 * staleness itself. A crash path from a decorative number is a bug by
 * definition.
 */
export async function fetchMarketPrice(
  countryCode: string,
  cropId: string,
  options?: FetchOptions
): Promise<MarketPrice | null> {
  try {
    const iso2 = countryCode.trim().toUpperCase()
    if (EU_MEMBERS.has(iso2)) {
      const euPrice = await fetchEuPrice(iso2, cropId, options)
      if (euPrice) return euPrice
    }

    const iso3 = iso3Of(countryCode)
    if (!iso3) return null
    const rule = CROP_COMMODITY[cropId]
    if (!rule) return null

    const chosen = pickSeries(await fetchSeriesList(iso3, options), rule)
    if (!chosen) return null
    return await fetchLatestPrice(chosen, options)
  } catch {
    return null
  }
}
