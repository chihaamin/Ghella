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

export interface DayCell {
  n: string
  dots: string[]
  isToday: boolean
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

/**
 * Everything the calendar screen renders, derived from the scenario switches
 * and the committed plan. Kept in one hook so the Today feed, the month grid
 * and the day detail can never disagree about what is scheduled.
 */
export function useCalendarData() {
  const { t, td, lang } = useT()
  const rain = useApp((s) => s.rain)
  const frost = useApp((s) => s.frost)
  const treated = useApp((s) => s.treated)
  const planned = useApp((s) => s.planned)
  const tstat = useApp((s) => s.tstat)
  const selDay = useApp((s) => s.selDay)

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

    // ── Month grid ──────────────────────────────────────────
    const days: DayCell[] = []
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
      days.push({
        n: String(d),
        dots: target ? [...dots, C.leafBright] : vacated ? [] : dots,
        isToday: d === 3,
        vacated,
        target,
      })
    }

    // ── Day detail ──────────────────────────────────────────
    const dayTasks: DayTask[] = []
    const d = selDay
    if (d) {
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

    const monShort = lang === "fr" ? "SEPT" : lang === "ar" ? "سبتمبر" : "SEP"
    const dayTitle = `${monShort} ${selDay || "—"} · ${
      planned ? CROP_SUBTITLE[planned] : ""
    }`
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

    return { todayTasks, days, dayTasks, dayTitle, dayCount, budget }
  }, [t, td, lang, rain, frost, treated, planned, tstat, selDay])
}

/** Weekday initials for the month grid header. */
export function weekdayInitials(lang: string) {
  if (lang === "fr") return ["L", "M", "M", "J", "V", "S", "D"]
  if (lang === "ar") return ["ن", "ث", "ر", "خ", "ج", "س", "ح"]
  return ["M", "T", "W", "T", "F", "S", "S"]
}
