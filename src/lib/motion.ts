import type { Transition, Variants } from "framer-motion"

/**
 * The four keyframes the design defines (`gh-in`, `gh-pop`, `gh-pulse`,
 * `gh-bar`), expressed as framer-motion presets so every screen animates from
 * the same vocabulary.
 */

export const springy: Transition = { type: "spring", stiffness: 320, damping: 30 }

/** gh-in — content arriving from just below. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: "easeIn" } },
}

/** gh-in, staggered — for lists whose items should cascade. */
export const listStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
  exit: {},
}

/** gh-pop — a number or badge landing with a slight overshoot. */
export const pop: Variants = {
  hidden: { scale: 0.6, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 420, damping: 18 },
  },
}

/** gh-pulse — the "working on it" breathing loop. */
export const pulse = {
  animate: { opacity: [1, 0.45, 1] },
  transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const },
}

/** Screen-to-screen crossfade inside the phone frame. */
export const screenTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" } },
}

/** Accordion body — height animates so the card grows rather than pops. */
export const expand: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: {
    height: "auto",
    opacity: 1,
    transition: { height: { duration: 0.26, ease: "easeOut" }, opacity: { duration: 0.2, delay: 0.06 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.2, ease: "easeIn" }, opacity: { duration: 0.12 } },
  },
}
