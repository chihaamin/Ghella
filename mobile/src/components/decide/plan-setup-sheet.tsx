/**
 * The three-question sheet between "Plan the harvest" and a committed plan.
 *
 * Pressing the button used to commit a season instantly, anchored on "today"
 * — which silently scheduled soil prep a farmer may have finished weeks ago,
 * on dates before they even meant to start. This sheet asks the only three
 * things the generic plan actually bends around: is the soil prepared, which
 * prep steps are already done, and when work begins. The card supplies the
 * frozen economics draft; the answers fill the three fields the calendar's
 * phase generator shapes itself by.
 *
 * Web mechanics were a clone of `edit-parcel-sheet` (absolute overlay +
 * y-spring panel); here that becomes the platform bottom sheet — an RN Modal
 * with a slide-in panel, same as `settings-sheet`.
 */

import { useEffect, useState } from "react"
import type { JSX } from "react"
import { Modal, Pressable, ScrollView, Text, View } from "react-native"

import { SectionLabel } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, dayCellStyle } from "@/components/ui/calendar"
import { dateOfIso, isoOfDate } from "@/hooks/use-calendar"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { recommendedPrep } from "@/lib/generic-plan"
import { animateLayout } from "@/lib/motion"
import type { PlannedCropPlan, PrepStepId } from "@/store/app-store"
import type { CropCategory } from "@/types/land"
import { useFF } from "@/theme/fonts"

/** The card's frozen economics — everything but the three answers this sheet asks. */
export type PlanDraft = Omit<PlannedCropPlan, "startIso" | "soilPrepared" | "prepDone">

export interface PlanSetupResult {
  startIso: string
  soilPrepared: boolean
  prepDone: PrepStepId[]
}

/** Chip order mirrors the field sequence: break ground before you feed it. */
const PREP_STEPS: PrepStepId[] = ["plough", "manure", "fertiliser", "beds", "irrigation"]

/** Green when picked, hairline when not — onboarding's choice-card outline. */
const pickBorder = (on: boolean) => (on ? C.leaf : C.line)

type WhenChoice = "today" | "week" | "pick"

export function PlanSetupSheet(props: {
  open: boolean
  cropName: string
  category: CropCategory | null
  /** Cycle length, so annual "fruit" (melon) gets bed/fertiliser advice. */
  cycleDays?: number | null
  onClose: () => void
  onCreate: (setup: PlanSetupResult) => void
}): JSX.Element | null {
  const { open, cropName, category, cycleDays = null, onClose, onCreate } = props
  const { t, lang, isRtl } = useT()
  const ff = useFF()

  const [soilPrepared, setSoilPrepared] = useState(false)
  const [prepDone, setPrepDone] = useState<PrepStepId[]>([])
  const [whenChoice, setWhenChoice] = useState<WhenChoice>("today")
  const [pickedIso, setPickedIso] = useState<string | null>(null)

  // Every opening is a fresh crop and a fresh conversation — yesterday's
  // answers about another card's soil must not leak into this one.
  useEffect(() => {
    if (open) {
      setSoilPrepared(false)
      setPrepDone([])
      setWhenChoice("today")
      setPickedIso(null)
    }
  }, [open])

  const stepLabel: Record<PrepStepId, string> = {
    plough: t.psPlough,
    manure: t.psManure,
    fertiliser: t.psFertiliser,
    beds: t.psBeds,
    irrigation: t.psIrrigation,
  }

  const recommended = recommendedPrep(category, cycleDays)

  const toggleStep = (step: PrepStepId) =>
    setPrepDone((cur) =>
      cur.includes(step) ? cur.filter((s) => s !== step) : [...cur, step]
    )

  // Local noon keeps every date on the day the farmer sees, whatever the
  // timezone does at midnight — same posture as the calendar hook.
  const todayIso = isoOfDate(new Date())
  const weekDate = dateOfIso(todayIso)
  weekDate.setDate(weekDate.getDate() + 7)
  const startIso =
    whenChoice === "today"
      ? todayIso
      : whenChoice === "week"
        ? isoOfDate(weekDate)
        : (pickedIso ?? todayIso)

  const locale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"
  const startLine = dateOfIso(startIso).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const whenChips: { id: WhenChoice; label: string }[] = [
    { id: "today", label: t.psToday },
    { id: "week", label: t.psNextWeek },
    { id: "pick", label: t.psPickDate },
  ]

  const rowDir = isRtl ? ("row-reverse" as const) : ("row" as const)
  const ta = { textAlign: isRtl ? ("right" as const) : ("left" as const) }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      {/* Scrim — web's bg-ink/40 overlay, press to dismiss. */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(31,36,22,0.4)" }}
      />

      {/* Panel — web's y-spring bottom sheet. */}
      <View
        style={{
          maxHeight: "80%",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          backgroundColor: C.surface,
          padding: 16,
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <SectionLabel style={ta}>{t.psTitle}</SectionLabel>
              <Text
                style={[
                  {
                    fontFamily: ff.display.bold,
                    fontSize: 18,
                    lineHeight: 21,
                    color: C.ink,
                  },
                  ta,
                ]}
              >
                {cropName}
              </Text>
            </View>

            {/* Q1 — is the soil already prepared? */}
            <View style={{ gap: 8 }}>
              <SectionLabel style={[{ fontSize: 12, letterSpacing: 1.2 }, ta]}>
                {t.psSoilQ}
              </SectionLabel>
              <View style={{ flexDirection: rowDir, gap: 8 }}>
                {[false, true].map((yes) => (
                  <Pressable
                    key={String(yes)}
                    onPress={() => {
                      animateLayout()
                      setSoilPrepared(yes)
                    }}
                    style={{
                      flex: 1,
                      borderRadius: 11,
                      borderWidth: 2.5,
                      borderColor: pickBorder(soilPrepared === yes),
                      backgroundColor: C.card,
                      paddingHorizontal: 11,
                      paddingVertical: 12,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontFamily: ff.sans.semibold,
                        fontSize: 13,
                        color: C.ink,
                      }}
                    >
                      {yes ? t.psYes : t.psNo}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Q2 — only when the soil is ready: what is already done? */}
            {soilPrepared && (
              <View style={{ gap: 8 }}>
                <SectionLabel style={[{ fontSize: 12, letterSpacing: 1.2 }, ta]}>
                  {t.psWhatDone}
                </SectionLabel>
                <View style={{ flexDirection: rowDir, flexWrap: "wrap", gap: 6 }}>
                  {PREP_STEPS.map((step) => (
                    <Pressable
                      key={step}
                      onPress={() => toggleStep(step)}
                      style={{
                        borderRadius: 10,
                        borderWidth: 2.5,
                        borderColor: pickBorder(prepDone.includes(step)),
                        backgroundColor: C.card,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: ff.sans.semibold,
                          fontSize: 12,
                          color: C.ink,
                        }}
                      >
                        {stepLabel[step]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <SectionLabel style={[{ paddingTop: 4, fontSize: 10 }, ta]}>
                  {t.psRecommended}
                </SectionLabel>
                <View style={{ flexDirection: rowDir, flexWrap: "wrap", gap: 4 }}>
                  {recommended.map((step) => (
                    <Badge key={step} variant="leaf" size="xs">
                      {stepLabel[step]}
                    </Badge>
                  ))}
                </View>
              </View>
            )}

            {/* The consequence of Q1, said out loud before the date is asked. */}
            <View
              style={{
                borderRadius: 9,
                backgroundColor: C.leafTint,
                paddingHorizontal: 11,
                paddingVertical: 8,
              }}
            >
              <Text
                style={[
                  {
                    fontFamily: ff.sans.semibold,
                    fontSize: 12,
                    lineHeight: 17,
                    color: C.leafDeep,
                  },
                  ta,
                ]}
              >
                {/* With recommended steps unticked, planting is NOT day 1 —
                    the gaps note is the honest one. */}
                {soilPrepared
                  ? recommended.some((step) => !prepDone.includes(step))
                    ? t.psGapsNote
                    : t.psReadyNote
                  : t.psSoilFirstNote}
              </Text>
            </View>

            {/* Q3 — when does work begin? */}
            <View style={{ gap: 8 }}>
              <SectionLabel style={[{ fontSize: 12, letterSpacing: 1.2 }, ta]}>
                {t.psWhenQ}
              </SectionLabel>
              <View style={{ flexDirection: rowDir, gap: 8 }}>
                {whenChips.map((chip) => (
                  <Pressable
                    key={chip.id}
                    onPress={() => {
                      animateLayout()
                      setWhenChoice(chip.id)
                    }}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 2.5,
                      borderColor: pickBorder(whenChoice === chip.id),
                      backgroundColor: C.card,
                      paddingHorizontal: 6,
                      paddingVertical: 9,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontFamily: ff.sans.semibold,
                        fontSize: 12,
                        color: C.ink,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {whenChoice === "pick" && (
                <View
                  style={{
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: C.line,
                    backgroundColor: C.card,
                    padding: 8,
                  }}
                >
                  <Calendar
                    selected={dateOfIso(startIso)}
                    onSelect={(d) => {
                      // Web passed `disabled={{ before: today }}` to
                      // react-day-picker; the kit Calendar has no disabled
                      // prop, so the guard lives here.
                      if (isoOfDate(d) < todayIso) return
                      setPickedIso(isoOfDate(d))
                    }}
                    initialMonth={dateOfIso(startIso)}
                    lang={lang}
                    renderDay={(day, modifiers) => {
                      const disabled = isoOfDate(day) < todayIso
                      return (
                        <View
                          style={[dayCellStyle(modifiers), disabled && { opacity: 0.35 }]}
                        >
                          <Text
                            style={{
                              fontFamily: ff.display.semibold,
                              fontSize: 11.5,
                              color: modifiers.today ? C.cream : C.ink,
                            }}
                          >
                            {day.getDate()}
                          </Text>
                        </View>
                      )
                    }}
                  />
                </View>
              )}

              <Text
                style={[
                  { fontFamily: ff.sans.semibold, fontSize: 12.5, color: C.ink },
                  ta,
                ]}
              >
                {startLine}
              </Text>
            </View>

            <Button
              variant="leaf"
              size="lg"
              onPress={() => onCreate({ startIso, soilPrepared, prepDone })}
            >
              {t.psCreate}
            </Button>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
