import { useEffect, useRef, type JSX } from "react"

import { Animated, Easing, Text, View } from "react-native"

import { SectionLabel, Stat } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { useT } from "@/i18n/use-t"
import { monthDayLabel } from "@/lib/agronomy"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { fmt } from "@/lib/utils"
import { useFF } from "@/theme/fonts"
import type { ClimateNormals, ClimateZoneId } from "@/types/land"

/**
 * Zone → badge tint. Dry zones read amber like the sun chips, the middle
 * band earth, wet zones water — so the badge colour alone tells the farmer
 * which side of "needs irrigation" this land sits on.
 */
const ZONE_BADGE: Record<ClimateZoneId, "sun" | "earth" | "water"> = {
  arid: "sun",
  "semi-arid": "sun",
  "dry-subhumid": "earth",
  humid: "water",
  "per-humid": "water",
}

/**
 * One rain bar growing to its month's share of the wettest month. The 2 %
 * floor keeps a bone-dry month visible as a sliver rather than vanishing —
 * "almost nothing" and "nothing rendered" read very differently.
 * (The web's `listStagger` + `barGrow` variants, rebuilt on Animated.)
 */
function RainBar({ pct, delay }: { pct: number; delay: number }): JSX.Element {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 350,
      delay,
      easing: Easing.out(Easing.cubic),
      // Height is a layout prop — the native driver can't carry it.
      useNativeDriver: false,
    }).start()
  }, [progress, delay])

  return (
    <View style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}>
      <Animated.View
        style={{
          height: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", `${Math.max(2, pct)}%`],
          }),
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: C.water,
        }}
      />
    </View>
  )
}

/**
 * Climate card for one parcel — the 10-year normals a planting decision hangs
 * on: rain vs evaporative demand, sun, growing degree days, the frost window
 * and a 12-month rain profile. Pure presentation: every number arrives
 * pre-computed on `ClimateNormals` and is only rounded for display here.
 */
export function ClimatePanel({ climate }: { climate: ClimateNormals }): JSX.Element {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const { frost } = climate

  // The wettest month sets the chart scale; the 1 floor keeps a rainless
  // desert from dividing by zero.
  const maxRain = Math.max(1, ...climate.monthly.map((m) => m.rainMm))

  const row = isRtl ? ("row-reverse" as const) : ("row" as const)

  return (
    <FadeUp
      style={{
        flexDirection: "column",
        gap: 10,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.card,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          flexDirection: row,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <SectionLabel>{t.ldClimate}</SectionLabel>
        <Badge variant={ZONE_BADGE[climate.zone.id]} size="sm">
          {climate.zone.label}
        </Badge>
      </View>

      <Text
        style={{
          fontFamily: ff.sans.regular,
          fontSize: 11.5,
          lineHeight: 17,
          color: C.muted,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {climate.zone.note}
      </Text>

      <View style={{ flexDirection: row, flexWrap: "wrap", gap: 6 }}>
        <Stat
          style={{ backgroundColor: C.chip2, width: "48.7%" }}
          label={t.ldAnnualRain}
          value={`${fmt(climate.annualRainMm)} mm`}
        />
        <Stat
          style={{ backgroundColor: C.chip2, width: "48.7%" }}
          label={t.ldEt0}
          value={`${fmt(climate.annualEt0Mm)} mm`}
        />
        <Stat
          style={{ backgroundColor: C.chip2, width: "48.7%" }}
          label={t.ldSunHours}
          // Rounded to tens — the trailing digit of "3 187 h" is noise.
          value={`${fmt(Math.round(climate.sunHoursPerYear / 10) * 10)} h`}
        />
        <Stat
          style={{ backgroundColor: C.chip2, width: "48.7%" }}
          label={t.ldGdd}
          value={`${fmt(climate.gddBase10)} °C·d`}
        />
      </View>

      <View
        style={{
          flexDirection: row,
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          borderRadius: 10,
          backgroundColor: C.chip2,
          paddingHorizontal: 11,
          paddingVertical: 9,
        }}
      >
        <Text style={{ fontFamily: ff.mono.bold, fontSize: 9.5, color: C.muted }}>
          {t.ldFrostWindow}
        </Text>
        <Text style={{ flexShrink: 1, textAlign: isRtl ? "left" : "right" }}>
          <Text style={{ fontFamily: ff.display.bold, fontSize: 13, color: C.ink }}>
            {frost.risk !== "none"
              ? `${monthDayLabel(frost.firstAutumnFrost, lang)} ${isRtl ? "←" : "→"} ${monthDayLabel(frost.lastSpringFrost, lang)}`
              : t.ldNoFrost}
          </Text>
          {frost.frostFreeDays !== null && (
            <Text
              style={{
                fontFamily: ff.sans.regular,
                fontSize: 10.5,
                color: C.muted2,
              }}
            >
              {/* The web's ms-1.5 gap — nested Text can't carry margin. */}
              {" "}
              {frost.frostFreeDays} {t.ldFrostFree}
            </Text>
          )}
        </Text>
      </View>

      {/* 12-month rain profile — heights are relative to the wettest month,
          so the shape of the year reads instantly even where totals are low. */}
      <View style={{ flexDirection: "column", gap: 4, paddingTop: 2 }}>
        <View
          style={{
            flexDirection: row,
            height: 52,
            alignItems: "flex-end",
            gap: 3,
          }}
        >
          {climate.monthly.map((m, i) => (
            <RainBar
              key={m.month}
              pct={(m.rainMm / maxRain) * 100}
              // listStagger: delayChildren 0.02s + staggerChildren 0.05s.
              delay={20 + i * 50}
            />
          ))}
        </View>
        <View style={{ flexDirection: row, gap: 3 }}>
          {climate.monthly.map((m) => (
            <Text
              key={m.month}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: ff.mono.regular,
                fontSize: 8.5,
                color: C.muted2,
              }}
            >
              {new Date(2026, m.month - 1, 1).toLocaleString(lang, { month: "narrow" })}
            </Text>
          ))}
        </View>
      </View>

      <Text
        style={{
          fontFamily: ff.mono.regular,
          fontSize: 9.5,
          color: C.muted,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.ldClimateYears}
      </Text>
    </FadeUp>
  )
}
