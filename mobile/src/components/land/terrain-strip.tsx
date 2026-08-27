import type { JSX } from "react"

import { Text, View, type ViewStyle } from "react-native"

import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { fmt, sx } from "@/lib/utils"
import { useFF } from "@/theme/fonts"
import type { Terrain } from "@/types/land"

/**
 * Terrain in one line — elevation, slope, aspect. Deliberately not a card:
 * three numbers do not earn a border, so it sits between the panels as a
 * quiet divided strip. Aspect is null on flat ground and reads "flat"
 * rather than leaving a hole.
 */
export function TerrainStrip({ terrain }: { terrain: Terrain }): JSX.Element {
  const { t, isRtl } = useT()
  const ff = useFF()

  const cells = [
    { label: t.ldElevation, value: `${fmt(terrain.elevationM)} m` },
    { label: t.ldSlope, value: `${terrain.slopePct.toFixed(1)}%` },
    { label: t.ldAspect, value: terrain.aspect ?? t.ldFlat },
  ]

  return (
    <FadeUp
      style={{
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        paddingHorizontal: 4,
      }}
    >
      {cells.map((cell, i) => (
        <View
          key={cell.label}
          // The web's logical border-s, flipped by hand so the dividers sit
          // between cells in RTL too.
          style={sx<ViewStyle>(
            { flex: 1, flexDirection: "column", gap: 1 },
            i > 0 &&
              (isRtl
                ? { borderRightWidth: 1, borderColor: C.line, paddingRight: 12 }
                : { borderLeftWidth: 1, borderColor: C.line, paddingLeft: 12 })
          )}
        >
          <Text
            style={{
              fontFamily: ff.mono.bold,
              fontSize: 9.5,
              color: C.muted,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {cell.label}
          </Text>
          <Text
            style={{
              fontFamily: ff.display.bold,
              fontSize: 14,
              color: C.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {cell.value}
          </Text>
        </View>
      ))}
    </FadeUp>
  )
}
