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

/** The white 1px-bordered card that carries most of the app's content. */
export function Card({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  return (
    <View
      style={[
        {
          flexDirection: "column",
          borderRadius: 13,
          borderWidth: 1,
          borderColor: C.line,
          backgroundColor: C.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** The inverted variant — ink background, cream/amber type. */
export function CardDark({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  return (
    <View
      style={[
        { flexDirection: "column", borderRadius: 16, backgroundColor: C.ink },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function CardHeader({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}
    >
      {children}
    </View>
  )
}

export function CardTitle({
  style,
  children,
}: {
  style?: StyleProp<TextStyle>
  children: ReactNode
}) {
  const ff = useFF()
  return (
    <Text
      style={[
        { fontFamily: ff.display.bold, fontSize: 15, color: C.ink },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

export function CardContent({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  return (
    <View style={[{ flexDirection: "column", gap: 8 }, style]}>{children}</View>
  )
}
