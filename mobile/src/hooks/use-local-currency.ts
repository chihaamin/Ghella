/**
 * Money in the currency of the FIELD, not of the app.
 *
 * A Tunisian farmer thinks in dinars and a Kenyan in shillings; a net-profit
 * figure in dollars is a number, not a decision. This hook turns a parcel's
 * country code into what every money-rendering component needs: which
 * ISO-4217 code to show, and formatters that take the app's internal USD
 * figures and print them localized in that currency.
 *
 * The failure posture mirrors the rest of the app: an unknown country, an
 * unknown currency, a rate table that never arrived, or an Intl that rejects
 * an exotic code all degrade to something readable — USD identity, or the
 * code spelled out before plain digits — because a card that blanks over a
 * missing FX rate would be absurd next to the error bar on the prices it
 * decorates.
 */

import { useEffect, useMemo, useState } from "react"

import { currencyOf } from "@/data/currencies"
import { useT } from "@/i18n/use-t"
import { fmt } from "@/lib/utils"
import { usdRates } from "@/services/fx"

export interface LocalCurrency {
  /** ISO-4217 code money is shown in; "USD" when the country or rate is unknown. */
  code: string
  /** USD → `code` multiplier (1 for USD). */
  rate: number
  /** Whole-amount money, localized: `formatMoney(56788)` → "TND 164,762" / "164 762 TND" per locale. */
  formatMoney: (usd: number) => string
  /** Per-kg price with sensible decimals: `formatPerKg(0.64)` → "TND 1.86/kg". */
  formatPerKg: (usd: number) => string
}

/**
 * The display currency for a country, with formatters. Identity (USD, rate 1)
 * whenever anything along the way is unknown — the UI must never blank.
 */
export function useLocalCurrency(countryCode: string | null): LocalCurrency {
  const { lang } = useT()
  const [rates, setRates] = useState<Record<string, number> | null>(null)

  // Keyed on nothing: a USD rate table is global, not per-parcel — one fetch
  // per mount covers every country this hook is ever asked about.
  useEffect(() => {
    const controller = new AbortController()
    usdRates({ signal: controller.signal }).then((table) => {
      // null means both publishers and the cache failed; staying on the USD
      // identity IS the plan, so there is nothing to store or report.
      if (controller.signal.aborted || !table) return
      setRates(table)
    })
    return () => controller.abort()
  }, [])

  return useMemo(() => {
    // Three gates to a local figure: a known country, a known currency, a
    // finite positive rate. Any gate failing falls back to dollars.
    let code = "USD"
    let mult = 1
    const wanted = currencyOf(countryCode)
    if (wanted && rates) {
      const rate = rates[wanted]
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
        code = wanted
        mult = rate
      }
    }

    const locale = lang === "fr" ? "fr" : lang === "ar" ? "ar" : "en"

    const formatMoney = (usd: number): string => {
      const value = usd * mult
      try {
        // Whole amounts only: season money carries no honest cents, and Intl
        // signs a loss itself in whatever way the locale writes one.
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: code,
          maximumFractionDigits: 0,
        }).format(value)
      } catch {
        // Intl does not know the code (a brand-new tender, an old runtime):
        // still say which currency it is, before plain digits.
        return `${code} ${fmt(value)}`
      }
    }

    const formatPerKg = (usd: number): string => {
      const value = usd * mult
      // Two decimals reads right for most prices; three keeps a very cheap
      // kilo (bulk cereal in a strong currency) from flattening to "0.06".
      const digits = Math.abs(value) < 0.1 ? 3 : 2
      try {
        return `${new Intl.NumberFormat(locale, {
          style: "currency",
          currency: code,
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value)}/kg`
      } catch {
        return `${code} ${value.toFixed(digits)}/kg`
      }
    }

    return { code, rate: mult, formatMoney, formatPerKg }
  }, [countryCode, rates, lang])
}
