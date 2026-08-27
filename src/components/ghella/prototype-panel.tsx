import { Switch } from "@/components/ui/switch"
import type { Lang } from "@/i18n/dict"
import { cn } from "@/lib/utils"
import { useApp, type Screen } from "@/store/app-store"
import { useParcels } from "@/store/parcel-store"

const JUMPS: ReadonlyArray<{ id: Screen; label: string }> = [
  { id: "onboard", label: "First-run onboarding" },
  { id: "cal", label: "Calendar · main ★" },
  { id: "decide", label: "Decision Screen ★" },
  { id: "home", label: "My land" },
  { id: "disease", label: "Disease flow ★" },
  { id: "market", label: "Market + simulator" },
  { id: "close", label: "Season close" },
]

const LANGS: ReadonlyArray<{ id: Lang; label: string }> = [
  { id: "en", label: "EN" },
  { id: "fr", label: "FR" },
  { id: "ar", label: "عربي" },
]

/**
 * The reviewer's control rig beside the phone — deep links into any screen,
 * the language switch and the three scenario toggles the demo hangs on.
 */
export function PrototypePanel() {
  const screen = useApp((s) => s.screen)
  const lang = useApp((s) => s.lang)
  const offline = useApp((s) => s.offline)
  const rain = useApp((s) => s.rain)
  const frost = useApp((s) => s.frost)

  const go = useApp((s) => s.go)
  const set = useApp((s) => s.set)
  const setLang = useApp((s) => s.setLang)
  const goDisease = useApp((s) => s.goDisease)
  const goClose = useApp((s) => s.goClose)
  const toggleOffline = useApp((s) => s.toggleOffline)
  const toggleRain = useApp((s) => s.toggleRain)
  const toggleFrost = useApp((s) => s.toggleFrost)
  const reset = useApp((s) => s.reset)
  const clearAllParcels = useParcels((s) => s.clearAllParcels)

  function jump(id: Screen) {
    if (id === "onboard") {
      set({ screen: "onboard", ob: 0, pts: [], located: false })
    } else if (id === "disease") {
      goDisease()
    } else if (id === "close") {
      goClose()
    } else {
      go(id)
    }
  }

  const scenarios = [
    { label: "Offline mode", on: offline, toggle: toggleOffline },
    { label: "Rain tonight (18 mm)", on: rain, toggle: toggleRain },
    { label: "Frost alert", on: frost, toggle: toggleFrost },
  ]

  return (
    <aside className="sticky top-6 flex w-[250px] flex-none flex-col gap-3.5 rounded-[14px] border border-line-strong bg-surface p-[18px]">
      <div className="font-mono text-[12px] font-bold tracking-[0.12em] text-earth">
        PROTOTYPE CONTROLS
      </div>

      <div className="flex flex-col gap-[5px]">
        {JUMPS.map((j) => (
          <button
            key={j.id}
            type="button"
            onClick={() => jump(j.id)}
            className={cn(
              "cursor-pointer rounded-lg px-[11px] py-2 text-start text-[12.5px] font-semibold transition-colors",
              screen === j.id ? "bg-ink text-cream" : "bg-chip text-ink-soft hover:bg-line"
            )}
          >
            {j.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-[10.5px] font-bold text-muted">LANGUAGE</div>
        <div className="flex rounded-[9px] bg-chip p-[3px]">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className={cn(
                "flex-1 cursor-pointer rounded-[7px] py-1.5 text-center text-[12px] font-bold transition-colors",
                lang === l.id ? "bg-ink text-cream" : "text-ink-muted"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="text-[10.5px] leading-[1.4] text-muted">
          AR = full RTL on Decision + Today per brief; FR/AR cover those screens.
        </div>
      </div>

      <div className="flex flex-col gap-[7px]">
        <div className="font-mono text-[10.5px] font-bold text-muted">SCENARIOS</div>
        {scenarios.map((s) => (
          <label
            key={s.label}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-[9px] border-[1.5px] px-[11px] py-2 transition-colors",
              s.on ? "border-leaf bg-leaf-tint" : "border-line-strong bg-card"
            )}
          >
            <span
              className={cn(
                "text-[12.5px] font-semibold",
                s.on ? "text-leaf-deep" : "text-ink-muted"
              )}
            >
              {s.label}
            </span>
            <Switch checked={s.on} onCheckedChange={s.toggle} />
          </label>
        ))}
      </div>

      {/* Demo state AND the farmer's real mapped land: "Reset demo" must
          return a reviewer to the true first-run experience. */}
      <button
        type="button"
        onClick={() => {
          reset()
          clearAllParcels()
        }}
        className="cursor-pointer rounded-[9px] border-[1.5px] border-line-dash py-2 text-center text-[12px] font-bold text-muted hover:bg-chip/60"
      >
        Reset demo
      </button>

      <div className="text-[10.5px] leading-[1.5] text-muted-2">
        Rain tonight cancels tomorrow’s irrigation on the Today feed. The disease flow ends by
        injecting 3 tasks + a harvest lockout on Parcel North.
      </div>
    </aside>
  )
}
