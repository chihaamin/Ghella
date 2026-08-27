import { Text, View } from "react-native"

import { SectionLabel } from "@/components/ghella/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { FadeUp } from "@/lib/motion"
import { useFF } from "@/theme/fonts"
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
  const { t, isRtl } = useT()
  const ff = useFF()

  // No cards, no header — an empty section title would read as broken.
  if (recommendations.length === 0) return null

  const row = { flexDirection: isRtl ? "row-reverse" : "row" } as const
  const alignStart = { textAlign: isRtl ? "right" : "left" } as const

  return (
    <View style={{ flexDirection: "column", gap: 8 }}>
      <View style={{ flexDirection: "column", gap: 2 }}>
        <SectionLabel style={alignStart}>{t.rcTitle}</SectionLabel>
        <Text
          style={[
            { fontFamily: ff.sans.regular, fontSize: 11, color: C.muted },
            alignStart,
          ]}
        >
          {t.rcSub}
        </Text>
      </View>

      <View style={{ flexDirection: "column", gap: 9 }}>
        {recommendations.map((rec, i) => (
          <FadeUp
            key={rec.id}
            delay={i * 50}
            style={[
              row,
              {
                overflow: "hidden",
                borderRadius: 13,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: C.card,
              },
            ]}
          >
            <View
              style={{
                width: 6,
                flexShrink: 0,
                alignSelf: "stretch",
                backgroundColor: EDGE[rec.priority],
              }}
            />

            <View
              style={{
                minWidth: 0,
                flex: 1,
                flexDirection: "column",
                gap: 6,
                paddingHorizontal: 13,
                paddingVertical: 11,
              }}
            >
              <Text
                style={[
                  {
                    fontFamily: ff.sans.bold,
                    fontSize: 13.5,
                    lineHeight: 18,
                    color: C.ink,
                  },
                  alignStart,
                ]}
              >
                {rec.title}
              </Text>
              <Text
                style={[
                  {
                    fontFamily: ff.sans.regular,
                    fontSize: 11.5,
                    lineHeight: 17,
                    color: C.muted,
                  },
                  alignStart,
                ]}
              >
                {rec.body}
              </Text>

              {(rec.impact || (rec.actionLabel && rec.action)) && (
                <View style={[row, { alignItems: "center", gap: 8, paddingTop: 2 }]}>
                  {rec.actionLabel && rec.action && (
                    <Button
                      variant={actionVariant(rec.kind)}
                      size="sm"
                      onPress={() => onAction(rec)}
                    >
                      {rec.actionLabel}
                    </Button>
                  )}
                  {rec.impact && (
                    <Badge
                      variant="neutral"
                      size="xs"
                      style={[
                        isRtl ? { marginRight: "auto" } : { marginLeft: "auto" },
                        { minWidth: 0, flexShrink: 1, alignSelf: "center" },
                      ]}
                    >
                      {rec.impact}
                    </Badge>
                  )}
                </View>
              )}
            </View>
          </FadeUp>
        ))}
      </View>
    </View>
  )
}
