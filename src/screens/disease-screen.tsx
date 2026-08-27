import { AnimatePresence, motion } from "framer-motion"

import { CheckIcon, LeafGlyph, LockIcon, WarningIcon } from "@/components/ghella/icons"
import { SectionLabel } from "@/components/ghella/primitives"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { fadeUp, listStagger, pop } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useApp } from "@/store/app-store"

/** The three copper applications injected into the calendar. */
function useApplications() {
  const { lang } = useT()
  return [
    {
      n: "1",
      d: lang === "fr" ? "Sam 5 sept" : lang === "ar" ? "السبت 5 سبتمبر" : "Sat Sep 5",
      note: lang === "ar" ? "صباحًا" : "morning · GO",
      full:
        lang === "ar"
          ? "رشّ نحاسي 1/3 · 120 غ / 40 ل"
          : "Copper spray 1/3 · 120 g / 40 L",
    },
    {
      n: "2",
      d: lang === "fr" ? "Sam 12 sept" : lang === "ar" ? "السبت 12 سبتمبر" : "Sat Sep 12",
      note: "+7 d",
      full: lang === "ar" ? "رشّ نحاسي 2/3 · إعادة" : "Copper spray 2/3 · repeat",
    },
    {
      n: "3",
      d: lang === "fr" ? "Sam 19 sept" : lang === "ar" ? "السبت 19 سبتمبر" : "Sat Sep 19",
      note: "+14 d",
      full: lang === "ar" ? "رشّ نحاسي 3/3 · الأخيرة" : "Copper spray 3/3 · final",
    },
  ]
}

function StepAlert() {
  const { t } = useT()
  const set = useApp((s) => s.set)

  return (
    <>
      <div className="flex flex-col gap-2.5 rounded-2xl bg-sun-deep p-4 text-white">
        <div className="flex items-center gap-[9px]">
          <WarningIcon size={22} />
          <span className="font-mono text-[11px] font-bold tracking-[0.14em]">{t.dzTag}</span>
        </div>
        <div className="font-display text-[21px] leading-[1.2] font-semibold">
          {t.dzAlertTitle}
        </div>
        <div className="text-[13px] leading-[1.5] opacity-92">{t.dzAlertWhy}</div>
        <div className="flex items-center justify-between rounded-[10px] bg-white/15 px-[11px] py-2">
          <span className="text-[12px] font-semibold">{t.dzRiskLevel}</span>
          <div className="flex items-center gap-[3px]">
            <span className="h-2 w-[26px] rounded-[4px] bg-white" />
            <span className="h-2 w-[26px] rounded-[4px] bg-white" />
            <span className="h-2 w-[26px] rounded-[4px] bg-white" />
            <span className="h-2 w-[26px] rounded-[4px] bg-white/35" />
          </div>
        </div>
      </div>

      <Button variant="ink" onClick={() => set({ dz: 1 })}>
        {t.dzInspect}
      </Button>
      <div className="cursor-pointer text-center text-[13px] font-semibold text-muted">
        {t.dzLater}
      </div>
    </>
  )
}

function StepCapture() {
  const { t, lang } = useT()
  const shots = useApp((s) => s.shots)
  const checks = useApp((s) => s.checks)
  const snapPhoto = useApp((s) => s.snapPhoto)
  const toggleCheck = useApp((s) => s.toggleCheck)
  const set = useApp((s) => s.set)

  const label =
    (lang === "ar" ? "صورة " : "PHOTO ") +
    `${Math.min(shots + 1, 2)} / 2` +
    (lang === "ar" ? " — أسفل الورقة" : " — UNDERSIDE OF LEAF")

  const checkLabels =
    lang === "fr"
      ? [
          "Taches brunes concentriques",
          "Halo jaune autour des taches",
          "Duvet blanc sous la feuille",
          "Flétrissement généralisé",
        ]
      : lang === "ar"
        ? ["بقع بنية حلقية", "هالة صفراء حول البقع", "زغب أبيض أسفل الورقة", "ذبول عام"]
        : [
            "Brown spots with concentric rings",
            "Yellow halo around spots",
            "White mold under the leaf",
            "General wilting",
          ]

  return (
    <>
      <div className="font-display text-xl font-semibold">{t.dzCapTitle}</div>

      <div className="relative flex h-[250px] items-center justify-center overflow-hidden rounded-2xl bg-[#171a12]">
        <svg width="120" height="120" viewBox="0 0 100 100" opacity=".5">
          <path
            d="M50 12 C74 22 82 46 78 66 C60 78 36 76 24 60 C18 40 30 20 50 12 Z"
            fill="none"
            stroke={C.leafLight}
            strokeWidth="2.5"
            strokeDasharray="5 5"
          />
          <path
            d="M50 12 C48 40 46 60 42 72"
            stroke={C.leafLight}
            strokeWidth="2"
            fill="none"
            strokeDasharray="5 5"
          />
        </svg>

        <span className="absolute top-3 left-3 size-[26px] rounded-tl-[4px] border-t-[3px] border-l-[3px] border-leaf-light" />
        <span className="absolute top-3 right-3 size-[26px] rounded-tr-[4px] border-t-[3px] border-r-[3px] border-leaf-light" />
        <span className="absolute bottom-3 left-3 size-[26px] rounded-bl-[4px] border-b-[3px] border-l-[3px] border-leaf-light" />
        <span className="absolute right-3 bottom-3 size-[26px] rounded-br-[4px] border-r-[3px] border-b-[3px] border-leaf-light" />

        <span className="absolute inset-x-0 bottom-4 text-center font-mono text-[11px] font-bold text-leaf-light">
          {label}
        </span>

        <button
          type="button"
          onClick={snapPhoto}
          aria-label="Take photo"
          className="absolute bottom-[52px] left-1/2 size-[54px] -translate-x-1/2 cursor-pointer rounded-full border-4 border-surface bg-surface/25 active:scale-95"
        />
      </div>

      <div className="flex min-h-11 gap-[7px]">
        <AnimatePresence>
          {Array.from({ length: shots }, (_, i) => (
            <motion.div
              key={i}
              variants={pop}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="flex size-11 items-center justify-center rounded-[9px] border-2 border-leaf-light bg-[linear-gradient(135deg,#57624a,#3d4a2c)]"
            >
              <LeafGlyph size={20} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <SectionLabel className="text-[12px] tracking-[0.1em]">{t.dzChecklist}</SectionLabel>

      <div className="flex flex-col gap-[7px]">
        {checkLabels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => toggleCheck(i)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-[11px] border-2 bg-card px-3 py-2.5 text-start transition-colors",
              checks[i] ? "border-leaf" : "border-line"
            )}
          >
            <span
              className={cn(
                "flex size-5 flex-none items-center justify-center rounded-[6px] border-2 transition-colors",
                checks[i] ? "border-leaf bg-leaf" : "border-line-dash bg-white"
              )}
            >
              {checks[i] && <CheckIcon size={11} />}
            </span>
            <span className="text-[13px] font-semibold">{label}</span>
          </button>
        ))}
      </div>

      <Button
        variant={shots > 0 ? "ink" : "disabled"}
        onClick={() => shots > 0 && set({ dz: 2 })}
      >
        {t.dzIdentify}
      </Button>
    </>
  )
}

/** A leaf tile with disease lesions — "your photo" and the two references. */
function LeafTile({
  leaf,
  spots,
  gradient,
  caption,
  bordered,
}: {
  leaf: string
  spots: Array<{ cx: number; cy: number; r: number; fill: string }>
  gradient: string
  caption: string
  bordered?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div
        className={cn(
          "flex h-[74px] items-center justify-center rounded-[10px]",
          bordered && "border-2 border-leaf-light"
        )}
        style={{ background: gradient }}
      >
        <svg width="30" height="30" viewBox="0 0 100 100">
          <path
            d="M50 12 C74 22 82 46 78 66 C60 78 36 76 24 60 C18 40 30 20 50 12 Z"
            fill={leaf}
          />
          {spots.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />
          ))}
        </svg>
      </div>
      <span className="text-center font-mono text-[10px] font-bold text-muted">{caption}</span>
    </div>
  )
}

function StepResult() {
  const { t } = useT()
  const set = useApp((s) => s.set)

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-[11px] rounded-[15px] border-[1.5px] border-line bg-card p-[15px]">
        <SectionLabel className="text-[10.5px]">{t.dzMatch}</SectionLabel>

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-[22px] font-semibold">{t.dzDisease}</span>
          <span className="text-[13px] text-muted italic">Alternaria solani</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[12px] font-semibold">
            <span>{t.dzConf}</span>
            <span className="font-mono text-[13px] font-bold text-leaf">87%</span>
          </div>
          <div className="h-[9px] overflow-hidden rounded-[5px] bg-chip">
            <motion.div
              className="h-full rounded-[5px] bg-leaf"
              initial={{ width: 0 }}
              animate={{ width: "87%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex gap-[7px]">
          <LeafTile
            bordered
            gradient="linear-gradient(135deg,#57624a,#3d4a2c)"
            leaf="#7a9a5e"
            spots={[
              { cx: 44, cy: 42, r: 7, fill: C.earth },
              { cx: 60, cy: 56, r: 5, fill: C.earth },
            ]}
            caption={t.dzYours}
          />
          <LeafTile
            gradient="linear-gradient(135deg,#5e6b4e,#46543a)"
            leaf="#83a468"
            spots={[
              { cx: 48, cy: 45, r: 8, fill: "#5c4326" },
              { cx: 49, cy: 45, r: 5, fill: "#7a5a35" },
              { cx: 49, cy: 45, r: 2.5, fill: "#4a3620" },
            ]}
            caption={`${t.dzRef} 1 · ${t.dzRings}`}
          />
          <LeafTile
            gradient="linear-gradient(135deg,#6b7758,#525f44)"
            leaf="#8fa877"
            spots={[
              { cx: 40, cy: 40, r: 6, fill: "#5c4326" },
              { cx: 58, cy: 52, r: 7, fill: "#5c4326" },
              { cx: 50, cy: 66, r: 4, fill: "#5c4326" },
            ]}
            caption={`${t.dzRef} 2 · ${t.dzSpread}`}
          />
        </div>

        <div className="text-[12px] leading-[1.5] text-muted">{t.dzAlts}</div>
      </div>

      <Button variant="ink" onClick={() => set({ dz: 3 })}>
        {t.dzConfirm}
      </Button>
      <div className="cursor-pointer text-center text-[13px] font-semibold text-muted">
        {t.dzNotMatch}
      </div>
    </motion.div>
  )
}

function StepPlan() {
  const { t } = useT()
  const apps = useApplications()
  const addTreatmentTasks = useApp((s) => s.addTreatmentTasks)

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
    >
      <div className="font-display text-xl font-semibold">{t.dzPlanTitle}</div>

      <div className="flex flex-col gap-3 rounded-[15px] border-[1.5px] border-line bg-card p-[15px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-base font-bold">{t.dzProduct}</span>
            <span className="text-[12px] text-muted">{t.dzProductSub}</span>
          </div>
          <span className="flex-none rounded-[7px] bg-leaf-tint px-2 py-1 font-mono text-[10px] font-bold text-leaf-deep">
            {t.dzRotOk}
          </span>
        </div>

        <div className="flex flex-col gap-[3px] rounded-[11px] border-[1.5px] border-dashed border-sun-deep bg-sun-tint px-[13px] py-[11px]">
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-sun-ink">
            {t.dzDoseTag}
          </span>
          <span className="font-display text-[17px] font-bold text-ink">{t.dzDose}</span>
          <span className="text-[12px] text-sun-ink">{t.dzDoseSub}</span>
        </div>

        <div className="rounded-[10px] bg-[#f2efe4] px-[11px] py-[9px] text-[12px] leading-[1.5] font-semibold text-sun-ink-2">
          {t.dzResist}
        </div>

        <div className="flex flex-col gap-1.5">
          <SectionLabel className="text-[10.5px]">{t.dzWindow}</SectionLabel>
          <div className="flex gap-[7px]">
            <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-clay-tint px-1.5 py-2 text-center">
              <span className="font-mono text-[10px] font-bold text-clay">{t.dzThu}</span>
              <span className="text-[11px] font-semibold text-clay">{t.dzWind}</span>
              <span className="text-[13px] font-bold text-clay">✕</span>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-clay-tint px-1.5 py-2 text-center">
              <span className="font-mono text-[10px] font-bold text-clay">{t.dzFri}</span>
              <span className="text-[11px] font-semibold text-clay">{t.dzRainW}</span>
              <span className="text-[13px] font-bold text-clay">✕</span>
            </div>
            <div className="flex flex-[1.25] flex-col gap-0.5 rounded-[10px] bg-leaf px-1.5 py-2 text-center">
              <span className="font-mono text-[10px] font-bold text-leaf-soft">{t.dzSat}</span>
              <span className="text-[11px] font-semibold text-white">{t.dzCalm}</span>
              <span className="text-[13px] font-bold text-white">{t.dzGo}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[5px]">
          <SectionLabel className="text-[10.5px]">{t.dzSched}</SectionLabel>
          {apps.map((a) => (
            <div
              key={a.n}
              className="flex items-center gap-[9px] border-b border-dashed border-chip py-1.5"
            >
              <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-sun-deep font-display text-[11px] font-bold text-white">
                {a.n}
              </span>
              <span className="text-[13px] font-semibold">{a.d}</span>
              <span className="ms-auto font-mono text-[11px] text-muted">{a.note}</span>
            </div>
          ))}
        </div>

        <div className="rounded-[10px] bg-water-tint px-[11px] py-[9px] text-[12px] leading-[1.5] font-semibold text-water-deep">
          {t.dzInterlock}
        </div>

        <div className="flex items-center gap-2 rounded-[10px] bg-clay-tint px-[11px] py-[9px]">
          <LockIcon size={15} />
          <span className="text-[12px] leading-[1.45] font-semibold text-clay">{t.dzPhi}</span>
        </div>
      </div>

      <Button variant="sunDeep" onClick={addTreatmentTasks}>
        {t.dzAddCta}
      </Button>
    </motion.div>
  )
}

function StepAdded() {
  const { t } = useT()
  const apps = useApplications()
  const go = useApp((s) => s.go)

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center gap-3.5 rounded-[18px] bg-ink px-[18px] py-[26px] text-surface"
    >
      <motion.span
        variants={pop}
        initial="hidden"
        animate="show"
        className="flex size-[58px] items-center justify-center rounded-full bg-leaf-bright"
      >
        <CheckIcon size={30} />
      </motion.span>

      <div className="text-center font-display text-[21px] font-semibold">{t.dzAdded}</div>

      <motion.div
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex w-full flex-col gap-[7px]"
      >
        {apps.map((a) => (
          <motion.div
            key={a.n}
            variants={fadeUp}
            className="flex items-center gap-[9px] rounded-[10px] bg-surface/9 px-3 py-[9px]"
          >
            <span className="size-2 flex-none rounded-full bg-sun-deep" />
            <span className="text-[12.5px] font-semibold">{a.full}</span>
            <span className="ms-auto font-mono text-[10.5px] font-bold text-sun">{a.d}</span>
          </motion.div>
        ))}
      </motion.div>

      <div className="flex w-full items-center gap-2 rounded-[10px] border-[1.5px] border-clay bg-clay/22 px-3 py-[9px]">
        <LockIcon size={15} stroke={C.clayLight} />
        <span className="text-[12px] leading-[1.45] font-semibold text-clay-pale">
          {t.dzPhiNote}
        </span>
      </div>

      <div className="w-full text-center text-[11.5px] leading-[1.5] text-sand">{t.dzLog}</div>

      <div className="flex w-full gap-2">
        <Button variant="light" size="md" className="flex-1 rounded-[10px]" onClick={() => go("cal")}>
          {t.dzViewCal}
        </Button>
        <Button
          variant="outlineOnDark"
          size="md"
          className="flex-1 rounded-[10px]"
          onClick={() => go("home")}
        >
          {t.dzHome}
        </Button>
      </div>
    </motion.div>
  )
}

export function DiseaseScreen() {
  const dz = useApp((s) => s.dz)

  return (
    <div className="flex flex-col gap-[13px] pt-1">
      <div className="flex gap-[5px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="h-1 flex-1 rounded-sm"
            animate={{ backgroundColor: i <= dz ? C.sunDeep : C.chip }}
            transition={{ duration: 0.25 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={dz} className="flex flex-col gap-[13px]">
          {dz === 0 && <StepAlert />}
          {dz === 1 && <StepCapture />}
          {dz === 2 && <StepResult />}
          {dz === 3 && <StepPlan />}
          {dz === 4 && <StepAdded />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
