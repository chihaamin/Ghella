/**
 * The generic season plan: five phases for ANY planned crop, derived from its
 * cycle length instead of a scripted demo table.
 *
 * The demo calendar ships a hand-written seven-phase tomato plan; a farmer who
 * just committed chickpea or fig needs the same shaped story built from the
 * two facts every crop snapshot carries — cycle days and money. Phase spans
 * are proportions of the cycle (plant ~5%, vegetative to 45%, flowering to
 * 75%, harvest to 100%), anchored on the farmer's own start date so
 * "Sep 1–8" style ranges come out of their calendar. The plan's setup answers
 * (soil prepared? which steps? when?) decide whether preparation opens the
 * plan, shrinks to the missing steps, or disappears entirely. Pure function,
 * no I/O — the caller hands in the dict, the money formatter and the locale
 * so this file never guesses at language or currency.
 */

import { ECOCROP } from "@/data/ecocrop"
import type { Dict } from "@/i18n/dict"
import type { TaskKind } from "@/lib/colors"
import type { PlannedCropPlan, PrepStepId } from "@/store/app-store"
import type { CropCategory } from "@/types/land"

export interface GenericPhase {
  n: string
  name: string
  when: string
  items: { kind: TaskKind; txt: string }[]
  cost?: string
  rev?: string
}

/**
 * The preparation steps worth recommending per crop category. Vegetables and
 * roots earn all five — fine seedbeds and laid drip lines pay for themselves
 * in stand and yield. Field crops (cereals, legumes, oilseed, forage) are
 * sown flat on ploughed, fed ground — no beds, and irrigation is a per-farm
 * choice, not a recommendation. Perennial fruit is planted once into pits:
 * ground opened, organic matter in, and water secured for establishment —
 * base fertiliser and beds belong to annual rotations. An unknown category
 * gets the full list: over-preparing soil is the cheap mistake.
 */
export function recommendedPrep(
  category: CropCategory | null,
  cycleDays?: number | null
): PrepStepId[] {
  if (category === "cereal" || category === "legume" || category === "oilseed" || category === "forage")
    return ["plough", "manure", "fertiliser"]
  // "Fruit" spans two farming realities: orchard perennials planted once into
  // pits, and annual row fruit (melon, watermelon, strawberry) grown on formed
  // beds like any vegetable. Cycle length, not the category label, tells them
  // apart — an unknown cycle is treated as perennial to match the old rule.
  if (category === "fruit" && (cycleDays == null || cycleDays >= 300))
    return ["plough", "manure", "irrigation"]
  return ["plough", "manure", "fertiliser", "beds", "irrigation"]
}

/** Canonical field order for prep work items: break ground before feeding it. */
const PREP_ORDER: PrepStepId[] = ["plough", "manure", "fertiliser", "beds", "irrigation"]

/** Dot colour per step: soil work "s", water work "w" — matching the feed. */
const PREP_KIND: Record<PrepStepId, TaskKind> = {
  plough: "s",
  manure: "s",
  fertiliser: "s",
  beds: "s",
  irrigation: "w",
}

/**
 * Prep steps as work items. The ps* answer labels double as the task text —
 * they are imperative enough as field work and already localized, where the
 * gp* prose lines only cover plough + irrigation.
 */
function prepItems(steps: PrepStepId[], t: Dict): { kind: TaskKind; txt: string }[] {
  const label: Record<PrepStepId, string> = {
    plough: t.psPlough,
    manure: t.psManure,
    fertiliser: t.psFertiliser,
    beds: t.psBeds,
    irrigation: t.psIrrigation,
  }
  return PREP_ORDER.filter((s) => steps.includes(s)).map((s) => ({
    kind: PREP_KIND[s],
    txt: label[s],
  }))
}

/** id → category, so the plan snapshot never has to carry the envelope. */
const CATEGORY_BY_ID = new Map<string, CropCategory>(
  ECOCROP.map((e) => [e.id, e.category])
)

/**
 * Build the phase list for a committed crop.
 *
 * `startDay` IS day 1 — the date the farmer said work begins. No phase may
 * open before it: a farmer who says "I start Monday" must never see prep
 * scheduled last Friday. Three shapes, from the setup answers:
 *
 *  - soil not prepared: prep opens the plan on day 1 (all recommended steps),
 *    planting follows it;
 *  - prepared, nothing missing: no prep phase at all — planting is day 1 and
 *    the whole plan shortens by the prep span;
 *  - prepared with gaps: a compact "finish the preparation" phase (only the
 *    missing steps) on days 1–3, planting from day 3.
 *
 * Harvest always closes cycleDays after PLANTING. Money keeps the demo's
 * simplest honest ledger: the full input cost on the FIRST phase (spent up
 * front, whatever that phase is), the full revenue estimate on harvest.
 */
export function genericPhases(
  plan: PlannedCropPlan,
  startDay: Date,
  t: Dict,
  formatMoney: (usd: number) => string,
  locale: string
): GenericPhase[] {
  const label = (day: number): string => {
    const d = new Date(startDay)
    d.setDate(d.getDate() + (day - 1))
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" })
  }
  const range = (from: number, to: number) => `${label(from)} – ${label(to)}`

  const cycle = plan.cycleDays
  const cost = formatMoney(plan.costUsd)
  const rev = formatMoney(plan.revenueUsd)

  const recommended = recommendedPrep(
    CATEGORY_BY_ID.get(plan.cropId) ?? null,
    plan.cycleDays
  )
  const missing = recommended.filter((s) => !plan.prepDone.includes(s))
  const prepared = plan.soilPrepared
  const gaps = prepared && missing.length > 0

  // A perennial's "cycle" runs to FIRST harvest, often a year out — five
  // annual phases would invent flowering dates nobody scheduled. Collapse to
  // the three stretches that are honest: establish, grow, first pick. The
  // establish phase carries whatever prep the answers left it — everything,
  // only the missing steps, or none — and always the planting itself.
  if (cycle >= 300) {
    const plantingDay = !prepared ? 4 : gaps ? 3 : 1
    const estEnd = plantingDay + 13
    const growEnd = plantingDay - 1 + Math.round(cycle * 0.75)
    const harvestEnd = plantingDay - 1 + cycle
    const establishItems = [
      ...prepItems(!prepared ? recommended : gaps ? missing : [], t),
      { kind: "r" as TaskKind, txt: t.gpPlant },
    ]
    return [
      {
        n: "A",
        // A farmer who said the soil is ready never sees an opening phase
        // called "Prep" — with gaps it is the finishing work, fully prepared
        // it is simply planting.
        name: !prepared ? t.stPrep : gaps ? t.psFinishPrep : t.stPlant,
        when: range(1, estEnd),
        cost,
        items: establishItems,
      },
      {
        n: "C",
        name: t.stVeg,
        when: range(estEnd + 1, growEnd),
        items: [
          { kind: "s", txt: t.gpVeg },
          { kind: "w", txt: t.gpEstab },
          { kind: "t", txt: t.gpScout },
        ],
      },
      {
        n: "E",
        name: t.stHarv,
        when: range(growEnd + 1, harvestEnd),
        rev,
        items: [
          { kind: "s", txt: t.gpFruit },
          { kind: "r", txt: t.gpHarv },
        ],
      },
    ]
  }

  // Planting day per shape: after a full 5-day prep, after a 3-day finish,
  // or day 1 outright. Later boundaries are proportions of the cycle FROM
  // PLANTING, so the harvest window always closes cycleDays after the crop
  // went in — the prep answers move planting, never the crop's biology. The
  // max() ladder keeps a very short cycle (fast radish, baby greens) from
  // folding a phase to zero or inverting a range.
  const plantingDay = !prepared ? 6 : gaps ? 3 : 1
  const plantEnd = plantingDay + Math.max(2, Math.round(cycle * 0.05))
  const vegEnd = Math.max(plantEnd + 1, plantingDay - 1 + Math.round(cycle * 0.45))
  const flowerEnd = Math.max(vegEnd + 1, plantingDay - 1 + Math.round(cycle * 0.75))
  const harvestEnd = Math.max(flowerEnd + 1, plantingDay - 1 + cycle)

  const phases: GenericPhase[] = []
  if (!prepared) {
    phases.push({
      n: "A",
      name: t.stPrep,
      when: range(1, 5),
      cost,
      items: prepItems(recommended, t),
    })
  } else if (gaps) {
    phases.push({
      n: "A",
      name: t.psFinishPrep,
      when: range(1, 3),
      cost,
      items: prepItems(missing, t),
    })
  }

  phases.push(
    {
      n: "B",
      name: t.stPlant,
      when: range(plantingDay, plantEnd),
      // With no prep phase at all, planting is the first phase — the input
      // money is spent here.
      ...(phases.length === 0 ? { cost } : {}),
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
    }
  )
  return phases
}

/**
 * The prep steps a prepared-soil plan still owes — the same reading
 * `genericPhases` schedules as the finishing phase, exported so the calendar
 * feed and month grid can agree with the Plan tab about days 1–3.
 */
export function missingPrep(plan: PlannedCropPlan): PrepStepId[] {
  if (!plan.soilPrepared) return []
  return recommendedPrep(
    CATEGORY_BY_ID.get(plan.cropId) ?? null,
    plan.cycleDays
  ).filter((step) => !plan.prepDone.includes(step))
}
