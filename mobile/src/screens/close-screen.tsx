import { useEffect, useRef } from "react"
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  type DimensionValue,
} from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { fmt } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

/** The plan figures the actuals are measured against. */
const PLAN = { profit: 35900, yield: 42, price: 1.55 } as const
/** 0.8 ha at $13,260/ha of inputs, plus 25% for labour and pumping. */
const AREA = 0.8
const COST_PER_HA = 13260

function StepBtn({ glyph, onPress }: { glyph: string; onPress: () => void }) {
  const ff = useFF()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          backgroundColor: C.chip,
        },
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      <Text style={{ fontFamily: ff.display.bold, fontSize: 18, color: C.ink }}>
        {glyph}
      </Text>
    </Pressable>
  )
}

function Stepper({
  label,
  sub,
  value,
  onDown,
  onUp,
}: {
  label: string
  sub: string
  value: string
  onDown: () => void
  onUp: () => void
}) {
  const { isRtl } = useT()
  const ff = useFF()
  return (
    <View
      style={{
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View>
        <Text
          style={{
            fontFamily: ff.sans.semibold,
            fontSize: 13.5,
            color: C.ink,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: ff.sans.regular,
            fontSize: 11,
            color: C.muted,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {sub}
        </Text>
      </View>
      <View
        style={{
          flexDirection: isRtl ? "row-reverse" : "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <StepBtn glyph="−" onPress={onDown} />
        <Text
          style={{
            minWidth: 52,
            textAlign: "center",
            fontFamily: ff.display.bold,
            fontSize: 20,
            color: C.ink,
          }}
        >
          {value}
        </Text>
        <StepBtn glyph="+" onPress={onUp} />
      </View>
    </View>
  )
}

function StepEntry() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const clYield = useApp((s) => s.clYield)
  const clPrice = useApp((s) => s.clPrice)
  const bumpYield = useApp((s) => s.bumpYield)
  const bumpPrice = useApp((s) => s.bumpPrice)
  const set = useApp((s) => s.set)

  return (
    <>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 22,
          lineHeight: 26,
          color: C.ink,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.clTitle}
      </Text>
      <Text
        style={{
          marginTop: -6,
          fontFamily: ff.sans.regular,
          fontSize: 13,
          lineHeight: 20,
          color: C.muted,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.clSub}
      </Text>

      <View
        style={{
          gap: 13,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C.line,
          backgroundColor: C.card,
          padding: 14,
        }}
      >
        <Stepper
          label={t.clYield}
          sub={`${t.clPredicted} 42.0`}
          value={clYield.toFixed(1)}
          onDown={() => bumpYield(-0.5)}
          onUp={() => bumpYield(0.5)}
        />
        <Stepper
          label={t.clPrice}
          sub={`${t.clForecastWas} 1.55`}
          value={clPrice.toFixed(2)}
          onDown={() => bumpPrice(-0.05)}
          onUp={() => bumpPrice(0.05)}
        />

        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: ff.sans.semibold,
              fontSize: 13.5,
              color: C.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.clPhotos}
          </Text>
          <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 8 }}>
            {[1, 2].map((n) => (
              <Pressable
                key={n}
                style={{
                  width: 74,
                  height: 74,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: C.lineDash,
                }}
              >
                <Text style={{ fontFamily: ff.sans.bold, fontSize: 20, color: C.muted }}>
                  +
                </Text>
                <Text style={{ fontFamily: ff.mono.bold, fontSize: 9.5, color: C.muted }}>
                  {t.clPhoto} {n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Button variant="sun" onPress={() => set({ cl: 1 })}>
        {t.clUnlock}
      </Button>
    </>
  )
}

/** The amber "actual" bar growing from 0 to its width, like the web's motion.div. */
function ActualBar({ width }: { width: string }) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [progress])

  const pct = parseFloat(width) || 0

  return (
    <Animated.View
      style={{
        height: "100%",
        borderRadius: 4,
        backgroundColor: C.sun,
        width: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0%", `${pct}%`],
        }),
      }}
    />
  )
}

function ComparisonRow({
  label,
  plan,
  actual,
  planWidth,
  actualWidth,
  delta,
}: {
  label: string
  plan: string
  actual: string
  planWidth: string
  actualWidth: string
  delta: string
}) {
  const { t, isRtl } = useT()
  const ff = useFF()

  const row = {
    flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const),
  }
  const track = {
    height: 7,
    flex: 1,
    borderRadius: 4,
    backgroundColor: "rgba(247,244,236,0.14)",
    alignItems: isRtl ? ("flex-end" as const) : ("flex-start" as const),
  }

  return (
    <View style={{ gap: 4 }}>
      <View style={[row, { justifyContent: "space-between" }]}>
        <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.sand }}>
          {label}
        </Text>
        <Text style={{ fontFamily: ff.mono.bold, fontSize: 11, color: "#e8b08a" }}>
          {delta}
        </Text>
      </View>

      <View style={[row, { alignItems: "center", gap: 7 }]}>
        <Text
          style={{
            width: 52,
            fontFamily: ff.mono.regular,
            fontSize: 10,
            color: C.sand,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.clPlan}
        </Text>
        <View style={track}>
          <View
            style={{
              height: "100%",
              borderRadius: 4,
              backgroundColor: C.sand,
              width: planWidth as DimensionValue,
            }}
          />
        </View>
        <Text
          style={{
            width: 58,
            textAlign: isRtl ? "left" : "right",
            fontFamily: ff.mono.bold,
            fontSize: 11.5,
            color: C.sand,
          }}
        >
          {plan}
        </Text>
      </View>

      <View style={[row, { alignItems: "center", gap: 7 }]}>
        <Text
          style={{
            width: 52,
            fontFamily: ff.mono.regular,
            fontSize: 10,
            color: C.cream,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.clActual}
        </Text>
        <View style={track}>
          <ActualBar width={actualWidth} />
        </View>
        <Text
          style={{
            width: 58,
            textAlign: isRtl ? "left" : "right",
            fontFamily: ff.mono.bold,
            fontSize: 11.5,
            color: C.surface,
          }}
        >
          {actual}
        </Text>
      </View>
    </View>
  )
}

function StepReport() {
  const { t, pick, isRtl } = useT()
  const ff = useFF()
  const clYield = useApp((s) => s.clYield)
  const clPrice = useApp((s) => s.clPrice)

  const netActual = clYield * AREA * 1000 * clPrice - AREA * COST_PER_HA * 1.25

  const rows = [
    {
      label: pick("Net profit ($)", "Profit net ($)", "صافي الربح ($)"),
      plan: "$35,900",
      actual: `$${fmt(netActual)}`,
      planWidth: "96%",
      actualWidth: `${Math.min(netActual / PLAN.profit, 1) * 96}%`,
      delta: "−13%",
    },
    {
      label: pick("Yield (t/ha)", "Rendement (t/ha)", "المردود (طن/هك)"),
      plan: "42.0",
      actual: clYield.toFixed(1),
      planWidth: "96%",
      actualWidth: `${(clYield / PLAN.yield) * 96}%`,
      delta: `${clYield >= PLAN.yield ? "+" : ""}${Math.round((clYield / PLAN.yield - 1) * 100)}%`,
    },
    {
      label: pick("Price ($/kg)", "Prix ($/kg)", "السعر ($/كغ)"),
      plan: "1.55",
      actual: clPrice.toFixed(2),
      planWidth: "96%",
      actualWidth: `${(clPrice / PLAN.price) * 96}%`,
      delta: `${Math.round((clPrice / PLAN.price - 1) * 100)}%`,
    },
  ]

  const row = {
    flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const),
  }

  return (
    <FadeUp>
      <View
        style={{
          gap: 14,
          borderRadius: 18,
          backgroundColor: C.ink,
          paddingHorizontal: 16,
          paddingVertical: 18,
        }}
      >
        <View style={[row, { alignItems: "center", justifyContent: "space-between" }]}>
          <Text
            style={{
              fontFamily: ff.mono.bold,
              fontSize: 11,
              letterSpacing: 1.54,
              color: C.sun,
            }}
          >
            {t.clReportTag}
          </Text>
          <View
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9,
              borderWidth: 2,
              borderColor: C.sun,
              transform: [{ rotate: "-4deg" }],
            }}
          >
            <Svg width={16} height={16} viewBox="0 0 56 56">
              <Circle cx={28} cy={28} r={24} fill="none" stroke={C.sun} strokeWidth={4} />
              <Path
                d="M28 13 C28 13 39 26 39 33 A11 11 0 0 1 17 33 C17 26 28 13 28 13 Z"
                fill={C.sun}
              />
            </Svg>
            <Text
              style={{
                fontFamily: ff.mono.bold,
                fontSize: 5,
                letterSpacing: 0.9,
                color: C.sun,
              }}
            >
              GHELLA
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontFamily: ff.display.semibold,
            fontSize: 20,
            lineHeight: 24,
            color: C.surface,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.clReportTitle}
        </Text>

        <View style={{ gap: 9 }}>
          {rows.map((r) => (
            <ComparisonRow key={r.label} {...r} />
          ))}
        </View>

        <View style={[row, { gap: 9 }]}>
          <View
            style={{
              flex: 1,
              gap: 2,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: C.water,
              backgroundColor: "rgba(31,127,184,0.2)",
              paddingHorizontal: 11,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                fontFamily: ff.mono.bold,
                fontSize: 9.5,
                color: C.waterLight,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t.clWaterSaved}
            </Text>
            <Text
              style={{
                fontFamily: ff.display.bold,
                fontSize: 20,
                color: C.waterLight,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              450 m³
            </Text>
            <Text
              style={{
                fontFamily: ff.sans.regular,
                fontSize: 10.5,
                color: C.waterPale,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t.clWaterSub}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              gap: 2,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: C.sun,
              backgroundColor: "rgba(217,164,65,0.16)",
              paddingHorizontal: 11,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                fontFamily: ff.mono.bold,
                fontSize: 9.5,
                color: C.sun,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t.clWps}
            </Text>
            <Text
              style={{
                fontFamily: ff.display.bold,
                fontSize: 20,
                color: C.cream,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              10.8 <Text style={{ fontSize: 11 }}>{t.decUnit}</Text>
            </Text>
            <Text
              style={{
                fontFamily: ff.sans.regular,
                fontSize: 10.5,
                color: "#d9c89a",
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t.clWpsSub}
            </Text>
          </View>
        </View>

        <View
          style={[
            row,
            {
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: 10,
              backgroundColor: "rgba(247,244,236,0.08)",
              paddingHorizontal: 12,
              paddingVertical: 9,
            },
          ]}
        >
          <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.surface }}>
            {t.clSprayLog}
          </Text>
          <Text style={{ fontFamily: ff.mono.bold, fontSize: 11, color: C.sun }}>
            {t.clExport} ↧
          </Text>
        </View>

        <Text
          style={{
            textAlign: "center",
            fontFamily: ff.sans.regular,
            fontSize: 11.5,
            lineHeight: 17,
            color: C.sand,
          }}
        >
          {t.clCommunity}
        </Text>

        <View style={[row, { gap: 8 }]}>
          <Button variant="light" size="md" style={{ flex: 1, borderRadius: 10 }}>
            {t.clShare}
          </Button>
          <Button variant="outlineOnDark" size="md" style={{ flex: 1, borderRadius: 10 }}>
            {t.clPrint}
          </Button>
        </View>
      </View>
    </FadeUp>
  )
}

export function CloseScreen() {
  const cl = useApp((s) => s.cl)

  return (
    <View style={{ gap: 13, paddingTop: 4 }}>
      {/* The web's AnimatePresence-keyed div: remount the step on change so
          StepReport's own FadeUp plays its entrance. */}
      <View key={cl} style={{ gap: 13 }}>
        {cl === 0 ? <StepEntry /> : <StepReport />}
      </View>
    </View>
  )
}
