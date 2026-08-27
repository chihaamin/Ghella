import { AnimatePresence, motion } from "framer-motion"

import { FrostBanner, WeatherStrip } from "@/components/ghella/weather-strip"
import { LockIcon, WarningIcon } from "@/components/ghella/icons"
import { Button } from "@/components/ui/button"
import { CROP_SUBTITLE } from "@/data/varieties"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { fadeUp, listStagger } from "@/lib/motion"
import { useApp } from "@/store/app-store"

/** Stylised aerial of the holding — parcels drawn as tinted polygons. */
function FarmMap() {
  const { t, isRtl } = useT()
  const treated = useApp((s) => s.treated)

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-line-strong">
      <svg
        width="100%"
        height="188"
        viewBox="0 0 380 188"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="380" height="188" fill="#3d4a2c" />
        <rect x="0" y="0" width="380" height="188" fill="#4a5735" opacity=".6" />
        <rect x="-20" y="120" width="180" height="90" fill="#5a6640" transform="rotate(-8 70 160)" />
        <rect x="240" y="-10" width="160" height="110" fill="#6d6a44" transform="rotate(5 320 40)" />
        <rect x="60" y="-20" width="120" height="80" fill="#57624a" transform="rotate(-4 120 20)" />
        <path
          d="M0 96 C90 88 150 118 230 108 S 340 84 380 92"
          stroke="#8d8668"
          strokeWidth="7"
          fill="none"
          opacity=".85"
        />
        <path d="M148 0 L128 188" stroke="#8d8668" strokeWidth="4" opacity=".6" />
        <polygon
          points="170,56 268,44 288,104 196,120"
          fill={C.leafBright}
          fillOpacity=".55"
          stroke={C.leafLight}
          strokeWidth="2.5"
        />
        <polygon
          points="52,110 142,124 128,174 40,162"
          fill={C.water}
          fillOpacity=".38"
          stroke="#7cc5ec"
          strokeWidth="2"
        />
        <polygon
          points="286,116 366,102 374,158 300,170"
          fill={C.sun}
          fillOpacity=".38"
          stroke="#ecd9a0"
          strokeWidth="2"
        />
        <text x="205" y="88" style={{ font: "700 12px 'Space Mono',monospace" }} fill="#fff">
          {t.pNorth} · 0.8
        </text>
        <text x="66" y="146" style={{ font: "700 11px 'Space Mono',monospace" }} fill="#fff">
          {t.pOued} · 1.6
        </text>
        <text x="306" y="140" style={{ font: "700 11px 'Space Mono',monospace" }} fill="#fff">
          {t.pHill} · 2.4
        </text>
        {treated && (
          <g>
            <circle cx="278" cy="52" r="9" fill={C.clay} />
            <text
              x="278"
              y="56"
              textAnchor="middle"
              style={{ font: "700 10px 'Space Mono',monospace" }}
              fill="#fff"
            >
              6
            </text>
          </g>
        )}
      </svg>
      <div
        className="absolute top-2 rounded-[7px] bg-ink/85 px-2 py-1 font-mono text-[10px] font-bold text-cream"
        style={isRtl ? { left: 8 } : { right: 8 }}
      >
        {t.myFarm} · 4.8 ha
      </div>
    </div>
  )
}

/** The "inspect your leaves" nudge that opens the disease flow. */
function RiskCard() {
  const { t } = useT()
  const goDisease = useApp((s) => s.goDisease)

  return (
    <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-sun-deep bg-sun-tint px-[13px] py-3">
      <div className="flex items-center gap-[9px]">
        <span className="flex size-[26px] flex-none items-center justify-center rounded-lg bg-sun-deep">
          <WarningIcon />
        </span>
        <div className="text-[13.5px] leading-[1.35]">
          <b>{t.riskTitle}</b>
          <div className="text-[12px] text-sun-ink">{t.riskWhy}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ink" size="md" className="flex-1 rounded-[9px]" onClick={goDisease}>
          {t.riskCta}
        </Button>
        <Button variant="outline" size="md" className="rounded-[9px]">
          {t.riskLater}
        </Button>
      </div>
    </div>
  )
}

export function HomeScreen() {
  const { t, lang } = useT()
  const planned = useApp((s) => s.planned)
  const treated = useApp((s) => s.treated)
  const goOnboard = useApp((s) => s.goOnboard)
  const hasPlan = planned !== null

  const parcels = [
    {
      name: t.pNorth,
      sub: hasPlan
        ? CROP_SUBTITLE[planned]
        : lang === "fr"
          ? "Pas encore de plan"
          : lang === "ar"
            ? "لا خطة بعد"
            : "No plan yet — tap Decide",
      area: "0.8",
      color: C.leafBright,
      prog: hasPlan ? 6 : 0,
      stage: hasPlan ? t.calStage : "—",
      locked: treated,
    },
    {
      name: t.pOued,
      sub:
        lang === "fr"
          ? "Pas de plan — melon dès mars"
          : lang === "ar"
            ? "لا خطة — بطيخ من مارس"
            : "No plan — melon window opens March",
      area: "1.6",
      color: C.water,
      prog: 0,
      stage: "—",
      locked: false,
    },
    {
      name: t.pHill,
      sub:
        lang === "fr"
          ? "Pas de plan — oignon dès oct."
          : lang === "ar"
            ? "لا خطة — بصل من أكتوبر"
            : "No plan — onion window opens Oct",
      area: "2.4",
      color: C.sun,
      prog: 0,
      stage: "—",
      locked: false,
    },
  ]

  return (
    <div className="flex flex-col gap-3.5 pt-1">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-2xl leading-[1.1] font-semibold">{t.greet}</div>
        <div className="font-mono text-[11px] font-bold text-muted">{t.seasonChip}</div>
      </div>

      <WeatherStrip />
      <FrostBanner />

      <AnimatePresence>
        {!treated && hasPlan && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <RiskCard />
          </motion.div>
        )}
      </AnimatePresence>

      <FarmMap />

      <motion.div
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-[9px]"
      >
        {parcels.map((p) => (
          <motion.div
            key={p.name}
            variants={fadeUp}
            className="flex flex-col gap-2 rounded-[13px] border border-line bg-card px-3.5 py-3"
          >
            <div className="flex items-center gap-[9px]">
              <span
                className="size-[11px] flex-none rounded-[3.5px]"
                style={{ background: p.color }}
              />
              <span className="font-display text-[15px] font-bold">{p.name}</span>
              <span className="text-[12px] text-muted">{p.sub}</span>
              <span className="ms-auto font-mono text-[11px] font-bold text-muted">
                {p.area} ha
              </span>
            </div>

            <AnimatePresence>
              {p.locked && (
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="flex items-center gap-2 rounded-[9px] border-[1.5px] border-clay bg-clay-tint px-2.5 py-[7px]"
                >
                  <LockIcon />
                  <span className="text-[12px] font-bold text-clay">{t.phiBadge}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-chip">
                <motion.div
                  className="h-full rounded-[3px]"
                  style={{ background: p.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${p.prog}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <span className="text-[11px] text-muted">{p.stage}</span>
            </div>
          </motion.div>
        ))}

        <motion.button
          variants={fadeUp}
          type="button"
          onClick={goOnboard}
          className="cursor-pointer rounded-[13px] border-[1.5px] border-dashed border-line-dash p-[13px] text-center text-[13.5px] font-bold text-leaf"
        >
          + {t.addParcel}
        </motion.button>
      </motion.div>
    </div>
  )
}
