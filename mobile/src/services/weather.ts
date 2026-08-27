import { skyFromWmoCode } from "@/lib/agronomy"
import type {
  CurrentConditions,
  DailySeries,
  Forecast,
  ForecastDay,
} from "@/types/land"

import { cacheKey, cached, getJson, roundCoord } from "./http"
import type { FetchOptions } from "./http"

const DAY_MS = 24 * 60 * 60 * 1000

/** Long enough that flicking between screens is free, short enough to feel live. */
const FORECAST_TTL_MS = 30 * 60 * 1000

/** History does not change; only the trailing edge does, and slowly. */
const ARCHIVE_TTL_MS = 30 * DAY_MS

/** Ten years is ~3 600 days of six variables — the default 10 s is not enough. */
const ARCHIVE_TIMEOUT_MS = 20_000

/** The archive runs about five days behind; ask for a week to be safe. */
const ARCHIVE_LAG_DAYS = 7

const FORECAST_DAILY =
  "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunshine_duration,et0_fao_evapotranspiration"
const FORECAST_CURRENT =
  "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
const ARCHIVE_DAILY =
  "temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,et0_fao_evapotranspiration"

interface ForecastResponse {
  timezone?: string
  current?: {
    time?: string
    temperature_2m?: number | null
    relative_humidity_2m?: number | null
    precipitation?: number | null
    weather_code?: number | null
    wind_speed_10m?: number | null
  }
  daily?: {
    time?: string[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_sum?: (number | null)[]
    weather_code?: (number | null)[]
    sunshine_duration?: (number | null)[]
    et0_fao_evapotranspiration?: (number | null)[]
  }
}

interface ArchiveResponse {
  daily?: {
    time?: string[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_sum?: (number | null)[]
    sunshine_duration?: (number | null)[]
    et0_fao_evapotranspiration?: (number | null)[]
  }
}

/** These APIs put `null` in an array where a reading is missing. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** UTC `YYYY-MM-DD` — the only date format the archive accepts. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// WMO code → the three icons this app draws lives in `lib/agronomy`, and there
// is exactly one of it. A local copy here disagreed with that one across codes
// 4–44 (haze, smoke, dust, the other fog forms), so the same weather could draw
// a raincloud or a cloud depending on which module had produced the reading.

function toCurrent(raw: NonNullable<ForecastResponse["current"]>): CurrentConditions {
  const code = num(raw.weather_code) ?? 0
  return {
    tempC: num(raw.temperature_2m) ?? 0,
    humidityPct: num(raw.relative_humidity_2m) ?? 0,
    precipMm: num(raw.precipitation) ?? 0,
    windKph: num(raw.wind_speed_10m) ?? 0,
    code,
    sky: skyFromWmoCode(code),
    time: raw.time ?? new Date().toISOString(),
  }
}

function toDays(raw: NonNullable<ForecastResponse["daily"]>): ForecastDay[] {
  const dates = raw.time ?? []
  const days: ForecastDay[] = []
  for (let i = 0; i < dates.length; i += 1) {
    const tMaxC = num(raw.temperature_2m_max?.[i])
    const tMinC = num(raw.temperature_2m_min?.[i])
    // A day with no temperatures tells a farmer nothing; drawing a blank card
    // is worse than drawing one card fewer.
    if (tMaxC === null || tMinC === null) continue
    const code = num(raw.weather_code?.[i]) ?? 0
    days.push({
      date: dates[i],
      tMaxC,
      tMinC,
      rainMm: num(raw.precipitation_sum?.[i]) ?? 0,
      code,
      sky: skyFromWmoCode(code),
      sunHours: round1((num(raw.sunshine_duration?.[i]) ?? 0) / 3600),
      et0Mm: num(raw.et0_fao_evapotranspiration?.[i]) ?? 0,
    })
  }
  return days
}

/**
 * Current conditions plus a 7-day outlook for a point.
 *
 * Cached for 30 minutes: the upstream model only updates hourly, so anything
 * shorter spends the farmer's data allowance on identical numbers.
 */
export async function fetchForecast(
  lat: number,
  lon: number,
  options?: FetchOptions
): Promise<Forecast> {
  const rlat = roundCoord(lat)
  const rlon = roundCoord(lon)

  return cached(cacheKey("forecast", rlat, rlon), FORECAST_TTL_MS, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${rlat}&longitude=${rlon}` +
      `&daily=${FORECAST_DAILY}&current=${FORECAST_CURRENT}&timezone=auto&forecast_days=7`
    const raw = await getJson<ForecastResponse>(url, options)
    if (!raw.current || !raw.daily) {
      throw new Error("The weather service sent no readings for this place.")
    }
    return {
      current: toCurrent(raw.current),
      days: toDays(raw.daily),
      fetchedAt: new Date().toISOString(),
      timezone: raw.timezone ?? "UTC",
    }
  })
}

/**
 * Daily history for a point, oldest first — the raw material for climate normals.
 *
 * The window ends a week in the past because the archive lags real time by
 * about five days, and asking past the edge returns a wall of nulls. The cache
 * key carries the year span rather than the exact dates: pinning the dates
 * would miss the cache every single day and re-download 3 600 rows for nothing.
 */
export async function fetchArchive(
  lat: number,
  lon: number,
  years = 10,
  options?: FetchOptions
): Promise<DailySeries> {
  const rlat = roundCoord(lat, 2)
  const rlon = roundCoord(lon, 2)
  const end = new Date(Date.now() - ARCHIVE_LAG_DAYS * DAY_MS)
  // +1 day so a 10-year window holds 10 whole years, not 10 years and a day.
  const start = new Date(
    Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth(), end.getUTCDate() + 1)
  )
  const key = cacheKey(
    "archive",
    rlat,
    rlon,
    years,
    start.getUTCFullYear(),
    end.getUTCFullYear()
  )

  return cached(key, ARCHIVE_TTL_MS, async () => {
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${rlat}&longitude=${rlon}` +
      `&start_date=${isoDate(start)}&end_date=${isoDate(end)}` +
      `&daily=${ARCHIVE_DAILY}&timezone=auto`
    const raw = await getJson<ArchiveResponse>(url, {
      ...options,
      timeoutMs: options?.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
    })

    const daily = raw.daily
    if (!daily || !Array.isArray(daily.time)) {
      throw new Error("The weather archive sent no history for this place.")
    }

    const series: DailySeries = {
      time: [],
      tMaxC: [],
      tMinC: [],
      rainMm: [],
      et0Mm: [],
      sunSeconds: [],
    }
    for (let i = 0; i < daily.time.length; i += 1) {
      const tMaxC = num(daily.temperature_2m_max?.[i])
      const tMinC = num(daily.temperature_2m_min?.[i])
      const rainMm = num(daily.precipitation_sum?.[i])
      const et0Mm = num(daily.et0_fao_evapotranspiration?.[i])
      // Dropping the whole index keeps all six arrays the same length, which is
      // the one promise DailySeries makes to lib/agronomy.
      if (tMaxC === null || tMinC === null || rainMm === null || et0Mm === null) continue
      series.time.push(daily.time[i])
      series.tMaxC.push(tMaxC)
      series.tMinC.push(tMinC)
      series.rainMm.push(rainMm)
      series.et0Mm.push(et0Mm)
      // Sunshine is the soft one: it only feeds a headline figure, so a gap
      // there must not throw away an otherwise good temperature-and-rain day.
      series.sunSeconds.push(num(daily.sunshine_duration?.[i]) ?? 0)
    }
    if (series.time.length === 0) {
      throw new Error("The weather archive has no usable history for this place.")
    }
    return series
  })
}
