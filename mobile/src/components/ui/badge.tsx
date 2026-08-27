import type { ReactNode } from "react"
import {
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native"

import { C } from "@/lib/colors"
import { F } from "@/theme/fonts"

/** The small mono "pill" used for crop stages, PHI locks, budgets and legends. */
export type BadgeVariant =
  | "neutral"
  | "leaf"
  | "water"
  | "sun"
  | "sunOutline"
  | "clay"
  | "ink"
  | "earth"

export type BadgeSize = "xs" | "sm" | "md"

const VARIANTS: Record<BadgeVariant, { box: ViewStyle; color: string }> = {
  neutral: { box: { backgroundColor: C.chip }, color: C.inkMuted },
  leaf: { box: { backgroundColor: C.leafTint }, color: C.leafDeep },
  water: { box: { backgroundColor: C.waterTint }, color: C.waterDeep },
  sun: { box: { backgroundColor: C.sunTint }, color: C.sunInk },
  sunOutline: {
    box: {
      backgroundColor: "#fdf6e6",
      borderWidth: 1,
      borderColor: C.sun,
    },
    color: C.sunInk,
  },
  clay: { box: { backgroundColor: C.clayTint }, color: C.clay },
  ink: { box: { backgroundColor: C.ink }, color: C.cream },
  earth: { box: { backgroundColor: C.chip2 }, color: "#5c4a1e" },
}

const SIZES: Record<
  BadgeSize,
  { box: ViewStyle; fontSize: number }
> = {
  xs: { box: { paddingHorizontal: 7, paddingVertical: 2.5 }, fontSize: 9.5 },
  sm: { box: { paddingHorizontal: 7, paddingVertical: 3 }, fontSize: 10.5 },
  md: { box: { paddingHorizontal: 10, paddingVertical: 5 }, fontSize: 11 },
}

/**
 * `{expr} d` style children arrive as an ARRAY of strings — those must land in
 * a Text too, or React Native throws "Text strings must be rendered within a
 * <Text> component" at runtime.
 */
function isTextual(children: ReactNode): boolean {
  if (typeof children === "string" || typeof children === "number") return true
  if (Array.isArray(children)) return children.every(isTextual)
  return false
}

export function Badge({
  variant = "neutral",
  size = "sm",
  style,
  textStyle,
  children,
}: {
  variant?: BadgeVariant
  size?: BadgeSize
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  children: ReactNode
}) {
  const v = VARIANTS[variant]
  const s = SIZES[size]
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignSelf: "flex-start",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          borderRadius: 6,
        },
        s.box,
        v.box,
        style,
      ]}
    >
      {isTextual(children) ? (
        <Text
          numberOfLines={1}
          style={[
            { fontFamily: F.mono.bold, fontSize: s.fontSize, color: v.color },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

/** The label colour of a variant — for a Badge composing its own children. */
export function badgeColor(variant: BadgeVariant): string {
  return VARIANTS[variant].color
}
