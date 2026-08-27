import { AnimatePresence, motion } from "framer-motion"

import { SectionLabel } from "@/components/ghella/primitives"
import { Button } from "@/components/ui/button"
import { SALINITY, WATER_SOURCES } from "@/data/onboarding"
import { useT } from "@/i18n/use-t"
import { textureLabel } from "@/lib/agronomy"
import { springy } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { PARCEL_PALETTE, useParcels } from "@/store/parcel-store"
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
const pickBorder = (on: boolean) => (on ? "border-leaf" : "border-line")

/**
 * Bottom sheet for correcting what the farmer knows about one parcel: name,
 * colour, soil texture, water source and salinity.
 *
 * Every tap writes to the store IMMEDIATELY — there is no staged draft and no
 * cancel, because these are facts about the land, not a form to abandon; the
 * Save button only closes. Positioned `absolute`, not `fixed`: the app lives
 * inside a device frame, and a fixed sheet would escape the phone.
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
  const { t } = useT()
  const renameParcel = useParcels((s) => s.renameParcel)
  const recolorParcel = useParcels((s) => s.recolorParcel)
  const setSoilTexture = useParcels((s) => s.setSoilTexture)
  const setWaterSource = useParcels((s) => s.setWaterSource)
  const setSalinity = useParcels((s) => s.setSalinity)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="absolute inset-0 z-40 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            key="panel"
            className="absolute inset-x-0 bottom-0 z-50 flex max-h-[75%] flex-col gap-4 overflow-auto rounded-t-[18px] bg-surface p-4"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springy}
          >
            <div className="flex flex-col gap-2">
              <SectionLabel>{t.epTitle}</SectionLabel>
              {/* Keyed by parcel so switching parcels resets the draft text. */}
              <input
                key={parcel.id}
                type="text"
                defaultValue={parcel.name}
                aria-label={t.epName}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (name && name !== parcel.name) renameParcel(parcel.id, name)
                }}
                className="w-full border-b border-line bg-transparent pb-1 font-display text-[18px] font-semibold outline-none focus:border-leaf"
              />
            </div>

            <div className="flex gap-2">
              {PARCEL_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => recolorParcel(parcel.id, color)}
                  className={cn(
                    "size-[30px] cursor-pointer rounded-[9px] border-[2.5px] transition-colors",
                    parcel.color === color ? "border-ink" : "border-transparent"
                  )}
                  style={{ background: color }}
                  aria-label={color}
                />
              ))}
            </div>

            {/* Soil — the model chip clears the farmer override (null). */}
            <div className="flex flex-col gap-2">
              <SectionLabel className="text-[12px] tracking-[0.1em]">{t.epSoilQ}</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSoilTexture(parcel.id, null)}
                  className={cn(
                    "col-span-3 cursor-pointer rounded-[10px] border-[2.5px] bg-card px-2 py-[8px] text-center text-[12px] font-semibold transition-colors",
                    pickBorder(parcel.soilTexture === null)
                  )}
                >
                  {t.epSoilModel}
                </button>
                {TEXTURES.map((texture) => (
                  <button
                    key={texture}
                    type="button"
                    onClick={() => setSoilTexture(parcel.id, texture)}
                    className={cn(
                      "cursor-pointer rounded-[10px] border-[2.5px] bg-card px-1.5 py-[8px] text-center text-[11.5px] leading-tight font-semibold transition-colors",
                      pickBorder(parcel.soilTexture === texture)
                    )}
                  >
                    {textureLabel(texture)}
                  </button>
                ))}
              </div>
            </div>

            {/* Water — styled like onboarding's water cards. */}
            <div className="flex flex-col gap-2">
              <SectionLabel className="text-[12px] tracking-[0.1em]">{t.epWaterQ}</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {WATER_SOURCES.map((source, i) => (
                  <button
                    key={source.name}
                    type="button"
                    onClick={() => setWaterSource(parcel.id, WATER_IDS[i])}
                    className={cn(
                      "flex cursor-pointer flex-col gap-0.5 rounded-[11px] border-[2.5px] bg-card px-[11px] py-2.5 text-start transition-colors",
                      pickBorder(parcel.waterSource === WATER_IDS[i])
                    )}
                  >
                    <span className="text-[13px] font-semibold">{source.name}</span>
                    <span className="text-[11px] text-muted">{source.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Salinity — a stated "none" is an answer, so it is a chip too. */}
            <div className="flex flex-col gap-2">
              <SectionLabel className="text-[12px] tracking-[0.1em]">{t.epSalQ}</SectionLabel>
              <div className="flex gap-2">
                {SALINITY.map((option, i) => (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setSalinity(parcel.id, SALINITY_IDS[i])}
                    className={cn(
                      "flex-1 cursor-pointer rounded-[10px] border-[2.5px] bg-card px-1.5 py-[9px] text-center text-[12px] font-semibold transition-colors",
                      pickBorder(parcel.salinity === SALINITY_IDS[i])
                    )}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="ink" size="lg" onClick={onClose}>
              {t.epSave}
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
