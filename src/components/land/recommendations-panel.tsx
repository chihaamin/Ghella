import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { fadeUp, listStagger } from "@/lib/motion"
import type { Recommendation } from "@/types/land"

/**
 * Priority reads as colour before it reads as text — the same 6px start-edge
 * the task cards use, so "red means act first" carries across screens.
 */
const EDGE: Record<Recommendation["priority"], string> = {
  high: C.clay,
  medium: C.sunDeep,
  low: C.water,
}

/**
 * The action button borrows the kind's own visual weight: a split redraws the
 * farm (leaf, the "commit" green), completing info is low-stakes (outline),
 * everything else is a plain primary.
 */
function actionVariant(kind: Recommendation["kind"]): "leaf" | "outline" | "ink" {
  if (kind === "split") return "leaf"
  if (kind === "complete-info") return "outline"
  return "ink"
}

/**
 * The ranked "what would improve this land" list on the My-land screen.
 *
 * Purely presentational: `buildRecommendations` decides what appears and in
 * what order, and the SCREEN dispatches the action — this panel only reports
 * which card was tapped, so the split/edit/navigate wiring lives in one place.
 */
export function RecommendationsPanel({
  recommendations,
  onAction,
}: {
  recommendations: Recommendation[]
  onAction: (rec: Recommendation) => void
}) {
  const { t } = useT()

  // No cards, no header — an empty section title would read as broken.
  if (recommendations.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <SectionLabel>{t.rcTitle}</SectionLabel>
        <div className="text-[11px] text-muted">{t.rcSub}</div>
      </div>

      <motion.div
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-[9px]"
      >
        {recommendations.map((rec) => (
          <motion.div
            key={rec.id}
            variants={fadeUp}
            className="flex overflow-hidden rounded-[13px] border border-line bg-card"
          >
            <div className="w-1.5 flex-none" style={{ background: EDGE[rec.priority] }} />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-[13px] py-[11px]">
              <div className="text-[13.5px] leading-[1.35] font-bold">{rec.title}</div>
              <div className="text-[11.5px] leading-[1.5] text-muted">{rec.body}</div>

              {(rec.impact || (rec.actionLabel && rec.action)) && (
                <div className="flex items-center gap-2 pt-0.5">
                  {rec.actionLabel && rec.action && (
                    <Button
                      variant={actionVariant(rec.kind)}
                      size="sm"
                      onClick={() => onAction(rec)}
                    >
                      {rec.actionLabel}
                    </Button>
                  )}
                  {rec.impact && (
                    <Badge variant="neutral" size="xs" className="ms-auto min-w-0 shrink truncate">
                      {rec.impact}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
