/**
 * Raw hexes for the places Tailwind classes can't reach: SVG `fill`/`stroke`
 * attributes, Leaflet layer options and inline gradients. Mirrors the tokens
 * declared in `src/index.css` — change both together.
 */
export const C = {
  canvas: "#eceadf",
  surface: "#f7f4ec",
  surfaceRaised: "#fffdf7",
  card: "#ffffff",
  ink: "#1f2416",
  inkSoft: "#3a3a30",
  inkMuted: "#4a4a3f",
  muted: "#6b6353",
  muted2: "#8a8474",
  line: "#e2dcc8",
  lineStrong: "#d8d2bf",
  lineDash: "#b9b19a",
  chip: "#eee8d8",
  chip2: "#f2f0e6",
  cream: "#f0e3c0",
  sand: "#a8a695",
  sand2: "#c9c2a9",

  leaf: "#4c6b2f",
  leafDeep: "#2f4520",
  leafBright: "#4c8a3a",
  leafLight: "#9fdc7e",
  leafTint: "#e7efdc",
  leafSoft: "#d9e4c9",

  water: "#1f7fb8",
  waterDeep: "#0e5e8e",
  waterLight: "#7cc5ec",
  waterPale: "#9cc4dd",
  waterTint: "#eaf2fb",

  sun: "#d9a441",
  sunDeep: "#c77d1d",
  sunInk: "#7a5a1e",
  sunTint: "#fdf1e3",

  clay: "#b3402f",
  clayLight: "#f2a99d",
  clayTint: "#fbeae7",

  earth: "#6b4a2e",
  earth2: "#8a6a4b",
  violet: "#7a5aa8",
  violetLight: "#b9a8d9",
} as const

/** Task-category colour, shared by the calendar, month dots and year rows. */
export const TASK_COLOR = {
  w: C.water,
  t: C.sunDeep,
  r: C.leafBright,
  s: C.earth,
} as const

export type TaskKind = keyof typeof TASK_COLOR
