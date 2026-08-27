import { create } from "zustand"

import type { Lang } from "@/i18n/dict"

export type Screen =
  | "onboard"
  | "home"
  | "decide"
  | "cal"
  | "disease"
  | "market"
  | "close"

export type CalView = "plan" | "today" | "month" | "year"

/**
 * Snapshot of a REAL planned crop, taken the moment the farmer presses
 * "Plan the harvest" on a shortlist card. The calendar renders from this
 * frozen picture — economics do not silently drift when a price refreshes.
 * Coexists with the demo `planned` variety; setting one clears the other.
 */
/** One soil-preparation work item the farmer may already have done. */
export type PrepStepId = "plough" | "manure" | "fertiliser" | "beds" | "irrigation"

export interface PlannedCropPlan {
  cropId: string
  name: string
  cycleDays: number
  waterNeedMm: number
  areaHa: number
  revenueUsd: number
  costUsd: number
  usedPriceUsd: number
  /** true when the price came from a live series, false when indicative. */
  priceLive: boolean
  /** Display currency of the field country plus the USD -> currency rate. */
  currency: string
  fxRate: number
  parcelName: string
  /** The day the farmer said work begins, ISO date — day 1 of the plan. */
  startIso: string
  /** Whether the soil was already prepared when the plan was made. */
  soilPrepared: boolean
  /** Which preparation steps are already done (only meaningful when prepared). */
  prepDone: PrepStepId[]
}
export type VarietyId = "rg" | "bk" | "gr" | "mz" | "fz"
export type CropId = "tom" | "pep" | "oni" | "mel"
export type SortKey = "wps" | "profit" | "water" | "cycle" | "risk"
export type TaskStatus = "done" | "snoozed" | "skipped"

/** A drawn parcel corner, in [lat, lng]. */
export type LatLng = [number, number]

export interface AppState {
  // ── Navigation ────────────────────────────────────────────
  screen: Screen
  lang: Lang
  /** Screen-transition direction, so the shell can slide the right way. */

  // ── Scenario switches (the prototype control panel) ───────
  offline: boolean
  rain: boolean
  frost: boolean

  // ── Onboarding ────────────────────────────────────────────
  located: boolean
  /** Where the device says the farmer is; null until geolocation resolves. */
  locatedAt: [number, number] | null
  ob: 0 | 1 | 2 | 3 | 4
  pts: LatLng[]
  mapCenterTxt: string
  anLine: number
  soil: number
  wsrc: number
  sal: number
  bud: number
  pcolor: number

  // ── Decision ──────────────────────────────────────────────
  planned: VarietyId | null
  plannedCrop: PlannedCropPlan | null
  sort: SortKey
  open: VarietyId | ""

  // ── Calendar ──────────────────────────────────────────────
  calView: CalView
  /** Selected calendar day, ISO "YYYY-MM-DD"; null = today. */
  selDate: string | null
  /** The day the season plan was committed, ISO date; anchors the schedule. */
  seasonStartIso: string | null
  tstat: Partial<Record<string, TaskStatus>>

  // ── Disease flow ──────────────────────────────────────────
  dz: 0 | 1 | 2 | 3 | 4
  shots: number
  treated: boolean
  checks: boolean[]

  // ── Market ────────────────────────────────────────────────
  mkCrop: CropId
  simA: number
  simY: number

  // ── Season close ──────────────────────────────────────────
  cl: 0 | 1
  clYield: number
  clPrice: number

  toastMsg: string
}

export interface AppActions {
  go: (screen: Screen, extra?: Partial<AppState>) => void
  set: <K extends keyof AppState>(patch: Pick<AppState, K> | Partial<AppState>) => void
  toast: (msg: string) => void
  dismissToast: () => void

  setLang: (lang: Lang) => void
  toggleOffline: () => void
  toggleRain: () => void
  toggleFrost: () => void

  allowLocate: () => void
  setPts: (pts: LatLng[]) => void
  resetPts: () => void
  startAnalysis: () => void
  stopAnalysis: () => void

  commitVariety: (id: VarietyId, message: string) => void
  /** The real-shortlist counterpart of commitVariety. */
  planCrop: (plan: PlannedCropPlan, message: string) => void
  toggleVariety: (id: VarietyId) => void

  cycleTask: (id: string, status: TaskStatus) => void

  toggleCheck: (index: number) => void
  snapPhoto: () => void
  addTreatmentTasks: () => void

  goOnboard: () => void
  goDisease: () => void
  goClose: () => void

  bumpYield: (delta: number) => void
  bumpPrice: (delta: number) => void

  reset: () => void
}

const initial: AppState = {
  screen: "onboard",
  lang: "en",

  offline: false,
  rain: false,
  frost: false,

  located: false,
  locatedAt: null,
  ob: 0,
  pts: [],
  mapCenterTxt: "SAT · LOCATING…",
  anLine: 0,
  soil: 0,
  wsrc: 0,
  sal: 1,
  bud: 2,
  pcolor: 2,

  planned: null,
  plannedCrop: null,
  sort: "wps",
  open: "rg",

  calView: "today",
  selDate: null,
  seasonStartIso: null,
  tstat: {},

  dz: 0,
  shots: 0,
  treated: false,
  checks: [true, true, false, false],

  mkCrop: "tom",
  simA: 0.8,
  simY: 42,

  cl: 0,
  clYield: 38.5,
  clPrice: 1.45,

  toastMsg: "",
}

/** Timers live outside the store so a reset can always clear them. */
let toastTimer: ReturnType<typeof setTimeout> | undefined
let analysisTick: ReturnType<typeof setInterval> | undefined
let analysisDone: ReturnType<typeof setTimeout> | undefined

function clearAnalysisTimers() {
  clearInterval(analysisTick)
  clearTimeout(analysisDone)
  analysisTick = undefined
  analysisDone = undefined
}

export const useApp = create<AppState & AppActions>((set, get) => ({
  ...initial,

  go: (screen, extra) => set({ screen, ...extra }),
  set: (patch) => set(patch as Partial<AppState>),

  toast: (msg) => {
    clearTimeout(toastTimer)
    set({ toastMsg: msg })
    toastTimer = setTimeout(() => set({ toastMsg: "" }), 2600)
  },
  dismissToast: () => {
    clearTimeout(toastTimer)
    set({ toastMsg: "" })
  },

  setLang: (lang) => set({ lang }),
  toggleOffline: () => set((s) => ({ offline: !s.offline })),
  toggleRain: () => set((s) => ({ rain: !s.rain })),
  toggleFrost: () => set((s) => ({ frost: !s.frost })),

  allowLocate: () => {
    // Optimistic: open the map immediately, recentre when the fix arrives.
    // Geolocation needs HTTPS + a user gesture; failure just keeps the
    // default centre, which the farmer can pan away from.
    set({ located: true })
    get().toast("Location found — centering on your fields")
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => set({ locatedAt: [pos.coords.latitude, pos.coords.longitude] }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      )
    }
  },
  setPts: (pts) => set({ pts }),
  resetPts: () => set({ pts: [] }),

  /**
   * Fakes the satellite read: cycles the status line every 780 ms and lands on
   * the parcel card after 2.5 s, matching the prototype's timings.
   */
  startAnalysis: () => {
    clearAnalysisTimers()
    set({ ob: 1, anLine: 0 })
    analysisTick = setInterval(
      () => set((s) => ({ anLine: s.anLine + 1 })),
      780
    )
    analysisDone = setTimeout(() => {
      clearAnalysisTimers()
      set({ ob: 2 })
    }, 2500)
  },
  stopAnalysis: clearAnalysisTimers,

  commitVariety: (id, message) => {
    get().toast(message)
    // The commit day anchors the whole schedule to real dates.
    set({
      planned: id,
      plannedCrop: null,
      screen: "cal",
      calView: "plan",
      seasonStartIso: new Date().toISOString().slice(0, 10),
    })
  },

  planCrop: (plan, message) => {
    get().toast(message)
    set({
      plannedCrop: plan,
      planned: null,
      screen: "cal",
      calView: "plan",
      // The farmer's own start date anchors the whole schedule.
      seasonStartIso: plan.startIso,
    })
  },
  toggleVariety: (id) => set((s) => ({ open: s.open === id ? "" : id })),

  cycleTask: (id, status) =>
    set((s) => ({
      tstat: {
        ...s.tstat,
        [id]: s.tstat[id] === status ? undefined : status,
      },
    })),

  toggleCheck: (index) =>
    set((s) => {
      const checks = s.checks.slice()
      checks[index] = !checks[index]
      return { checks }
    }),
  snapPhoto: () => set((s) => ({ shots: Math.min(s.shots + 1, 2) })),
  addTreatmentTasks: () => set({ dz: 4, treated: true }),

  goOnboard: () => set({ screen: "onboard", ob: 0, pts: [] }),
  goDisease: () =>
    set((s) => ({
      screen: "disease",
      dz: 0,
      shots: 0,
      // The demo default must not overwrite a REAL plan: with a generic
      // plannedCrop active, resurrecting "rg" would make the season-close
      // and Decide screens claim Rio Grande beside a chickpea calendar.
      planned: s.plannedCrop ? s.planned : (s.planned ?? "rg"),
    })),
  goClose: () =>
    set((s) => ({
      screen: "close",
      cl: 0,
      planned: s.plannedCrop ? s.planned : (s.planned ?? "rg"),
    })),

  bumpYield: (delta) =>
    set((s) => ({ clYield: clamp(s.clYield + delta, 10, 60) })),
  bumpPrice: (delta) =>
    set((s) => ({ clPrice: clamp(s.clPrice + delta, 0.3, 3) })),

  reset: () => {
    clearAnalysisTimers()
    clearTimeout(toastTimer)
    set({ ...initial })
  },
}))

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

/** `true` once a variety has been committed to Parcel North. */
export const selectHasPlan = (s: AppState) => s.planned !== null
