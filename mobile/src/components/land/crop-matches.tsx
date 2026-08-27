import { useEffect, useRef, useState } from "react"
import type { JSX } from "react"
import { Animated, Easing, Pressable, Text, View } from "react-native"

import { NoteStrip, SectionLabel } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { animateLayout, FadeUp } from "@/lib/motion"
import { fmt } from "@/lib/utils"
import { useFF } from "@/theme/fonts"
import type { CropMatch, CropRating } from "@/types/land"

/** Rating → badge tint, the same green→blue→amber→red ladder the app uses. */
const RATING_BADGE: Record<CropRating, "leaf" | "water" | "sun" | "clay"> = {
  excellent: "leaf",
  good: "water",
  marginal: "sun",
  unsuitable: "clay",
}

/** Rating → the score bar fill, matching the badge beside it. */
const RATING_BAR: Record<CropRating, string> = {
  excellent: C.leaf,
  good: C.water,
  marginal: C.sun,
  unsuitable: C.clay,
}

/**
 * The factor score bar — the web version's `motion.div` width sweep
 * (0 → score%, 450 ms ease-out), on the Animated API.
 */
function FactorBar({ score, color }: { score: number; color: string }) {
  const progress = useRef(new Animated.Value(0)).current
  const pct = Math.min(Math.max(score, 0), 100)

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.ease),
      // Width cannot ride the native driver.
      useNativeDriver: false,
    }).start()
  }, [progress])

  return (
    <View
      style={{
        height: 7,
        borderRadius: 4,
        backgroundColor: C.chip,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 4,
          backgroundColor: color,
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", `${pct}%`],
          }),
        }}
      />
    </View>
  )
}

/**
 * A dashed top hairline. Android only draws dashed borders when all four
 * sides exist, so a taller dashed box is clipped down to its top edge.
 */
function DashedTop() {
  return (
    <View style={{ height: 1.5, overflow: "hidden" }}>
      <View
        style={{
          height: 6,
          borderWidth: 1.5,
          borderColor: C.line,
          borderStyle: "dashed",
        }}
      />
    </View>
  )
}

/**
 * Ranked crop matches for a parcel, as an accordion — one open at a time,
 * because the open body is the whole story (factor bars in the Decide
 * screen "Why this score" style, planting chips, hard blockers) and two of
 * them open is a wall. Shows the top `initial` crops until the farmer asks
 * for more. Pure presentation: ranking and scoring happened upstream in
 * `lib/crop-suitability`.
 */
export function CropMatches({
  crops,
  initial = 5,
  onPick,
}: {
  crops: CropMatch[]
  initial?: number
  onPick?: (crop: CropMatch) => void
}): JSX.Element {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? crops : crops.slice(0, initial)

  const ratingLabel: Record<CropRating, string> = {
    excellent: t.ldRatingExcellent,
    good: t.ldRatingGood,
    marginal: t.ldRatingMarginal,
    unsuitable: t.ldRatingUnsuitable,
  }

  const monthShort = (m: number) =>
    new Date(2026, m - 1, 1).toLocaleString(lang, { month: "short" })

  const row = { flexDirection: isRtl ? "row-reverse" : "row" } as const
  const alignStart = { textAlign: isRtl ? "right" : "left" } as const

  return (
    <FadeUp
      style={{
        flexDirection: "column",
        borderRadius: 13,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.card,
      }}
    >
      <View
        style={{
          flexDirection: "column",
          gap: 4,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 10,
        }}
      >
        <SectionLabel style={alignStart}>{t.ldCrops}</SectionLabel>
        <Text
          style={[
            {
              fontFamily: ff.sans.regular,
              fontSize: 11.5,
              lineHeight: 17,
              color: C.muted,
            },
            alignStart,
          ]}
        >
          {t.ldCropsSub}
        </Text>
      </View>

      <View style={{ flexDirection: "column" }}>
        {visible.map((crop, i) => {
          const open = openId === crop.id
          return (
            <FadeUp
              key={crop.id}
              delay={i * 50}
              style={{ borderTopWidth: 1, borderColor: C.line }}
            >
              <Pressable
                onPress={() => {
                  animateLayout()
                  setOpenId((cur) => (cur === crop.id ? null : crop.id))
                }}
                style={[
                  row,
                  {
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0, flexDirection: "column" }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      {
                        fontFamily: ff.display.bold,
                        fontSize: 14.5,
                        lineHeight: 18,
                        color: C.ink,
                      },
                      alignStart,
                    ]}
                  >
                    {crop.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      { fontFamily: ff.mono.regular, fontSize: 10.5, color: C.muted2 },
                      alignStart,
                    ]}
                  >
                    {crop.family}
                  </Text>
                </View>
                <View style={[row, { flexShrink: 0, alignItems: "center", gap: 6 }]}>
                  <Badge variant={RATING_BADGE[crop.rating]} size="xs">
                    {ratingLabel[crop.rating]}
                  </Badge>
                  <Progress
                    value={crop.score}
                    trackHeight={5}
                    indicatorColor={RATING_BAR[crop.rating]}
                    style={{ width: 64 }}
                  />
                  <Text
                    style={{
                      width: 24,
                      textAlign: isRtl ? "left" : "right",
                      fontFamily: ff.mono.bold,
                      fontSize: 11,
                      color: C.ink,
                    }}
                  >
                    {Math.round(crop.score)}
                  </Text>
                </View>
              </Pressable>

              {open && (
                <View>
                  <DashedTop />
                  <View
                    style={{
                      flexDirection: "column",
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    {crop.factors.map((factor) => {
                      // Same thresholds as the Decide screen bars, so a 60
                      // looks the same everywhere in the app.
                      const strong = factor.score >= 75
                      const mid = factor.score >= 55
                      const color = strong ? C.leaf : mid ? C.sun : C.clay
                      const fg = strong ? C.leaf : mid ? C.sunInk : C.clay
                      return (
                        <View key={factor.key} style={{ flexDirection: "column", gap: 3 }}>
                          <View style={[row, { justifyContent: "space-between" }]}>
                            <Text
                              style={{
                                fontFamily: ff.sans.semibold,
                                fontSize: 12,
                                color: C.ink,
                              }}
                            >
                              {factor.label}
                            </Text>
                            <Text
                              style={{
                                fontFamily: ff.mono.bold,
                                fontSize: 11,
                                color: fg,
                              }}
                            >
                              {Math.round(factor.score)}
                            </Text>
                          </View>
                          <FactorBar score={factor.score} color={color} />
                          <Text
                            style={[
                              {
                                fontFamily: ff.sans.regular,
                                fontSize: 11,
                                lineHeight: 15,
                                color: C.muted,
                              },
                              alignStart,
                            ]}
                          >
                            {factor.note}
                          </Text>
                        </View>
                      )
                    })}

                    <View style={[row, { flexWrap: "wrap", gap: 6 }]}>
                      {crop.plantingMonths.length > 0 && (
                        <Badge variant="leaf" size="xs">
                          {`${t.ldPlantIn} ${crop.plantingMonths.map(monthShort).join(" · ")}`}
                        </Badge>
                      )}
                      <Badge variant="neutral" size="xs">
                        {`${t.ldCycle} ${crop.cycleDays} d`}
                      </Badge>
                      <Badge variant="water" size="xs">
                        {`${t.ldWaterNeed} ${fmt(crop.waterNeedMm)} mm`}
                      </Badge>
                    </View>

                    {crop.blockers.length > 0 && (
                      <NoteStrip tone="clay" style={{ alignItems: "flex-start" }}>
                        <Text
                          style={{
                            fontFamily: ff.mono.bold,
                            fontSize: 9.5,
                            letterSpacing: 9.5 * 0.12,
                            color: C.clay,
                          }}
                        >
                          {t.ldBlockers}
                        </Text>
                        {crop.blockers.map((blocker) => (
                          <Text
                            key={blocker}
                            style={{
                              fontFamily: ff.sans.semibold,
                              fontSize: 11.5,
                              lineHeight: 17,
                              color: C.clay,
                            }}
                          >
                            {"\n"}
                            {blocker}
                          </Text>
                        ))}
                      </NoteStrip>
                    )}

                    {onPick && (
                      <Button variant="outline" size="sm" onPress={() => onPick(crop)}>
                        {t.rcOpenDecide}
                      </Button>
                    )}
                  </View>
                </View>
              )}
            </FadeUp>
          )
        })}
      </View>

      {crops.length > initial && (
        <Pressable
          onPress={() => setShowAll((s) => !s)}
          style={{
            alignSelf: "stretch",
            borderTopWidth: 1,
            borderColor: C.line,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: ff.sans.bold,
              fontSize: 12.5,
              color: C.leaf,
            }}
          >
            {showAll ? t.ldShowLess : t.ldShowMore}
          </Text>
        </Pressable>
      )}
    </FadeUp>
  )
}
