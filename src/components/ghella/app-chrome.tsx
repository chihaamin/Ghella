import { AnimatePresence, motion } from "framer-motion"

import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { cn } from "@/lib/utils"
import { useApp, type Screen } from "@/store/app-store"

import { BellIcon, CheckIcon, GhellaLogo, OfflineIcon, TAB_PATHS } from "./icons"

/** The dark strip that appears above everything when the device is offline. */
export function OfflineBanner() {
  const { t } = useT()
  const offline = useApp((s) => s.offline)

  return (
    <AnimatePresence initial={false}>
      {offline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden bg-ink text-cream"
        >
          <div className="flex items-center gap-2 px-4 py-[7px] text-[12.5px] font-semibold">
            <OfflineIcon />
            <span>{t.offlineMsg}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Logo, notification bell and the account avatar. */
export function AppHeader() {
  const treated = useApp((s) => s.treated)
  const bellDot = !treated

  return (
    <div className="flex items-center justify-between px-4 pt-[10px] pb-2">
      <GhellaLogo />
      <div className="flex items-center gap-2.5">
        <div className="relative flex size-[34px] items-center justify-center rounded-full bg-chip">
          <BellIcon />
          <AnimatePresence>
            {bellDot && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-[5px] right-[6px] size-2 rounded-full border-[1.5px] border-surface bg-clay"
              />
            )}
          </AnimatePresence>
        </div>
        <div className="flex size-[34px] items-center justify-center rounded-full bg-leaf font-display text-[13px] font-bold text-surface">
          S
        </div>
      </div>
    </div>
  )
}

/** Bottom tab bar. The active pill slides between tabs. */
export function BottomNav() {
  const { t } = useT()
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
    <div className="absolute inset-x-0 bottom-0 flex border-t border-line bg-surface-raised px-1 pt-1.5 pb-2.5">
      {tabs.map((tab) => {
        const active = screen === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => go(tab.id)}
            className="flex flex-1 cursor-pointer flex-col items-center gap-[3px] py-1"
          >
            <span className="relative flex h-[26px] w-10 items-center justify-center">
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[13px] bg-leaf-tint"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? C.leafDeep : C.muted2}
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative z-10"
              >
                <path d={tab.d} />
              </svg>
            </span>
            <span
              className={cn(
                "text-[10px] font-bold",
                active ? "text-leaf-deep" : "text-muted-2"
              )}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Confirmation toast, floating just above the tab bar. */
export function Toast() {
  const toastMsg = useApp((s) => s.toastMsg)

  return (
    <AnimatePresence>
      {toastMsg && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.26, ease: "easeOut" }}
          className="absolute inset-x-4 bottom-[86px] z-5 flex items-center gap-[9px] rounded-xl bg-ink px-[15px] py-3 text-[13px] font-semibold text-surface shadow-[0_8px_24px_rgba(0,0,0,.3)]"
        >
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-leaf-bright">
            <CheckIcon />
          </span>
          <span>{toastMsg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
