import { useMemo } from "react"

import { CROP_SUBTITLE, SEASON_BUDGET } from "@/data/varieties"
import { useT } from "@/i18n/use-t"
import { C, type TaskKind } from "@/lib/colors"
import { useApp, type TaskStatus } from "@/store/app-store"

/** What each completable task costs, in dollars. Drives the "spent" bar. */
export const TASK_COST: Record<string, number> = {
  prep: 310,
  beds: 45,
  irr: 18,
  tr: 26,
  cu1: 31,
}

export interface Task {
  id: string
  kind: TaskKind
  parcel: string
  title: string
  /** The computed quantity — dose, volume, duration. */
  calc: string
  /** The one-line reason the task exists today. */
  why: string
  cost: string
  /** Set when weather pushed the task to another day. */
  moved: string
  /** Set when weather cancelled the task outright. */
  cancelNote: string
  status?: TaskStatus
}

/** What one real calendar day carries, keyed by ISO "YYYY-MM-DD". */
export interface DayMark {
  dots: string[]
  /** Frost moved a task off this day. */
  vacated: boolean
  /** Frost moved a task onto this day. */
  target: boolean
}

export interface DayTask {
  c: string
  t: string
  cost: string
}

export interface Budget {
  title: string
  revenue: number
  cost: number
  net: number
  spent: number
  pct: number
}

/** Local-noon Date for an ISO day — immune to timezone backslides. */
export function dateOfIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

/** ISO "YYYY-MM-DD" of a Date, in local time. */
export function isoOfDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

/** Whole days from a to b (local noon to local noon). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Everything the calendar screen renders, derived from the scenario switches
 * and the committed plan, on REAL calendar dates. The schedule is authored in
 * season-relative day numbers (day 1 = two days before the commit, so that
 * commit day = "day 3 of 8" of soil prep, matching the Today feed) and mapped
 * onto ISO dates from the season anchor. Kept in one hook so the Today feed,
 * the month grid and the day detail can never disagree about what is
 * scheduled.
 */
export function useCalendarData() {
  const { t, td, lang } = useT()
  const rain = useApp((s) => s.rain)
  const frost = useApp((s) => s.frost)
  const treated = useApp((s) => s.treated)
  const planned = useApp((s) => s.planned)
  const tstat = useApp((s) => s.tstat)
  const selDate = useApp((s) => s.selDate)
  const seasonStartIso = useApp((s) => s.seasonStartIso)

  return useMemo(() => {
    const task = (
      id: string,
      kind: TaskKind,
      title: string,
      calc: string,
      why: string,
      extra?: Partial<Task>
    ): Task => ({
      id,
      kind,
      parcel: t.pNorth,
      title,
      calc,
      why,
      cost: TASK_COST[id] ? `$${TASK_COST[id]}` : "",
      moved: "",
      cancelNote: "",
      status: tstat[id],
      ...extra,
    })

    // ── Today feed ──────────────────────────────────────────
    const todayTasks: Task[] = []
    todayTasks.push(
      rain
        ? task("prep", "s", td.prepT, td.prepC, "", {
            moved: "→ FRI",
            cancelNote: td.prepRain,
          })
        : task("prep", "s", td.prepT, td.prepC, td.prepW)
    )
    todayTasks.push(task("flush", "w", td.flushT, td.flushC, td.flushW))
    if (treated) {
      todayTasks.push(
        task("cu1", "t", td.cu1, td.cu1C, td.cu1W, { moved: td.cuMoved })
      )
    }
    todayTasks.push(task("beds", "r", td.bedsT, td.bedsC, td.bedsW))

    // ── Real-date schedule ──────────────────────────────────
    // Day 1 of the season sits two days before the anchor (commit day, or
    // today for prototype deep links), so "today" is always day 3 — the
    // soil-prep stretch the Today feed narrates.
    const anchor = seasonStartIso ? dateOfIso(seasonStartIso) : dateOfIso(isoOfDate(new Date()))
    const seasonStart = new Date(anchor)
    seasonStart.setDate(seasonStart.getDate() - 2)

    const schedule = new Map<string, DayMark>()
    for (let d = 1; d <= 30; d++) {
      const dots: string[] = []
      if (d <= 2) dots.push(C.earth)
      if (d === 3) dots.push(C.water)
      if (d >= 5 && d <= 12) dots.push(C.leafBright)
      if (d >= 13 && d % 2 === 1) dots.push(C.water)
      if ([15, 22, 29].includes(d)) dots.push(C.leafBright)
      if (d === 19 || (treated && [5, 12].includes(d))) dots.push(C.sunDeep)

      const vacated = frost && d === 8
      const target = frost && d === 11
      const date = new Date(seasonStart)
      date.setDate(date.getDate() + (d - 1))
      schedule.set(isoOfDate(date), {
        dots: target ? [...dots, C.leafBright] : vacated ? [] : dots,
        vacated,
        target,
      })
    }

    // ── Day detail ──────────────────────────────────────────
    // The selected real date maps back to its season-relative day number;
    // days outside the 30-day plan simply have no tasks.
    const selectedIso = selDate ?? isoOfDate(new Date())
    const dayTasks: DayTask[] = []
    const d = daysBetween(seasonStart, dateOfIso(selectedIso)) + 1
    if (d >= 1 && d <= 30) {
      if (d <= 2)
        dayTasks.push({ c: C.earth, t: td.prepT, cost: d === 1 ? "$310" : "" })
      if (d === 3) dayTasks.push({ c: C.water, t: td.flushT, cost: "" })
      if (d >= 5 && d <= 8)
        dayTasks.push({ c: C.leafBright, t: td.bedsT, cost: d === 5 ? "$45" : "" })
      if (d >= 9 && d <= 12) {
        dayTasks.push({
          c: C.leafBright,
          t: td.transplantT,
          cost: d === 9 ? "$560" : "",
        })
        if (d === 9)
          dayTasks.push({ c: C.water, t: td.waterInT, cost: "" })
      }
      if (d >= 13 && d % 2 === 1)
        dayTasks.push({ c: C.water, t: td.dripEstT, cost: "$6" })
      if ([15, 22, 29].includes(d))
        dayTasks.push({ c: C.leafBright, t: td.scoutT, cost: "" })
      if (d === 19) dayTasks.push({ c: C.sunDeep, t: td.trT, cost: "$26" })
      if (treated && [5, 12, 19].includes(d))
        dayTasks.push({ c: C.sunDeep, t: td.cu1, cost: "$31" })
    }

    const locale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
    const dayLabel = dateOfIso(selectedIso)
      .toLocaleDateString(locale, { day: "numeric", month: "short" })
      .toUpperCase()
    const dayTitle = `${dayLabel} · ${planned ? CROP_SUBTITLE[planned] : ""}`
    const dayCount =
      dayTasks.length +
      (lang === "fr" ? " tâche(s)" : lang === "ar" ? " مهمة" : " task(s)")

    // ── Budget ──────────────────────────────────────────────
    const spent = Object.entries(tstat).reduce(
      (sum, [id, status]) =>
        status === "done" && TASK_COST[id] ? sum + TASK_COST[id] : sum,
      0
    )
    const [revenue, cost] = planned ? SEASON_BUDGET[planned] : [0, 0]
    const budget: Budget = {
      title: `BUDGET · ${(planned ? CROP_SUBTITLE[planned] : "").toUpperCase()}`,
      revenue,
      cost,
      net: revenue - cost,
      spent,
      pct: Math.min((spent / (cost || 1)) * 100, 100),
    }

    return {
      todayTasks,
      schedule,
      seasonStart,
      selectedIso,
      dayTasks,
      dayTitle,
      dayCount,
      budget,
    }
  }, [t, td, lang, rain, frost, treated, planned, tstat, selDate, seasonStartIso])
}
