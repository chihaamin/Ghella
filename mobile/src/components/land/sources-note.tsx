import type { JSX } from "react"

import { Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { useFF } from "@/theme/fonts"
import type { AnalysisIssue } from "@/types/land"

/** NoteStrip's sun-tone ink (`sunInk2` on the web). */
const SUN_INK_2 = "#5c4a1e"

/**
 * The amber "some data didn't load" strip that closes an analysis section.
 * One line per failed source, in the words the analyzer recorded, plus the
 * time the analysis ran — so the farmer can judge how stale the gaps are —
 * and a retry when the caller can offer one. Renders nothing at all when
 * every source answered: no news is the normal state, not a card.
 *
 * The kit's NoteStrip only takes text children, so this rebuilds its
 * sun-tone chrome locally around the multi-line column the web version
 * nested inside it.
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
  const { t, lang, isRtl } = useT()
  const ff = useFF()

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
    <FadeUp>
      <View
        style={{
          flexDirection: isRtl ? "row-reverse" : "row",
          alignItems: "flex-start",
          gap: 8,
          borderRadius: 10,
          paddingHorizontal: 11,
          paddingVertical: 9,
          backgroundColor: C.chip2,
        }}
      >
        <View style={{ flex: 1, flexDirection: "column", gap: 4 }}>
          <View
            style={{
              flexDirection: isRtl ? "row-reverse" : "row",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <Text style={{ fontFamily: ff.sans.bold, fontSize: 12, color: SUN_INK_2 }}>
              {t.ldSourceIssues}
            </Text>
            {stamp && (
              <Text
                style={{
                  fontFamily: ff.mono.regular,
                  fontSize: 9.5,
                  color: SUN_INK_2,
                  opacity: 0.7,
                }}
              >
                {stamp}
              </Text>
            )}
          </View>
          {issues.map((issue) => (
            <Text
              key={issue.source}
              style={{
                fontFamily: ff.sans.semibold,
                fontSize: 11.5,
                lineHeight: 17,
                color: SUN_INK_2,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {issue.message}
            </Text>
          ))}
          {onRetry && (
            <Button
              variant="ghost"
              size="chip"
              onPress={onRetry}
              // Pull the label back onto the strip's text edge — ghost
              // padding would otherwise indent it past every message line.
              style={{
                alignSelf: isRtl ? "flex-end" : "flex-start",
                marginLeft: isRtl ? 0 : -11,
                marginRight: isRtl ? -11 : 0,
              }}
              textStyle={{ color: C.sunInk }}
            >
              {t.ldRetry}
            </Button>
          )}
        </View>
      </View>
    </FadeUp>
  )
}
