import { useState } from "react"
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native"

import { SectionLabel } from "@/components/ghella/primitives"
import { Button } from "@/components/ui/button"
import { SALINITY, WATER_SOURCES } from "@/data/onboarding"
import { useT } from "@/i18n/use-t"
import { textureLabel } from "@/lib/agronomy"
import { C } from "@/lib/colors"
import { PARCEL_PALETTE, useParcels } from "@/store/parcel-store"
import { useFF } from "@/theme/fonts"
import type { Parcel, SalinityId, TextureClass, WaterSourceId } from "@/types/land"

/**
 * The twelve USDA texture classes, light to heavy — the same order the
 * `TextureClass` union declares them, so the grid reads sand → clay.
 */
const TEXTURES: TextureClass[] = [
  "sand",
  "loamy sand",
  "sandy loam",
  "loam",
  "silt loam",
  "silt",
  "sandy clay loam",
  "clay loam",
  "silty clay loam",
  "sandy clay",
  "silty clay",
  "clay",
]

/** Onboarding's water cards are index-ordered; these are their store ids. */
const WATER_IDS: WaterSourceId[] = ["drip", "sprinkler", "flood", "rainfed"]

/** Same deal for the three salinity answers. */
const SALINITY_IDS: SalinityId[] = ["none", "slight", "patches"]

/** Green when picked, hairline when not — onboarding's choice-card outline. */
const pickBorder = (on: boolean) => (on ? C.leaf : C.line)

/**
 * The parcel name field. Uncontrolled on the web (`defaultValue` + commit on
 * blur); here the draft lives in state, and the `key={parcel.id}` on the
 * call site remounts it so switching parcels resets the draft text, exactly
 * like the web version.
 */
function ParcelNameInput({
  name,
  label,
  isRtl,
  onCommit,
}: {
  name: string
  label: string
  isRtl: boolean
  onCommit: (name: string) => void
}) {
  const ff = useFF()
  const [draft, setDraft] = useState(name)
  const [focused, setFocused] = useState(false)

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      accessibilityLabel={label}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        const next = draft.trim()
        if (next && next !== name) onCommit(next)
      }}
      style={{
        alignSelf: "stretch",
        borderBottomWidth: 1,
        borderColor: focused ? C.leaf : C.line,
        backgroundColor: "transparent",
        paddingBottom: 4,
        paddingTop: 0,
        fontFamily: ff.display.semibold,
        fontSize: 18,
        color: C.ink,
        textAlign: isRtl ? "right" : "left",
      }}
    />
  )
}

/**
 * Bottom sheet for correcting what the farmer knows about one parcel: name,
 * colour, soil texture, water source and salinity.
 *
 * Every tap writes to the store IMMEDIATELY — there is no staged draft and no
 * cancel, because these are facts about the land, not a form to abandon; the
 * Save button only closes. A transparent slide-in Modal plays the part of the
 * web version's absolute-positioned sheet inside the device frame.
 */
export function EditParcelSheet({
  parcel,
  open,
  onClose,
}: {
  parcel: Parcel
  open: boolean
  onClose: () => void
}) {
  const { t, isRtl } = useT()
  const ff = useFF()
  const renameParcel = useParcels((s) => s.renameParcel)
  const recolorParcel = useParcels((s) => s.recolorParcel)
  const setSoilTexture = useParcels((s) => s.setSoilTexture)
  const setWaterSource = useParcels((s) => s.setWaterSource)
  const setSalinity = useParcels((s) => s.setSalinity)

  const row = { flexDirection: isRtl ? "row-reverse" : "row" } as const
  const alignStart = { textAlign: isRtl ? "right" : "left" } as const

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(31,36,22,0.4)" }}
      />

      <View
        style={{
          maxHeight: "75%",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          backgroundColor: C.surface,
          padding: 16,
          paddingBottom: 26,
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: "column", gap: 16 }}
        >
          <View style={{ flexDirection: "column", gap: 8 }}>
            <SectionLabel style={alignStart}>{t.epTitle}</SectionLabel>
            {/* Keyed by parcel so switching parcels resets the draft text. */}
            <ParcelNameInput
              key={parcel.id}
              name={parcel.name}
              label={t.epName}
              isRtl={isRtl}
              onCommit={(name) => renameParcel(parcel.id, name)}
            />
          </View>

          <View style={[row, { gap: 8 }]}>
            {PARCEL_PALETTE.map((color) => (
              <Pressable
                key={color}
                onPress={() => recolorParcel(parcel.id, color)}
                accessibilityLabel={color}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  borderWidth: 2.5,
                  borderColor: parcel.color === color ? C.ink : "transparent",
                  backgroundColor: color,
                }}
              />
            ))}
          </View>

          {/* Soil — the model chip clears the farmer override (null). */}
          <View style={{ flexDirection: "column", gap: 8 }}>
            <SectionLabel style={[{ fontSize: 12, letterSpacing: 1.2 }, alignStart]}>
              {t.epSoilQ}
            </SectionLabel>
            <View style={[row, { flexWrap: "wrap", gap: 6 }]}>
              <Pressable
                onPress={() => setSoilTexture(parcel.id, null)}
                style={{
                  flexBasis: "100%",
                  borderRadius: 10,
                  borderWidth: 2.5,
                  borderColor: pickBorder(parcel.soilTexture === null),
                  backgroundColor: C.card,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
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
                  {t.epSoilModel}
                </Text>
              </Pressable>
              {TEXTURES.map((texture) => (
                <Pressable
                  key={texture}
                  onPress={() => setSoilTexture(parcel.id, texture)}
                  style={{
                    flexBasis: "31%",
                    flexGrow: 1,
                    justifyContent: "center",
                    borderRadius: 10,
                    borderWidth: 2.5,
                    borderColor: pickBorder(parcel.soilTexture === texture),
                    backgroundColor: C.card,
                    paddingHorizontal: 6,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      fontFamily: ff.sans.semibold,
                      fontSize: 11.5,
                      lineHeight: 14,
                      color: C.ink,
                    }}
                  >
                    {textureLabel(texture)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Water — styled like onboarding's water cards. */}
          <View style={{ flexDirection: "column", gap: 8 }}>
            <SectionLabel style={[{ fontSize: 12, letterSpacing: 1.2 }, alignStart]}>
              {t.epWaterQ}
            </SectionLabel>
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              {WATER_SOURCES.map((source, i) => (
                <Pressable
                  key={source.name}
                  onPress={() => setWaterSource(parcel.id, WATER_IDS[i])}
                  style={{
                    flexBasis: "47%",
                    flexGrow: 1,
                    flexDirection: "column",
                    gap: 2,
                    borderRadius: 11,
                    borderWidth: 2.5,
                    borderColor: pickBorder(parcel.waterSource === WATER_IDS[i]),
                    backgroundColor: C.card,
                    paddingHorizontal: 11,
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={[
                      { fontFamily: ff.sans.semibold, fontSize: 13, color: C.ink },
                      alignStart,
                    ]}
                  >
                    {source.name}
                  </Text>
                  <Text
                    style={[
                      { fontFamily: ff.sans.regular, fontSize: 11, color: C.muted },
                      alignStart,
                    ]}
                  >
                    {source.sub}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Salinity — a stated "none" is an answer, so it is a chip too. */}
          <View style={{ flexDirection: "column", gap: 8 }}>
            <SectionLabel style={[{ fontSize: 12, letterSpacing: 1.2 }, alignStart]}>
              {t.epSalQ}
            </SectionLabel>
            <View style={[row, { gap: 8 }]}>
              {SALINITY.map((option, i) => (
                <Pressable
                  key={option.name}
                  onPress={() => setSalinity(parcel.id, SALINITY_IDS[i])}
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    borderRadius: 10,
                    borderWidth: 2.5,
                    borderColor: pickBorder(parcel.salinity === SALINITY_IDS[i]),
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
                    {option.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Button variant="ink" size="lg" onPress={onClose}>
            {t.epSave}
          </Button>
        </ScrollView>
      </View>
    </Modal>
  )
}
