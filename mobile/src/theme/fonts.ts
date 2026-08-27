/**
 * Font families, one name per weight — React Native selects custom fonts by
 * exact family name, so a `fontWeight` next to a custom `fontFamily` must
 * never appear (Android would fall back to the system font).
 *
 * `useFF()` in this module is the everyday entry point: it swaps the latin
 * display/sans families for IBM Plex Sans Arabic when the app runs in Arabic,
 * exactly like the web app's `[dir="rtl"] { font-family: --font-arabic }`.
 * Mono (numbers, section labels) stays Space Mono in every language.
 */
import { useMemo } from "react"

import { useApp } from "@/store/app-store"

export const F = {
  display: {
    medium: "SpaceGrotesk_500Medium",
    semibold: "SpaceGrotesk_600SemiBold",
    bold: "SpaceGrotesk_700Bold",
  },
  sans: {
    regular: "Karla_400Regular",
    medium: "Karla_500Medium",
    semibold: "Karla_600SemiBold",
    bold: "Karla_700Bold",
    extrabold: "Karla_800ExtraBold",
  },
  mono: {
    regular: "SpaceMono_400Regular",
    bold: "SpaceMono_700Bold",
  },
  arabic: {
    regular: "IBMPlexSansArabic_400Regular",
    medium: "IBMPlexSansArabic_500Medium",
    semibold: "IBMPlexSansArabic_600SemiBold",
    bold: "IBMPlexSansArabic_700Bold",
  },
} as const

export interface FontFamilies {
  display: { medium: string; semibold: string; bold: string }
  sans: {
    regular: string
    medium: string
    semibold: string
    bold: string
    extrabold: string
  }
  mono: { regular: string; bold: string }
}

const latin: FontFamilies = {
  display: F.display,
  sans: F.sans,
  mono: F.mono,
}

const arabic: FontFamilies = {
  display: {
    medium: F.arabic.medium,
    semibold: F.arabic.semibold,
    bold: F.arabic.bold,
  },
  sans: {
    regular: F.arabic.regular,
    medium: F.arabic.medium,
    semibold: F.arabic.semibold,
    bold: F.arabic.bold,
    extrabold: F.arabic.bold,
  },
  mono: F.mono,
}

/** The active families for the current language — Arabic swaps in Plex. */
export function useFF(): FontFamilies {
  const lang = useApp((s) => s.lang)
  return useMemo(() => (lang === "ar" ? arabic : latin), [lang])
}
