import { useEffect, useState } from "react"

import { roundCoord } from "@/services/http"
import { fetchForecast } from "@/services/weather"
import type { Forecast } from "@/types/land"

/**
 * Live 7-day forecast for a point, or nothing at all when no point is given.
 *
 * The effect keys on coordinates rounded to 2 dp (~1.1 km) so dragging a
 * parcel corner a few metres never triggers a refetch — the service caches
 * too, but not asking at all is cheaper than asking and hitting the cache.
 * While a refetch runs the last good forecast stays up
 * (stale-while-revalidate), so a strip that already shows real weather never
 * flashes empty on a coordinate change.
 */
export function useForecast(latlng: [number, number] | null): {
  forecast: Forecast | null
  loading: boolean
  error: string | null
} {
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rlat = latlng ? roundCoord(latlng[0], 2) : null
  const rlon = latlng ? roundCoord(latlng[1], 2) : null

  useEffect(() => {
    if (rlat === null || rlon === null) {
      // No point, no forecast — and no leftovers from a previous point.
      setForecast(null)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchForecast(rlat, rlon, { signal: controller.signal })
      .then((fresh) => {
        if (controller.signal.aborted) return
        setForecast(fresh)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        // Keep the last good forecast on screen; only the flag goes red.
        setError(e instanceof Error ? e.message : "Forecast failed")
        setLoading(false)
      })

    return () => controller.abort()
  }, [rlat, rlon])

  return { forecast, loading, error }
}
