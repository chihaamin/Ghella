import { useEffect, useRef, type JSX } from "react"

import { Animated, Easing, Text, View } from "react-native"

import { NoteStrip, SectionLabel, Stat } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { textureLabel, waterHoldingFromTexture } from "@/lib/agronomy"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { useFF } from "@/theme/fonts"
import type { SoilSample, TextureClass } from "@/types/land"

/**
 * One texture-fraction bar growing to its percentage — the web's
 * `animate={{ width }}` on the fill div, rebuilt on Animated.
 */
function FractionFill({ pct, color }: { pct: number; color: string }): JSX.Element {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      // Width is a layout prop — the native driver can't carry it.
      useNativeDriver: false,
    }).start()
  }, [progress])

  return (
    <Animated.View
      style={{
        width: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0%", `${Math.min(100, Math.max(0, pct))}%`],
        }),
        height: "100%",
        borderRadius: 4,
        backgroundColor: color,
      }}
    />
  )
}

/**
 * Soil card — what this parcel is made of, and who says so. The farmer's own
 * texture always outranks the model: when `farmerTexture` is set, both the
 * badge and the water-holding figure are recomputed from it, and the
 * provenance strip flips to "set by you".
 *
 * Every field of `SoilSample` can be null (no soil grid over built-up land),
 * so each block renders only when its numbers exist — the worst case is just
 * the provenance strip and the confirm button.
 */
export function SoilPanel({
  soil,
  farmerTexture,
  onConfirm,
}: {
  soil: SoilSample
  farmerTexture: TextureClass | null
  onConfirm?: () => void
}): JSX.Element {
  const { t, isRtl } = useT()
  const ff = useFF()

  const effective = farmerTexture ?? soil.texture
  // Farmer texture overrides the derived water holding too — the model's
  // figure was derived from the model's texture, which just lost.
  const waterHolding = farmerTexture
    ? waterHoldingFromTexture(farmerTexture)
    : soil.waterHoldingMmPerM

  // Destructured so the null checks narrow — `soil.sandPct` would not.
  const { sandPct, siltPct, clayPct } = soil
  const fractions =
    sandPct !== null && siltPct !== null && clayPct !== null
      ? [
          { label: t.ldSand, pct: sandPct, color: C.sun },
          { label: t.ldSilt, pct: siltPct, color: C.sand },
          { label: t.ldClay, pct: clayPct, color: C.earth },
        ]
      : null

  const hasStats = soil.ph !== null || soil.socGkg !== null || waterHolding !== null

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
        <SectionLabel>{t.ldSoil}</SectionLabel>
        <Badge variant="earth" size="sm">
          {effective ? textureLabel(effective) : "—"}
        </Badge>
      </View>

      {fractions && (
        <View style={{ flexDirection: "column", gap: 7 }}>
          {fractions.map((f) => (
            <View key={f.label} style={{ flexDirection: "column", gap: 3 }}>
              <View
                style={{
                  flexDirection: row,
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.ink }}>
                  {f.label}
                </Text>
                <Text style={{ fontFamily: ff.mono.bold, fontSize: 11, color: C.muted }}>
                  {Math.round(f.pct)}%
                </Text>
              </View>
              <View
                style={{
                  height: 7,
                  overflow: "hidden",
                  borderRadius: 4,
                  backgroundColor: C.chip,
                  // The fill grows from the reading edge, as dir="rtl" did.
                  alignItems: isRtl ? "flex-end" : "flex-start",
                }}
              >
                <FractionFill pct={f.pct} color={f.color} />
              </View>
            </View>
          ))}
        </View>
      )}

      {hasStats && (
        <View style={{ flexDirection: row, gap: 6 }}>
          <Stat
            style={{ flex: 1, backgroundColor: C.chip2 }}
            label={t.ldPh}
            value={soil.ph !== null ? soil.ph.toFixed(1) : "—"}
            valueStyle={{ fontSize: 15 }}
          />
          <Stat
            style={{ flex: 1, backgroundColor: C.chip2 }}
            label={t.ldSoc}
            value={soil.socGkg !== null ? `${soil.socGkg} g/kg` : "—"}
            valueStyle={{ fontSize: 15 }}
          />
          <Stat
            style={{ flex: 1, backgroundColor: C.chip2 }}
            label={t.ldWaterHolding}
            value={waterHolding !== null ? `${waterHolding} mm/m` : "—"}
            valueStyle={{ fontSize: 15 }}
          />
        </View>
      )}

      {/* Provenance — the farmer outranks the model, the model outranks a
          shrug. When detection failed with a reason, the reason is more
          useful than the generic line. */}
      {farmerTexture ? (
        <NoteStrip tone="sun">{t.ldSoilFarmerNote}</NoteStrip>
      ) : soil.source === "soilgrids" ? (
        <NoteStrip tone="water">{t.ldSoilModelNote}</NoteStrip>
      ) : (
        <NoteStrip tone="clay">{soil.note ?? t.ldSoilUnknownNote}</NoteStrip>
      )}

      {onConfirm && farmerTexture === null && (
        <Button variant="outline" size="sm" onPress={onConfirm}>
          {t.ldConfirmSoil}
        </Button>
      )}
    </FadeUp>
  )
}
