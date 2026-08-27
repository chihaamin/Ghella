import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, Text, View } from "react-native"
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg"

import { CheckIcon, DropBadge, PinIcon, WaterDrop } from "@/components/ghella/icons"
import { ParcelMap } from "@/components/ghella/parcel-map"
import { SectionLabel } from "@/components/ghella/primitives"
import { Button } from "@/components/ui/button"
import {
  ANALYSIS_LINES,
  PARCEL_COLORS,
  PARCEL_FACTS,
  SALINITY,
  SALINITY_SHORT,
  SOILS,
  WATER_ESTIMATES,
  WATER_SHORT,
  WATER_SOURCES,
} from "@/data/onboarding"
import { BUDGET_BANDS } from "@/data/varieties"
import { useLandAnalysis } from "@/hooks/use-land-analysis"
import { useT } from "@/i18n/use-t"
import { monthDayLabel, textureLabel } from "@/lib/agronomy"
import { C } from "@/lib/colors"
import { polygonAreaHa } from "@/lib/geo"
import { FadeUp, Pop, Pulse } from "@/lib/motion"
import { useApp } from "@/store/app-store"
import { selectFocusParcel, useParcels } from "@/store/parcel-store"
import { useFF } from "@/theme/fonts"
import type { SalinityId, TextureClass, WaterSourceId } from "@/types/land"

/** Green when picked, hairline when not — the shared "choice card" outline. */
const pickBorder = (on: boolean) => (on ? C.leaf : C.line)

/** The three demo SOILS cards, mapped onto real store texture classes. */
const SOIL_TEXTURES: TextureClass[] = ["sandy loam", "clay loam", "silt loam"]

/**
 * Collapse the 12 USDA classes onto the three cards the refine step shows.
 * Sand-led classes read as "sandy loam", clay-led as "clay loam", silt-led as
 * "silt loam" — coarse, but the farmer is confirming a feel, not a lab result.
 */
function refineIndexFor(texture: TextureClass | null): number | null {
  if (!texture) return null
  if (["silt", "silt loam"].includes(texture)) return 2
  if (
    ["clay", "clay loam", "sandy clay", "sandy clay loam", "silty clay", "silty clay loam"].includes(
      texture
    )
  )
    return 1
  return 0
}

/** Onboarding's water cards are index-ordered; these are their store ids. */
const WATER_IDS: WaterSourceId[] = ["drip", "sprinkler", "flood", "rainfed"]

/** Same deal for the three salinity answers. */
const SALINITY_IDS: SalinityId[] = ["none", "slight", "patches"]

/**
 * The web SOILS swatches are CSS radial-gradients; redraw the same gradient
 * with react-native-svg so the three soil cards keep their textured look.
 */
function SoilSwatch({ tex, height }: { tex: string; height: number }) {
  const m =
    /circle at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})/.exec(
      tex
    )
  const cx = m ? `${m[1]}%` : "50%"
  const cy = m ? `${m[2]}%` : "50%"
  const from = m ? m[3] : "#a98e63"
  const to = m ? m[4] : "#6b4a2e"
  const id = `soil-${from.slice(1)}-${to.slice(1)}`
  return (
    <Svg width="100%" height={height}>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} r="85%">
          <Stop offset="0%" stopColor={from} />
          <Stop offset="100%" stopColor={to} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}

/** The web's `initial 4% → animate 96%` width sweep over 2.3 s, ease-out. */
function AnalysisBar() {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 2300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation
    })
    anim.start()
    return () => anim.stop()
  }, [progress])

  return (
    <View
      style={{
        height: 7,
        width: 220,
        overflow: "hidden",
        borderRadius: 4,
        backgroundColor: C.line,
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 4,
          backgroundColor: C.leaf,
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["4%", "96%"],
          }),
        }}
      />
    </View>
  )
}

function LocatePrompt() {
  const { t } = useT()
  const ff = useFF()
  const allowLocate = useApp((s) => s.allowLocate)

  return (
    <View
      style={{
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.lineStrong,
        backgroundColor: C.card,
        paddingHorizontal: 20,
        paddingVertical: 26,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 27,
          backgroundColor: C.leafTint,
        }}
      >
        <PinIcon />
      </View>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 18,
          color: C.ink,
          textAlign: "center",
        }}
      >
        {t.locTitle}
      </Text>
      <Text
        style={{
          maxWidth: 280,
          fontFamily: ff.sans.regular,
          fontSize: 12.5,
          lineHeight: 19,
          color: C.muted,
          textAlign: "center",
        }}
      >
        {t.locSub}
      </Text>
      <Button variant="ink" onPress={allowLocate}>
        {t.locBtn}
      </Button>
      <Text
        style={{
          fontFamily: ff.sans.semibold,
          fontSize: 12.5,
          color: C.muted,
          textAlign: "center",
        }}
      >
        {t.locAlt}
      </Text>
    </View>
  )
}

function StepDraw({ onConfirm }: { onConfirm: (parcelId: string) => void }) {
  const { t, isRtl } = useT()
  const ff = useFF()
  const located = useApp((s) => s.located)
  const pts = useApp((s) => s.pts)
  const startAnalysis = useApp((s) => s.startAnalysis)
  const addParcel = useParcels((s) => s.addParcel)
  const ready = pts.length >= 3

  return (
    <>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 22,
          lineHeight: 25,
          color: C.ink,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.obTitle}
      </Text>
      <Text
        style={{
          marginTop: -8,
          fontFamily: ff.sans.regular,
          fontSize: 13,
          lineHeight: 20,
          color: C.muted,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.obSub}
      </Text>

      {!located ? (
        <LocatePrompt />
      ) : (
        <>
          <ParcelMap />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              variant={ready ? "ink" : "disabled"}
              style={{ flex: 1 }}
              onPress={() => {
                if (!ready) return
                // The drawn ring becomes REAL land the moment the farmer
                // confirms, and the open-data analysis starts immediately —
                // the scripted reveal below paces the wait, the card fills
                // with live values as each source lands.
                const parcel = addParcel({ points: pts, areaHa: polygonAreaHa(pts) })
                onConfirm(parcel.id)
                startAnalysis()
              }}
            >
              {t.obConfirm}
            </Button>
          </View>
        </>
      )}
    </>
  )
}

function StepAnalyzing() {
  const { t } = useT()
  const ff = useFF()
  const anLine = useApp((s) => s.anLine)
  // The real pipeline's stage line when it is running; scripted lines cover
  // the gap before the first progress event and any deep-link demo run.
  const parcel = useParcels(selectFocusParcel)
  const liveLabel = useParcels((s) =>
    parcel ? s.analysisProgress[parcel.id]?.label : undefined
  )

  return (
    <View
      style={{
        minHeight: 520,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
      }}
    >
      <Pulse>
        <DropBadge />
      </Pulse>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 20,
          color: C.ink,
          textAlign: "center",
        }}
      >
        {t.obAnalyzing}
      </Text>
      <Pulse>
        <Text
          style={{
            fontFamily: ff.mono.regular,
            fontSize: 13,
            color: C.muted,
            textAlign: "center",
          }}
        >
          {liveLabel || ANALYSIS_LINES[Math.min(anLine, ANALYSIS_LINES.length - 1)]}
        </Text>
      </Pulse>
      <AnalysisBar />
    </View>
  )
}

function StepParcelCard() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const set = useApp((s) => s.set)
  // The parcel just confirmed in StepDraw — its REAL area replaces the
  // scripted demo figure; the fallback only covers prototype deep links.
  const parcel = useParcels(selectFocusParcel)
  const areaHa = parcel?.areaHa ?? 1.42

  // Live facts from the open-data analysis. The card re-renders as sources
  // land (the store updates on analysisFinished), so a slow SoilGrids fills
  // its tile in late rather than holding the reveal hostage. "—" marks a
  // source still loading or unavailable; the static demo facts only appear
  // when there is no real parcel at all (prototype deep links).
  const a = parcel?.analysis
  const loading = parcel?.analysisState === "loading"
  const frost = a?.climate?.frost
  const facts = parcel
    ? [
        { k: "CLIMATE ZONE", v: a?.climate?.zone.label ?? "—" },
        {
          k: "FROST WINDOW",
          v: a?.climate
            ? frost && frost.risk !== "none" && frost.firstAutumnFrost
              ? `${monthDayLabel(frost.firstAutumnFrost)} → ${monthDayLabel(frost.lastSpringFrost)}`
              : t.ldNoFrost
            : "—",
        },
        {
          k: "RAINFALL (10-YR)",
          v: a?.climate ? `${Math.round(a.climate.annualRainMm)} mm/yr` : "—",
        },
        {
          k: "ELEVATION · SLOPE",
          v: a?.terrain
            ? `${Math.round(a.terrain.elevationM)} m · ${a.terrain.slopePct.toFixed(1)}%`
            : "—",
        },
        { k: "EST. SOIL", v: a?.soil.texture ? textureLabel(a.soil.texture) : "—" },
        {
          k: "SUN HOURS",
          v: a?.climate
            ? `${Math.round(a.climate.sunHoursPerYear).toLocaleString()} h/yr`
            : "—",
        },
      ]
    : PARCEL_FACTS

  return (
    <FadeUp style={{ flexDirection: "column", gap: 14 }}>
      <View
        style={{
          flexDirection: "column",
          gap: 14,
          borderRadius: 16,
          backgroundColor: C.ink,
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 16,
        }}
      >
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: ff.mono.bold,
              fontSize: 11,
              letterSpacing: 1.54,
              color: C.sun,
            }}
          >
            {t.obCardTag}
          </Text>
          {loading ? (
            <Pulse>
              <View
                style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: C.sun }}
              />
            </Pulse>
          ) : (
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
                backgroundColor: C.leafLight,
              }}
            />
          )}
        </View>

        {/* The "we found you" moment: region + country from the reverse geocode. */}
        {a?.place?.label ? (
          <FadeUp>
            <Text
              style={{
                marginTop: -8,
                fontFamily: ff.mono.bold,
                fontSize: 10.5,
                letterSpacing: 0.84,
                color: C.sand,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {[a.place.label, a.place.country].filter(Boolean).join(" · ")}
            </Text>
          </FadeUp>
        ) : null}

        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <Pop>
            <Text
              style={{
                fontFamily: ff.display.bold,
                fontSize: 44,
                lineHeight: 44,
                color: C.surface,
              }}
            >
              {areaHa.toFixed(2)}
            </Text>
          </Pop>
          <Text style={{ fontFamily: ff.display.bold, fontSize: 16, color: C.sand }}>
            ha
          </Text>
          <Text
            style={[
              { fontFamily: ff.display.semibold, fontSize: 15, color: C.surface },
              isRtl ? { marginRight: "auto" } : { marginLeft: "auto" },
            ]}
          >
            {t.obParcelName}
          </Text>
        </View>

        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            flexWrap: "wrap",
            gap: 9,
          }}
        >
          {facts.map((f) => {
            const dim = f.v === "—" && loading
            const value = (
              <Text
                style={{
                  fontFamily: ff.sans.semibold,
                  fontSize: 13.5,
                  color: dim ? C.sand : C.surface,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {f.v}
              </Text>
            )
            return (
              <View
                key={f.k}
                style={{
                  width: "48.5%",
                  flexDirection: "column",
                  gap: 2,
                  borderRadius: 10,
                  backgroundColor: "rgba(247,244,236,0.08)",
                  paddingHorizontal: 11,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    fontFamily: ff.mono.bold,
                    fontSize: 9.5,
                    letterSpacing: 0.95,
                    color: C.sand,
                    textAlign: isRtl ? "right" : "left",
                  }}
                >
                  {f.k}
                </Text>
                {dim ? <Pulse>{value}</Pulse> : value}
              </View>
            )
          })}
        </View>
      </View>

      <Text
        style={{
          fontFamily: ff.sans.regular,
          fontSize: 12.5,
          lineHeight: 19,
          color: C.muted,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.obRevealNote}
      </Text>
      <Button variant="leaf" onPress={() => set({ ob: 3 })}>
        {t.obRefineCta}
      </Button>
    </FadeUp>
  )
}

function StepRefine() {
  const { t, pick, isRtl } = useT()
  const ff = useFF()
  const soil = useApp((s) => s.soil)
  const wsrc = useApp((s) => s.wsrc)
  const sal = useApp((s) => s.sal)
  const bud = useApp((s) => s.bud)
  const set = useApp((s) => s.set)
  const parcel = useParcels(selectFocusParcel)
  const setSoilTexture = useParcels((s) => s.setSoilTexture)
  const setWaterSource = useParcels((s) => s.setWaterSource)
  const setSalinity = useParcels((s) => s.setSalinity)

  // Preselect the card matching the model's texture — once, and never after
  // the farmer has tapped a card themselves.
  const modelTexture = parcel?.analysis?.soil.texture ?? null
  const farmerTouched = useRef(false)
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || farmerTouched.current) return
    const idx = refineIndexFor(modelTexture)
    if (idx !== null) {
      prefilled.current = true
      set({ soil: idx })
    }
  }, [modelTexture, set])

  // Don't ask what the soil survey already answered: with a model texture the
  // soil question collapses to a "detected" strip the farmer can override.
  // The remaining questions renumber so the list never shows a gap.
  const [changingSoil, setChangingSoil] = useState(false)
  const askSoil = modelTexture === null || changingSoil
  const qNum = (position: number) => (askSoil ? position : position - 1)

  // The rainfed answer talks rainfall — use THIS parcel's, not the demo's.
  const annualRain = parcel?.analysis?.climate?.annualRainMm
  const waterEstLine =
    wsrc === 3 && annualRain != null
      ? pick(
          `Rainfall only — about ${Math.round(annualRain)} mm/yr falls here`,
          `Pluie seule — environ ${Math.round(annualRain)} mm/an ici`,
          `مطر فقط — نحو ${Math.round(annualRain)} مم/سنة هنا`
        )
      : WATER_ESTIMATES[wsrc]

  return (
    <FadeUp style={{ flexDirection: "column", gap: 16 }}>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 20,
          color: C.ink,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.obRefineTitle}
      </Text>

      {/* Soil texture — asked only when the survey came back empty. */}
      {askSoil ? (
        <View style={{ flexDirection: "column", gap: 8 }}>
          <SectionLabel
            style={{ fontSize: 12, letterSpacing: 1.2, textAlign: isRtl ? "right" : "left" }}
          >
            1 · {t.obSoil}
          </SectionLabel>
          <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 8 }}>
            {SOILS.map((s, i) => (
              <Pressable
                key={s.name}
                accessibilityRole="button"
                onPress={() => {
                  farmerTouched.current = true
                  set({ soil: i })
                }}
                style={{
                  flex: 1,
                  overflow: "hidden",
                  borderRadius: 11,
                  borderWidth: 2.5,
                  borderColor: pickBorder(soil === i),
                  backgroundColor: C.card,
                }}
              >
                <SoilSwatch tex={s.tex} height={54} />
                <View style={{ paddingHorizontal: 8, paddingVertical: 7 }}>
                  <Text
                    style={{
                      fontFamily: ff.sans.semibold,
                      fontSize: 11.5,
                      color: C.ink,
                      textAlign: "center",
                    }}
                  >
                    {s.name}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Text
            style={{
              fontFamily: ff.sans.regular,
              fontSize: 11.5,
              color: C.muted,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {modelTexture ? t.ldSoilModelNote : t.obSoilHint}
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: "column", gap: 8 }}>
          <SectionLabel
            style={{ fontSize: 12, letterSpacing: 1.2, textAlign: isRtl ? "right" : "left" }}
          >
            {t.obSoil}
          </SectionLabel>
          <View
            style={{
              flexDirection: isRtl ? "row-reverse" : "row",
              alignItems: "center",
              gap: 10,
              borderRadius: 11,
              borderWidth: 1.5,
              borderColor: C.leaf,
              backgroundColor: C.leafTint,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                backgroundColor: C.leaf,
              }}
            >
              <CheckIcon size={11} />
            </View>
            <View style={{ minWidth: 0, flex: 1, flexDirection: "column" }}>
              <Text
                style={{
                  fontFamily: ff.sans.bold,
                  fontSize: 13,
                  color: C.leafDeep,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {modelTexture ? textureLabel(modelTexture) : ""}
              </Text>
              <Text
                style={{
                  fontFamily: ff.sans.regular,
                  fontSize: 11,
                  lineHeight: 15,
                  color: "rgba(47,69,32,0.8)",
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {pick(
                  "Read from the soil survey for this exact spot — no need to ask.",
                  "Lu dans le relevé de sol de cet endroit précis — pas besoin de demander.",
                  "مقروء من مسح التربة لهذه النقطة بالضبط — لا حاجة للسؤال."
                )}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setChangingSoil(true)}
              hitSlop={8}
              style={{ flexShrink: 0 }}
            >
              <Text style={{ fontFamily: ff.sans.bold, fontSize: 12, color: C.leaf }}>
                {pick("Not right?", "Pas ça ?", "غير صحيح؟")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 2 — irrigation */}
      <View style={{ flexDirection: "column", gap: 8 }}>
        <SectionLabel
          style={{ fontSize: 12, letterSpacing: 1.2, textAlign: isRtl ? "right" : "left" }}
        >
          {qNum(2)} · {t.obWater}
        </SectionLabel>
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {WATER_SOURCES.map((s, i) => (
            <Pressable
              key={s.name}
              accessibilityRole="button"
              onPress={() => set({ wsrc: i })}
              style={{
                width: "48.5%",
                flexDirection: "column",
                gap: 2,
                borderRadius: 11,
                borderWidth: 2.5,
                borderColor: pickBorder(wsrc === i),
                backgroundColor: C.card,
                paddingHorizontal: 11,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: ff.sans.semibold,
                  fontSize: 13,
                  color: C.ink,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {s.name}
              </Text>
              <Text
                style={{
                  fontFamily: ff.sans.regular,
                  fontSize: 11,
                  color: C.muted,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {s.sub}
              </Text>
            </Pressable>
          ))}
        </View>
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 10,
            backgroundColor: C.waterTint,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <WaterDrop />
          <Text
            style={{
              flex: 1,
              fontFamily: ff.sans.semibold,
              fontSize: 12.5,
              color: C.waterDeep,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {waterEstLine}
          </Text>
        </View>
      </View>

      {/* 3 — salinity */}
      <View style={{ flexDirection: "column", gap: 8 }}>
        <SectionLabel
          style={{ fontSize: 12, letterSpacing: 1.2, textAlign: isRtl ? "right" : "left" }}
        >
          {qNum(3)} · {t.obSal}
        </SectionLabel>
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 8 }}>
          {SALINITY.map((s, i) => (
            <Pressable
              key={s.name}
              accessibilityRole="button"
              onPress={() => set({ sal: i })}
              style={{
                flex: 1,
                borderRadius: 10,
                borderWidth: 2.5,
                borderColor: pickBorder(sal === i),
                backgroundColor: C.card,
                paddingHorizontal: 6,
                paddingVertical: 9,
              }}
            >
              <Text
                style={{
                  fontFamily: ff.sans.semibold,
                  fontSize: 12,
                  color: C.ink,
                  textAlign: "center",
                }}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 4 — budget */}
      <View style={{ flexDirection: "column", gap: 8 }}>
        <SectionLabel
          style={{ fontSize: 12, letterSpacing: 1.2, textAlign: isRtl ? "right" : "left" }}
        >
          {qNum(4)} · {t.obBudget}
        </SectionLabel>
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {BUDGET_BANDS.map((b, i) => (
            <Pressable
              key={b.label}
              accessibilityRole="button"
              onPress={() => set({ bud: i })}
              style={{
                width: "48.5%",
                borderRadius: 10,
                borderWidth: 2.5,
                borderColor: pickBorder(bud === i),
                backgroundColor: C.card,
                paddingHorizontal: 6,
                paddingVertical: 9,
              }}
            >
              <Text
                style={{
                  fontFamily: ff.sans.semibold,
                  fontSize: 12.5,
                  color: C.ink,
                  textAlign: "center",
                }}
              >
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text
          style={{
            fontFamily: ff.sans.regular,
            fontSize: 11.5,
            color: C.muted,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.obBudgetHint}
        </Text>
      </View>

      <Button
        variant="leaf"
        onPress={() => {
          // Persist the farmer's answers on the REAL parcel — they outrank
          // the model's guesses everywhere downstream (soil panel, budget).
          // Soil is only written when the farmer actually answered it: an
          // auto-answered (survey) texture stays null on the parcel so the
          // model's reading keeps governing, at full 12-class precision.
          if (parcel) {
            const farmerAnswered = modelTexture === null || farmerTouched.current
            setSoilTexture(
              parcel.id,
              farmerAnswered ? (SOIL_TEXTURES[soil] ?? null) : null
            )
            setWaterSource(parcel.id, WATER_IDS[wsrc] ?? null)
            setSalinity(parcel.id, SALINITY_IDS[sal] ?? null)
          }
          set({ ob: 4 })
        }}
      >
        {t.obSave}
      </Button>
    </FadeUp>
  )
}

function StepDone() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const wsrc = useApp((s) => s.wsrc)
  const sal = useApp((s) => s.sal)
  const bud = useApp((s) => s.bud)
  const pcolor = useApp((s) => s.pcolor)
  const set = useApp((s) => s.set)
  const go = useApp((s) => s.go)
  const toast = useApp((s) => s.toast)
  const parcel = useParcels(selectFocusParcel)
  const recolorParcel = useParcels((s) => s.recolorParcel)
  const areaHa = parcel?.areaHa ?? 1.42

  // The recap the farmer signs off on — their answers plus what the analysis
  // established, no invented neighbours. Demo fallback for deep links only.
  const texture = parcel?.soilTexture ?? parcel?.analysis?.soil.texture ?? null
  const summary = parcel
    ? [
        texture ? textureLabel(texture) : null,
        WATER_SHORT[wsrc],
        SALINITY_SHORT[sal],
        `budget ${BUDGET_BANDS[bud].label}`,
        `${areaHa.toFixed(2)} ha`,
        parcel.analysis?.place?.label ?? null,
      ]
        .filter(Boolean)
        .join(" · ")
    : `Sandy loam · ${WATER_SHORT[wsrc]} · ${SALINITY_SHORT[sal]} · budget ${
        BUDGET_BANDS[bud].label
      } · 1.42 ha next to ${lang === "fr" ? "Colline" : "Hill"}`

  return (
    <FadeUp style={{ flexDirection: "column", gap: 14 }}>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 20,
          color: C.ink,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.obDoneTitle}
      </Text>

      <View
        style={{
          flexDirection: "column",
          gap: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C.line,
          backgroundColor: C.card,
          padding: 14,
        }}
      >
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              backgroundColor: PARCEL_COLORS[pcolor],
            }}
          />
          <Text style={{ fontFamily: ff.display.bold, fontSize: 18, color: C.ink }}>
            {t.obParcelName}
          </Text>
          <Text
            style={[
              { fontFamily: ff.mono.bold, fontSize: 12, color: C.muted },
              isRtl ? { marginRight: "auto" } : { marginLeft: "auto" },
            ]}
          >
            {areaHa.toFixed(2)} ha
          </Text>
        </View>

        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 8 }}>
          {PARCEL_COLORS.map((v, i) => (
            <Pressable
              key={v}
              accessibilityRole="button"
              onPress={() => {
                set({ pcolor: i })
                // The live map draws parcel.color — keep the real one in sync.
                if (parcel) recolorParcel(parcel.id, v)
              }}
              accessibilityLabel={`Parcel colour ${i + 1}`}
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                borderWidth: 2.5,
                borderColor: pcolor === i ? C.ink : "transparent",
                backgroundColor: v,
              }}
            />
          ))}
        </View>

        <Text
          style={{
            fontFamily: ff.sans.regular,
            fontSize: 12.5,
            lineHeight: 19,
            color: C.muted,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {summary}
        </Text>
      </View>

      <Button
        variant="ink"
        onPress={() => {
          toast(
            lang === "ar"
              ? "حُفظت الأرض — أرضك جاهزة"
              : lang === "fr"
                ? "Terre enregistrée — votre parcelle est prête"
                : "Land saved — your land is ready"
          )
          // The reveal continues on My Land: live map, full analysis,
          // recommendations. The calendar is one tab away.
          go("home")
        }}
      >
        {t.obFinish}
      </Button>
    </FadeUp>
  )
}

export function OnboardScreen() {
  const ob = useApp((s) => s.ob)
  // autorun off: the analysis starts on the farmer's explicit confirm, not on
  // whatever idle parcels happen to be lying around while they are drawing.
  const { analyze } = useLandAnalysis({ autorun: false })

  return (
    <View style={{ flexDirection: "column", gap: 14, paddingTop: 4 }}>
      <View key={ob} style={{ flexDirection: "column", gap: 14 }}>
        {ob === 0 && <StepDraw onConfirm={(id) => void analyze(id)} />}
        {ob === 1 && <StepAnalyzing />}
        {ob === 2 && <StepParcelCard />}
        {ob === 3 && <StepRefine />}
        {ob === 4 && <StepDone />}
      </View>
    </View>
  )
}
