import { useCallback, useEffect, useRef } from "react"

import { analyzeLand } from "@/services/analyze-land"
import { useParcels } from "@/store/parcel-store"

/**
 * Bridges parcels to the analysis pipeline.
 *
 * `analyze(id)` starts (or restarts) an analysis for one parcel and streams
 * progress into the store. Only one analysis runs per parcel; starting a new
 * one aborts the old. `autorun` re-triggers any parcel still in "idle" —
 * that's what makes a freshly drawn parcel analyse itself.
 */
export function useLandAnalysis({ autorun = true } = {}) {
  const controllers = useRef(new Map<string, AbortController>())

  const analyze = useCallback(async (parcelId: string) => {
    const store = useParcels.getState()
    const parcel = store.parcels.find((p) => p.id === parcelId)
    if (!parcel || parcel.points.length < 3) return

    controllers.current.get(parcelId)?.abort()
    const controller = new AbortController()
    controllers.current.set(parcelId, controller)

    store.analysisStarted(parcelId)
    try {
      const analysis = await analyzeLand(parcel.points, {
        signal: controller.signal,
        onProgress: (progress) =>
          useParcels.getState().analysisProgressed(parcelId, progress),
      })
      if (!controller.signal.aborted)
        useParcels.getState().analysisFinished(parcelId, analysis)
    } catch (e) {
      // Aborted means superseded (a newer analyze() for this parcel) or the
      // owner unmounted. The newer call owns the state in the first case and
      // the unmount cleanup below resets it in the second — touching the
      // store here would flip a parcel to "idle" under a live run and send
      // the autorun effect into a loop.
      if (controller.signal.aborted) return
      useParcels
        .getState()
        .analysisFailed(
          parcelId,
          e instanceof Error ? e.message : "Analysis failed"
        )
    } finally {
      if (controllers.current.get(parcelId) === controller)
        controllers.current.delete(parcelId)
    }
  }, [])

  const idleIds = useParcels((s) =>
    s.parcels
      .filter((p) => p.analysisState === "idle" && p.points.length >= 3)
      .map((p) => p.id)
      .join(",")
  )

  useEffect(() => {
    if (!autorun || !idleIds) return
    for (const id of idleIds.split(",")) void analyze(id)
  }, [autorun, idleIds, analyze])

  // Abort everything in flight when the owner unmounts, and hand each parcel
  // back to "idle" so the next mounted owner's autorun resumes it seamlessly
  // (e.g. finishing onboarding mid-analysis and landing on My Land).
  useEffect(() => {
    const map = controllers.current
    return () => {
      for (const [id, c] of map.entries()) {
        c.abort()
        useParcels.getState().analysisAborted(id)
      }
      map.clear()
    }
  }, [])

  return { analyze }
}
