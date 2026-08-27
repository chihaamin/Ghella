import type { StyleProp } from "react-native"

/**
 * Merge conditional styles the way the web app merged Tailwind classes:
 * `sx(styles.card, active && styles.cardActive, props.style)`.
 * React Native accepts nested arrays and ignores falsy entries.
 */
export function sx<T>(
  ...styles: Array<StyleProp<T> | false | null | undefined>
): StyleProp<T> {
  return styles.filter(Boolean) as StyleProp<T>
}

/** 35900 → "35,900" — the prototype's `fmt` helper. */
export function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US")
}

/** 35900 → "$35,900" */
export function money(n: number) {
  return `$${fmt(n)}`
}
