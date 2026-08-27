import type { Lang } from "@/i18n/dict"
import type { SortKey, VarietyId } from "@/store/app-store"

export interface ScoreBar {
  /** Label, e.g. "Soil match". */
  k: string
  /** 0–100. */
  n: number
  /** The sentence that explains the number. */
  note: string
}

export interface Variety {
  crop: string
  name: string
  /** Water-profit score, $/m³. */
  wps: number
  profit: string
  forecastLine: string
  /** Days left in the planting window. */
  plantD: number
  /** Cycle length in days. */
  cycle: number
  badges: string[]
  warn?: string
  warnLvl?: "amber" | "red"
  /** Season water demand, m³. */
  water: number
  bars: ScoreBar[]
}

/** What the well can deliver this season, m³. Every water score is read against it. */
export const WATER_CAPACITY = 4200

export const VARIETIES: Record<VarietyId, Variety> = {
  rg: {
    crop: "TOMATO · PASTE",
    name: "Rio Grande",
    wps: 10.7,
    profit: "$35,900",
    forecastLine: "@ forecast $1.55/kg · harvest wk 46–49",
    plantD: 18,
    cycle: 110,
    badges: ["V", "F1-2", "N"],
    water: 3360,
    bars: [
      { k: "Soil match", n: 92, note: "Sandy loam is ideal for paste tomato — deep, drains well." },
      { k: "Temperature", n: 88, note: "Sept transplant hits its 22–28°C sweet spot." },
      { k: "Water fit", n: 80, note: "Needs 3,360 m³ — your well covers it with margin." },
      { k: "Market outlook", n: 81, note: "Paste demand firm; factories contract early." },
    ],
  },
  bk: {
    crop: "PEPPER · BELL",
    name: "California Wonder",
    wps: 10.3,
    profit: "$29,800",
    forecastLine: "@ forecast $2.10/kg · harvest wk 44–48",
    plantD: 12,
    cycle: 95,
    badges: ["TMV"],
    warn: "Frost-sensitive if transplanted after Sept 20.",
    warnLvl: "amber",
    water: 2880,
    bars: [
      { k: "Soil match", n: 85, note: "Good drainage suits bell pepper." },
      { k: "Temperature", n: 90, note: "Loves the heat through October." },
      { k: "Water fit", n: 84, note: "2,880 m³ — comfortable." },
      { k: "Market outlook", n: 74, note: "Strong local demand, volatile peaks." },
    ],
  },
  gr: {
    crop: "ONION · SHORT-DAY",
    name: "Texas Early Grano",
    wps: 9.9,
    profit: "$19,700",
    forecastLine: "@ forecast $0.95/kg · harvest wk 8–12",
    plantD: 25,
    cycle: 130,
    badges: ["PR"],
    water: 1980,
    bars: [
      { k: "Soil match", n: 88, note: "Loose topsoil = clean bulbs." },
      { k: "Temperature", n: 84, note: "Mild winter fits short-day onion." },
      { k: "Water fit", n: 92, note: "Lowest demand on this list." },
      { k: "Market outlook", n: 65, note: "Stable but thin margins." },
    ],
  },
  mz: {
    crop: "MELON",
    name: "Galia F1",
    wps: 7.9,
    profit: "$18,800",
    forecastLine: "@ forecast $1.15/kg · harvest wk 2–6",
    plantD: 9,
    cycle: 88,
    badges: ["F"],
    warn: "Rotation conflict: cucurbits grew here last season.",
    warnLvl: "red",
    water: 2400,
    bars: [
      { k: "Soil match", n: 78, note: "Acceptable, prefers lighter sand." },
      { k: "Temperature", n: 70, note: "Late-window heat risk at set." },
      { k: "Water fit", n: 82, note: "2,400 m³ fits." },
      { k: "Market outlook", n: 72, note: "Early melon premium if wk 2 hit." },
    ],
  },
  fz: {
    crop: "TOMATO · FRESH",
    name: "Firenze F1",
    wps: 7.0,
    profit: "$38,200",
    forecastLine: "@ forecast $1.62/kg · harvest wk 45–50",
    plantD: 18,
    cycle: 105,
    badges: ["V"],
    warn: "Needs 5,460 m³ — 30% more water than your stated capacity.",
    warnLvl: "red",
    water: 5460,
    bars: [
      { k: "Soil match", n: 86, note: "Fine for fresh-market hybrid." },
      { k: "Temperature", n: 85, note: "OK with shade net through Sept." },
      { k: "Water fit", n: 38, note: "5,460 m³ vs your 4,200 m³ — shortfall." },
      { k: "Market outlook", n: 79, note: "Fresh prices strong at wk 45–50." },
    ],
  },
}

/** Pre-computed rankings — the prototype ships a fixed order per sort key. */
export const SORT_ORDERS: Record<SortKey, VarietyId[]> = {
  wps: ["rg", "bk", "gr", "mz", "fz"],
  profit: ["fz", "rg", "bk", "gr", "mz"],
  water: ["gr", "mz", "bk", "rg", "fz"],
  cycle: ["mz", "bk", "fz", "rg", "gr"],
  risk: ["gr", "rg", "bk", "mz", "fz"],
}

export function sortLabels(lang: Lang): Record<SortKey, string> {
  if (lang === "fr")
    return {
      wps: "Meilleur profit/eau",
      profit: "Profit max",
      water: "Moins d’eau",
      cycle: "Cycle court",
      risk: "Moins de risque",
    }
  if (lang === "ar")
    return {
      wps: "أفضل ربح/ماء",
      profit: "أعلى ربح",
      water: "أقل ماء",
      cycle: "أقصر دورة",
      risk: "أقل خطر",
    }
  return {
    wps: "Best water-profit",
    profit: "Highest profit",
    water: "Lowest water",
    cycle: "Shortest cycle",
    risk: "Lowest risk",
  }
}

/** Short label shown wherever a committed plan is referenced. */
export const CROP_SUBTITLE: Record<VarietyId, string> = {
  rg: "Tomato · Rio Grande",
  bk: "Pepper · California Wonder",
  gr: "Onion · Early Grano",
  mz: "Melon · Galia F1",
  fz: "Tomato · Firenze F1",
}

/** [estimated revenue, estimated input cost] for the committed season. */
export const SEASON_BUDGET: Record<VarietyId, [revenue: number, cost: number]> = {
  rg: [52100, 16200],
  bk: [43700, 13900],
  gr: [28900, 9200],
  mz: [29400, 10600],
  fz: [63400, 25200],
}

export const BUDGET_BANDS: ReadonlyArray<{ label: string; cap: number }> = [
  { label: "Under $5k", cap: 5000 },
  { label: "$5k – 15k", cap: 15000 },
  { label: "$15k – 30k", cap: 30000 },
  { label: "$30k+", cap: Infinity },
]
