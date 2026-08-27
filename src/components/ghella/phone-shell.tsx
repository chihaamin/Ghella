import { AnimatePresence, motion } from "framer-motion"

import { AndroidDevice } from "@/components/device/android-device"
import { useT } from "@/i18n/use-t"
import { screenTransition } from "@/lib/motion"
import { CalendarScreen } from "@/screens/calendar-screen"
import { CloseScreen } from "@/screens/close-screen"
import { DecideScreen } from "@/screens/decide-screen"
import { DiseaseScreen } from "@/screens/disease-screen"
import { HomeScreen } from "@/screens/home-screen"
import { MarketScreen } from "@/screens/market-screen"
import { OnboardScreen } from "@/screens/onboard-screen"
import { useApp, type Screen } from "@/store/app-store"

import { AppHeader, BottomNav, OfflineBanner, Toast } from "./app-chrome"

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
 * The app inside its device frame: offline banner, header, the scrolling
 * screen body, the toast layer and the tab bar.
 */
export function PhoneShell() {
  const { dir } = useT()
  const screen = useApp((s) => s.screen)
  const Active = SCREENS[screen]

  return (
    <AndroidDevice bg="#f7f4ec">
      <div dir={dir} className="relative flex h-full flex-col bg-surface">
        <OfflineBanner />
        <AppHeader />

        <div className="no-scrollbar flex-1 overflow-auto px-4 pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              variants={screenTransition}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <Active />
            </motion.div>
          </AnimatePresence>
        </div>

        <Toast />
        <BottomNav />
      </div>
    </AndroidDevice>
  )
}
