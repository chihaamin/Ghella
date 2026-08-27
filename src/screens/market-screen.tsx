import { useMemo } from "react"

import { ClockIcon } from "@/components/ghella/icons"
import { SectionLabel } from "@/components/ghella/primitives"
import { Slider } from "@/components/ui/slider"
import {
  CROP_CHIPS,
  PER_HECTARE,
  cropChipLabel,
  forecastPrice,
  priceSeries,
} from "@/data/market"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { cn, money } from "@/lib/utils"
import { useApp } from "@/store/app-store"

/** Two recorded seasons, then the forecast and its 80% band. */
function PriceChart({ crop }: { crop: ReturnType<typeof priceSeries> }) {
  const { t } = useT()

  return (
    <svg
      width="100%"
      height="176"
      viewBox="0 0 372 176"
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <line x1="0" y1="44" x2="372" y2="44" stroke={C.chip} strokeWidth="1" />
      <line x1="0" y1="88" x2="372" y2="88" stroke={C.chip} strokeWidth="1" />
      <line x1="0" y1="132" x2="372" y2="132" stroke={C.chip} strokeWidth="1" />

      {/* the harvest window */}
      <rect x="308" y="6" width="46" height="160" fill={C.sun} opacity=".14" />

      <polygon points={crop.bandPoints} fill={C.water} opacity=".14" />
      <path d={crop.histPath} fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinejoin="round" />
      <path
        d={crop.forecastPath}
        fill="none"
        stroke={C.water}
        strokeWidth="2.4"
        strokeDasharray="6 5"
        strokeLinejoin="round"
      />

      <line
        x1="248"
        y1="6"
        x2="248"
        y2="170"
        stroke={C.muted}
        strokeWidth="1.4"
        strokeDasharray="3 4"
      />
      <text
        x="244"
        y="16"
        textAnchor="end"
        style={{ font: "700 9.5px 'Space Mono',monospace" }}
        fill={C.muted}
      >
        {t.mkToday}
      </text>
      <text
        x="331"
        y="20"
        textAnchor="middle"
        style={{ font: "700 9.5px 'Space Mono',monospace" }}
        fill={C.sunInk}
      >
        {t.mkHarvest}
      </text>
      <circle cx="248" cy={crop.nowY} r="4.5" fill={C.ink} />
    </svg>
  )
}

function ProfitSimulator() {
  const { t } = useT()
  const mkCrop = useApp((s) => s.mkCrop)
  const simA = useApp((s) => s.simA)
  const simY = useApp((s) => s.simY)
  const set = useApp((s) => s.set)

  const price = forecastPrice(mkCrop)
  const revenue = simA * simY * 1000 * price
  const cost = simA * PER_HECTARE.cost
  const water = simA * PER_HECTARE.water

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-3.5">
      <SectionLabel>{t.simTitle}</SectionLabel>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[12.5px] font-semibold">
          <span>{t.simArea}</span>
          <span className="font-mono text-[13px] font-bold">{simA.toFixed(1)} ha</span>
        </div>
        <Slider
          min={0.1}
          max={2}
          step={0.1}
          value={[simA]}
          onValueChange={([v]) => set({ simA: v })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[12.5px] font-semibold">
          <span>{t.simYield}</span>
          <span className="font-mono text-[13px] font-bold">{simY.toFixed(1)} t/ha</span>
        </div>
        <Slider
          min={25}
          max={60}
          step={0.5}
          value={[simY]}
          onValueChange={([v]) => set({ simY: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SimStat label={t.simRev} value={money(revenue)} tone="neutral" />
        <SimStat label={t.simCost} value={`−${money(cost)}`} tone="neutral" />
        <SimStat label={t.simNet} value={money(revenue - cost)} tone="leaf" />
        <SimStat
          label={t.simWater}
          value={`${Math.round(water).toLocaleString("en-US")} m³`}
          tone="water"
        />
      </div>

      <span className="text-[11px] text-muted">{t.simFoot}</span>
    </div>
  )
}

function SimStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "neutral" | "leaf" | "water"
}) {
  const tones = {
    neutral: { box: "bg-chip-2", label: "text-muted", value: "text-ink" },
    leaf: { box: "bg-leaf-tint", label: "text-leaf-deep", value: "text-leaf-deep" },
    water: { box: "bg-water-tint", label: "text-water-deep", value: "text-water-deep" },
  }[tone]

  return (
    <div className={cn("flex flex-col gap-px rounded-[10px] px-[11px] py-[9px]", tones.box)}>
      <span className={cn("font-mono text-[9.5px] font-bold", tones.label)}>{label}</span>
      <span className={cn("font-display text-[17px] font-bold", tones.value)}>{value}</span>
    </div>
  )
}

export function MarketScreen() {
  const { t, lang } = useT()
  const mkCrop = useApp((s) => s.mkCrop)
  const set = useApp((s) => s.set)
  const series = useMemo(() => priceSeries(mkCrop), [mkCrop])

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="font-display text-[22px] font-semibold">{t.mkTitle}</div>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5">
        {CROP_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => set({ mkCrop: c.id })}
            className={cn(
              "flex-none cursor-pointer rounded-[9px] border-[1.5px] px-3 py-[7px] text-[12px] font-bold transition-colors",
              mkCrop === c.id
                ? "border-ink bg-ink text-cream"
                : "border-line-strong bg-card text-ink-muted"
            )}
          >
            {cropChipLabel(c, lang)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-[9px] rounded-[14px] border border-line bg-card px-[13px] pt-[13px] pb-[9px]">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] whitespace-nowrap text-muted">
              {series.subtitle}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[26px] font-bold">{series.now}</span>
              <span className="text-[12px] font-semibold text-muted">$/kg</span>
              <span className="font-mono text-[12px] font-bold text-leaf">+4% wk</span>
            </div>
          </div>
          <div className="text-end">
            <span className="block font-mono text-[10px] font-bold text-water-deep">
              {t.mkForecastAt}
            </span>
            <span className="font-display text-base font-bold text-water-deep">
              {series.forecast}
            </span>
          </div>
        </div>

        <PriceChart crop={series} />

        <div className="flex flex-wrap gap-[13px] pb-[3px]">
          <span className="flex items-center gap-[5px] text-[10.5px] font-semibold text-muted">
            <span className="h-[2.5px] w-4 bg-ink" />
            {t.mkLegHist}
          </span>
          <span className="flex items-center gap-[5px] text-[10.5px] font-semibold text-muted">
            <span className="w-4 border-t-[2.5px] border-dashed border-water" />
            {t.mkLegFc}
          </span>
          <span className="flex items-center gap-[5px] text-[10.5px] font-semibold text-muted">
            <span className="h-[9px] w-3.5 rounded-[2px] bg-water/18" />
            {t.mkLegBand}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-sun bg-sun-tint-2 px-[13px] py-[11px]">
        <span className="mt-px flex-none">
          <ClockIcon />
        </span>
        <span className="text-[12.5px] leading-[1.5] font-semibold text-sun-ink-2">
          {t.mkHint}
        </span>
      </div>

      <ProfitSimulator />
    </div>
  )
}
