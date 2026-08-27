import { useEffect, useRef } from "react"
import {
  Animated,
  Pressable,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native"

import { useT } from "@/i18n/use-t"
import { C, TASK_COLOR } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { sx } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import type { Task } from "@/hooks/use-calendar"
import { useFF } from "@/theme/fonts"

import { WaterDrop } from "./icons"

const CHIP_BG = {
  w: C.waterTint,
  t: C.sunTint,
  s: "#f0e6dc", // chip-3
  r: C.leafTint,
} as const

/**
 * One row of the Today feed. Everything about a task is on the card: what to
 * do, the computed quantity, why today, and what the weather did to it.
 */
export function TaskCard({ task }: { task: Task }) {
  const { t, td, isRtl } = useT()
  const ff = useFF()
  const cycleTask = useApp((s) => s.cycleTask)

  const done = task.status === "done"
  const skipped = task.status === "skipped"
  const snoozed = task.status === "snoozed"
  const color = TASK_COLOR[task.kind]
  const typeLabel = {
    w: td.wType,
    t: td.tType,
    s: td.sType,
    r: td.rType,
  }[task.kind]

  // Web: `animate={{ opacity: snoozed ? 0.55 : 1 }}` — ease the card in and
  // out of the dimmed snoozed state instead of snapping.
  const dim = useRef(new Animated.Value(snoozed ? 0.55 : 1)).current
  useEffect(() => {
    Animated.timing(dim, {
      toValue: snoozed ? 0.55 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [dim, snoozed])

  const row: ViewStyle = { flexDirection: isRtl ? "row-reverse" : "row" }
  const alignText: TextStyle = { textAlign: isRtl ? "right" : "left" }

  return (
    <Animated.View
      style={[
        row,
        {
          opacity: dim,
          overflow: "hidden",
          borderRadius: 13,
          borderWidth: 1,
          borderColor: C.line,
          backgroundColor: C.card,
        },
      ]}
    >
      <View style={{ width: 6, backgroundColor: color }} />

      <View
        style={{
          minWidth: 0,
          flex: 1,
          flexDirection: "column",
          gap: 6,
          paddingHorizontal: 13,
          paddingVertical: 11,
        }}
      >
        <View style={sx(row, { alignItems: "center", gap: 8 })}>
          <View
            style={{
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 2.5,
              backgroundColor: CHIP_BG[task.kind],
            }}
          >
            <Text
              style={{
                fontFamily: ff.mono.bold,
                fontSize: 9.5,
                letterSpacing: 9.5 * 0.08,
                color,
              }}
            >
              {typeLabel}
            </Text>
          </View>
          <Text style={{ fontFamily: ff.mono.bold, fontSize: 10.5, color: C.muted }}>
            {task.parcel}
          </Text>
          {task.moved && (
            <View
              style={{
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 2.5,
                backgroundColor: C.waterTint,
              }}
            >
              <Text style={{ fontFamily: ff.mono.bold, fontSize: 9.5, color: C.waterDeep }}>
                {task.moved}
              </Text>
            </View>
          )}
          {task.cost && (
            <Text
              numberOfLines={1}
              style={{
                [isRtl ? "marginRight" : "marginLeft"]: "auto" as const,
                fontFamily: ff.mono.bold,
                fontSize: 10.5,
                color: C.muted,
              }}
            >
              {task.cost}
            </Text>
          )}
        </View>

        <Text
          style={sx(
            alignText,
            { fontFamily: ff.sans.bold, fontSize: 14.5, lineHeight: 18 },
            done || skipped
              ? { color: C.sand, textDecorationLine: "line-through" as const }
              : { color: C.ink }
          )}
        >
          {task.title}
        </Text>

        {task.calc && (
          <Text style={sx(alignText, { fontFamily: ff.mono.bold, fontSize: 12, color })}>
            {task.calc}
          </Text>
        )}

        {task.why && (
          <Text
            style={sx(alignText, {
              fontFamily: ff.sans.regular,
              fontSize: 11.5,
              lineHeight: 17,
              color: C.muted,
            })}
          >
            {task.why}
          </Text>
        )}

        {task.cancelNote && (
          <FadeUp>
            <View
              style={sx(row, {
                alignItems: "center",
                gap: 7,
                borderRadius: 8,
                backgroundColor: C.waterTint,
                paddingHorizontal: 9,
                paddingVertical: 6,
              })}
            >
              <WaterDrop size={13} />
              <Text style={{ fontFamily: ff.sans.bold, fontSize: 11, color: C.waterDeep }}>
                {task.cancelNote}
              </Text>
            </View>
          </FadeUp>
        )}

        <View style={sx(row, { gap: 7, paddingTop: 2 })}>
          <Pressable
            onPress={() => cycleTask(task.id, "done")}
            style={{
              flex: 1,
              borderRadius: 8,
              paddingVertical: 7,
              alignItems: "center",
              backgroundColor: done ? C.leaf : C.leafTint,
            }}
          >
            <Text
              style={{
                fontFamily: ff.sans.bold,
                fontSize: 12,
                color: done ? "#fff" : C.leafDeep,
              }}
            >
              ✓ {t.tDone}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => cycleTask(task.id, "snoozed")}
            style={{
              borderRadius: 8,
              borderWidth: 1.5,
              paddingHorizontal: 12,
              paddingVertical: 7,
              alignItems: "center",
              borderColor: snoozed ? C.water : C.lineStrong,
              backgroundColor: snoozed ? C.waterTint : undefined,
            }}
          >
            <Text
              style={{
                fontFamily: ff.sans.semibold,
                fontSize: 12,
                color: snoozed ? C.waterDeep : C.muted,
              }}
            >
              {t.tSnooze}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => cycleTask(task.id, "skipped")}
            style={{
              borderRadius: 8,
              borderWidth: 1.5,
              paddingHorizontal: 12,
              paddingVertical: 7,
              alignItems: "center",
              borderColor: skipped ? C.clay : C.lineStrong,
              backgroundColor: skipped ? C.clayTint : undefined,
            }}
          >
            <Text
              style={{
                fontFamily: ff.sans.semibold,
                fontSize: 12,
                color: skipped ? C.clay : C.muted,
              }}
            >
              {t.tSkip}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}
