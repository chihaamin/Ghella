import type { JSX } from "react"

import { motion } from "framer-motion"

import { NoteStrip } from "@/components/ghella/primitives"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { fadeUp } from "@/lib/motion"
import type { AnalysisIssue } from "@/types/land"

/**
 * The amber "some data didn't load" strip that closes an analysis section.
 * One line per failed source, in the words the analyzer recorded, plus the
 * time the analysis ran — so the farmer can judge how stale the gaps are —
 * and a retry when the caller can offer one. Renders nothing at all when
 * every source answered: no news is the normal state, not a card.
 */
export function SourcesNote({
  issues,
  fetchedAt,
  onRetry,
}: {
  issues: AnalysisIssue[]
  fetchedAt: string
  onRetry?: () => void
}): JSX.Element | null {
  const { t, lang } = useT()

  if (issues.length === 0) return null

  // An unparseable timestamp just drops the caption — it must never take the
  // issue list down with it.
  const stamp = Number.isNaN(Date.parse(fetchedAt))
    ? null
    : new Date(fetchedAt).toLocaleString(lang, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

  return (
    <motion.div variants={fadeUp}>
      <NoteStrip tone="sun" className="items-start">
        <span className="flex flex-col gap-1">
          <span className="flex items-baseline gap-2">
            <span className="text-[12px] font-bold">{t.ldSourceIssues}</span>
            {stamp && (
              <span className="font-mono text-[9.5px] font-normal opacity-70">{stamp}</span>
            )}
          </span>
          {issues.map((issue) => (
            <span key={issue.source} className="text-[11.5px] leading-[1.45] font-semibold">
              {issue.message}
            </span>
          ))}
          {onRetry && (
            <Button
              variant="ghost"
              size="chip"
              onClick={onRetry}
              // Pull the label back onto the strip's text edge — ghost
              // padding would otherwise indent it past every message line.
              className="-ms-[11px] self-start text-sun-ink"
            >
              {t.ldRetry}
            </Button>
          )}
        </span>
      </NoteStrip>
    </motion.div>
  )
}
