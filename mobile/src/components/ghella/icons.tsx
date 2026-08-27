import { Text, View } from "react-native"
import Svg, { Circle, Path, Rect } from "react-native-svg"

import { C } from "@/lib/colors"
import { F } from "@/theme/fonts"

/**
 * Hand-drawn icons lifted from the design. They are not lucide glyphs — the
 * water drop in particular is the brand mark — so they live here rather than
 * being approximated by an icon set. Same exports as the web app's icons.tsx.
 */

export function GhellaLogo() {
  // The wordmark is set as real text beside the drop-of-water leaf mark —
  // SVG <text> with a custom font is flaky across platforms, RN Text is not.
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <Text
        style={{
          fontFamily: F.display.bold,
          fontSize: 24,
          letterSpacing: -1,
          color: "#2f4520",
        }}
      >
        ghella
      </Text>
      <Svg width={13} height={24} viewBox="210 12 32 40">
        <Path
          d="M226 46 L226 20 M226 30 C226 22 234 22 236 16 M226 36 C226 28 218 28 216 22"
          stroke={C.leafBright}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

export function BellIcon({ size = 17, stroke = C.ink }: { size?: number; stroke?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
      <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0" />
    </Svg>
  )
}

export function OfflineIcon({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.sun} strokeWidth={2.6}>
      <Path d="M1 1l22 22M9 9a10 10 0 0 1 13 3M5 12a14 14 0 0 1 3-2.5M8.5 15.5a6 6 0 0 1 5-1.8M12 19h.01" />
    </Svg>
  )
}

export function SunIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.sun} strokeWidth={2.4}>
      <Circle cx={12} cy={12} r={4.4} fill={C.sun} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2" />
    </Svg>
  )
}

export function CloudIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={C.sand}>
      <Path d="M6 19a5 5 0 1 1 1-9.9A7 7 0 0 1 20.5 11 4 4 0 0 1 19 19Z" />
    </Svg>
  )
}

export function RainIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 15a5 5 0 1 1 1-9.9A7 7 0 0 1 20.5 7 4 4 0 0 1 19 15Z" fill="#7d8f9c" />
      <Path
        d="M8 18l-1.4 3M13 18l-1.4 3M18 18l-1.4 3"
        stroke={C.water}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}

export function FrostIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.waterDeep} strokeWidth={2.2}>
      <Path d="M12 2v20M4 6l16 12M20 6L4 18M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2" />
    </Svg>
  )
}

export function WarningIcon({
  size = 15,
  stroke = "#fff",
  strokeWidth = 2.4,
}: {
  size?: number
  stroke?: string
  strokeWidth?: number
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
      <Path d="M12 3l10 18H2Z M12 10v5M12 18.5v.01" />
    </Svg>
  )
}

export function LockIcon({ size = 14, stroke = C.clay }: { size?: number; stroke?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.4}>
      <Rect x={4} y={10} width={16} height={11} rx={2} />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

export function CheckIcon({
  size = 12,
  stroke = "#fff",
  strokeWidth = 3,
}: {
  size?: number
  stroke?: string
  strokeWidth?: number
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
      <Path d="M4 12.5l5 5L20 6.5" />
    </Svg>
  )
}

export function PinIcon({ size = 26, stroke = C.leafDeep }: { size?: number; stroke?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.2}>
      <Path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
      <Circle cx={12} cy={10} r={2.6} />
    </Svg>
  )
}

export function ClockIcon({ size = 17, stroke = C.sunInk }: { size?: number; stroke?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.2}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3.2 2" />
    </Svg>
  )
}

/** The brand water drop, filled solid. Used for water notes and estimates. */
export function WaterDrop({ size = 15, fill = C.water }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Path d="M28 8 C28 8 42 25 42 34 A14 14 0 0 1 14 34 C14 25 28 8 28 8 Z" fill={fill} />
    </Svg>
  )
}

/** Outlined drop inside a ring — the analysis spinner on onboarding step 2. */
export function DropBadge({ size = 84 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Circle cx={28} cy={28} r={26} fill="none" stroke={C.ink} strokeWidth={2.5} />
      <Path
        d="M28 12 C28 12 40 26 40 34 A12 12 0 0 1 16 34 C16 26 28 12 28 12 Z"
        fill={C.water}
      />
    </Svg>
  )
}

/** A single tomato/pepper leaf silhouette, used for photo placeholders. */
export function LeafGlyph({ size = 30, fill = "#7a9a5e" }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 12 C74 22 82 46 78 66 C60 78 36 76 24 60 C18 40 30 20 50 12 Z"
        fill={fill}
      />
    </Svg>
  )
}

/** A 24×24 icon drawn from a tab path — stroke-styled like the tab bar. */
export function PathIcon({
  d,
  size = 19,
  stroke = C.muted2,
  strokeWidth = 2.1,
}: {
  d: string
  size?: number
  stroke?: string
  strokeWidth?: number
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={d} />
    </Svg>
  )
}

/** Tab-bar glyph paths, keyed by screen. */
export const TAB_PATHS = {
  cal: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",
  decide: "M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11ZM9 14h6",
  home: "M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5",
  market: "M3 20h18M5 20V9m5 11V4m5 16v-8m5 8V7",
  close: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v5h5M9 13h6M9 17h4",
} as const
