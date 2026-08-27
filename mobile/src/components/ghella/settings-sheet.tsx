import { Modal, Pressable, ScrollView, Text, View } from "react-native"

import { SectionLabel } from "@/components/ghella/primitives"
import { Segmented } from "@/components/ui/segmented"
import { Switch } from "@/components/ui/switch"
import type { Lang } from "@/i18n/dict"
import { C } from "@/lib/colors"
import { useApp, type Screen } from "@/store/app-store"
import { useParcels } from "@/store/parcel-store"
import { useFF } from "@/theme/fonts"

const JUMPS: ReadonlyArray<{ id: Screen; label: string }> = [
  { id: "onboard", label: "First-run onboarding" },
  { id: "cal", label: "Calendar · main" },
  { id: "decide", label: "Decision screen" },
  { id: "home", label: "My land" },
  { id: "disease", label: "Disease flow" },
  { id: "market", label: "Market + simulator" },
  { id: "close", label: "Season close" },
]

const LANGS: ReadonlyArray<{ value: Lang; label: string }> = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
  { value: "ar", label: "عربي" },
]

/**
 * The web prototype's control panel, folded into the app as a bottom sheet:
 * language, the three demo scenarios, screen shortcuts and the full reset.
 */
export function SettingsSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const ff = useFF()
  const lang = useApp((s) => s.lang)
  const setLang = useApp((s) => s.setLang)
  const offline = useApp((s) => s.offline)
  const rain = useApp((s) => s.rain)
  const frost = useApp((s) => s.frost)
  const toggleOffline = useApp((s) => s.toggleOffline)
  const toggleRain = useApp((s) => s.toggleRain)
  const toggleFrost = useApp((s) => s.toggleFrost)
  const go = useApp((s) => s.go)
  const goDisease = useApp((s) => s.goDisease)
  const goClose = useApp((s) => s.goClose)
  const reset = useApp((s) => s.reset)
  const clearAllParcels = useParcels((s) => s.clearAllParcels)

  const jump = (id: Screen) => {
    if (id === "disease") goDisease()
    else if (id === "close") goClose()
    else go(id)
    onClose()
  }

  const scenarios = [
    { label: "Offline mode", on: offline, toggle: toggleOffline },
    { label: "Rain tonight (18 mm)", on: rain, toggle: toggleRain },
    { label: "Frost alert", on: frost, toggle: toggleFrost },
  ]

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(31,36,22,0.45)" }}
      />
      <View
        style={{
          maxHeight: "78%",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: C.surfaceRaised,
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: 26,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: C.lineStrong,
            marginBottom: 12,
          }}
        />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <SectionLabel>LANGUAGE</SectionLabel>
              <Segmented value={lang} options={LANGS} onChange={setLang} />
            </View>

            <View style={{ gap: 4 }}>
              <SectionLabel>SCENARIOS</SectionLabel>
              {scenarios.map((s) => (
                <View
                  key={s.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontFamily: ff.sans.semibold, fontSize: 13.5, color: C.inkSoft }}>
                    {s.label}
                  </Text>
                  <Switch checked={s.on} onCheckedChange={s.toggle} />
                </View>
              ))}
            </View>

            <View style={{ gap: 6 }}>
              <SectionLabel>SCREENS</SectionLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {JUMPS.map((j) => (
                  <Pressable
                    key={j.id}
                    onPress={() => jump(j.id)}
                    style={({ pressed }) => ({
                      borderRadius: 9,
                      borderWidth: 1,
                      borderColor: C.lineStrong,
                      backgroundColor: pressed ? C.chip : C.card,
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                    })}
                  >
                    <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12, color: C.inkSoft }}>
                      {j.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={() => {
                reset()
                clearAllParcels()
                onClose()
              }}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                borderRadius: 9,
                backgroundColor: pressed ? C.clay : C.clayTint,
                paddingHorizontal: 12,
                paddingVertical: 8,
              })}
            >
              {({ pressed }) => (
                <Text
                  style={{
                    fontFamily: ff.sans.bold,
                    fontSize: 12.5,
                    color: pressed ? "#fff" : C.clay,
                  }}
                >
                  Reset demo — wipe parcels
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
