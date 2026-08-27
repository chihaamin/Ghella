import {
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
  Karla_800ExtraBold,
} from "@expo-google-fonts/karla"
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk"
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono"
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic"
import { useFonts } from "expo-font"
import { StatusBar } from "expo-status-bar"
import { useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context"

import { AppHeader, BottomNav, OfflineBanner, Toast } from "@/components/ghella/app-chrome"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { CalendarScreen } from "@/screens/calendar-screen"
import { CloseScreen } from "@/screens/close-screen"
import { DecideScreen } from "@/screens/decide-screen"
import { DiseaseScreen } from "@/screens/disease-screen"
import { HomeScreen } from "@/screens/home-screen"
import { MarketScreen } from "@/screens/market-screen"
import { OnboardScreen } from "@/screens/onboard-screen"
import { hydrateStorage } from "@/services/storage"
import { useApp, type Screen } from "@/store/app-store"
import { useParcels } from "@/store/parcel-store"

const SCREENS: Record<Screen, () => React.JSX.Element> = {
  home: HomeScreen,
  onboard: OnboardScreen,
  decide: DecideScreen,
  cal: CalendarScreen,
  disease: DiseaseScreen,
  market: MarketScreen,
  close: CloseScreen,
}

/**
 * The app shell: offline banner, header, the scrolling screen body, the toast
 * layer and the tab bar — the web app's PhoneShell without the device frame.
 */
function AppShell() {
  const screen = useApp((s) => s.screen)
  const insets = useSafeAreaInsets()
  const bodyRef = useRef<ScrollView>(null)
  const Active = SCREENS[screen]

  // A new screen always starts at the top, the way a native push would.
  useEffect(() => {
    bodyRef.current?.scrollTo({ y: 0, animated: false })
  }, [screen])

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.surface,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <OfflineBanner />
      <AppHeader />

      <ScrollView
        ref={bodyRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp key={screen} distance={8}>
          <Active />
        </FadeUp>
      </ScrollView>

      <Toast />
      <BottomNav />
    </View>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Karla_400Regular,
    Karla_500Medium,
    Karla_600SemiBold,
    Karla_700Bold,
    Karla_800ExtraBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  })
  const [storageReady, setStorageReady] = useState(false)

  // The HTTP stale-cache and the parcel store both read synchronously, so the
  // AsyncStorage keyspace is pulled into memory before the first screen mounts.
  useEffect(() => {
    hydrateStorage().then(() => {
      // Storage is in memory now — replay the persisted parcels into zustand.
      useParcels.persist.rehydrate()
      setStorageReady(true)
    })
  }, [])

  if (!fontsLoaded || !storageReady) {
    // The splash screen covers this frame; painting the canvas colour avoids a
    // white flash between splash and first render.
    return <View style={{ flex: 1, backgroundColor: C.surface }} />
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppShell />
    </SafeAreaProvider>
  )
}
