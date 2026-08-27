import { useEffect, useState } from "react"

import { fetchMarketPrice } from "@/services/prices"
import type { MarketPrice } from "@/types/land"

/**
 * Live FPMA market prices for a set of crops in one country, keyed by crop id.
 *
 * The caller hands in a fresh `cropIds` array every render, so the effect keys
 * on the sorted join of the ids rather than the array itself — a referential
 * change with the same members must never refetch. All crops go out
 * concurrently, and each lookup is guarded on its own: one failed series costs
 * one crop, never the whole map. Results land in a single state write once
 * every lookup has settled — a shortlist where cards flick from demo to live
 * one by one reads like a glitch, while one late fill reads like an update —
 * and the last good map stays up while a refetch for a new country runs.
 */
export function useMarketPrices(
  countryCode: string | null,
  cropIds: string[]
): { prices: Record<string, MarketPrice | null>; loading: boolean } {
  const [prices, setPrices] = useState<Record<string, MarketPrice | null>>({})
  const [loading, setLoading] = useState(false)

  // The stable identity of the request: same members, same key, no refetch.
  const cropsKey = [...cropIds].sort().join(",")

  useEffect(() => {
    if (!countryCode || cropsKey === "") {
      // Nothing to price — and no leftovers from a previous country either.
      setPrices({})
      setLoading(false)
      return
    }

    const ids = cropsKey.split(",")
    const controller = new AbortController()
    setLoading(true)

    Promise.all(
      ids.map((id) =>
        fetchMarketPrice(countryCode, id, { signal: controller.signal }).catch(
          // A country with no series already resolves to null inside the
          // service; a rejection here is transport trouble, worth exactly one
          // null too — never the loss of the crops that did answer.
          () => null
        )
      )
    ).then((results) => {
      // An unmount or a country change raced this fetch; the newer effect owns
      // the state now.
      if (controller.signal.aborted) return
      const next: Record<string, MarketPrice | null> = {}
      ids.forEach((id, i) => {
        next[id] = results[i] ?? null
      })
      setPrices(next)
      setLoading(false)
    })

    return () => controller.abort()
  }, [countryCode, cropsKey])

  return { prices, loading }
}
