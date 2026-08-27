/**
 * The generic season plan: five phases for ANY planned crop, derived from its
 * cycle length instead of a scripted demo table.
 *
 * The demo calendar ships a hand-written seven-phase tomato plan; a farmer who
 * just committed chickpea or fig needs the same shaped story built from the
 * two facts every crop snapshot carries — cycle days and money. Phase spans
 * are proportions of the cycle (plant ~5%, vegetative to 45%, flowering to
 * 75%, harvest to 100%), anchored on the REAL commit day so "Sep 1–8" style
 * ranges come out of the farmer's own calendar. Pure function, no I/O — the
 * caller hands in the dict, the money formatter and the locale so this file
 * never guesses at language or currency.
 */

import type { Dict } from "@/i18n/dict"
import type { TaskKind } from "@/lib/colors"
import type { PlannedCropPlan } from "@/store/app-store"

export interface GenericPhase {
  n: string
  name: string
  when: string
  items: { kind: TaskKind; txt: string }[]
  cost?: string
  rev?: string
}

/**
 * Build the phase list for a committed crop.
 *
 * `seasonStart` is the COMMIT day (the store's `seasonStartIso`) — day 0 of
 * the phase maths. Prep opens two days before it, matching the Today feed's
 * "day 3 of 8" fiction where commit day is already mid-prep. Money keeps the
 * demo's simplest honest ledger: the full input cost on prep (spent up
 * front), the full revenue estimate on harvest (earned at the end).
 */
export function genericPhases(
  plan: PlannedCropPlan,
  seasonStart: Date,
  t: Dict,
  formatMoney: (usd: number) => string,
  locale: string
): GenericPhase[] {
  const label = (offsetDays: number): string => {
    const d = new Date(seasonStart)
    d.setDate(d.getDate() + offsetDays)
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" })
  }
  const range = (from: number, to: number) => `${label(from)} – ${label(to)}`

  const cycle = plan.cycleDays
  const cost = formatMoney(plan.costUsd)
  const rev = formatMoney(plan.revenueUsd)

  // A perennial's "cycle" runs to FIRST harvest, often a year out — five
  // annual phases would invent flowering dates nobody scheduled. Collapse to
  // the three stretches that are honest: establish, grow, first pick.
  if (cycle >= 300) {
    const growEnd = Math.round(cycle * 0.75)
    return [
      {
        n: "A",
        name: t.stPrep,
        when: range(-2, 14),
        cost,
        items: [
          { kind: "s", txt: t.gpPrepA },
          { kind: "w", txt: t.gpPrepB },
          { kind: "r", txt: t.gpPlant },
        ],
      },
      {
        n: "C",
        name: t.stVeg,
        when: range(15, growEnd),
        items: [
          { kind: "s", txt: t.gpVeg },
          { kind: "w", txt: t.gpEstab },
          { kind: "t", txt: t.gpScout },
        ],
      },
      {
        n: "E",
        name: t.stHarv,
        when: range(growEnd + 1, cycle),
        rev,
        items: [
          { kind: "s", txt: t.gpFruit },
          { kind: "r", txt: t.gpHarv },
        ],
      },
    ]
  }

  // Boundary days as proportions of the cycle. The max() ladder keeps a very
  // short cycle (fast radish, baby greens) from folding a phase to zero or
  // inverting a range — each stage always gets at least one day.
  const plantEnd = 3 + Math.max(2, Math.round(cycle * 0.05))
  const vegEnd = Math.max(plantEnd + 1, Math.round(cycle * 0.45))
  const flowerEnd = Math.max(vegEnd + 1, Math.round(cycle * 0.75))
  const harvestEnd = Math.max(flowerEnd + 1, cycle)

  return [
    {
      n: "A",
      name: t.stPrep,
      when: range(-2, 2),
      cost,
      items: [
        { kind: "s", txt: t.gpPrepA },
        { kind: "w", txt: t.gpPrepB },
      ],
    },
    {
      n: "B",
      name: t.stPlant,
      when: range(3, plantEnd),
      items: [
        { kind: "r", txt: t.gpPlant },
        { kind: "w", txt: t.gpEstab },
      ],
    },
    {
      n: "C",
      name: t.stVeg,
      when: range(plantEnd + 1, vegEnd),
      items: [
        { kind: "s", txt: t.gpVeg },
        { kind: "r", txt: t.gpEstabScout },
        { kind: "t", txt: t.gpScout },
      ],
    },
    {
      n: "D",
      name: t.stFlower,
      when: range(vegEnd + 1, flowerEnd),
      items: [
        { kind: "w", txt: t.gpFlower },
        { kind: "t", txt: t.gpScout },
      ],
    },
    {
      n: "E",
      name: t.stHarv,
      when: range(flowerEnd + 1, harvestEnd),
      rev,
      items: [
        { kind: "s", txt: t.gpFruit },
        { kind: "r", txt: t.gpHarv },
      ],
    },
  ]
}
