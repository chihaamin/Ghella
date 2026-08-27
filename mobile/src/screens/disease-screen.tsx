import { useEffect, useRef, type ReactNode } from "react"
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg"

import { CheckIcon, LeafGlyph, LockIcon, WarningIcon } from "@/components/ghella/icons"
import { SectionLabel } from "@/components/ghella/primitives"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { FadeUp, Pop } from "@/lib/motion"
import { sx } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

/** The three copper applications injected into the calendar. */
function useApplications() {
  const { lang } = useT()
  return [
    {
      n: "1",
      d: lang === "fr" ? "Sam 5 sept" : lang === "ar" ? "السبت 5 سبتمبر" : "Sat Sep 5",
      note: lang === "ar" ? "صباحًا" : "morning · GO",
      full:
        lang === "ar"
          ? "رشّ نحاسي 1/3 · 120 غ / 40 ل"
          : "Copper spray 1/3 · 120 g / 40 L",
    },
    {
      n: "2",
      d: lang === "fr" ? "Sam 12 sept" : lang === "ar" ? "السبت 12 سبتمبر" : "Sat Sep 12",
      note: "+7 d",
      full: lang === "ar" ? "رشّ نحاسي 2/3 · إعادة" : "Copper spray 2/3 · repeat",
    },
    {
      n: "3",
      d: lang === "fr" ? "Sam 19 sept" : lang === "ar" ? "السبت 19 سبتمبر" : "Sat Sep 19",
      note: "+14 d",
      full: lang === "ar" ? "رشّ نحاسي 3/3 · الأخيرة" : "Copper spray 3/3 · final",
    },
  ]
}

/**
 * Local stand-in for the web's CSS `linear-gradient(135deg, from, to)`
 * backgrounds — parses the same gradient string and paints it with an SVG
 * fill behind the children (no expo-linear-gradient in the kit).
 */
function GradientBox({
  gradient,
  style,
  children,
}: {
  gradient: string
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  const [from = "#000000", to = "#000000"] = gradient.match(/#[0-9a-fA-F]+/g) ?? []
  const id = `g${from.slice(1)}${to.slice(1)}`
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  )
}

function StepAlert() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const set = useApp((s) => s.set)

  return (
    <>
      <View
        style={{
          flexDirection: "column",
          gap: 10,
          borderRadius: 16,
          backgroundColor: C.sunDeep,
          padding: 16,
        }}
      >
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: 9,
          }}
        >
          <WarningIcon size={22} />
          <Text
            style={{
              fontFamily: ff.mono.bold,
              fontSize: 11,
              letterSpacing: 11 * 0.14,
              color: "#ffffff",
            }}
          >
            {t.dzTag}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: ff.display.semibold,
            fontSize: 21,
            lineHeight: 25,
            color: "#ffffff",
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.dzAlertTitle}
        </Text>
        <Text
          style={{
            fontFamily: ff.sans.regular,
            fontSize: 13,
            lineHeight: 20,
            color: "#ffffff",
            opacity: 0.92,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.dzAlertWhy}
        </Text>
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.15)",
            paddingHorizontal: 11,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: "#ffffff" }}>
            {t.dzRiskLevel}
          </Text>
          <View
            style={{
              flexDirection: isRtl ? "row-reverse" : "row",
              alignItems: "center",
              gap: 3,
            }}
          >
            <View style={{ height: 8, width: 26, borderRadius: 4, backgroundColor: "#ffffff" }} />
            <View style={{ height: 8, width: 26, borderRadius: 4, backgroundColor: "#ffffff" }} />
            <View style={{ height: 8, width: 26, borderRadius: 4, backgroundColor: "#ffffff" }} />
            <View
              style={{
                height: 8,
                width: 26,
                borderRadius: 4,
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            />
          </View>
        </View>
      </View>

      <Button variant="ink" onPress={() => set({ dz: 1 })}>
        {t.dzInspect}
      </Button>
      <Text
        style={{
          textAlign: "center",
          fontFamily: ff.sans.semibold,
          fontSize: 13,
          color: C.muted,
        }}
      >
        {t.dzLater}
      </Text>
    </>
  )
}

function StepCapture() {
  const { t, lang, isRtl } = useT()
  const ff = useFF()
  const shots = useApp((s) => s.shots)
  const checks = useApp((s) => s.checks)
  const snapPhoto = useApp((s) => s.snapPhoto)
  const toggleCheck = useApp((s) => s.toggleCheck)
  const set = useApp((s) => s.set)

  const label =
    (lang === "ar" ? "صورة " : "PHOTO ") +
    `${Math.min(shots + 1, 2)} / 2` +
    (lang === "ar" ? " — أسفل الورقة" : " — UNDERSIDE OF LEAF")

  const checkLabels =
    lang === "fr"
      ? [
          "Taches brunes concentriques",
          "Halo jaune autour des taches",
          "Duvet blanc sous la feuille",
          "Flétrissement généralisé",
        ]
      : lang === "ar"
        ? ["بقع بنية حلقية", "هالة صفراء حول البقع", "زغب أبيض أسفل الورقة", "ذبول عام"]
        : [
            "Brown spots with concentric rings",
            "Yellow halo around spots",
            "White mold under the leaf",
            "General wilting",
          ]

  const corner: ViewStyle = {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: C.leafLight,
  }

  return (
    <>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 20,
          color: C.ink,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.dzCapTitle}
      </Text>

      <View
        style={{
          height: 250,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: 16,
          backgroundColor: "#171a12",
        }}
      >
        <Svg width={120} height={120} viewBox="0 0 100 100" style={{ opacity: 0.5 }}>
          <Path
            d="M50 12 C74 22 82 46 78 66 C60 78 36 76 24 60 C18 40 30 20 50 12 Z"
            fill="none"
            stroke={C.leafLight}
            strokeWidth={2.5}
            strokeDasharray="5 5"
          />
          <Path
            d="M50 12 C48 40 46 60 42 72"
            stroke={C.leafLight}
            strokeWidth={2}
            fill="none"
            strokeDasharray="5 5"
          />
        </Svg>

        <View
          style={sx(corner, {
            top: 12,
            left: 12,
            borderTopWidth: 3,
            borderLeftWidth: 3,
            borderTopLeftRadius: 4,
          })}
        />
        <View
          style={sx(corner, {
            top: 12,
            right: 12,
            borderTopWidth: 3,
            borderRightWidth: 3,
            borderTopRightRadius: 4,
          })}
        />
        <View
          style={sx(corner, {
            bottom: 12,
            left: 12,
            borderBottomWidth: 3,
            borderLeftWidth: 3,
            borderBottomLeftRadius: 4,
          })}
        />
        <View
          style={sx(corner, {
            bottom: 12,
            right: 12,
            borderBottomWidth: 3,
            borderRightWidth: 3,
            borderBottomRightRadius: 4,
          })}
        />

        <Text
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 16,
            textAlign: "center",
            fontFamily: ff.mono.bold,
            fontSize: 11,
            color: C.leafLight,
          }}
        >
          {label}
        </Text>

        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 52,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={snapPhoto}
            accessibilityLabel="Take photo"
            style={({ pressed }) => [
              {
                width: 54,
                height: 54,
                borderRadius: 27,
                borderWidth: 4,
                borderColor: C.surface,
                backgroundColor: "rgba(247,244,236,0.25)",
              },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          />
        </View>
      </View>

      <View
        style={{
          minHeight: 44,
          flexDirection: isRtl ? "row-reverse" : "row",
          gap: 7,
        }}
      >
        {Array.from({ length: shots }, (_, i) => (
          <Pop key={i}>
            <GradientBox
              gradient="linear-gradient(135deg,#57624a,#3d4a2c)"
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 9,
                borderWidth: 2,
                borderColor: C.leafLight,
              }}
            >
              <LeafGlyph size={20} />
            </GradientBox>
          </Pop>
        ))}
      </View>

      <SectionLabel style={{ fontSize: 12, letterSpacing: 12 * 0.1 }}>
        {t.dzChecklist}
      </SectionLabel>

      <View style={{ flexDirection: "column", gap: 7 }}>
        {checkLabels.map((label, i) => (
          <Pressable
            key={label}
            onPress={() => toggleCheck(i)}
            style={{
              flexDirection: isRtl ? "row-reverse" : "row",
              alignItems: "center",
              gap: 10,
              borderRadius: 11,
              borderWidth: 2,
              backgroundColor: C.card,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderColor: checks[i] ? C.leaf : C.line,
            }}
          >
            <View
              style={sx<ViewStyle>(
                {
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  borderWidth: 2,
                },
                checks[i]
                  ? { borderColor: C.leaf, backgroundColor: C.leaf }
                  : { borderColor: C.lineDash, backgroundColor: "#ffffff" }
              )}
            >
              {checks[i] && <CheckIcon size={11} />}
            </View>
            <Text
              style={{
                flex: 1,
                fontFamily: ff.sans.semibold,
                fontSize: 13,
                color: C.ink,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        variant={shots > 0 ? "ink" : "disabled"}
        onPress={() => shots > 0 && set({ dz: 2 })}
      >
        {t.dzIdentify}
      </Button>
    </>
  )
}

/** A leaf tile with disease lesions — "your photo" and the two references. */
function LeafTile({
  leaf,
  spots,
  gradient,
  caption,
  bordered,
}: {
  leaf: string
  spots: Array<{ cx: number; cy: number; r: number; fill: string }>
  gradient: string
  caption: string
  bordered?: boolean
}) {
  const ff = useFF()
  return (
    <View style={{ flex: 1, flexDirection: "column", gap: 4 }}>
      <GradientBox
        gradient={gradient}
        style={sx<ViewStyle>(
          {
            height: 74,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
          },
          bordered && { borderWidth: 2, borderColor: C.leafLight }
        )}
      >
        <Svg width={30} height={30} viewBox="0 0 100 100">
          <Path
            d="M50 12 C74 22 82 46 78 66 C60 78 36 76 24 60 C18 40 30 20 50 12 Z"
            fill={leaf}
          />
          {spots.map((s, i) => (
            <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />
          ))}
        </Svg>
      </GradientBox>
      <Text
        style={{
          textAlign: "center",
          fontFamily: ff.mono.bold,
          fontSize: 10,
          color: C.muted,
        }}
      >
        {caption}
      </Text>
    </View>
  )
}

/** The web's `motion.div initial={{width:0}} animate={{width:"87%"}}` bar. */
function ConfidenceBar({ isRtl }: { isRtl: boolean }) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [progress])

  return (
    <View
      style={{
        height: 9,
        overflow: "hidden",
        borderRadius: 5,
        backgroundColor: C.chip,
        flexDirection: isRtl ? "row-reverse" : "row",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 5,
          backgroundColor: C.leaf,
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "87%"],
          }),
        }}
      />
    </View>
  )
}

function StepResult() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const set = useApp((s) => s.set)

  return (
    <FadeUp style={{ flexDirection: "column", gap: 12 }}>
      <View
        style={{
          flexDirection: "column",
          gap: 11,
          borderRadius: 15,
          borderWidth: 1.5,
          borderColor: C.line,
          backgroundColor: C.card,
          padding: 15,
        }}
      >
        <SectionLabel style={{ fontSize: 10.5 }}>{t.dzMatch}</SectionLabel>

        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            flexWrap: "wrap",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <Text style={{ fontFamily: ff.display.semibold, fontSize: 22, color: C.ink }}>
            {t.dzDisease}
          </Text>
          <Text
            style={{
              fontFamily: ff.sans.regular,
              fontSize: 13,
              color: C.muted,
              fontStyle: "italic",
            }}
          >
            Alternaria solani
          </Text>
        </View>

        <View style={{ flexDirection: "column", gap: 4 }}>
          <View
            style={{
              flexDirection: isRtl ? "row-reverse" : "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.ink }}>
              {t.dzConf}
            </Text>
            <Text style={{ fontFamily: ff.mono.bold, fontSize: 13, color: C.leaf }}>
              87%
            </Text>
          </View>
          <ConfidenceBar isRtl={isRtl} />
        </View>

        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 7 }}>
          <LeafTile
            bordered
            gradient="linear-gradient(135deg,#57624a,#3d4a2c)"
            leaf="#7a9a5e"
            spots={[
              { cx: 44, cy: 42, r: 7, fill: C.earth },
              { cx: 60, cy: 56, r: 5, fill: C.earth },
            ]}
            caption={t.dzYours}
          />
          <LeafTile
            gradient="linear-gradient(135deg,#5e6b4e,#46543a)"
            leaf="#83a468"
            spots={[
              { cx: 48, cy: 45, r: 8, fill: "#5c4326" },
              { cx: 49, cy: 45, r: 5, fill: "#7a5a35" },
              { cx: 49, cy: 45, r: 2.5, fill: "#4a3620" },
            ]}
            caption={`${t.dzRef} 1 · ${t.dzRings}`}
          />
          <LeafTile
            gradient="linear-gradient(135deg,#6b7758,#525f44)"
            leaf="#8fa877"
            spots={[
              { cx: 40, cy: 40, r: 6, fill: "#5c4326" },
              { cx: 58, cy: 52, r: 7, fill: "#5c4326" },
              { cx: 50, cy: 66, r: 4, fill: "#5c4326" },
            ]}
            caption={`${t.dzRef} 2 · ${t.dzSpread}`}
          />
        </View>

        <Text
          style={{
            fontFamily: ff.sans.regular,
            fontSize: 12,
            lineHeight: 18,
            color: C.muted,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.dzAlts}
        </Text>
      </View>

      <Button variant="ink" onPress={() => set({ dz: 3 })}>
        {t.dzConfirm}
      </Button>
      <Text
        style={{
          textAlign: "center",
          fontFamily: ff.sans.semibold,
          fontSize: 13,
          color: C.muted,
        }}
      >
        {t.dzNotMatch}
      </Text>
    </FadeUp>
  )
}

function StepPlan() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const apps = useApplications()
  const addTreatmentTasks = useApp((s) => s.addTreatmentTasks)

  return (
    <FadeUp style={{ flexDirection: "column", gap: 12 }}>
      <Text
        style={{
          fontFamily: ff.display.semibold,
          fontSize: 20,
          color: C.ink,
          textAlign: isRtl ? "right" : "left",
        }}
      >
        {t.dzPlanTitle}
      </Text>

      <View
        style={{
          flexDirection: "column",
          gap: 12,
          borderRadius: 15,
          borderWidth: 1.5,
          borderColor: C.line,
          backgroundColor: C.card,
          padding: 15,
        }}
      >
        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "column", gap: 2 }}>
            <Text
              style={{
                fontFamily: ff.display.bold,
                fontSize: 16,
                color: C.ink,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t.dzProduct}
            </Text>
            <Text
              style={{
                fontFamily: ff.sans.regular,
                fontSize: 12,
                color: C.muted,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {t.dzProductSub}
            </Text>
          </View>
          <View
            style={{
              borderRadius: 7,
              backgroundColor: C.leafTint,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.leafDeep }}>
              {t.dzRotOk}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "column",
            gap: 3,
            borderRadius: 11,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: C.sunDeep,
            backgroundColor: C.sunTint,
            paddingHorizontal: 13,
            paddingVertical: 11,
          }}
        >
          <Text
            style={{
              fontFamily: ff.mono.bold,
              fontSize: 10,
              letterSpacing: 10 * 0.12,
              color: C.sunInk,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.dzDoseTag}
          </Text>
          <Text
            style={{
              fontFamily: ff.display.bold,
              fontSize: 17,
              color: C.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.dzDose}
          </Text>
          <Text
            style={{
              fontFamily: ff.sans.regular,
              fontSize: 12,
              color: C.sunInk,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.dzDoseSub}
          </Text>
        </View>

        <View
          style={{
            borderRadius: 10,
            backgroundColor: "#f2efe4",
            paddingHorizontal: 11,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              fontFamily: ff.sans.semibold,
              fontSize: 12,
              lineHeight: 18,
              color: "#5c4a1e",
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.dzResist}
          </Text>
        </View>

        <View style={{ flexDirection: "column", gap: 6 }}>
          <SectionLabel style={{ fontSize: 10.5 }}>{t.dzWindow}</SectionLabel>
          <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 7 }}>
            <View
              style={{
                flex: 1,
                flexDirection: "column",
                gap: 2,
                borderRadius: 10,
                backgroundColor: C.clayTint,
                paddingHorizontal: 6,
                paddingVertical: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.clay }}>
                {t.dzThu}
              </Text>
              <Text style={{ fontFamily: ff.sans.semibold, fontSize: 11, color: C.clay }}>
                {t.dzWind}
              </Text>
              <Text style={{ fontFamily: ff.sans.bold, fontSize: 13, color: C.clay }}>✕</Text>
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: "column",
                gap: 2,
                borderRadius: 10,
                backgroundColor: C.clayTint,
                paddingHorizontal: 6,
                paddingVertical: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.clay }}>
                {t.dzFri}
              </Text>
              <Text style={{ fontFamily: ff.sans.semibold, fontSize: 11, color: C.clay }}>
                {t.dzRainW}
              </Text>
              <Text style={{ fontFamily: ff.sans.bold, fontSize: 13, color: C.clay }}>✕</Text>
            </View>
            <View
              style={{
                flex: 1.25,
                flexDirection: "column",
                gap: 2,
                borderRadius: 10,
                backgroundColor: C.leaf,
                paddingHorizontal: 6,
                paddingVertical: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: ff.mono.bold, fontSize: 10, color: C.leafSoft }}>
                {t.dzSat}
              </Text>
              <Text style={{ fontFamily: ff.sans.semibold, fontSize: 11, color: "#ffffff" }}>
                {t.dzCalm}
              </Text>
              <Text style={{ fontFamily: ff.sans.bold, fontSize: 13, color: "#ffffff" }}>
                {t.dzGo}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "column", gap: 5 }}>
          <SectionLabel style={{ fontSize: 10.5 }}>{t.dzSched}</SectionLabel>
          {apps.map((a) => (
            <View
              key={a.n}
              style={{
                flexDirection: isRtl ? "row-reverse" : "row",
                alignItems: "center",
                gap: 9,
                borderBottomWidth: 1,
                borderStyle: "dashed",
                borderBottomColor: C.chip,
                paddingVertical: 6,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 11,
                  backgroundColor: C.sunDeep,
                }}
              >
                <Text style={{ fontFamily: ff.display.bold, fontSize: 11, color: "#ffffff" }}>
                  {a.n}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: ff.sans.semibold,
                  fontSize: 13,
                  color: C.ink,
                  textAlign: isRtl ? "right" : "left",
                }}
              >
                {a.d}
              </Text>
              <Text style={{ fontFamily: ff.mono.regular, fontSize: 11, color: C.muted }}>
                {a.note}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={{
            borderRadius: 10,
            backgroundColor: C.waterTint,
            paddingHorizontal: 11,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              fontFamily: ff.sans.semibold,
              fontSize: 12,
              lineHeight: 18,
              color: C.waterDeep,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.dzInterlock}
          </Text>
        </View>

        <View
          style={{
            flexDirection: isRtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 10,
            backgroundColor: C.clayTint,
            paddingHorizontal: 11,
            paddingVertical: 9,
          }}
        >
          <LockIcon size={15} />
          <Text
            style={{
              flex: 1,
              fontFamily: ff.sans.semibold,
              fontSize: 12,
              lineHeight: 17,
              color: C.clay,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {t.dzPhi}
          </Text>
        </View>
      </View>

      <Button variant="sunDeep" onPress={addTreatmentTasks}>
        {t.dzAddCta}
      </Button>
    </FadeUp>
  )
}

function StepAdded() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const apps = useApplications()
  const go = useApp((s) => s.go)

  return (
    <FadeUp
      style={{
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        borderRadius: 18,
        backgroundColor: C.ink,
        paddingHorizontal: 18,
        paddingVertical: 26,
      }}
    >
      <Pop>
        <View
          style={{
            width: 58,
            height: 58,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 29,
            backgroundColor: C.leafBright,
          }}
        >
          <CheckIcon size={30} />
        </View>
      </Pop>

      <Text
        style={{
          textAlign: "center",
          fontFamily: ff.display.semibold,
          fontSize: 21,
          color: C.surface,
        }}
      >
        {t.dzAdded}
      </Text>

      <View style={{ width: "100%", flexDirection: "column", gap: 7 }}>
        {apps.map((a, i) => (
          <FadeUp
            key={a.n}
            delay={i * 50}
            style={{
              flexDirection: isRtl ? "row-reverse" : "row",
              alignItems: "center",
              gap: 9,
              borderRadius: 10,
              backgroundColor: "rgba(247,244,236,0.09)",
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: C.sunDeep,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: ff.sans.semibold,
                fontSize: 12.5,
                color: C.surface,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {a.full}
            </Text>
            <Text style={{ fontFamily: ff.mono.bold, fontSize: 10.5, color: C.sun }}>
              {a.d}
            </Text>
          </FadeUp>
        ))}
      </View>

      <View
        style={{
          width: "100%",
          flexDirection: isRtl ? "row-reverse" : "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: C.clay,
          backgroundColor: "rgba(179,64,47,0.22)",
          paddingHorizontal: 12,
          paddingVertical: 9,
        }}
      >
        <LockIcon size={15} stroke={C.clayLight} />
        <Text
          style={{
            flex: 1,
            fontFamily: ff.sans.semibold,
            fontSize: 12,
            lineHeight: 17,
            color: "#f2c4bb",
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {t.dzPhiNote}
        </Text>
      </View>

      <Text
        style={{
          width: "100%",
          textAlign: "center",
          fontFamily: ff.sans.regular,
          fontSize: 11.5,
          lineHeight: 17,
          color: C.sand,
        }}
      >
        {t.dzLog}
      </Text>

      <View
        style={{
          width: "100%",
          flexDirection: isRtl ? "row-reverse" : "row",
          gap: 8,
        }}
      >
        <Button
          variant="light"
          size="md"
          style={{ flex: 1, borderRadius: 10 }}
          onPress={() => go("cal")}
        >
          {t.dzViewCal}
        </Button>
        <Button
          variant="outlineOnDark"
          size="md"
          style={{ flex: 1, borderRadius: 10 }}
          onPress={() => go("home")}
        >
          {t.dzHome}
        </Button>
      </View>
    </FadeUp>
  )
}

export function DiseaseScreen() {
  const dz = useApp((s) => s.dz)
  const { isRtl } = useT()

  return (
    <View style={{ flexDirection: "column", gap: 13, paddingTop: 4 }}>
      <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 5 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              backgroundColor: i <= dz ? C.sunDeep : C.chip,
            }}
          />
        ))}
      </View>

      <View key={dz} style={{ flexDirection: "column", gap: 13 }}>
        {dz === 0 && <StepAlert />}
        {dz === 1 && <StepCapture />}
        {dz === 2 && <StepResult />}
        {dz === 3 && <StepPlan />}
        {dz === 4 && <StepAdded />}
      </View>
    </View>
  )
}
