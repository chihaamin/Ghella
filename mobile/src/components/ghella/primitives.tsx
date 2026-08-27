import type { ReactNode } from "react"
import {
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native"

import { C } from "@/lib/colors"
import { useFF } from "@/theme/fonts"

/** The small caps mono label that opens most sections. */
export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<TextStyle>
}) {
  const ff = useFF()
  return (
    <Text
      style={[
        {
          fontFamily: ff.mono.bold,
          fontSize: 11,
          letterSpacing: 1.3,
          color: C.earth,
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

/** Screen title — Space Grotesk, semibold, tight leading. */
export function ScreenTitle({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<TextStyle>
}) {
  const ff = useFF()
  return (
    <Text
      style={[
        {
          fontFamily: ff.display.semibold,
          fontSize: 22,
          lineHeight: 25,
          color: C.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

/** A key/value tile — the grey and tinted stat boxes used all over the app. */
export function Stat({
  label,
  value,
  sub,
  style,
  labelStyle,
  valueStyle,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
  valueStyle?: StyleProp<TextStyle>
}) {
  const ff = useFF()
  return (
    <View
      style={[
        {
          flexDirection: "column",
          gap: 1,
          borderRadius: 10,
          paddingHorizontal: 11,
          paddingVertical: 9,
        },
        style,
      ]}
    >
      <Text
        style={[
          { fontFamily: ff.mono.bold, fontSize: 9.5, color: C.muted },
          labelStyle,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          { fontFamily: ff.display.bold, fontSize: 17, color: C.ink },
          valueStyle,
        ]}
      >
        {value}
      </Text>
      {sub != null && (
        <Text style={{ fontFamily: ff.sans.regular, fontSize: 10.5, color: C.muted2 }}>
          {sub}
        </Text>
      )}
    </View>
  )
}

/** Tinted note strip — water (blue), advisory (amber) or alert (clay). */
export function NoteStrip({
  tone = "water",
  icon,
  children,
  style,
}: {
  tone?: "water" | "sun" | "clay" | "neutral"
  icon?: ReactNode
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const ff = useFF()
  const tones = {
    water: { bg: C.waterTint, color: C.waterDeep },
    sun: { bg: C.chip2, color: "#5c4a1e" },
    clay: { bg: C.clayTint, color: C.clay },
    neutral: { bg: C.chip2, color: C.inkSoft },
  } as const
  const t = tones[tone]
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 10,
          paddingHorizontal: 11,
          paddingVertical: 9,
          backgroundColor: t.bg,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          flex: 1,
          fontFamily: ff.sans.semibold,
          fontSize: 12,
          lineHeight: 18,
          color: t.color,
        }}
      >
        {children}
      </Text>
    </View>
  )
}
