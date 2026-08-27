import { useMemo } from "react"
import { Pressable, Text, View } from "react-native"

import { SectionLabel } from "@/components/ghella/primitives"
import { TaskCard } from "@/components/ghella/task-card"
import { FrostBanner, WeatherStrip } from "@/components/ghella/weather-strip"
import { Calendar, dayCellStyle, type DayModifiers } from "@/components/ui/calendar"
import { Progress } from "@/components/ui/progress"
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
import { FadeUp } from "@/lib/motion"
import { fmt, money, sx } from "@/lib/utils"
import { useFF } from "@/theme/fonts"
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

/* ── Shared style scraps ────────────────────────────────────── */

/** Tinted tokens the palette file doesn't carry (match web CSS vars). */
const SUN_INK_2 = "#5c4a1e"
const SUN_TINT_2 = "#fdf6e6"
/** `bg-surface/…` translucencies — surface is #f7f4ec. */
const SURFACE_15 = "rgba(247,244,236,0.15)"
const SURFACE_10 = "rgba(247,244,236,0.1)"
const SURFACE_30 = "rgba(247,244,236,0.3)"

const cardShell = {
  borderRadius: 12,
  borderWidth: 1,
  borderColor: C.line,
  backgroundColor: C.card,
} as const

/* ── Budget header ──────────────────────────────────────────── */

function BudgetCard() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const { budget, plannedCrop } = useCalendarData()
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  const ta = { textAlign: isRtl ? ("right" as const) : ("left" as const) }

  // A generic plan shows every figure in the snapshot's own currency (spent
  // included — one card, one currency); the demo keeps its scripted dollars.
  const fm = plannedCrop ? planMoney(plannedCrop, localeOf(lang)) : money

  return (
    <View
      style={{
        gap: 8,
        borderRadius: 13,
        backgroundColor: C.ink,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          flexDirection: rowDir,
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            {
              minWidth: 0,
              flex: 1,
              fontFamily: ff.mono.bold,
              fontSize: 10,
              letterSpacing: 1.2,
              color: C.sun,
            },
            ta,
          ]}
        >
          {budget.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.sand }}
        >
          {t.bdSpent} {fm(budget.spent)}
        </Text>
      </View>

      <View style={{ flexDirection: rowDir, gap: 8 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[{ fontFamily: ff.mono.bold, fontSize: 9, color: C.sand }, ta]}>
            {t.bdExp}
          </Text>
          <Text
            style={[
              { fontFamily: ff.display.bold, fontSize: 18, color: C.surface },
              ta,
            ]}
          >
            {fm(budget.cost)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[{ fontFamily: ff.mono.bold, fontSize: 9, color: C.sand }, ta]}>
            {t.bdRev}
          </Text>
          <Text
            style={[{ fontFamily: ff.display.bold, fontSize: 18, color: C.sun }, ta]}
          >
            {fm(budget.revenue)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={[{ fontFamily: ff.mono.bold, fontSize: 9, color: C.waterLight }, ta]}
          >
            {t.bdNet}
          </Text>
          <Text
            style={[
              { fontFamily: ff.display.bold, fontSize: 18, color: C.waterLight },
              ta,
            ]}
          >
            {fm(budget.net)}
          </Text>
        </View>
      </View>

      <Progress
        value={budget.pct}
        trackHeight={6}
        trackColor={SURFACE_15}
        indicatorColor={C.sun}
        style={{ borderRadius: 3 }}
      />
    </View>
  )
}

function HeadlineStats() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const { plannedCrop } = useCalendarData()
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  const ta = { textAlign: isRtl ? ("right" as const) : ("left" as const) }
  const hvDays = lang === "fr" ? "70 jours" : lang === "ar" ? "70 يومًا" : "70 days"

  const tile = {
    ...cardShell,
    flex: 1,
    gap: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const
  const label = { fontFamily: ff.mono.bold, fontSize: 9 } as const
  const value = { fontFamily: ff.display.bold, fontSize: 19 } as const
  const sub = { fontFamily: ff.sans.regular, fontSize: 10.5, color: C.muted2 } as const

  // Generic plan: the crop's own cycle and water need, money in the frozen
  // currency. Same card shell as the demo below — only the data changes.
  if (plannedCrop) {
    const revenueTxt = planMoney(plannedCrop, localeOf(lang))(plannedCrop.revenueUsd)
    // 1 mm over 1 ha = 10 m³ — the same conversion the shortlist card used.
    const waterM3 = plannedCrop.waterNeedMm * 10 * plannedCrop.areaHa
    return (
      <View style={{ flexDirection: rowDir, gap: 9 }}>
        <View style={tile}>
          <Text style={[label, { color: C.muted }, ta]}>{t.gpHarvestIn}</Text>
          <Text style={[value, { color: C.ink }, ta]}>
            ~{plannedCrop.cycleDays} {t.gpDays}
          </Text>
          <Text style={[sub, ta]}>{revenueTxt}</Text>
        </View>
        <View style={tile}>
          <Text style={[label, { color: C.waterDeep }, ta]}>{t.gpWaterPlan}</Text>
          <Text style={[value, { color: C.waterDeep }, ta]}>{fmt(waterM3)} m³</Text>
          <Text style={[sub, ta]}>
            {plannedCrop.parcelName} · {plannedCrop.areaHa.toFixed(1)} ha
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={{ flexDirection: rowDir, gap: 9 }}>
      <View style={tile}>
        <Text style={[label, { color: C.muted }, ta]}>{t.hvTitle}</Text>
        <Text style={[value, { color: C.ink }, ta]}>{hvDays}</Text>
        <Text style={[sub, ta]}>{t.hvSub}</Text>
      </View>
      <View style={tile}>
        <Text style={[label, { color: C.waterDeep }, ta]}>{t.wtTitle}</Text>
        <Text style={[value, { color: C.waterDeep }, ta]}>3,360 m³</Text>
        <Text style={[sub, ta]}>{t.wtSub}</Text>
      </View>
    </View>
  )
}

/** Where the season sits — soil prep through harvest. */
function StageBar() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const planned = useApp((s) => s.planned)
  const plannedCrop = useApp((s) => s.plannedCrop)
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  const stages = [
    { f: 0.6, c: C.leafBright },
    { f: 0.4, c: C.chip },
    { f: 2, c: C.chip },
    { f: 1.3, c: C.chip },
    { f: 1.6, c: C.chip },
  ]

  return (
    <View style={{ ...cardShell, gap: 7, paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ flexDirection: rowDir, justifyContent: "space-between" }}>
        <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.ink }}>
          {/* A generic plan names its own parcel and crop; demo keeps North. */}
          {plannedCrop
            ? `${plannedCrop.parcelName} · ${plannedCrop.name}`
            : `${t.pNorth} · ${planned ? CROP_SUBTITLE[planned] : ""}`}
        </Text>
        <Text style={{ fontFamily: ff.sans.bold, fontSize: 12, color: C.leaf }}>
          {t.calStage}
        </Text>
      </View>
      <View style={{ flexDirection: rowDir, gap: 3 }}>
        {stages.map((s, i) => (
          <View
            key={i}
            style={{ flex: s.f, height: 8, borderRadius: 4, backgroundColor: s.c }}
          >
            {i === 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -3,
                  left: "34%",
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  borderWidth: 2.5,
                  borderColor: C.surface,
                  backgroundColor: C.ink,
                }}
              />
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: rowDir, justifyContent: "space-between" }}>
        {[t.stPrep, t.stPlant, t.stVeg, t.stFlower, t.stHarv].map((s) => (
          <Text
            key={s}
            style={{ fontFamily: ff.mono.regular, fontSize: 10, color: C.muted }}
          >
            {s}
          </Text>
        ))}
      </View>
    </View>
  )
}

/* ── Empty state (no plan committed yet) ────────────────────── */

function EmptyState() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const go = useApp((s) => s.go)
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  const ta = { textAlign: isRtl ? ("right" as const) : ("left" as const) }

  return (
    <View style={{ gap: 9 }}>
      <SectionLabel style={ta}>{t.emptyNow}</SectionLabel>

      {STAGE_CARDS.map((g) => (
        <Pressable
          key={g.crop}
          onPress={() => go("decide")}
          style={{
            ...cardShell,
            flexDirection: rowDir,
            alignItems: "center",
            gap: 11,
            paddingHorizontal: 13,
            paddingVertical: 11,
          }}
        >
          <View
            style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: g.c }}
          />
          <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
            <View style={{ flexDirection: rowDir, alignItems: "center", gap: 8 }}>
              <Text
                style={{ fontFamily: ff.display.bold, fontSize: 14.5, color: C.ink }}
              >
                {g.crop}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  borderRadius: 6,
                  backgroundColor: C.chip2,
                  paddingHorizontal: 7,
                  paddingVertical: 2.5,
                  fontFamily: ff.mono.bold,
                  fontSize: 9.5,
                  color: SUN_INK_2,
                  overflow: "hidden",
                }}
              >
                {g.stage}
              </Text>
            </View>
            <Text
              style={[
                {
                  fontFamily: ff.sans.regular,
                  fontSize: 11.5,
                  lineHeight: 17,
                  color: C.muted,
                },
                ta,
              ]}
            >
              {g.brief}
            </Text>
          </View>
          <Text style={{ fontFamily: ff.sans.bold, fontSize: 14, color: C.lineDash }}>
            ›
          </Text>
        </Pressable>
      ))}

      <View
        style={{
          marginTop: 4,
          gap: 10,
          borderRadius: 14,
          backgroundColor: C.ink,
          padding: 15,
        }}
      >
        <Text
          style={[
            { fontFamily: ff.display.semibold, fontSize: 17, color: C.surface },
            ta,
          ]}
        >
          {t.emptyTitle}
        </Text>
        <Text
          style={[
            { fontFamily: ff.sans.regular, fontSize: 12, lineHeight: 18, color: C.sand },
            ta,
          ]}
        >
          {t.emptySub}
        </Text>
        <View style={{ flexDirection: rowDir, flexWrap: "wrap", gap: 6 }}>
          {PLANT_CHIPS.map(([crop, value]) => (
            <Pressable
              key={crop}
              onPress={() => go("decide")}
              style={{
                borderRadius: 8,
                borderWidth: 1,
                borderColor: SURFACE_30,
                backgroundColor: SURFACE_10,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ fontFamily: ff.mono.bold, fontSize: 11, color: C.cream }}
              >
                {crop} · ~{value}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => go("decide")}
          style={{ borderRadius: 10, backgroundColor: C.sun, paddingVertical: 12 }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: ff.sans.extrabold,
              fontSize: 13.5,
              color: C.ink,
            }}
          >
            {t.emptyCta}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

/* ── Views ──────────────────────────────────────────────────── */

function TodayView() {
  const { isRtl } = useT()
  const ff = useFF()
  const { todayTasks, todayNote } = useCalendarData()
  const base = todayNote ? 1 : 0
  return (
    <View style={{ gap: 9 }}>
      {/* A generic plan that starts in the future has no work today — the
          feed says when the season begins instead of listing early tasks. */}
      {todayNote ? (
        <FadeUp>
          <View
            style={{ ...cardShell, paddingHorizontal: 13, paddingVertical: 11 }}
          >
            <Text
              style={{
                fontFamily: ff.sans.regular,
                fontSize: 12,
                lineHeight: 18,
                color: C.muted2,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {todayNote}
            </Text>
          </View>
        </FadeUp>
      ) : null}
      {todayTasks.map((task, i) => (
        <FadeUp key={task.id} delay={(base + i) * 50}>
          <TaskCard task={task} />
        </FadeUp>
      ))}
    </View>
  )
}

function MonthView() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const { schedule, seasonStart, selectedIso, dayTasks, dayTitle, dayCount } =
    useCalendarData()
  const set = useApp((s) => s.set)
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)

  /** Day cell: real date numeral + this day's task dots. */
  const TaskDay = (day: Date, modifiers: DayModifiers) => {
    const mark = schedule.get(isoOfDate(day))
    return (
      <View
        style={sx(
          dayCellStyle(modifiers),
          !!mark?.target &&
            !modifiers.selected && { borderWidth: 1.5, borderColor: C.water }
        )}
      >
        <Text
          style={{
            fontFamily: ff.display.semibold,
            fontSize: 11.5,
            color: modifiers.today ? C.cream : C.ink,
          }}
        >
          {day.getDate()}
        </Text>
        <View style={{ flexDirection: "row", minHeight: 5, gap: 2 }}>
          {(mark?.dots ?? []).map((c, i) => (
            <View
              key={i}
              style={{ width: 4.5, height: 4.5, borderRadius: 999, backgroundColor: c }}
            />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={{ ...cardShell, borderRadius: 13, padding: 12 }}>
      <Calendar
        selected={dateOfIso(selectedIso)}
        onSelect={(d) => set({ selDate: isoOfDate(d) })}
        initialMonth={dateOfIso(selectedIso) ?? seasonStart}
        lang={lang}
        renderDay={TaskDay}
      />

      <FadeUp key={selectedIso}>
        <View
          style={{
            marginTop: 10,
            gap: 7,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.surface,
            paddingHorizontal: 12,
            paddingVertical: 11,
          }}
        >
          <View
            style={{
              flexDirection: rowDir,
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: ff.mono.bold,
                fontSize: 11,
                letterSpacing: 1.1,
                color: C.earth,
              }}
            >
              {dayTitle}
            </Text>
            <Text style={{ fontFamily: ff.mono.regular, fontSize: 10.5, color: C.muted2 }}>
              {dayCount}
            </Text>
          </View>

          {dayTasks.map((dt, i) => (
            <View
              key={i}
              style={{ flexDirection: rowDir, alignItems: "flex-start", gap: 8 }}
            >
              <View
                style={{
                  marginTop: 4,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: dt.c,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: ff.sans.semibold,
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: C.ink,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {dt.t}
              </Text>
              {dt.cost ? (
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: ff.mono.bold, fontSize: 10.5, color: C.muted }}
                >
                  {dt.cost}
                </Text>
              ) : null}
            </View>
          ))}

          {dayTasks.length === 0 && (
            <Text
              style={{
                fontFamily: ff.sans.regular,
                fontSize: 12,
                color: C.muted2,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t.dayEmpty}
            </Text>
          )}
        </View>
      </FadeUp>

      <View
        style={{ flexDirection: rowDir, flexWrap: "wrap", gap: 12, paddingTop: 10 }}
      >
        {[
          { c: C.water, n: t.legWater },
          { c: C.sunDeep, n: t.legTreat },
          { c: C.leafBright, n: t.legRoutine },
        ].map((l) => (
          <View
            key={l.n}
            style={{ flexDirection: rowDir, alignItems: "center", gap: 5 }}
          >
            <View
              style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: l.c }}
            />
            <Text style={{ fontFamily: ff.sans.semibold, fontSize: 11, color: C.muted }}>
              {l.n}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function YearView() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const { seasonStart } = useCalendarData()
  const set = useApp((s) => s.set)
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  const ta = { textAlign: isRtl ? ("right" as const) : ("left" as const) }
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
    <View style={{ ...cardShell, gap: 10, borderRadius: 13, padding: 13 }}>
      <View
        style={{
          flexDirection: rowDir,
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontFamily: ff.display.bold, fontSize: 13, color: C.ink }}>
          {t.yearTitle}
        </Text>
        <Text style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.muted2 }}>
          {range}
        </Text>
      </View>

      <View style={{ flexDirection: rowDir, alignItems: "center", gap: 6 }}>
        <View style={{ width: 56 }} />
        {months.map((m, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: ff.mono.bold,
              fontSize: 9,
              color: C.lineDash,
            }}
          >
            {monthLabel(m, "narrow")}
          </Text>
        ))}
      </View>

      {YEAR_ROWS.map((r, ri) => (
        <View key={ri} style={{ gap: 3 }}>
          <View style={{ flexDirection: rowDir, alignItems: "center", gap: 6 }}>
            <Text
              style={[
                { width: 56, fontFamily: ff.sans.bold, fontSize: 11, color: C.ink },
                ta,
              ]}
            >
              {names[ri]}
            </Text>
            {r.cells.map((k, ci) => (
              <Pressable
                key={ci}
                onPress={() => set({ calView: "month" })}
                accessibilityLabel={`${names[ri]} ${monthLabel(months[ci], "short")}`}
                style={{
                  height: 22,
                  flex: 1,
                  borderRadius: 4,
                  backgroundColor: YEAR_COLORS[k],
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: rowDir, gap: 6 }}>
            <View style={{ width: 56 }} />
            <Text
              style={[
                { flex: 1, fontFamily: ff.sans.regular, fontSize: 10.5, color: C.muted2 },
                ta,
              ]}
            >
              {r.sub}
            </Text>
          </View>
        </View>
      ))}

      <View
        style={{ flexDirection: rowDir, flexWrap: "wrap", gap: 10, paddingTop: 2 }}
      >
        {YEAR_LEGEND.map((l) => (
          <View
            key={l.n}
            style={{ flexDirection: rowDir, alignItems: "center", gap: 5 }}
          >
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                backgroundColor: YEAR_COLORS[l.k],
              }}
            />
            <Text
              style={{ fontFamily: ff.sans.semibold, fontSize: 10.5, color: C.muted }}
            >
              {l.n}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          borderRadius: 9,
          backgroundColor: C.chip2,
          paddingHorizontal: 11,
          paddingVertical: 8,
        }}
      >
        <Text
          style={[
            {
              fontFamily: ff.sans.semibold,
              fontSize: 11.5,
              lineHeight: 17,
              color: SUN_INK_2,
            },
            ta,
          ]}
        >
          {t.yearHint}
        </Text>
      </View>
    </View>
  )
}

function PlanView() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const { plannedCrop, seasonStart } = useCalendarData()
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  const ta = { textAlign: isRtl ? ("right" as const) : ("left" as const) }

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
    <View style={{ gap: 10 }}>
      {phases.map((ph, phi) => (
        <FadeUp key={ph.n} delay={phi * 50}>
          <View
            style={{
              ...cardShell,
              gap: 9,
              borderRadius: 13,
              paddingHorizontal: 13,
              paddingVertical: 12,
            }}
          >
            <View style={{ flexDirection: rowDir, alignItems: "center", gap: 9 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: ph.rev ? C.sun : C.chip,
                }}
              >
                <Text
                  style={{ fontFamily: ff.display.bold, fontSize: 12, color: C.ink }}
                >
                  {ph.n}
                </Text>
              </View>
              <Text
                style={{ fontFamily: ff.display.bold, fontSize: 14.5, color: C.ink }}
              >
                {ph.name}
              </Text>
              {/* ms-auto — push the date range to the row's far end. */}
              <View style={{ flex: 1 }} />
              <Text
                numberOfLines={1}
                style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.muted }}
              >
                {ph.when}
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              {ph.items.map((it, i) => (
                <View
                  key={i}
                  style={{ flexDirection: rowDir, alignItems: "flex-start", gap: 8 }}
                >
                  <View
                    style={{
                      marginTop: 5,
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      backgroundColor: TASK_COLOR[it.kind],
                    }}
                  />
                  <Text
                    style={[
                      {
                        flex: 1,
                        fontFamily: ff.sans.regular,
                        fontSize: 12.5,
                        lineHeight: 19,
                        color: C.inkSoft,
                      },
                      ta,
                    ]}
                  >
                    {it.txt}
                  </Text>
                </View>
              ))}
            </View>

            {ph.cost ? (
              <View style={{ flexDirection: rowDir, justifyContent: "flex-end" }}>
                <Text
                  style={{
                    borderRadius: 6,
                    backgroundColor: C.chip2,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    fontFamily: ff.mono.bold,
                    fontSize: 10.5,
                    color: C.muted,
                    overflow: "hidden",
                  }}
                >
                  {ph.cost}
                </Text>
              </View>
            ) : null}
            {ph.rev ? (
              <View style={{ flexDirection: rowDir, justifyContent: "flex-end" }}>
                <Text
                  style={{
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: C.sun,
                    backgroundColor: SUN_TINT_2,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    fontFamily: ff.mono.bold,
                    fontSize: 10.5,
                    color: C.sunInk,
                    overflow: "hidden",
                  }}
                >
                  {ph.rev}
                </Text>
              </View>
            ) : null}
          </View>
        </FadeUp>
      ))}
    </View>
  )
}

/* ── Screen ─────────────────────────────────────────────────── */

export function CalendarScreen() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const planned = useApp((s) => s.planned)
  const plannedCrop = useApp((s) => s.plannedCrop)
  const calView = useApp((s) => s.calView)
  const treated = useApp((s) => s.treated)
  const set = useApp((s) => s.set)
  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  // Either commitment fills the calendar: the demo variety or a generic plan.
  const hasPlan = planned !== null || plannedCrop !== null

  const views: Array<{ value: CalView; label: string }> = [
    { value: "plan", label: t.calPlan },
    { value: "today", label: t.calToday },
    { value: "month", label: t.calMonth },
    { value: "year", label: t.calYear },
  ]

  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <View
        style={{
          flexDirection: rowDir,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontFamily: ff.display.semibold, fontSize: 22, color: C.ink }}>
          {t.calTitle}
        </Text>
        {hasPlan && (
          <Segmented
            value={calView}
            options={views}
            onChange={(v) => set({ calView: v })}
            style={{ flexDirection: rowDir }}
          />
        )}
      </View>

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

      {treated && (
        <FadeUp>
          <View
            style={{
              flexDirection: rowDir,
              alignItems: "center",
              gap: 8,
              borderRadius: 10,
              backgroundColor: C.sunTint,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <View
              style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.sunDeep }}
            />
            <Text style={{ fontFamily: ff.sans.bold, fontSize: 12, color: C.sunInk }}>
              {t.calInjected}
            </Text>
          </View>
        </FadeUp>
      )}

      {hasPlan && (
        <FadeUp key={calView}>
          {calView === "today" && <TodayView />}
          {calView === "month" && <MonthView />}
          {calView === "year" && <YearView />}
          {calView === "plan" && <PlanView />}
        </FadeUp>
      )}
    </View>
  )
}
