import type { Lang } from "@/i18n/dict"

export type Sky = "sun" | "cloud" | "rain"

export interface WeatherDay {
  d: string
  t: number
  sky: Sky
  /** Rainfall label, e.g. "18mm". Empty when dry. */
  mm: string
  today: boolean
}

const DAY_LABELS: Record<Lang, string[]> = {
  en: ["THU", "FRI", "SAT", "SUN", "MON", "TUE", "WED"],
  fr: ["JEU", "VEN", "SAM", "DIM", "LUN", "MAR", "MER"],
  ar: ["خم", "جم", "سب", "أح", "إث", "ثل", "أر"],
}

const BASE: ReadonlyArray<{ t: number; k: Sky }> = [
  { t: 34, k: "sun" },
  { t: 36, k: "sun" },
  { t: 33, k: "cloud" },
  { t: 31, k: "sun" },
  { t: 32, k: "sun" },
  { t: 29, k: "cloud" },
  { t: 30, k: "sun" },
]

/**
 * The seven-day strip. The two scenario switches rewrite it in place: `rain`
 * soaks the first two days, `frost` drops Tuesday to 2°C under cloud.
 */
export function forecast(
  lang: Lang,
  { rain, frost }: { rain: boolean; frost: boolean }
): WeatherDay[] {
  const days = DAY_LABELS[lang]
  return BASE.map((w, i) => {
    let sky = w.k
    let mm = ""
    if (rain && i === 0) {
      sky = "rain"
      mm = "18mm"
    }
    if (rain && i === 1) {
      sky = "rain"
      mm = "6mm"
    }
    if (frost && i === 5) sky = "cloud"
    return {
      d: days[i],
      t: frost && i === 5 ? 12 : w.t,
      sky,
      mm,
      today: i === 0,
    }
  })
}
