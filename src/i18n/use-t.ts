import { useMemo } from "react"

import { useApp } from "@/store/app-store"

import { dict, type Dict, type Lang } from "./dict"
import { taskDefs, type TaskDict } from "./task-defs"

export interface Translation {
  lang: Lang
  /** Screen copy. */
  t: Dict
  /** Task copy. */
  td: TaskDict
  dir: "ltr" | "rtl"
  isRtl: boolean
  /** Picks one of three strings by the active language. */
  pick: <T>(en: T, fr: T, ar: T) => T
}

export function useT(): Translation {
  const lang = useApp((s) => s.lang)

  return useMemo(() => {
    const isRtl = lang === "ar"
    return {
      lang,
      t: dict(lang),
      td: taskDefs(lang),
      dir: isRtl ? "rtl" : "ltr",
      isRtl,
      pick: (en, fr, ar) => (lang === "fr" ? fr : lang === "ar" ? ar : en),
    }
  }, [lang])
}
