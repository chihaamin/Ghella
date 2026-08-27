import { C } from "@/lib/colors"

/** Status lines cycled while the satellite read runs. */
export const ANALYSIS_LINES = [
  "Reading 10 years of satellite history…",
  "Pulling local weather station data…",
  "Estimating soil from geology maps…",
  "Computing frost dates…",
]

/** The parcel card revealed once the read finishes. */
export const PARCEL_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "CLIMATE ZONE", v: "Semi-arid · steppe" },
  { k: "FROST WINDOW", v: "Dec 8 → Mar 2" },
  { k: "RAINFALL (10-YR)", v: "285 mm/yr" },
  { k: "ELEVATION · SLOPE", v: "68 m · 1.8%" },
  { k: "EST. SOIL", v: "Sandy loam" },
  { k: "SUN HOURS", v: "3,240 h/yr" },
]

export const SOILS = [
  { name: "Sandy loam", tex: "radial-gradient(circle at 30% 30%,#c9b28a,#a98e63)" },
  { name: "Clay loam", tex: "radial-gradient(circle at 40% 40%,#9a7a55,#6b4a2e)" },
  { name: "Silty", tex: "radial-gradient(circle at 35% 35%,#b8a98e,#8f8168)" },
] as const

export const WATER_SOURCES = [
  { name: "Drip", sub: "well · 2 L/s" },
  { name: "Sprinkler", sub: "pump + lines" },
  { name: "Flood / furrow", sub: "canal turn" },
  { name: "Rainfed", sub: "no irrigation" },
] as const

/** Available season volume, one line per water source above. */
export const WATER_ESTIMATES = [
  "≈ 5,200 m³/season available (2 L/s × 6 h/day)",
  "≈ 4,600 m³ effective — 12% wind/evap loss",
  "≈ 6,800 m³ needed — high evaporation loss",
  "Rainfall only — 285 mm expected this season",
]

export const SALINITY = [
  { name: "None known" },
  { name: "Slight" },
  { name: "Saline patches" },
] as const

/** Short forms used to compose the closing summary sentence. */
export const WATER_SHORT = ["drip", "sprinkler", "flood", "rainfed"]
export const SALINITY_SHORT = ["no salinity", "slight salinity", "saline patches"]

export const PARCEL_COLORS = [
  C.leafBright,
  C.water,
  C.violet,
  C.sun,
  C.clay,
] as const

/** Where the satellite map opens before the device reports a fix. */
export const MAP_START: [number, number] = [36.7078, -119.685]
export const MAX_PARCEL_POINTS = 8
