import { climateNormalsFrom, slopeFromStencil } from "@/lib/agronomy"
import { matchCrops } from "@/lib/crop-suitability"
import { buildGeometry, samplePointsAround } from "@/lib/geo"
import type {
  AnalysisIssue,
  AnalysisProgress,
  LandAnalysis,
  LatLng,
  SoilSample,
} from "@/types/land"
import { LAND_ANALYSIS_VERSION } from "@/types/land"

import { fetchElevations } from "./elevation"
import { reverseGeocode } from "./geocode"
import { fetchSoil } from "./soil"
import { fetchArchive } from "./weather"

/** Radius of the elevation stencil that yields slope, metres. */
const SLOPE_RADIUS_M = 120

const STAGE_LABELS: Record<string, string> = {
  place: "Locating your region…",
  climate: "Reading 10 years of weather history…",
  terrain: "Measuring elevation and slope…",
  soil: "Estimating soil from the ISRIC world grid…",
  crops: "Matching crops to your land…",
}

const UNKNOWN_SOIL: SoilSample = {
  source: "unknown",
  sandPct: null,
  siltPct: null,
  clayPct: null,
  ph: null,
  socGkg: null,
  texture: null,
  waterHoldingMmPerM: null,
  note: null,
}

/**
 * Run the full open-data analysis for a drawn parcel.
 *
 * The four sources are fetched concurrently and each failure is recorded as an
 * issue instead of failing the whole analysis — a farmer on a patchy
 * connection should get climate + place even when SoilGrids times out.
 * Progress is reported as each source settles, in settlement order.
 */
export async function analyzeLand(
  points: LatLng[],
  options?: {
    signal?: AbortSignal
    onProgress?: (progress: AnalysisProgress) => void
  }
): Promise<LandAnalysis> {
  const { signal, onProgress } = options ?? {}
  const geometry = buildGeometry(points)
  const [lat, lon] = geometry.centroid
  const issues: AnalysisIssue[] = []

  // Progress: geometry is instant; the four fetches carry the bar to ~0.9,
  // crop matching the rest.
  let settled = 0
  const totalFetches = 4
  const report = (stage: AnalysisProgress["stage"]) => {
    settled += 1
    onProgress?.({
      stage,
      progress: 0.1 + (settled / totalFetches) * 0.8,
      label: STAGE_LABELS[stage] ?? "",
    })
  }
  onProgress?.({ stage: "geometry", progress: 0.05, label: STAGE_LABELS.place })

  const guard = async <T>(
    source: AnalysisIssue["source"],
    stage: AnalysisProgress["stage"],
    task: Promise<T>,
    friendly: string
  ): Promise<T | null> => {
    try {
      const value = await task
      report(stage)
      return value
    } catch (e) {
      report(stage)
      issues.push({
        source,
        message: friendly || (e instanceof Error ? e.message : String(e)),
      })
      return null
    }
  }

  const [place, series, elevations, soil] = await Promise.all([
    guard(
      "place",
      "place",
      reverseGeocode(lat, lon, { signal }),
      "Could not name this region — the map still works."
    ),
    guard(
      "climate",
      "climate",
      fetchArchive(lat, lon, 10, { signal }),
      "Weather history is unavailable right now — climate facts and crop scores are limited."
    ),
    guard(
      "terrain",
      "terrain",
      fetchElevations(samplePointsAround(geometry.centroid, SLOPE_RADIUS_M), {
        signal,
      }),
      "Elevation service unavailable — slope is unknown."
    ),
    guard(
      "soil",
      "soil",
      fetchSoil(lat, lon, { signal }),
      "The soil grid did not answer — tell us your texture and every score sharpens."
    ),
  ])

  if (signal?.aborted) throw new DOMException("Analysis aborted", "AbortError")

  // Latitude picks the hemisphere for the frost-season pivot.
  const climate = series ? climateNormalsFrom(series, lat) : null
  const terrain =
    elevations && elevations.length >= 5
      ? slopeFromStencil(elevations, SLOPE_RADIUS_M)
      : null
  const soilSample = soil ?? UNKNOWN_SOIL

  onProgress?.({ stage: "crops", progress: 0.95, label: STAGE_LABELS.crops })
  // The whole table, not the top-12: the Decide screen looks varieties up by
  // crop id and a capped list would silently drop tomato on an arid site.
  const crops = matchCrops(
    { climate, soil: soilSample, terrain, latitude: lat },
    Infinity
  )

  onProgress?.({ stage: "done", progress: 1, label: "" })
  return {
    version: LAND_ANALYSIS_VERSION,
    geometry,
    place,
    climate,
    terrain,
    soil: soilSample,
    crops,
    fetchedAt: new Date().toISOString(),
    issues,
  }
}
