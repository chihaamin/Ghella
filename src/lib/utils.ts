import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 35900 → "35,900" — the prototype's `fmt` helper. */
export function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US")
}

/** 35900 → "$35,900" */
export function money(n: number) {
  return `$${fmt(n)}`
}
