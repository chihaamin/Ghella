import { C, type TaskKind } from "@/lib/colors"

export interface PhaseItem {
  kind: TaskKind
  txt: string
}

export interface Phase {
  n: string
  name: string
  when: string
  cost?: string
  rev?: string
  items: PhaseItem[]
}

/** The seven-phase season plan revealed after committing a variety. */
export const PHASES: Phase[] = [
  {
    n: "A",
    name: "Soil preparation",
    when: "Sep 1–8",
    cost: "$310",
    items: [
      { kind: "s", txt: "Spread 16 t composted manure + base NPK 45-60-60, plow in at 25 cm" },
      { kind: "w", txt: "Flush and pressure-test drip lines — season need: 3,360 m³" },
      { kind: "r", txt: "Form beds 80 cm apart, lay mulch film" },
    ],
  },
  {
    n: "B",
    name: "Planting",
    when: "Sep 9–12",
    cost: "$560",
    items: [
      { kind: "r", txt: "Transplant seedlings 40 cm apart — 26,400 plants for your 0.8 ha" },
      { kind: "r", txt: "How: plant in the evening, bury to the first true leaf, firm the soil" },
      { kind: "w", txt: "Water-in 10 mm the same evening" },
    ],
  },
  {
    n: "C",
    name: "Establishment",
    when: "Sep 13–30",
    items: [
      { kind: "w", txt: "8 mm every 2 days — auto-adjusts to rain" },
      { kind: "r", txt: "Dawn check days 3–10 for cutworm; replace failed plants by day 10" },
      { kind: "t", txt: "Humid spell → preventive copper 80 g / 30 L (in stock at your supplier)" },
    ],
  },
  {
    n: "D",
    name: "Vegetative growth",
    when: "Oct",
    cost: "$240",
    items: [
      { kind: "s", txt: "Fertigate nitrogen 20 kg/ha weekly" },
      { kind: "r", txt: "Stake and first pruning at 6 true leaves" },
      { kind: "w", txt: "12 mm every 2 days as canopy closes" },
    ],
  },
  {
    n: "E",
    name: "Flowering",
    when: "Nov 1–20",
    items: [
      { kind: "w", txt: "Peak water: 25 mm ≈ 4 h drip every 2 days — never stress flowers" },
      { kind: "t", txt: "Calcium spray at first sign of blossom-end rot" },
      { kind: "r", txt: "Scout twice weekly; hang whitefly traps" },
    ],
  },
  {
    n: "F",
    name: "Fruit set & ripening",
    when: "Nov 20 – Dec 15",
    cost: "$180",
    items: [
      { kind: "s", txt: "Shift fertigation to potassium 30 kg/ha, cut nitrogen" },
      { kind: "t", txt: "Blight watch — humid 18–22° days raise auto-alerts" },
      { kind: "w", txt: "Taper to 15 mm / 2 days at first color" },
    ],
  },
  {
    n: "G",
    name: "Harvest",
    when: "Wk 46–49",
    rev: "$52,100 est. revenue",
    items: [
      { kind: "r", txt: "Pick at breaker stage every 3–4 days, in the morning" },
      { kind: "t", txt: "PHI lockouts enforced after any spray — harvest blocks itself" },
      { kind: "r", txt: "Log sales — your Season Report builds itself" },
    ],
  },
]

/** "Around you now" — what the region is doing, shown before a plan exists. */
export const STAGE_CARDS = [
  {
    crop: "Tomato",
    stage: "HARVEST NOW",
    c: C.clay,
    brief: "Regional harvest is running — fresh prices dipping, paste contracts firm.",
  },
  {
    crop: "Potato",
    stage: "PLANT ~3 WKS",
    c: C.earth2,
    brief: "Autumn window opens once soil drops below 24°C — pre-sprout seed now.",
  },
  {
    crop: "Onion",
    stage: "SOW NOW",
    c: C.violet,
    brief: "Short-day nurseries seeded this week transplant in October.",
  },
  {
    crop: "Wheat",
    stage: "SOIL PREP",
    c: C.sun,
    brief: "First rains ahead — sowing from mid-October in your zone.",
  },
] as const

export const PLANT_CHIPS = [
  ["Tomato", "$35,900"],
  ["Pepper", "$29,800"],
  ["Onion", "$19,700"],
  ["Melon", "$18,800"],
] as const

/** Year-view cell colours. */
export const YEAR_COLORS = {
  prep: C.earth,
  plant: C.leafBright,
  grow: "#7a9a5e",
  flower: C.sun,
  harv: C.clay,
  sugg: C.violetLight,
  idle: C.chip,
} as const

export type YearCell = keyof typeof YEAR_COLORS

export const YEAR_MONTHS = ["S", "O", "N", "D", "J", "F", "M", "A", "M", "J", "J", "A"]

export const YEAR_LEGEND: ReadonlyArray<{ n: string; k: YearCell }> = [
  { n: "Soil prep", k: "prep" },
  { n: "Plant", k: "plant" },
  { n: "Grow", k: "grow" },
  { n: "Flower/fruit", k: "flower" },
  { n: "Harvest", k: "harv" },
  { n: "Suggested", k: "sugg" },
]

export const YEAR_ROWS: ReadonlyArray<{ sub: string; cells: YearCell[] }> = [
  {
    sub: "Tomato Rio Grande → suggested onion follow-on",
    cells: ["prep", "grow", "flower", "harv", "sugg", "sugg", "sugg", "idle", "idle", "idle", "prep", "idle"],
  },
  {
    sub: "Suggested: Galia melon — spring cycle (not planned yet)",
    cells: ["idle", "idle", "idle", "idle", "idle", "sugg", "sugg", "sugg", "sugg", "sugg", "sugg", "idle"],
  },
  {
    sub: "Suggested: short-day onion — window opens Oct (not planned yet)",
    cells: ["idle", "sugg", "sugg", "sugg", "sugg", "sugg", "sugg", "sugg", "idle", "idle", "idle", "idle"],
  },
]
