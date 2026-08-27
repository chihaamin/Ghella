import { AnimatePresence, motion } from "framer-motion"
import { useMemo } from "react"
import type { DayButtonProps } from "react-day-picker"
import { ar as arLocale, enUS, fr as frLocale } from "react-day-picker/locale"

import { SectionLabel } from "@/components/ghella/primitives"
import { TaskCard } from "@/components/ghella/task-card"
import { FrostBanner, WeatherStrip } from "@/components/ghella/weather-strip"
import { Calendar, dayButtonClass } from "@/components/ui/calendar"
import { Segmented } from "@/components/ui/segmented"
import {
  PHASES,
  PLANT_CHIPS,
  STAGE_CARDS,
  YEAR_COLORS,
  YEAR_LEGEND,
  YEAR_ROWS,
} from "@/data/plan"
import { CROP_SUBTITLE } from "@/data/varieties"
import { dateOfIso, isoOfDate, useCalendarData } from "@/hooks/use-calendar"
import type { Lang } from "@/i18n/dict"
import { useT } from "@/i18n/use-t"
import { C, TASK_COLOR } from "@/lib/colors"
import { genericPhases } from "@/lib/generic-plan"
import { fadeUp, listStagger } from "@/lib/motion"
import { cn, fmt, money } from "@/lib/utils"
import { useApp, type CalView, type PlannedCropPlan } from "@/store/app-store"

/* ── Generic-plan money ─────────────────────────────────────── */

/** The app's three UI languages as Intl locales — same mapping as elsewhere. */
function localeOf(lang: Lang): string {
  return lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
}

/**
 * Money formatter for a generic plan, in the currency and rate FROZEN into
 * the snapshot at commit — mirrors `use-local-currency`'s formatting without
 * the hook, because a live FX refresh must never silently move a budget the
 * farmer already said yes to. Whole amounts: season money has no honest cents.
 */
function planMoney(plan: PlannedCropPlan, locale: string): (usd: number) => string {
  return (usd) => {
    const value = usd * plan.fxRate
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: plan.currency,
        maximumFractionDigits: 0,
      }).format(value)
    } catch {
      // Intl does not know the code — still say which currency it is.
      return `${plan.currency} ${fmt(value)}`
    }
  }
}

/* ── Budget header ──────────────────────────────────────────── */

function BudgetCard() {
  const { t, lang } = useT()
  const { budget, plannedCrop } = useCalendarData()

  // A generic plan shows every figure in the snapshot's own currency (spent
  // included — one card, one currency); the demo keeps its scripted dollars.
  const fm = plannedCrop ? planMoney(plannedCrop, localeOf(lang)) : money

  return (
    <div className="flex flex-col gap-2 rounded-[13px] bg-ink px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold tracking-[0.12em] text-sun">
          {budget.title}
        </span>
        <span className="flex-none font-mono text-[10px] font-bold whitespace-nowrap text-sand">
          {t.bdSpent} {fm(budget.spent)}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-px">
          <span className="font-mono text-[9px] font-bold text-sand">{t.bdExp}</span>
          <span className="font-display text-lg font-bold text-surface">
            {fm(budget.cost)}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-px">
          <span className="font-mono text-[9px] font-bold text-sand">{t.bdRev}</span>
          <span className="font-display text-lg font-bold text-sun">
            {fm(budget.revenue)}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-px">
          <span className="font-mono text-[9px] font-bold text-water-light">{t.bdNet}</span>
          <span className="font-display text-lg font-bold text-water-light">
            {fm(budget.net)}
          </span>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-[3px] bg-surface/15">
        <motion.div
          className="h-full rounded-[3px] bg-sun"
          initial={{ width: 0 }}
          animate={{ width: `${budget.pct}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 24 }}
        />
      </div>
    </div>
  )
}

function HeadlineStats() {
  const { t, lang } = useT()
  const { plannedCrop } = useCalendarData()
  const hvDays = lang === "fr" ? "70 jours" : lang === "ar" ? "70 يومًا" : "70 days"

  // Generic plan: the crop's own cycle and water need, money in the frozen
  // currency. Same card shell as the demo below — only the data changes.
  if (plannedCrop) {
    const revenueTxt = planMoney(plannedCrop, localeOf(lang))(plannedCrop.revenueUsd)
    // 1 mm over 1 ha = 10 m³ — the same conversion the shortlist card used.
    const waterM3 = plannedCrop.waterNeedMm * 10 * plannedCrop.areaHa
    return (
      <div className="grid grid-cols-2 gap-[9px]">
        <div className="flex flex-col gap-px rounded-xl border border-line bg-card px-3 py-2.5">
          <span className="font-mono text-[9px] font-bold text-muted">{t.gpHarvestIn}</span>
          <span className="font-display text-[19px] font-bold">
            ~{plannedCrop.cycleDays} {t.gpDays}
          </span>
          <span className="text-[10.5px] text-muted-2">{revenueTxt}</span>
        </div>
        <div className="flex flex-col gap-px rounded-xl border border-line bg-card px-3 py-2.5">
          <span className="font-mono text-[9px] font-bold text-water-deep">{t.gpWaterPlan}</span>
          <span className="font-display text-[19px] font-bold text-water-deep">
            {fmt(waterM3)} m³
          </span>
          <span className="text-[10.5px] text-muted-2">
            {plannedCrop.parcelName} · {plannedCrop.areaHa.toFixed(1)} ha
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-[9px]">
      <div className="flex flex-col gap-px rounded-xl border border-line bg-card px-3 py-2.5">
        <span className="font-mono text-[9px] font-bold text-muted">{t.hvTitle}</span>
        <span className="font-display text-[19px] font-bold">{hvDays}</span>
        <span className="text-[10.5px] text-muted-2">{t.hvSub}</span>
      </div>
      <div className="flex flex-col gap-px rounded-xl border border-line bg-card px-3 py-2.5">
        <span className="font-mono text-[9px] font-bold text-water-deep">{t.wtTitle}</span>
        <span className="font-display text-[19px] font-bold text-water-deep">3,360 m³</span>
        <span className="text-[10.5px] text-muted-2">{t.wtSub}</span>
      </div>
    </div>
  )
}

/** Where the season sits — soil prep through harvest. */
function StageBar() {
  const { t } = useT()
  const planned = useApp((s) => s.planned)
  const plannedCrop = useApp((s) => s.plannedCrop)
  const stages = [
    { f: 0.6, c: C.leafBright },
    { f: 0.4, c: C.chip },
    { f: 2, c: C.chip },
    { f: 1.3, c: C.chip },
    { f: 1.6, c: C.chip },
  ]

  return (
    <div className="flex flex-col gap-[7px] rounded-xl border border-line bg-card px-3 py-2.5">
      <div className="flex justify-between text-[12px] font-semibold">
        <span>
          {/* A generic plan names its own parcel and crop; demo keeps North. */}
          {plannedCrop
            ? `${plannedCrop.parcelName} · ${plannedCrop.name}`
            : `${t.pNorth} · ${planned ? CROP_SUBTITLE[planned] : ""}`}
        </span>
        <span className="font-bold text-leaf">{t.calStage}</span>
      </div>
      <div className="flex gap-[3px]">
        {stages.map((s, i) => (
          <div
            key={i}
            className="relative h-2 rounded-[4px]"
            style={{ flex: s.f, background: s.c }}
          >
            {i === 0 && (
              <span className="absolute -top-[3px] left-[34%] size-3.5 rounded-full border-[2.5px] border-surface bg-ink" />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted">
        <span>{t.stPrep}</span>
        <span>{t.stPlant}</span>
        <span>{t.stVeg}</span>
        <span>{t.stFlower}</span>
        <span>{t.stHarv}</span>
      </div>
    </div>
  )
}

/* ── Empty state (no plan committed yet) ────────────────────── */

function EmptyState() {
  const { t } = useT()
  const go = useApp((s) => s.go)

  return (
    <div className="flex flex-col gap-[9px]">
      <SectionLabel>{t.emptyNow}</SectionLabel>

      {STAGE_CARDS.map((g) => (
        <button
          key={g.crop}
          type="button"
          onClick={() => go("decide")}
          className="flex cursor-pointer items-center gap-[11px] rounded-xl border border-line bg-card px-[13px] py-[11px] text-start"
        >
          <span className="size-2.5 flex-none rounded-full" style={{ background: g.c }} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-display text-[14.5px] font-bold">{g.crop}</span>
              <span className="rounded-[6px] bg-chip-2 px-[7px] py-[2.5px] font-mono text-[9.5px] font-bold whitespace-nowrap text-sun-ink-2">
                {g.stage}
              </span>
            </div>
            <span className="text-[11.5px] leading-[1.45] text-muted">{g.brief}</span>
          </div>
          <span className="text-[14px] font-bold text-line-dash">›</span>
        </button>
      ))}

      <div className="mt-1 flex flex-col gap-2.5 rounded-[14px] bg-ink p-[15px]">
        <div className="font-display text-[17px] font-semibold text-surface">
          {t.emptyTitle}
        </div>
        <div className="text-[12px] leading-[1.5] text-sand">{t.emptySub}</div>
        <div className="flex flex-wrap gap-1.5">
          {PLANT_CHIPS.map(([crop, value]) => (
            <button
              key={crop}
              type="button"
              onClick={() => go("decide")}
              className="cursor-pointer rounded-lg border border-surface/30 bg-surface/10 px-2.5 py-1.5 font-mono text-[11px] font-bold whitespace-nowrap text-cream"
            >
              {crop} · ~{value}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go("decide")}
          className="cursor-pointer rounded-[10px] bg-sun py-3 text-center text-[13.5px] font-extrabold text-ink"
        >
          {t.emptyCta}
        </button>
      </div>
    </div>
  )
}

/* ── Views ──────────────────────────────────────────────────── */

function TodayView() {
  const { todayTasks, todayNote } = useCalendarData()
  return (
    <motion.div
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-[9px]"
    >
      {/* A generic plan that starts in the future has no work today — the
          feed says when the season begins instead of listing early tasks. */}
      {todayNote && (
        <motion.div
          variants={fadeUp}
          className="rounded-xl border border-line bg-card px-[13px] py-[11px] text-[12px] leading-[1.5] text-muted-2"
        >
          {todayNote}
        </motion.div>
      )}
      {todayTasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </motion.div>
  )
}

function MonthView() {
  const { t, lang } = useT()
  const { schedule, seasonStart, selectedIso, dayTasks, dayTitle, dayCount } =
    useCalendarData()
  const set = useApp((s) => s.set)

  // react-day-picker speaks date-fns locales; ours map 1:1.
  const locale = lang === "fr" ? frLocale : lang === "ar" ? arLocale : enUS

  /** Day cell: real date numeral + this day's task dots. */
  const TaskDay = (props: DayButtonProps) => {
    const { day, modifiers, ...button } = props
    const mark = schedule.get(isoOfDate(day.date))
    return (
      <button
        {...button}
        type="button"
        className={cn(
          dayButtonClass(modifiers),
          mark?.target && !modifiers.selected && "border-[1.5px] border-water"
        )}
      >
        <span className="font-display text-[11.5px] font-semibold">
          {day.date.getDate()}
        </span>
        <span className="flex min-h-[5px] gap-0.5">
          {(mark?.dots ?? []).map((c, i) => (
            <span
              key={i}
              className="size-[4.5px] rounded-full"
              style={{ background: c }}
            />
          ))}
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-[13px] border border-line bg-card p-3">
      <Calendar
        mode="single"
        selected={dateOfIso(selectedIso)}
        onSelect={(d) => d && set({ selDate: isoOfDate(d) })}
        defaultMonth={dateOfIso(selectedIso) ?? seasonStart}
        captionLayout="dropdown"
        startMonth={new Date(seasonStart.getFullYear() - 3, 0)}
        endMonth={new Date(seasonStart.getFullYear() + 3, 11)}
        locale={locale}
        dir={lang === "ar" ? "rtl" : "ltr"}
        components={{ DayButton: TaskDay }}
      />

      <motion.div
        key={selectedIso}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mt-2.5 flex flex-col gap-[7px] rounded-[11px] border border-line bg-surface px-3 py-[11px]"
      >
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-earth">
            {dayTitle}
          </span>
          <span className="font-mono text-[10.5px] text-muted-2">{dayCount}</span>
        </div>

        {dayTasks.map((dt, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className="mt-1 size-2 flex-none rounded-full"
              style={{ background: dt.c }}
            />
            <span className="flex-1 text-[12.5px] leading-[1.4] font-semibold">{dt.t}</span>
            {dt.cost && (
              <span className="font-mono text-[10.5px] font-bold whitespace-nowrap text-muted">
                {dt.cost}
              </span>
            )}
          </div>
        ))}

        {dayTasks.length === 0 && (
          <span className="text-[12px] text-muted-2">{t.dayEmpty}</span>
        )}
      </motion.div>

      <div className="flex flex-wrap gap-3 pt-2.5">
        {[
          { c: C.water, n: t.legWater },
          { c: C.sunDeep, n: t.legTreat },
          { c: C.leafBright, n: t.legRoutine },
        ].map((l) => (
          <span
            key={l.n}
            className="flex items-center gap-[5px] text-[11px] font-semibold text-muted"
          >
            <span className="size-[7px] rounded-full" style={{ background: l.c }} />
            {l.n}
          </span>
        ))}
      </div>
    </div>
  )
}

function YearView() {
  const { t, lang } = useT()
  const { seasonStart } = useCalendarData()
  const set = useApp((s) => s.set)
  const names = [t.pNorth, t.pOued, t.pHill]

  // Twelve real months rolling from the season's start month — the strip
  // follows the actual year instead of a hardcoded SEP→AUG.
  const locale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(seasonStart.getFullYear(), seasonStart.getMonth() + i, 1)
    return d
  })
  const monthLabel = (d: Date, form: "narrow" | "short") =>
    d.toLocaleDateString(locale, { month: form })
  const range = `${monthLabel(months[0], "short").toUpperCase()} ${months[0].getFullYear()} → ${monthLabel(months[11], "short").toUpperCase()} ${months[11].getFullYear()}`

  return (
    <div className="flex flex-col gap-2.5 rounded-[13px] border border-line bg-card p-[13px]">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[13px] font-bold">{t.yearTitle}</span>
        <span className="font-mono text-[10px] font-bold text-muted-2">{range}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-14 flex-none" />
        {months.map((m, i) => (
          <span
            key={i}
            className="flex-1 text-center font-mono text-[9px] font-bold text-line-dash"
          >
            {monthLabel(m, "narrow")}
          </span>
        ))}
      </div>

      {YEAR_ROWS.map((r, ri) => (
        <div key={ri} className="flex flex-col gap-[3px]">
          <div className="flex items-center gap-1.5">
            <span className="w-14 flex-none text-[11px] font-bold">{names[ri]}</span>
            {r.cells.map((k, ci) => (
              <button
                key={ci}
                type="button"
                onClick={() => set({ calView: "month" })}
                className="h-[22px] flex-1 cursor-pointer rounded-[4px]"
                style={{ background: YEAR_COLORS[k] }}
                aria-label={`${names[ri]} ${monthLabel(months[ci], "short")}`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <span className="w-14 flex-none" />
            <span className="text-[10.5px] text-muted-2">{r.sub}</span>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2.5 pt-0.5">
        {YEAR_LEGEND.map((l) => (
          <span
            key={l.n}
            className="flex items-center gap-[5px] text-[10.5px] font-semibold text-muted"
          >
            <span
              className="size-[9px] rounded-[3px]"
              style={{ background: YEAR_COLORS[l.k] }}
            />
            {l.n}
          </span>
        ))}
      </div>

      <div className="rounded-[9px] bg-chip-2 px-[11px] py-2 text-[11.5px] leading-[1.5] font-semibold text-sun-ink-2">
        {t.yearHint}
      </div>
    </div>
  )
}

function PlanView() {
  const { t, lang } = useT()
  const { plannedCrop, seasonStart } = useCalendarData()

  // Generic plans derive their phases from the committed snapshot; the demo
  // keeps its scripted PHASES. Both feed the SAME card JSX below — the plan
  // view must read as the data changing, never the UI.
  const phases = useMemo(() => {
    if (!plannedCrop) return PHASES
    // With a generic plan the hook's seasonStart IS the farmer's chosen
    // start date — day 1 of the generator's maths, passed through unshifted
    // so no phase can ever open before the day they said work begins.
    const locale = localeOf(lang)
    return genericPhases(plannedCrop, seasonStart, t, planMoney(plannedCrop, locale), locale)
  }, [plannedCrop, seasonStart, t, lang])

  return (
    <motion.div
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-2.5"
    >
      {phases.map((ph) => (
        <motion.div
          key={ph.n}
          variants={fadeUp}
          className="flex flex-col gap-[9px] rounded-[13px] border border-line bg-card px-[13px] py-3"
        >
          <div className="flex items-center gap-[9px]">
            <span
              className={cn(
                "flex size-6 flex-none items-center justify-center rounded-lg font-display text-[12px] font-bold text-ink",
                ph.rev ? "bg-sun" : "bg-chip"
              )}
            >
              {ph.n}
            </span>
            <span className="font-display text-[14.5px] font-bold">{ph.name}</span>
            <span className="ms-auto font-mono text-[10px] font-bold whitespace-nowrap text-muted">
              {ph.when}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {ph.items.map((it, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="mt-[5px] size-[7px] flex-none rounded-full"
                  style={{ background: TASK_COLOR[it.kind] }}
                />
                <span className="text-[12.5px] leading-[1.5] text-ink-soft">{it.txt}</span>
              </div>
            ))}
          </div>

          {ph.cost && (
            <div className="flex justify-end">
              <span className="rounded-[6px] bg-chip-2 px-2 py-[3px] font-mono text-[10.5px] font-bold text-muted">
                {ph.cost}
              </span>
            </div>
          )}
          {ph.rev && (
            <div className="flex justify-end">
              <span className="rounded-[6px] border border-sun bg-sun-tint-2 px-2 py-[3px] font-mono text-[10.5px] font-bold text-sun-ink">
                {ph.rev}
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

/* ── Screen ─────────────────────────────────────────────────── */

export function CalendarScreen() {
  const { t } = useT()
  const planned = useApp((s) => s.planned)
  const plannedCrop = useApp((s) => s.plannedCrop)
  const calView = useApp((s) => s.calView)
  const treated = useApp((s) => s.treated)
  const set = useApp((s) => s.set)
  // Either commitment fills the calendar: the demo variety or a generic plan.
  const hasPlan = planned !== null || plannedCrop !== null

  const views: Array<{ value: CalView; label: string }> = [
    { value: "plan", label: t.calPlan },
    { value: "today", label: t.calToday },
    { value: "month", label: t.calMonth },
    { value: "year", label: t.calYear },
  ]

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between">
        <div className="font-display text-[22px] font-semibold">{t.calTitle}</div>
        {hasPlan && (
          <Segmented
            layoutId="cal-view"
            value={calView}
            options={views}
            onChange={(v) => set({ calView: v })}
          />
        )}
      </div>

      {hasPlan && (
        <>
          <BudgetCard />
          <HeadlineStats />
        </>
      )}

      {!hasPlan && <EmptyState />}
      {hasPlan && <StageBar />}

      <WeatherStrip />
      <FrostBanner />

      <AnimatePresence>
        {treated && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="exit"
            className="flex items-center gap-2 rounded-[10px] bg-sun-tint px-3 py-2"
          >
            <span className="size-2 rounded-full bg-sun-deep" />
            <span className="text-[12px] font-bold text-sun-ink">{t.calInjected}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {hasPlan && (
        <AnimatePresence mode="wait">
          <motion.div
            key={calView}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {calView === "today" && <TodayView />}
            {calView === "month" && <MonthView />}
            {calView === "year" && <YearView />}
            {calView === "plan" && <PlanView />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
