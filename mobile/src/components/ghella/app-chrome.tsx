import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { SettingsSheet } from "@/components/ghella/settings-sheet"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { FadeUp, Pop } from "@/lib/motion"
import { useApp, type Screen } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

import { BellIcon, CheckIcon, GhellaLogo, OfflineIcon, PathIcon, TAB_PATHS } from "./icons"

/** The dark strip that appears above everything when the device is offline. */
export function OfflineBanner() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const offline = useApp((s) => s.offline)

  if (!offline) return null
  return (
    <View
      style={{
        backgroundColor: C.ink,
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 7,
      }}
    >
      <OfflineIcon />
      <Text style={{ fontFamily: ff.sans.semibold, fontSize: 12.5, color: C.cream }}>
        {t.offlineMsg}
      </Text>
    </View>
  )
}

/**
 * Logo, notification bell and the account avatar. The avatar opens the
 * settings sheet — language, demo scenarios and reset live there now that
 * the web prototype's side panel is gone.
 */
export function AppHeader() {
  const { isRtl } = useT()
  const ff = useFF()
  const treated = useApp((s) => s.treated)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const bellDot = !treated

  return (
    <View
      style={{
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
      }}
    >
      <GhellaLogo />
      <View
        style={{
          flexDirection: isRtl ? "row-reverse" : "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: C.chip,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BellIcon />
          {bellDot && (
            <Pop
              style={{
                position: "absolute",
                top: 5,
                right: 6,
                width: 8,
                height: 8,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: C.surface,
                  backgroundColor: C.clay,
                }}
              />
            </Pop>
          )}
        </View>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: C.leaf,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: ff.display.bold, fontSize: 13, color: C.surface }}>
            S
          </Text>
        </Pressable>
      </View>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  )
}

/** Bottom tab bar. */
export function BottomNav() {
  const { t, isRtl } = useT()
  const ff = useFF()
  const screen = useApp((s) => s.screen)
  const go = useApp((s) => s.go)

  const tabs: Array<{ id: Screen; label: string; d: string }> = [
    { id: "cal", label: t.tabCal, d: TAB_PATHS.cal },
    { id: "decide", label: t.tabDecide, d: TAB_PATHS.decide },
    { id: "home", label: t.tabHome, d: TAB_PATHS.home },
    { id: "market", label: t.tabMarket, d: TAB_PATHS.market },
    { id: "close", label: t.tabReport, d: TAB_PATHS.close },
  ]

  return (
    <View
      style={{
        flexDirection: isRtl ? "row-reverse" : "row",
        borderTopWidth: 1,
        borderTopColor: C.line,
        backgroundColor: C.surfaceRaised,
        paddingHorizontal: 4,
        paddingTop: 6,
        paddingBottom: 10,
      }}
    >
      {tabs.map((tab) => {
        const active = screen === tab.id
        return (
          <Pressable
            key={tab.id}
            onPress={() => go(tab.id)}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 3,
              paddingVertical: 4,
            }}
          >
            <View
              style={{
                width: 40,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? C.leafTint : "transparent",
              }}
            >
              <PathIcon d={tab.d} stroke={active ? C.leafDeep : C.muted2} />
            </View>
            <Text
              style={{
                fontFamily: ff.sans.bold,
                fontSize: 10,
                color: active ? C.leafDeep : C.muted2,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Confirmation toast, floating just above the tab bar. */
export function Toast() {
  const ff = useFF()
  const toastMsg = useApp((s) => s.toastMsg)

  if (!toastMsg) return null
  return (
    <FadeUp
      distance={12}
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 86,
        zIndex: 5,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          borderRadius: 12,
          backgroundColor: C.ink,
          paddingHorizontal: 15,
          paddingVertical: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: C.leafBright,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckIcon />
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: ff.sans.semibold,
            fontSize: 13,
            color: C.surface,
          }}
        >
          {toastMsg}
        </Text>
      </View>
    </FadeUp>
  )
}
