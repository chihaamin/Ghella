import { ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { forecast as demoForecast, type WeatherDay } from "@/data/weather"
import { useForecast } from "@/hooks/use-forecast"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { sx } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

import { CloudIcon, FrostIcon, RainIcon, SunIcon } from "./icons"

/**
 * Seven-day forecast — the horizontal scroller at the top of Home and Calendar.
 *
 * Given a `latlng` it shows the real Open-Meteo outlook for that point;
 * without one it falls back to the bundled demo week, so existing call sites
 * keep working untouched.
 */
export function WeatherStrip({
  style,
  latlng = null,
}: {
  style?: StyleProp<ViewStyle>
  /** Where to fetch real weather for; omit to stay on the demo week. */
  latlng?: [number, number] | null
}) {
  const { lang, isRtl } = useT()
  const ff = useFF()
  const rain = useApp((s) => s.rain)
  const frost = useApp((s) => s.frost)
  const { forecast: live } = useForecast(latlng)

  // The DEMO data wins whenever a scenario toggle (rain/frost) is on, latlng
  // is missing, or the real fetch has produced nothing — so the prototype
  // panel still demos deterministically offline, and the strip never renders
  // blank while waiting on the network.
  const useDemo = rain || frost || !latlng || !live || live.days.length === 0

  const days: WeatherDay[] = useDemo
    ? demoForecast(lang, { rain, frost })
    : live.days.slice(0, 7).map((d, i) => ({
        // Noon, not midnight: a bare ISO date parses as UTC midnight, which
        // west of Greenwich renders yesterday's weekday. `lang` doubles as
        // the locale, so "ar" gets Arabic day names for free.
        d: new Date(d.date + "T12:00:00")
          .toLocaleDateString(lang, { weekday: "short" })
          .toUpperCase(),
        t: Math.round(d.tMaxC),
        sky: d.sky,
        // Under a millimetre reads as noise, not rain — show nothing.
        mm: d.rainMm >= 1 ? `${Math.round(d.rainMm)}mm` : "",
        today: i === 0,
      }))

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={sx({ marginHorizontal: -16 }, style)}
      contentContainerStyle={{
        flexDirection: isRtl ? "row-reverse" : "row",
        gap: 6,
        paddingHorizontal: 16,
      }}
    >
      {days.map((w, i) => (
        <View
          key={`${w.d}-${i}`}
          style={{
            width: 52,
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            borderRadius: 10,
            borderWidth: 1,
            paddingTop: 8,
            paddingBottom: 7,
            borderColor: w.today ? C.sand2 : "transparent",
            backgroundColor: w.today ? C.surfaceRaised : C.chip2,
          }}
        >
          <Text style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.muted }}>
            {w.d}
          </Text>
          {w.sky === "sun" && <SunIcon />}
          {w.sky === "cloud" && <CloudIcon />}
          {w.sky === "rain" && <RainIcon />}
          <Text style={{ fontFamily: ff.display.bold, fontSize: 12, color: C.ink }}>
            {w.t}°
          </Text>
          <Text
            style={{
              minHeight: 12,
              fontFamily: ff.mono.regular,
              fontSize: 9.5,
              color: C.water,
            }}
          >
            {w.mm}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

/** Frost advisory — only mounted while the frost scenario is on. */
export function FrostBanner() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const frost = useApp((s) => s.frost)

  if (!frost) return null

  return (
    <FadeUp>
      <View
        style={{
          flexDirection: isRtl ? "row-reverse" : "row",
          alignItems: "flex-start",
          gap: 10,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: C.water,
          backgroundColor: C.waterTint,
          paddingHorizontal: 13,
          paddingVertical: 11,
        }}
      >
        <View style={{ marginTop: 1 }}>
          <FrostIcon />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: ff.sans.bold,
              fontSize: 13,
              lineHeight: 19,
              color: C.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.frostBanner}
          </Text>
          <Text
            style={{
              fontFamily: ff.sans.regular,
              fontSize: 12,
              lineHeight: 17,
              color: "#456",
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.frostSub}
          </Text>
        </View>
      </View>
    </FadeUp>
  )
}
