import { useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View, type ViewStyle } from "react-native"
import Svg, { Circle, Line, Path, Polygon, Rect } from "react-native-svg"

import { ClockIcon } from "@/components/ghella/icons"
import { SectionLabel } from "@/components/ghella/primitives"
import { Slider } from "@/components/ui/slider"
import {
  CROP_CHIPS,
  PER_HECTARE,
  cropChipLabel,
  forecastPrice,
  priceSeries,
} from "@/data/market"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { money, sx } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

/** Two recorded seasons, then the forecast and its 80% band. */
function PriceChart({ crop }: { crop: ReturnType<typeof priceSeries> }) {
  const { t } = useT()
  const ff = useFF()
  const [w, setW] = useState(0)
  const scale = w / 372

  return (
    <View
      style={{ alignSelf: "stretch", height: 176 }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Svg width="100%" height={176} viewBox="0 0 372 176" preserveAspectRatio="none">
        <Line x1={0} y1={44} x2={372} y2={44} stroke={C.chip} strokeWidth={1} />
        <Line x1={0} y1={88} x2={372} y2={88} stroke={C.chip} strokeWidth={1} />
        <Line x1={0} y1={132} x2={372} y2={132} stroke={C.chip} strokeWidth={1} />

        {/* the harvest window */}
        <Rect x={308} y={6} width={46} height={160} fill={C.sun} opacity={0.14} />

        <Polygon points={crop.bandPoints} fill={C.water} opacity={0.14} />
        <Path
          d={crop.histPath}
          fill="none"
          stroke={C.ink}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <Path
          d={crop.forecastPath}
          fill="none"
          stroke={C.water}
          strokeWidth={2.4}
          strokeDasharray="6 5"
          strokeLinejoin="round"
        />

        <Line
          x1={248}
          y1={6}
          x2={248}
          y2={170}
          stroke={C.muted}
          strokeWidth={1.4}
          strokeDasharray="3 4"
        />
        <Circle cx={248} cy={crop.nowY} r={4.5} fill={C.ink} />
      </Svg>

      {/* SVG <text> with custom fonts is flaky in react-native-svg, so the two
          chart labels are RN Text overlaid at the same viewBox coordinates. */}
      {w > 0 && (
        <>
          <Text
            style={{
              position: "absolute",
              top: 8,
              left: 0,
              width: 244 * scale,
              textAlign: "right",
              fontFamily: ff.mono.bold,
              fontSize: 9.5,
              color: C.muted,
            }}
          >
            {t.mkToday}
          </Text>
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 308 * scale,
              width: 46 * scale,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: ff.mono.bold, fontSize: 9.5, color: C.sunInk }}>
              {t.mkHarvest}
            </Text>
          </View>
        </>
      )}
    </View>
  )
}

function ProfitSimulator() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const mkCrop = useApp((s) => s.mkCrop)
  const simA = useApp((s) => s.simA)
  const simY = useApp((s) => s.simY)
  const set = useApp((s) => s.set)

  const price = forecastPrice(mkCrop)
  const revenue = simA * simY * 1000 * price
  const cost = simA * PER_HECTARE.cost
  const water = simA * PER_HECTARE.water

  const row = {
    flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const),
  }

  return (
    <View
      style={{
        gap: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.card,
        padding: 14,
      }}
    >
      <SectionLabel style={{ textAlign: isRtl ? "right" : "left" }}>
        {t.simTitle}
      </SectionLabel>

      <View style={{ gap: 4 }}>
        <View style={[row, { justifyContent: "space-between" }]}>
          <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12.5, color: C.ink }}>
            {t.simArea}
          </Text>
          <Text style={{ fontFamily: ff.mono.bold, fontSize: 13, color: C.ink }}>
            {simA.toFixed(1)} ha
          </Text>
        </View>
        <Slider
          min={0.1}
          max={2}
          step={0.1}
          value={simA}
          onValueChange={(v) => set({ simA: v })}
        />
      </View>

      <View style={{ gap: 4 }}>
        <View style={[row, { justifyContent: "space-between" }]}>
          <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12.5, color: C.ink }}>
            {t.simYield}
          </Text>
          <Text style={{ fontFamily: ff.mono.bold, fontSize: 13, color: C.ink }}>
            {simY.toFixed(1)} t/ha
          </Text>
        </View>
        <Slider
          min={25}
          max={60}
          step={0.5}
          value={simY}
          onValueChange={(v) => set({ simY: v })}
        />
      </View>

      <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
        <SimStat label={t.simRev} value={money(revenue)} tone="neutral" />
        <SimStat label={t.simCost} value={`−${money(cost)}`} tone="neutral" />
        <SimStat label={t.simNet} value={money(revenue - cost)} tone="leaf" />
        <SimStat
          label={t.simWater}
          value={`${Math.round(water).toLocaleString("en-US")} m³`}
          tone="water"
        />
      </View>

      <Text
        style={{
          fontFamily: ff.sans.regular,
          fontSize: 11,
          color: C.muted,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.simFoot}
      </Text>
    </View>
  )
}

function SimStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "neutral" | "leaf" | "water"
}) {
  const { isRtl } = useT()
  const ff = useFF()
  const tones = {
    neutral: { box: C.chip2, label: C.muted, value: C.ink },
    leaf: { box: C.leafTint, label: C.leafDeep, value: C.leafDeep },
    water: { box: C.waterTint, label: C.waterDeep, value: C.waterDeep },
  }[tone]

  return (
    <View
      style={{
        width: "48.7%",
        flexGrow: 1,
        gap: 1,
        borderRadius: 10,
        paddingHorizontal: 11,
        paddingVertical: 9,
        backgroundColor: tones.box,
      }}
    >
      <Text
        style={{
          fontFamily: ff.mono.bold,
          fontSize: 9.5,
          color: tones.label,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: ff.display.bold,
          fontSize: 17,
          color: tones.value,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {value}
      </Text>
    </View>
  )
}

export function MarketScreen() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const mkCrop = useApp((s) => s.mkCrop)
  const set = useApp((s) => s.set)
  const series = useMemo(() => priceSeries(mkCrop), [mkCrop])

  const row = {
    flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const),
  }

  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 22,
          color: C.ink,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.mkTitle}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{
          flexDirection: isRtl ? "row-reverse" : "row",
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 2,
        }}
      >
        {CROP_CHIPS.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => set({ mkCrop: c.id })}
            style={sx<ViewStyle>(
              {
                borderRadius: 9,
                borderWidth: 1.5,
                paddingHorizontal: 12,
                paddingVertical: 7,
              },
              mkCrop === c.id
                ? { borderColor: C.ink, backgroundColor: C.ink }
                : { borderColor: C.lineStrong, backgroundColor: C.card }
            )}
          >
            <Text
              style={{
                fontFamily: ff.sans.bold,
                fontSize: 12,
                color: mkCrop === c.id ? C.cream : C.inkMuted,
              }}
            >
              {cropChipLabel(c, lang)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View
        style={{
          gap: 9,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C.line,
          backgroundColor: C.card,
          paddingHorizontal: 13,
          paddingTop: 13,
          paddingBottom: 9,
        }}
      >
        <View style={[row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: ff.mono.bold,
                fontSize: 10.5,
                letterSpacing: 1.05,
                color: C.muted,
              }}
            >
              {series.subtitle}
            </Text>
            <View style={[row, { alignItems: "baseline", gap: 6 }]}>
              <Text style={{ fontFamily: ff.display.bold, fontSize: 26, color: C.ink }}>
                {series.now}
              </Text>
              <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.muted }}>
                $/kg
              </Text>
              <Text style={{ fontFamily: ff.mono.bold, fontSize: 12, color: C.leaf }}>
                +4% wk
              </Text>
            </View>
          </View>
          <View style={{ alignItems: isRtl ? "flex-start" : "flex-end" }}>
            <Text style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.waterDeep }}>
              {t.mkForecastAt}
            </Text>
            <Text style={{ fontFamily: ff.display.bold, fontSize: 16, color: C.waterDeep }}>
              {series.forecast}
            </Text>
          </View>
        </View>

        <PriceChart crop={series} />

        <View style={[row, { flexWrap: "wrap", gap: 13, paddingBottom: 3 }]}>
          <View style={[row, { alignItems: "center", gap: 5 }]}>
            <View style={{ height: 2.5, width: 16, backgroundColor: C.ink }} />
            <Text style={{ fontFamily: ff.sans.semibold, fontSize: 10.5, color: C.muted }}>
              {t.mkLegHist}
            </Text>
          </View>
          <View style={[row, { alignItems: "center", gap: 5 }]}>
            <Svg width={16} height={3}>
              <Line
                x1={0}
                y1={1.5}
                x2={16}
                y2={1.5}
                stroke={C.water}
                strokeWidth={2.5}
                strokeDasharray="4 3"
              />
            </Svg>
            <Text style={{ fontFamily: ff.sans.semibold, fontSize: 10.5, color: C.muted }}>
              {t.mkLegFc}
            </Text>
          </View>
          <View style={[row, { alignItems: "center", gap: 5 }]}>
            <View
              style={{
                height: 9,
                width: 14,
                borderRadius: 2,
                backgroundColor: "rgba(31,127,184,0.18)",
              }}
            />
            <Text style={{ fontFamily: ff.sans.semibold, fontSize: 10.5, color: C.muted }}>
              {t.mkLegBand}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          row,
          {
            alignItems: "flex-start",
            gap: 10,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: C.sun,
            backgroundColor: "#fdf6e6",
            paddingHorizontal: 13,
            paddingVertical: 11,
          },
        ]}
      >
        <View style={{ marginTop: 1 }}>
          <ClockIcon />
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: ff.sans.semibold,
            fontSize: 12.5,
            lineHeight: 19,
            color: "#5c4a1e",
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.mkHint}
        </Text>
      </View>

      <ProfitSimulator />
    </View>
  )
}
