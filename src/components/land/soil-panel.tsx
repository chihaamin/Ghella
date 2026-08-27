import type { JSX } from "react"

import { motion } from "framer-motion"

import { NoteStrip, SectionLabel, Stat } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { textureLabel, waterHoldingFromTexture } from "@/lib/agronomy"
import { C } from "@/lib/colors"
import { fadeUp } from "@/lib/motion"
import type { SoilSample, TextureClass } from "@/types/land"

/**
 * Soil card — what this parcel is made of, and who says so. The farmer's own
 * texture always outranks the model: when `farmerTexture` is set, both the
 * badge and the water-holding figure are recomputed from it, and the
 * provenance strip flips to "set by you".
 *
 * Every field of `SoilSample` can be null (no soil grid over built-up land),
 * so each block renders only when its numbers exist — the worst case is just
 * the provenance strip and the confirm button.
 */
export function SoilPanel({
  soil,
  farmerTexture,
  onConfirm,
}: {
  soil: SoilSample
  farmerTexture: TextureClass | null
  onConfirm?: () => void
}): JSX.Element {
  const { t } = useT()

  const effective = farmerTexture ?? soil.texture
  // Farmer texture overrides the derived water holding too — the model's
  // figure was derived from the model's texture, which just lost.
  const waterHolding = farmerTexture
    ? waterHoldingFromTexture(farmerTexture)
    : soil.waterHoldingMmPerM

  // Destructured so the null checks narrow — `soil.sandPct` would not.
  const { sandPct, siltPct, clayPct } = soil
  const fractions =
    sandPct !== null && siltPct !== null && clayPct !== null
      ? [
          { label: t.ldSand, pct: sandPct, color: C.sun },
          { label: t.ldSilt, pct: siltPct, color: C.sand },
          { label: t.ldClay, pct: clayPct, color: C.earth },
        ]
      : null

  const hasStats = soil.ph !== null || soil.socGkg !== null || waterHolding !== null

  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col gap-2.5 rounded-[13px] border border-line bg-card px-3.5 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t.ldSoil}</SectionLabel>
        <Badge variant="earth" size="sm">
          {effective ? textureLabel(effective) : "—"}
        </Badge>
      </div>

      {fractions && (
        <div className="flex flex-col gap-[7px]">
          {fractions.map((f) => (
            <div key={f.label} className="flex flex-col gap-[3px]">
              <div className="flex items-baseline justify-between text-[12px] font-semibold">
                <span>{f.label}</span>
                <span className="font-mono text-[11px] font-bold text-muted">
                  {Math.round(f.pct)}%
                </span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-[4px] bg-chip">
                <motion.div
                  className="h-full rounded-[4px]"
                  style={{ background: f.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, f.pct))}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {hasStats && (
        <div className="grid grid-cols-3 gap-1.5">
          <Stat
            className="bg-chip-2"
            label={t.ldPh}
            value={soil.ph !== null ? soil.ph.toFixed(1) : "—"}
            valueClassName="text-[15px]"
          />
          <Stat
            className="bg-chip-2"
            label={t.ldSoc}
            value={soil.socGkg !== null ? `${soil.socGkg} g/kg` : "—"}
            valueClassName="text-[15px]"
          />
          <Stat
            className="bg-chip-2"
            label={t.ldWaterHolding}
            value={waterHolding !== null ? `${waterHolding} mm/m` : "—"}
            valueClassName="text-[15px]"
          />
        </div>
      )}

      {/* Provenance — the farmer outranks the model, the model outranks a
          shrug. When detection failed with a reason, the reason is more
          useful than the generic line. */}
      {farmerTexture ? (
        <NoteStrip tone="sun">{t.ldSoilFarmerNote}</NoteStrip>
      ) : soil.source === "soilgrids" ? (
        <NoteStrip tone="water">{t.ldSoilModelNote}</NoteStrip>
      ) : (
        <NoteStrip tone="clay">{soil.note ?? t.ldSoilUnknownNote}</NoteStrip>
      )}

      {onConfirm && farmerTexture === null && (
        <Button variant="outline" size="sm" onClick={onConfirm}>
          {t.ldConfirmSoil}
        </Button>
      )}
    </motion.div>
  )
}
