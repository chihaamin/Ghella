import { useState, type ReactNode } from "react"
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import type { Lang } from "@/i18n/dict"
import { C } from "@/lib/colors"
import { useFF } from "@/theme/fonts"

/**
 * The Ghella month calendar — replaces the web app's react-day-picker wrapper
 * with a hand-built grid in the same clothes: Space Grotesk numerals, mono
 * weekday initials, ink-on-cream selection. Chevrons step months across year
 * boundaries; the caption shows "Month Year". Week start and names follow the
 * language (en Sunday, fr Monday, ar Saturday) and Arabic reverses the columns.
 *
 * Pass `renderDay` to draw inside the day cells (the calendar screen uses it
 * for task dots).
 */

export interface DayModifiers {
  selected: boolean
  today: boolean
  outside: boolean
}

const NAMES: Record<
  Lang,
  { months: string[]; weekdays: string[]; weekStart: number }
> = {
  en: {
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    weekStart: 0,
  },
  fr: {
    months: [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ],
    weekdays: ["di", "lu", "ma", "me", "je", "ve", "sa"],
    weekStart: 1,
  },
  ar: {
    months: [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ],
    weekdays: ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"],
    weekStart: 6,
  },
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function Calendar({
  selected,
  onSelect,
  initialMonth,
  lang = "en",
  yearSpan = 3,
  renderDay,
  style,
}: {
  selected?: Date | null
  onSelect?: (day: Date) => void
  /** Which month opens first; any date inside it. */
  initialMonth: Date
  lang?: Lang
  /** Chevrons clamp to ±yearSpan years around the initial month. */
  yearSpan?: number
  renderDay?: (day: Date, modifiers: DayModifiers) => ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const ff = useFF()
  const names = NAMES[lang]
  const isRtl = lang === "ar"

  const [month, setMonth] = useState(
    () => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1)
  )
  const minTime = new Date(initialMonth.getFullYear() - yearSpan, 0, 1).getTime()
  const maxTime = new Date(initialMonth.getFullYear() + yearSpan, 11, 1).getTime()

  const step = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1)
    if (next.getTime() < minTime || next.getTime() > maxTime) return
    setMonth(next)
  }

  // The grid: full weeks covering the month, outside days included.
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const lead = (first.getDay() - names.weekStart + 7) % 7
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - lead)
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate()
  const weekCount = Math.ceil((lead + daysInMonth) / 7)
  const today = new Date()

  const weekdayOrder = Array.from(
    { length: 7 },
    (_, i) => names.weekdays[(names.weekStart + i) % 7]
  )

  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)

  return (
    <View style={style}>
      {/* Caption: ‹ Month Year › */}
      <View
        style={{
          height: 36,
          flexDirection: rowDir,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* First child = "previous". Under row-reverse it renders at the
            inline start (the right), and the glyph mirrors — exactly what
            react-day-picker does with dir="rtl" on the web. */}
        <Pressable
          onPress={() => step(-1)}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? C.chip : "transparent",
          })}
        >
          <Text style={{ fontFamily: ff.mono.bold, fontSize: 16, color: C.lineDash }}>
            {isRtl ? "›" : "‹"}
          </Text>
        </Pressable>
        <Text style={{ fontFamily: ff.display.bold, fontSize: 14, color: C.ink }}>
          {names.months[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable
          onPress={() => step(1)}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? C.chip : "transparent",
          })}
        >
          <Text style={{ fontFamily: ff.mono.bold, fontSize: 16, color: C.lineDash }}>
            {isRtl ? "‹" : "›"}
          </Text>
        </Pressable>
      </View>

      {/* Weekday header */}
      <View style={{ flexDirection: rowDir, marginTop: 4 }}>
        {weekdayOrder.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              paddingVertical: 3,
              textAlign: "center",
              fontFamily: ff.mono.bold,
              fontSize: 9.5,
              color: C.lineDash,
              textTransform: "uppercase",
            }}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      {Array.from({ length: weekCount }, (_, w) => (
        <View key={w} style={{ flexDirection: rowDir }}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(
              start.getFullYear(),
              start.getMonth(),
              start.getDate() + w * 7 + i
            )
            const modifiers: DayModifiers = {
              selected: selected != null && sameDay(day, selected),
              today: sameDay(day, today),
              outside: day.getMonth() !== month.getMonth(),
            }
            return (
              <View key={i} style={{ flex: 1 }}>
                <Pressable
                  onPress={() => onSelect?.(day)}
                  style={{ opacity: modifiers.outside ? 0.35 : 1 }}
                >
                  {renderDay ? (
                    renderDay(day, modifiers)
                  ) : (
                    <DefaultDay day={day} modifiers={modifiers} />
                  )}
                </Pressable>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

/** Shared cell chrome: today = ink chip, selected = 2px ink ring. */
export function dayCellStyle(modifiers: {
  selected?: boolean
  today?: boolean
}): ViewStyle {
  return {
    aspectRatio: 0.92,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 8,
    ...(modifiers.today ? { backgroundColor: C.ink } : null),
    ...(modifiers.selected && !modifiers.today
      ? { borderWidth: 2, borderColor: C.ink }
      : null),
  }
}

function DefaultDay({ day, modifiers }: { day: Date; modifiers: DayModifiers }) {
  const ff = useFF()
  return (
    <View style={dayCellStyle(modifiers)}>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 11.5,
          color: modifiers.today ? C.cream : C.ink,
        }}
      >
        {day.getDate()}
      </Text>
    </View>
  )
}
