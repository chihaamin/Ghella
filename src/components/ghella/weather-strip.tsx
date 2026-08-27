import { AnimatePresence, motion } from "framer-motion"

import { forecast as demoForecast, type WeatherDay } from "@/data/weather"
import { useForecast } from "@/hooks/use-forecast"
import { useT } from "@/i18n/use-t"
import { fadeUp } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useApp } from "@/store/app-store"

import { CloudIcon, FrostIcon, RainIcon, SunIcon } from "./icons"

/**
 * Seven-day forecast — the horizontal scroller at the top of Home and Calendar.
 *
 * Given a `latlng` it shows the real Open-Meteo outlook for that point;
 * without one it falls back to the bundled demo week, so existing call sites
 * keep working untouched.
 */
export function WeatherStrip({
  className,
  latlng = null,
}: {
  className?: string
  /** Where to fetch real weather for; omit to stay on the demo week. */
  latlng?: [number, number] | null
}) {
  const { lang } = useT()
  const rain = useApp((s) => s.rain)
  const frost = useApp((s) => s.frost)
  const { forecast: live } = useForecast(latlng)

  // The DEMO data wins whenever a scenario toggle (rain/frost) is on, latlng
  // is missing, or the real fetch has produced nothing — so the prototype
  // panel still demos deterministically offline, and the strip never renders
  // blank while waiting on the network.
  const useDemo = rain || frost || !latlng || !live || live.days.length === 0

  const days: WeatherDay[] = useDemo
    ? demoForecast(lang, { rain, frost })
    : live.days.slice(0, 7).map((d, i) => ({
        // Noon, not midnight: a bare ISO date parses as UTC midnight, which
        // west of Greenwich renders yesterday's weekday. `lang` doubles as
        // the locale, so "ar" gets Arabic day names for free.
        d: new Date(d.date + "T12:00:00")
          .toLocaleDateString(lang, { weekday: "short" })
          .toUpperCase(),
        t: Math.round(d.tMaxC),
        sky: d.sky,
        // Under a millimetre reads as noise, not rain — show nothing.
        mm: d.rainMm >= 1 ? `${Math.round(d.rainMm)}mm` : "",
        today: i === 0,
      }))

  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4", className)}>
      {days.map((w, i) => (
        <div
          key={`${w.d}-${i}`}
          className={cn(
            "flex w-[52px] flex-none flex-col items-center gap-[3px] rounded-[10px] border pt-2 pb-[7px]",
            w.today
              ? "border-sand-2 bg-surface-raised"
              : "border-transparent bg-chip-2"
          )}
        >
          <span className="font-mono text-[10px] font-bold text-muted">{w.d}</span>
          {w.sky === "sun" && <SunIcon />}
          {w.sky === "cloud" && <CloudIcon />}
          {w.sky === "rain" && <RainIcon />}
          <span className="font-display text-[12px] font-bold">{w.t}°</span>
          <span className="min-h-3 font-mono text-[9.5px] text-water">{w.mm}</span>
        </div>
      ))}
    </div>
  )
}

/** Frost advisory — only mounted while the frost scenario is on. */
export function FrostBanner() {
  const { t } = useT()
  const frost = useApp((s) => s.frost)

  return (
    <AnimatePresence>
      {frost && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          exit="exit"
          className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-water bg-water-tint px-[13px] py-[11px]"
        >
          <span className="mt-px flex-none">
            <FrostIcon />
          </span>
          <div className="text-[13px] leading-[1.45]">
            <b>{t.frostBanner}</b>
            <div className="text-[12px] text-[#456]">{t.frostSub}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
