import { useMemo } from "react"

import { CROP_SUBTITLE, SEASON_BUDGET } from "@/data/varieties"
import { missingPrep } from "@/lib/generic-plan"
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
 * season-relative day numbers and mapped onto ISO dates from the season
 * anchor. DEMO plans keep the scripted fiction (day 1 = two days before the
 * commit, so commit day = "day 3 of 8" of soil prep, matching the Today
 * feed); a GENERIC plan's day 1 is the start date the farmer chose in the
 * setup sheet — exactly, with no shift. Kept in one hook so the Today feed,
 * the month grid and the day detail can never disagree about what is
 * scheduled.
 */
export function useCalendarData() {
  const { t, td, lang, pick } = useT()
  const rain = useApp((s) => s.rain)
  const frost = useApp((s) => s.frost)
  const treated = useApp((s) => s.treated)
  const planned = useApp((s) => s.planned)
  const plannedCrop = useApp((s) => s.plannedCrop)
  const tstat = useApp((s) => s.tstat)
  const selDate = useApp((s) => s.selDate)
  const seasonStartIso = useApp((s) => s.seasonStartIso)

  return useMemo(() => {
    // Task-cost chips follow the plan's currency: a TND budget card next to a
    // "$310" chip would read as two different bills for one job. The demo
    // dollar path is untouched when no generic plan is active.
    const taskCost = (id: string): string => {
      const usd = TASK_COST[id]
      if (!usd) return ""
      if (!plannedCrop) return `$${usd}`
      try {
        return new Intl.NumberFormat(lang, {
          style: "currency",
          currency: plannedCrop.currency,
          maximumFractionDigits: 0,
        }).format(usd * plannedCrop.fxRate)
      } catch {
        return `$${usd}`
      }
    }

    /** Same conversion for the month-detail's literal dollar figures. */
    const dayCost = (usd: number): string => {
      if (!plannedCrop) return `$${usd}`
      try {
        return new Intl.NumberFormat(lang, {
          style: "currency",
          currency: plannedCrop.currency,
          maximumFractionDigits: 0,
        }).format(usd * plannedCrop.fxRate)
      } catch {
        return `$${usd}`
      }
    }

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
      cost: taskCost(id),
      moved: "",
      cancelNote: "",
      status: tstat[id],
      ...extra,
    })

    // ── Today feed ──────────────────────────────────────────
    // A generic plan starting in the future has no work TODAY: the feed
    // stays empty until the farmer's own start date arrives, and says so.
    const todayIso = isoOfDate(new Date())
    const startsLater = plannedCrop != null && todayIso < plannedCrop.startIso
    // Prep work disappears from the feed and grid ONLY when the farmer said
    // the soil is ready AND nothing recommended is missing — with gaps, the
    // Plan tab schedules a finishing phase on days 1–3 and these views must
    // show the same work, not a clean slate.
    const prepDone =
      plannedCrop != null &&
      plannedCrop.soilPrepared &&
      missingPrep(plannedCrop).length === 0
    const todayTasks: Task[] = []
    if (!startsLater) {
      // Fully prepared soil means the prep task never existed — the plan
      // opens with planting work, not a job the farmer told us is done.
      if (!prepDone) {
        todayTasks.push(
          rain
            ? task("prep", "s", td.prepT, td.prepC, "", {
                moved: "→ FRI",
                cancelNote: td.prepRain,
              })
            : task("prep", "s", td.prepT, td.prepC, td.prepW)
        )
      }
      todayTasks.push(task("flush", "w", td.flushT, td.flushC, td.flushW))
      if (treated) {
        todayTasks.push(
          task("cu1", "t", td.cu1, td.cu1C, td.cu1W, { moved: td.cuMoved })
        )
      }
      // The demo why-line names the demo variety (English only — FR/AR are
      // already generic); a generic plan swaps in the crop actually committed.
      const bedsWhy = plannedCrop
        ? td.bedsW.replace("Rio Grande", plannedCrop.name)
        : td.bedsW
      todayTasks.push(task("beds", "r", td.bedsT, td.bedsC, bedsWhy))
    }
    // The line the empty feed shows instead: the month view's rest-day copy
    // plus when the season actually begins.
    const noteLocale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
    const todayNote =
      startsLater && plannedCrop
        ? `${t.dayEmpty} ${pick("Starts", "Commence le", "يبدأ في")} ${dateOfIso(
            plannedCrop.startIso
          ).toLocaleDateString(noteLocale, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}`
        : ""

    // ── Real-date schedule ──────────────────────────────────
    // DEMO plans keep the scripted fiction: day 1 sits two days before the
    // anchor (commit day, or today for prototype deep links), so "today" is
    // always day 3 — mid soil-prep, as the Today feed narrates. A GENERIC
    // plan anchors on the farmer's stated start date with no shift: the day
    // they said work begins IS day 1, never two days after prep started.
    const anchor = seasonStartIso ? dateOfIso(seasonStartIso) : dateOfIso(isoOfDate(new Date()))
    const seasonStart = new Date(anchor)
    if (!plannedCrop) seasonStart.setDate(seasonStart.getDate() - 2)

    const schedule = new Map<string, DayMark>()
    for (let d = 1; d <= 30; d++) {
      const dots: string[] = []
      // Prepared soil has no opening prep days to dot.
      if (d <= 2 && !prepDone) dots.push(C.earth)
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
      // Same gate as the dots: prepared soil never schedules the prep job.
      if (d <= 2 && !prepDone)
        dayTasks.push({ c: C.earth, t: td.prepT, cost: d === 1 ? dayCost(310) : "" })
      if (d === 3) dayTasks.push({ c: C.water, t: td.flushT, cost: "" })
      if (d >= 5 && d <= 8)
        dayTasks.push({ c: C.leafBright, t: td.bedsT, cost: d === 5 ? dayCost(45) : "" })
      if (d >= 9 && d <= 12) {
        dayTasks.push({
          c: C.leafBright,
          t: td.transplantT,
          cost: d === 9 ? dayCost(560) : "",
        })
        if (d === 9)
          dayTasks.push({ c: C.water, t: td.waterInT, cost: "" })
      }
      if (d >= 13 && d % 2 === 1)
        dayTasks.push({ c: C.water, t: td.dripEstT, cost: dayCost(6) })
      if ([15, 22, 29].includes(d))
        dayTasks.push({ c: C.leafBright, t: td.scoutT, cost: "" })
      if (d === 19) dayTasks.push({ c: C.sunDeep, t: td.trT, cost: dayCost(26) })
      if (treated && [5, 12, 19].includes(d))
        dayTasks.push({ c: C.sunDeep, t: td.cu1, cost: dayCost(31) })
    }

    const locale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
    const dayLabel = dateOfIso(selectedIso)
      .toLocaleDateString(locale, { day: "numeric", month: "short" })
      .toUpperCase()
    // One crop line for the day header AND the budget title: the generic
    // snapshot's own name, or the demo subtitle — `planned` may be null while
    // `plannedCrop` is set, so every CROP_SUBTITLE lookup stays guarded.
    const cropLine = plannedCrop
      ? plannedCrop.name
      : planned
        ? CROP_SUBTITLE[planned]
        : ""
    const dayTitle = `${dayLabel} · ${cropLine}`
    const dayCount =
      dayTasks.length +
      (lang === "fr" ? " tâche(s)" : lang === "ar" ? " مهمة" : " task(s)")

    // ── Budget ──────────────────────────────────────────────
    const spent = Object.entries(tstat).reduce(
      (sum, [id, status]) =>
        status === "done" && TASK_COST[id] ? sum + TASK_COST[id] : sum,
      0
    )
    // A generic plan budgets from its frozen snapshot (USD internally — the
    // screen localizes); the demo keeps its scripted per-variety figures.
    const [revenue, cost] = plannedCrop
      ? [plannedCrop.revenueUsd, plannedCrop.costUsd]
      : planned
        ? SEASON_BUDGET[planned]
        : [0, 0]
    const budget: Budget = {
      title: `BUDGET · ${cropLine.toUpperCase()}`,
      revenue,
      cost,
      net: revenue - cost,
      spent,
      pct: Math.min((spent / (cost || 1)) * 100, 100),
    }

    return {
      todayTasks,
      todayNote,
      schedule,
      seasonStart,
      selectedIso,
      dayTasks,
      dayTitle,
      dayCount,
      budget,
      plannedCrop,
    }
  }, [t, td, lang, pick, rain, frost, treated, planned, plannedCrop, tstat, selDate, seasonStartIso])
}
