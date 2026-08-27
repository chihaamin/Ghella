import type { Lang } from "@/i18n/dict"
import type { CropId } from "@/store/app-store"

/**
 * The price chart is drawn in a 372 × 176 viewBox. `x = 248` is today: to its
 * left is two seasons of recorded wholesale prices, to its right the forecast
 * and its 80% band.
 */
const CHART = { todayX: 248, stepX: 4, points: 62, forecastSteps: 8 } as const

const SEED: Record<CropId, number> = { tom: 0, pep: 1.7, oni: 3.1, mel: 4.6 }
const NOW: Record<CropId, number> = { tom: 1.32, pep: 1.85, oni: 0.78, mel: 0.95 }
const FORECAST: Record<CropId, number> = { tom: 1.55, pep: 2.1, oni: 0.95, mel: 1.15 }

const NAMES: Record<CropId, string> = {
  tom: "TOMATO · REGIONAL WHOLESALE",
  pep: "PEPPER · REGIONAL WHOLESALE",
  oni: "ONION · REGIONAL WHOLESALE",
  mel: "MELON · REGIONAL WHOLESALE",
}

export const CROP_CHIPS: ReadonlyArray<{ id: CropId; en: string; fr: string; ar: string }> = [
  { id: "tom", en: "Tomato", fr: "Tomate", ar: "طماطم" },
  { id: "pep", en: "Pepper", fr: "Piment", ar: "فلفل" },
  { id: "oni", en: "Onion", fr: "Oignon", ar: "بصل" },
  { id: "mel", en: "Melon", fr: "Melon", ar: "بطيخ" },
]

export function cropChipLabel(
  chip: (typeof CROP_CHIPS)[number],
  lang: Lang
): string {
  return lang === "fr" ? chip.fr : lang === "ar" ? chip.ar : chip.en
}

/** Price → y coordinate inside the chart viewBox. */
const toY = (p: number) => 170 - ((p - 0.5) / 1.6) * 158

export interface PriceSeries {
  subtitle: string
  now: string
  forecast: string
  /** Recorded price polyline. */
  histPath: string
  /** Dashed forecast polyline. */
  forecastPath: string
  /** Confidence-band polygon points. */
  bandPoints: string
  /** y of the "today" dot. */
  nowY: string
}

export function priceSeries(crop: CropId): PriceSeries {
  const seed = SEED[crop]

  const hist: Array<[number, number]> = []
  for (let i = 0; i <= CHART.points; i++) {
    const p =
      1.05 +
      0.42 * Math.sin(i / 9.5 + seed) +
      0.16 * Math.sin(i / 3.2 + seed * 2) +
      0.06 * Math.sin(i * 1.7)
    hist.push([i * CHART.stepX, toY(Math.max(0.62, p))])
  }

  const last = hist[CHART.points]
  const fc: Array<[number, number]> = [[CHART.todayX, last[1]]]
  for (let i = 1; i <= CHART.forecastSteps; i++) {
    const p =
      1.05 +
      0.42 * Math.sin((CHART.points + i * 1.6) / 9.5 + seed) +
      0.1 * Math.sin(i / 1.8 + seed) +
      i * 0.028
    fc.push([CHART.todayX + i * 15.5, toY(p)])
  }

  const line = (pts: Array<[number, number]>) =>
    "M" + pts.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(1)}`).join(" L")

  // The band widens as the forecast reaches further out.
  const top = fc.map(([x, y], i) => `${x.toFixed(0)},${(y - 6 - i * 3.4).toFixed(1)}`)
  const bottom = fc
    .slice()
    .reverse()
    .map(([x, y], i) => `${x.toFixed(0)},${(y + 6 + (8 - i) * 3.4).toFixed(1)}`)

  return {
    subtitle: NAMES[crop],
    now: NOW[crop].toFixed(2),
    forecast: `$${FORECAST[crop].toFixed(2)}/kg`,
    histPath: line(hist),
    forecastPath: line(fc),
    bandPoints: top.concat(bottom).join(" "),
    nowY: last[1].toFixed(1),
  }
}

export function forecastPrice(crop: CropId) {
  return FORECAST[crop]
}

/** Input cost and water draw per hectare, used by the profit simulator. */
export const PER_HECTARE = { cost: 18500, water: 4200 } as const
