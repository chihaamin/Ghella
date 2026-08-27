import type { ReactNode } from "react"
import {
  Pressable,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native"

import { C } from "@/lib/colors"
import { useFF } from "@/theme/fonts"

/**
 * Ghella button. The variants are the treatments that actually appear in the
 * design: dark ink, leaf green, sun amber, an outline and a "light on dark
 * card" pair used inside the ink-coloured panels. Mirrors the web kit's
 * variant/size vocabulary exactly.
 */
export type ButtonVariant =
  | "ink"
  | "leaf"
  | "sun"
  | "sunDeep"
  | "outline"
  | "ghost"
  | "light"
  | "outlineOnDark"
  | "muted"
  | "disabled"

export type ButtonSize = "lg" | "md" | "sm" | "chip"

const VARIANTS: Record<
  ButtonVariant,
  { box: ViewStyle; color: string; weight: "bold" | "semibold" | "extrabold" }
> = {
  ink: { box: { backgroundColor: C.ink }, color: C.surface, weight: "bold" },
  leaf: { box: { backgroundColor: C.leaf }, color: "#ffffff", weight: "bold" },
  sun: { box: { backgroundColor: C.sun }, color: C.ink, weight: "extrabold" },
  sunDeep: {
    box: { backgroundColor: C.sunDeep },
    color: "#ffffff",
    weight: "bold",
  },
  outline: {
    box: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: C.lineStrong,
    },
    color: C.muted,
    weight: "semibold",
  },
  ghost: {
    box: { backgroundColor: "transparent" },
    color: C.muted,
    weight: "semibold",
  },
  light: { box: { backgroundColor: C.surface }, color: C.ink, weight: "bold" },
  outlineOnDark: {
    box: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: "rgba(247,244,236,0.4)",
    },
    color: C.surface,
    weight: "bold",
  },
  muted: { box: { backgroundColor: C.chip }, color: C.ink, weight: "bold" },
  disabled: { box: { backgroundColor: C.line }, color: C.sand, weight: "bold" },
}

const SIZES: Record<ButtonSize, { box: ViewStyle; fontSize: number }> = {
  lg: {
    box: { height: 46, paddingHorizontal: 16, borderRadius: 11, alignSelf: "stretch" },
    fontSize: 14,
  },
  md: { box: { height: 40, paddingHorizontal: 16, borderRadius: 11 }, fontSize: 13.5 },
  sm: { box: { height: 34, paddingHorizontal: 12, borderRadius: 9 }, fontSize: 12.5 },
  chip: { box: { height: 31, paddingHorizontal: 11, borderRadius: 9 }, fontSize: 12 },
}

export function Button({
  variant = "ink",
  size = "lg",
  onPress,
  disabled = false,
  style,
  textStyle,
  children,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  children: ReactNode
}) {
  const ff = useFF()
  const v = VARIANTS[variant]
  const s = SIZES[size]
  const family =
    v.weight === "extrabold"
      ? ff.sans.extrabold
      : v.weight === "semibold"
        ? ff.sans.semibold
        : ff.sans.bold

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || variant === "disabled"}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
        s.box,
        v.box,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.82 },
        style,
      ]}
    >
      {typeof children === "string" || typeof children === "number" ? (
        <Text
          numberOfLines={1}
          style={[
            { fontFamily: family, fontSize: s.fontSize, color: v.color },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

/** The text style a non-string Button child should give its own label. */
export function buttonTextStyle(
  variant: ButtonVariant,
  size: ButtonSize,
  family: string
): TextStyle {
  return {
    fontFamily: family,
    fontSize: SIZES[size].fontSize,
    color: VARIANTS[variant].color,
  }
}

/** The label colour of a variant — for icons drawn inside a Button. */
export function buttonColor(variant: ButtonVariant): string {
  return VARIANTS[variant].color
}
