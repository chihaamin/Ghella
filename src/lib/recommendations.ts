/**
 * Turns the farmer's parcels and their analyses into the ranked list on the
 * "My land" screen.
 *
 * Every card is something to tap, not something to read: each one carries a
 * `RecommendationAction` the screen can dispatch. Nothing here fetches — it is
 * a pure function of the parcels, the selection and the forecast, so the same
 * state always produces the same list in the same order, with the same ids.
 * That matters because the ids are React keys: an id that changed between
 * renders would re-animate the whole list on every store tick.
 *
 * The rule everywhere below is that a card only appears when the data supports
 * it. A padded list is a list the farmer stops reading.
 */

import { ECOCROP, type CropEnvelope } from "@/data/ecocrop"
import { VARIETIES, type Variety } from "@/data/varieties"
import { textureLabel, waterBudget } from "@/lib/agronomy"
import { plantingMonthsFor, applyIrrigation } from "@/lib/crop-suitability"
import { polygonAreaHa, splitPolygon } from "@/lib/geo"
import { fmt } from "@/lib/utils"
import type {
  ClimateNormals,
  CropMatch,
  Forecast,
  LatLng,
  Parcel,
  Recommendation,
  RecommendationAction,
  WaterSourceId,
} from "@/types/land"

/* ── The numbers to correct first ────────────────────────────── */

/**
 * What each water source puts on one parcel over a season, m³.
 *
 * `drip` is the worked case: a 2 L/s well pumped 6 h a day for 180 days is
 * 7 776 m³ gross, but pump downtime, filter flushing and distribution loss
 * leave about 5 200 m³ usable. `sprinkler` moves less because wind and air
 * take a share between nozzle and soil. `flood` is the number to distrust
 * first — 6 800 m³ leaves the ditch, but a large part of it drains past the
 * root zone, so a flood parcel that reads "comfortable" here can still run dry
 * at the plant. `rainfed` has no pump at all, so its volume is rainfall over
 * the crop's own months × area, computed per parcel rather than listed.
 *
 * These are per parcel, for one pump: a well shared between two fields does
 * not deliver this twice. Every water figure in this file comes from here and
 * nowhere else, so correcting a number is a one-line change.
 */
const SEASON_DELIVERY: Record<WaterSourceId, { usableM3: number | null; label: string }> = {
  drip: { usableM3: 5200, label: "drip" },
  sprinkler: { usableM3: 4600, label: "sprinkler" },
  flood: { usableM3: 6800, label: "flood" },
  rainfed: { usableM3: null, label: "rain alone" },
}

/** 1 mm of water over 1 ha is 10 m³. The unit bridge for every volume below. */
const MM_HA_TO_M3 = 10

/** Under this a parcel is one working unit already, ha. */
const SPLIT_MIN_HA = 1.5
/** Target block size, ha — the divisor that sets the block count. */
const SPLIT_BLOCK_HA = 0.8
/** Below this a block is more headland than field, ha. */
const SPLIT_MIN_BLOCK_HA = 0.3
const SPLIT_MIN_BLOCKS = 2
const SPLIT_MAX_BLOCKS = 6

/** Fewer parcels than this and the map is almost certainly incomplete. */
const MIN_PARCELS = 2
/** A whole holding under this reads as "they drew one corner and stopped", ha. */
const SMALL_HOLDING_HA = 1

/** Rain worth moving work around, mm summed over the days below. */
const MEANINGFUL_RAIN_MM = 8
/** A night at or under this hurts tender plants, °C. */
const FROST_T_MIN_C = 2
/** How far ahead the season card looks. Beyond three days the forecast moves. */
const FORECAST_DAYS = 3

/** A margin thinner than this share of the season need is one hot week from a deficit. */
const TIGHT_MARGIN = 0.1

/**
 * Hard cap, deliberate. The screen is a phone held in a field, and a list that
 * scrolls is a list that gets abandoned halfway. Anything cut here is either
 * lower priority or about less land than what is already shown.
 */
const MAX_RECOMMENDATIONS = 6

/** The parcel on screen edges out an equal-sized one the farmer is not looking at. */
const SELECTED_BOOST = 1.25

const PRIORITY_RANK: Record<Recommendation["priority"], number> = { high: 0, medium: 1, low: 2 }

/**
 * Botanical family per crop, for the varieties this app ships. Only a fallback:
 * where the parcel has been analysed we read the family off its own crop
 * matches, which come from EcoCrop and cover far more than these.
 */
const FAMILY_BY_CROP: Record<string, string> = {
  tomato: "Solanaceae",
  pepper: "Solanaceae",
  potato: "Solanaceae",
  aubergine: "Solanaceae",
  onion: "Amaryllidaceae",
  garlic: "Amaryllidaceae",
  leek: "Amaryllidaceae",
  melon: "Cucurbitaceae",
  watermelon: "Cucurbitaceae",
  cucumber: "Cucurbitaceae",
  squash: "Cucurbitaceae",
}

/* ── Public shape ────────────────────────────────────────────── */

/** Everything the "My land" screen knows, and everything this file reads. */
export interface RecommendationInput {
  parcels: Parcel[]
  selectedParcelId: string | null
  forecast: Forecast | null
}

/** A recommendation plus the hectares it is about, which is how ties are broken. */
interface Scored {
  rec: Recommendation
  /**
   * Hectares at stake. Ranking a water deficit in m³ against a split in
   * hectares needs one shared unit, and hectares is the one the farmer feels.
   */
  weight: number
}

/**
 * Builds the ranked, capped list of what to do next.
 *
 * Each kind is generated independently and then sorted together, so adding a
 * kind never disturbs the others. Every generator runs inside `safely` because
 * this list is the whole screen: one parcel with a half-written polygon must
 * cost its own card, not all six.
 */
export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const parcels = Array.isArray(input.parcels) ? input.parcels.filter((parcel) => Boolean(parcel)) : []
  const selectedId = typeof input.selectedParcelId === "string" ? input.selectedParcelId : null
  const forecast = input.forecast ?? null

  const scored: Scored[] = [
    ...safely(() => splitRecs(parcels)),
    ...safely(() => addLandRecs(parcels)),
    ...safely(() => completeInfoRecs(parcels, selectedId)),
    ...safely(() => waterRecs(parcels)),
    ...safely(() => rotationRecs(parcels)),
    ...safely(() => cropRecs(parcels)),
    ...safely(() => seasonRecs(forecast, parcels)),
  ]

  return rank(scored, selectedId)
}

/**
 * Proposes blocking a parcel up, with a real preview the map can draw.
 *
 * Returns null — no card — whenever the parcel is too small to gain anything,
 * the geometry is unusable, or the cut would leave blocks too small to work.
 */
export function suggestSplit(parcel: Parcel): { blocks: number; preview: LatLng[][]; reason: string } | null {
  const ring = ringOf(parcel.points)
  const areaHa = areaOf(parcel)
  if (!ring || areaHa < SPLIT_MIN_HA) return null

  let blocks = clamp(Math.round(areaHa / SPLIT_BLOCK_HA), SPLIT_MIN_BLOCKS, SPLIT_MAX_BLOCKS)
  // Checked rather than trusted: the divisor above is a tunable, and a block
  // too small to turn a tractor in is worse than leaving the field whole.
  while (blocks > SPLIT_MIN_BLOCKS && areaHa / blocks < SPLIT_MIN_BLOCK_HA) blocks -= 1
  if (areaHa / blocks < SPLIT_MIN_BLOCK_HA) return null

  const preview = previewFor(ring, blocks)
  if (!preview) return null

  return { blocks, preview, reason: splitReason(parcel, blocks, areaHa) }
}

/* ── Generators ──────────────────────────────────────────────── */

function splitRecs(parcels: Parcel[]): Scored[] {
  const out: Scored[] = []
  for (const parcel of parcels) {
    const suggestion = suggestSplit(parcel)
    if (!suggestion) continue
    const areaHa = areaOf(parcel)
    out.push({
      weight: areaHa,
      rec: {
        id: `split:${parcel.id}`,
        kind: "split",
        priority: "high",
        title: `Split ${nameOf(parcel)} into ${suggestion.blocks} blocks`,
        body: suggestion.reason,
        impact: blockSizes(suggestion.preview, suggestion.blocks, areaHa),
        actionLabel: `Preview ${suggestion.blocks} blocks`,
        action: {
          type: "split",
          parcelId: parcel.id,
          blocks: suggestion.blocks,
          preview: suggestion.preview,
        },
      },
    })
  }
  return out
}

function addLandRecs(parcels: Parcel[]): Scored[] {
  const count = parcels.length
  const totalHa = parcels.reduce((sum, parcel) => sum + areaOf(parcel), 0)
  const thin = totalHa < SMALL_HOLDING_HA
  if (count >= MIN_PARCELS && !thin) return []

  const priority: Recommendation["priority"] = count === 0 ? "high" : count < MIN_PARCELS ? "medium" : "low"
  const body =
    count === 0
      ? "Nothing is mapped yet. Trace the boundary on the satellite view and the soil, the rainfall and every crop score follow from the shape."
      : `${count === 1 ? "One parcel" : `${count} parcels`}, ${ha(totalHa)} in total. Mapping the rest is what lets the plan move work between fields instead of stacking it all on this one.`

  return [
    {
      // Whole-holding advice, so it is never outranked purely on hectares.
      weight: Math.max(totalHa, SMALL_HOLDING_HA),
      rec: {
        id: "add-land",
        kind: "add-land",
        priority,
        title: count === 0 ? "Map your first parcel" : "Add the rest of your land",
        body,
        impact: count === 0 ? null : `${ha(totalHa)} mapped so far`,
        actionLabel: "Draw a parcel",
        action: { type: "draw-parcel" },
      },
    },
  ]
}

function completeInfoRecs(parcels: Parcel[], selectedId: string | null): Scored[] {
  const selected = parcels.find((parcel) => parcel.id === selectedId) ?? null
  // Ask about the parcel in front of the farmer; fall back to the first one
  // with a gap, so the prompt never disappears just because the selection moved.
  const target =
    selected && missingFields(selected).length > 0
      ? selected
      : (parcels.find((parcel) => missingFields(parcel).length > 0) ?? null)
  if (!target) return []

  const areaHa = areaOf(target)
  const name = nameOf(target)
  const modelled = target.analysis?.soil?.texture ?? null

  return missingFields(target).map((field) => {
    if (field === "soil") {
      return {
        weight: areaHa,
        rec: {
          id: `complete-info:${target.id}:soil`,
          kind: "complete-info",
          priority: "high",
          title: `Tell us the soil on ${name}`,
          body: `Soil texture sets how long one watering lasts — sand takes short, frequent sets, clay takes fewer and longer. ${
            modelled
              ? `The satellite reads it as ${textureLabel(modelled).toLowerCase()}; confirm that or correct it.`
              : "Until you answer, every crop score here runs on a satellite estimate."
          }`,
          impact: `${ha(areaHa)} scored on measured soil`,
          actionLabel: "Set the soil",
          action: { type: "edit-parcel", parcelId: target.id, field: "soil" },
        },
      }
    }
    if (field === "water") {
      return {
        weight: areaHa,
        rec: {
          id: `complete-info:${target.id}:water`,
          kind: "complete-info",
          priority: "medium",
          title: `How do you water ${name}?`,
          body: "Water source turns the season plan from millimetres into hours of pumping. It is also what decides whether a crop's demand fits what you can actually deliver.",
          impact: "Season plan in pump hours",
          actionLabel: "Set the water source",
          action: { type: "edit-parcel", parcelId: target.id, field: "water" },
        },
      }
    }
    return {
      weight: areaHa,
      rec: {
        id: `complete-info:${target.id}:salinity`,
        kind: "complete-info",
        priority: "low",
        title: `Any salt patches on ${name}?`,
        body: "Salinity takes the crops that will not tolerate it off the list before you spend on seed. Answering “none” is worth as much as answering “patches” — it stops the question coming back.",
        impact: "Crop list filtered before you buy seed",
        actionLabel: "Set salinity",
        action: { type: "edit-parcel", parcelId: target.id, field: "salinity" },
      },
    }
  })
}

function waterRecs(parcels: Parcel[]): Scored[] {
  const out: Scored[] = []
  for (const parcel of parcels) {
    const rec = waterRec(parcel)
    if (rec) out.push(rec)
  }
  return out
}

/**
 * The water card for one parcel.
 *
 * The whole card forks on whether the source is a PUMP or the SKY, because the
 * two deliver water in different shapes. A pump gives a fixed volume that can
 * be concentrated on fewer hectares, so "plant 1.5 of your 3 ha and water it
 * properly" is real advice. Rain gives a DEPTH that lands on every hectare
 * equally: on a 3 ha rainfed parcel getting half what the crop wants, no
 * hectare is fully watered and none is dry, so the same sentence is
 * arithmetically derived and physically impossible. Rainfed therefore talks in
 * millimetres and in changing the crop; only the pumped sources talk in area.
 */
function waterRec(parcel: Parcel): Scored | null {
  const source = parcel.waterSource
  if (!source) return null

  const delivery = SEASON_DELIVERY[source]
  if (!delivery) return null

  const areaHa = areaOf(parcel)
  const need = seasonNeed(parcel)
  if (areaHa <= 0 || !need) return null

  // Climate is only needed to size RAIN. A drip parcel whose weather history
  // failed to load still has a pump with a known output and a crop with a known
  // demand, and losing the whole card over an unrelated fetch failure is the
  // opposite of what the analysis contract models as survivable.
  const climate = parcel.analysis?.climate ?? null
  let rainMm: number | null = null
  let availableM3 = delivery.usableM3
  if (availableM3 === null) {
    if (!climate) return null
    rainMm = seasonRainMm(climate, need.cycleDays, need.startMonth)
    availableM3 = rainMm * areaHa * MM_HA_TO_M3
  }

  const budget = waterBudget({ seasonNeedMm: need.mm, areaHa, availableM3 })
  const needM3 = num(budget.seasonNeedM3)
  const haveM3 = num(budget.availableM3)
  if (needM3 === null || needM3 <= 0 || haveM3 === null) return null

  const deficitM3 = num(budget.deficitM3) ?? Math.max(0, needM3 - haveM3)
  // `budget.deficitM3` is floored at zero, so a surplus has to be measured here
  // rather than read off as a negative deficit.
  const spareM3 = Math.max(0, haveM3 - needM3)
  const name = nameOf(parcel)
  const id = `water:${parcel.id}`

  if (deficitM3 > 0) {
    const short = rainMm === null ? null : Math.max(0, need.mm - rainMm)
    return {
      weight: areaHa,
      rec: {
        id,
        kind: "water",
        priority: "high",
        title: `${name} is ${m3(deficitM3)} short of water`,
        body:
          rainMm === null
            ? // Hectares one full season of this pump can actually irrigate.
              `${need.crop} needs ${m3(needM3)} across ${ha(areaHa)}, and ${delivery.label} delivers about ${m3(haveM3)} over the season. Plant ${ha(coversHa(haveM3, need.mm))} and water it properly, or take a crop with a shorter cycle.`
            : `About ${mm(rainMm)} falls while ${need.crop.toLowerCase()} is in the ground and it wants ${mm(need.mm)} — a ${mm(short ?? 0)} shortfall on every one of these ${ha(areaHa)}. Rain cannot be moved onto fewer hectares, so the fix is a shorter-cycle or less thirsty crop, or water you can bring in.`,
        impact:
          rainMm === null
            ? `${ha(Math.max(areaHa - coversHa(haveM3, need.mm), 0))} would run dry`
            : `${mm(short ?? 0)} short across ${ha(areaHa)}`,
        actionLabel: "Pick a crop that fits",
        action: { type: "open-decide", parcelId: parcel.id },
      },
    }
  }

  if (spareM3 < needM3 * TIGHT_MARGIN) {
    return {
      weight: areaHa,
      rec: {
        id,
        kind: "water",
        priority: "medium",
        title: `Water on ${name} has almost no margin`,
        body:
          rainMm === null
            ? `${need.crop} needs ${m3(needM3)} and ${delivery.label} delivers about ${m3(haveM3)} — ${m3(spareM3)} spare across the season. One hot fortnight or a week of pump trouble turns that into a shortfall.`
            : `${need.crop} wants ${mm(need.mm)} and about ${mm(rainMm)} falls while it is in the ground. One dry fortnight in the wrong week turns that margin into a shortfall, and on rain alone there is nothing to open.`,
        impact: `${m3(spareM3)} spare on ${ha(areaHa)}`,
        actionLabel: "See the water fit",
        action: { type: "open-decide", parcelId: parcel.id },
      },
    }
  }

  return {
    weight: areaHa,
    rec: {
      id,
      kind: "water",
      priority: "low",
      title:
        rainMm === null
          ? `Water covers ${name} with ${m3(spareM3)} spare`
          : `Rain covers ${name} with ${mm(rainMm - need.mm)} to spare`,
      body:
        rainMm === null
          ? // Only a pumped volume can be spent on more land, so only this
            // branch is allowed to price the margin in hectares.
            `${need.crop} needs ${m3(needM3)} across ${ha(areaHa)} and ${delivery.label} delivers about ${m3(haveM3)}. The margin is worth roughly ${ha(spareM3 / (need.mm * MM_HA_TO_M3))} more of the same crop, or it is your cover for a hot spell.`
          : `About ${mm(rainMm)} falls while ${need.crop.toLowerCase()} is in the ground and it wants ${mm(need.mm)}. That margin is your cover for a dry spell — it does not stretch to more land, because more land arrives with its own rain and its own demand.`,
      impact:
        rainMm === null
          ? `${ha(spareM3 / (need.mm * MM_HA_TO_M3))} of headroom`
          : `${mm(rainMm - need.mm)} of headroom on ${ha(areaHa)}`,
      actionLabel: "See the water fit",
      action: { type: "open-decide", parcelId: parcel.id },
    },
  }
}

/** Hectares one season of a fixed pumped volume can carry at `needMm`. */
function coversHa(haveM3: number, needMm: number): number {
  return haveM3 / (needMm * MM_HA_TO_M3)
}

function rotationRecs(parcels: Parcel[]): Scored[] {
  const out: Scored[] = []
  const byFamily = new Map<string, { parcel: Parcel; crop: string }[]>()

  for (const parcel of parcels) {
    const planned = plannedCrop(parcel)
    if (!planned) continue

    // `Parcel` carries no cropping history yet, so the variety's own warning
    // line is the only place a repeat on this ground is recorded.
    if (isRotationWarning(planned.warn)) {
      const areaHa = areaOf(parcel)
      out.push({
        weight: areaHa,
        rec: {
          id: `rotation:parcel:${parcel.id}`,
          kind: "rotation",
          priority: "high",
          title: `${planned.crop} repeats on ${nameOf(parcel)}`,
          body: `${planned.warn} Soil-borne disease and nematodes build up on a repeat, so move it to other ground and put a cereal or a legume on these ${ha(areaHa)}.`,
          impact: `${ha(areaHa)} on a second season of the same family`,
          actionLabel: "Change the plan",
          action: { type: "open-decide", parcelId: parcel.id },
        },
      })
    }

    // No family resolved means no honest rotation advice — say nothing.
    if (!planned.family) continue
    const group = byFamily.get(planned.family) ?? []
    group.push({ parcel, crop: planned.crop })
    byFamily.set(planned.family, group)
  }

  for (const [family, group] of byFamily) {
    if (group.length < 2) continue
    const areaHa = group.reduce((sum, entry) => sum + areaOf(entry.parcel), 0)
    // Changing the smallest parcel costs the least, so that is the one to name.
    const smallest = [...group].sort((a, b) => areaOf(a.parcel) - areaOf(b.parcel))[0]
    const names = list(group.map((entry) => nameOf(entry.parcel)))
    const crops = unique(group.map((entry) => entry.crop))
    const both = group.length === 2 ? "both" : "all"
    const opening =
      crops.length === 1
        ? `${names} are ${both} planted to ${crops[0]}, so ${ha(areaHa)} carries one ${family} crop.`
        : `${names} are ${both} ${family} — ${list(crops)}.`
    out.push({
      weight: areaHa,
      rec: {
        id: `rotation:family:${slug(family)}`,
        kind: "rotation",
        priority: "medium",
        title: `${group.length === 2 ? "Two parcels" : `${group.length} parcels`} planned to the same family`,
        body: `${opening} They share the same soil-borne diseases and come ready in the same market week, so switch ${nameOf(smallest.parcel)} to a cereal or a legume.`,
        impact: `${ha(areaHa)} carrying one family's risk`,
        actionLabel: `Change ${nameOf(smallest.parcel)}`,
        action: { type: "open-decide", parcelId: smallest.parcel.id },
      },
    })
  }

  return out
}

function cropRecs(parcels: Parcel[]): Scored[] {
  const out: Scored[] = []
  // Sibling blocks of one field share a climate and therefore a best crop;
  // six identical "grow barley" cards would drown everything else. One card
  // per crop, pinned to the largest parcel that earned it.
  const seenCrop = new Set<string>()
  const byArea = [...parcels].sort((a, b) => areaOf(b) - areaOf(a))
  for (const parcel of byArea) {
    const planned = plannedCrop(parcel)
    const best = matchesOf(parcel)
      .filter(
        (match) =>
          match.rating === "excellent" &&
          (num(match.score) ?? 0) > 0 &&
          (!Array.isArray(match.blockers) || match.blockers.length === 0),
      )
      .sort((a, b) => (num(b.score) ?? 0) - (num(a.score) ?? 0))[0]
    if (!best) continue

    const name = typeof best.name === "string" ? best.name.trim() : ""
    if (!name) continue
    // Already committed to this crop — nothing to suggest.
    if (planned && sameCrop(name, planned.crop)) continue
    if (seenCrop.has(name)) continue
    seenCrop.add(name)

    const areaHa = areaOf(parcel)
    const score = Math.round(num(best.score) ?? 0)
    out.push({
      weight: areaHa,
      rec: {
        id: `crop:${parcel.id}:${best.id}`,
        kind: "crop",
        priority: "medium",
        title: `${name} scores ${score} on ${nameOf(parcel)}`,
        body: `${leadFactor(best) ?? `${name} matches this parcel on soil, rainfall and season.`} ${
          planned
            ? `You have ${planned.crop} planned here, so compare the two before you buy seed.`
            : "Nothing is committed on this parcel yet."
        }`,
        impact: `${score}/100 across ${ha(areaHa)}`,
        actionLabel: `Compare ${name}`,
        action: { type: "open-decide", parcelId: parcel.id },
      },
    })
  }
  return out
}

function seasonRecs(forecast: Forecast | null, parcels: Parcel[]): Scored[] {
  const all = forecast && Array.isArray(forecast.days) ? forecast.days : []
  const days = all.slice(0, FORECAST_DAYS)
  if (days.length === 0) return []

  const totalHa = parcels.reduce((sum, parcel) => sum + areaOf(parcel), 0)
  // Weather hits every parcel, so it is weighed against the whole holding.
  const weight = Math.max(totalHa, SMALL_HOLDING_HA)
  const out: Scored[] = []

  const frostDay = days.find((day) => (num(day.tMinC) ?? Number.POSITIVE_INFINITY) <= FROST_T_MIN_C)
  if (frostDay) {
    const low = Math.round(num(frostDay.tMinC) ?? 0)
    out.push({
      weight,
      rec: {
        id: "season:frost",
        kind: "season",
        priority: "high",
        title: `Frost risk ${when(frostDay.date)}`,
        body: `The low ${when(frostDay.date)} is ${low}°C. Move transplanting and any tender sowing to the end of the week, and cover what is already in the ground.`,
        impact: `Low of ${low}°C`,
        actionLabel: "Open the calendar",
        action: { type: "open-calendar" },
      },
    })
  }

  const rainMm = days.reduce((sum, day) => sum + (num(day.rainMm) ?? 0), 0)
  if (rainMm >= MEANINGFUL_RAIN_MM) {
    const wettest = days.reduce((best, day) => ((num(day.rainMm) ?? 0) > (num(best.rainMm) ?? 0) ? day : best), days[0])
    const savedM3 = rainMm * MM_HA_TO_M3 * totalHa
    out.push({
      weight,
      rec: {
        id: "season:rain",
        kind: "season",
        priority: "medium",
        title: `${Math.round(rainMm)} mm of rain coming`,
        body: `${Math.round(rainMm)} mm is due over the next ${days.length} days, most of it ${when(wettest.date)}. Hold the irrigation set and any spraying until it has passed, and move soil work to after the ground drains.`,
        impact: totalHa > 0 ? `${m3(savedM3)} you do not pump` : `${m3(rainMm * MM_HA_TO_M3)} per hectare`,
        actionLabel: "Open the calendar",
        action: { type: "open-calendar" },
      },
    })
  }

  return out
}

/* ── Ranking ─────────────────────────────────────────────────── */

/** Sorts by priority, then by hectares at stake, then by id so it never wobbles. */
function rank(scored: Scored[], selectedId: string | null): Recommendation[] {
  const byId = new Map<string, Scored>()
  for (const item of scored) {
    // Ids are React keys; a duplicate would silently drop a card, so the first
    // generator to claim an id keeps it.
    if (!byId.has(item.rec.id)) byId.set(item.rec.id, item)
  }

  const items = [...byId.values()].map((item) => ({ rec: item.rec, weight: boosted(item, selectedId) }))
  items.sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.rec.priority] - PRIORITY_RANK[b.rec.priority]
    if (byPriority !== 0) return byPriority
    if (b.weight !== a.weight) return b.weight - a.weight
    // Last resort, so the order never depends on which generator ran first.
    return a.rec.id < b.rec.id ? -1 : a.rec.id > b.rec.id ? 1 : 0
  })

  return items.slice(0, MAX_RECOMMENDATIONS).map((item) => item.rec)
}

function boosted(item: Scored, selectedId: string | null): number {
  if (!selectedId) return item.weight
  return parcelIdOf(item.rec.action) === selectedId ? item.weight * SELECTED_BOOST : item.weight
}

function parcelIdOf(action: RecommendationAction | null): string | null {
  if (!action) return null
  return "parcelId" in action ? action.parcelId : null
}

/**
 * Runs one generator and swallows anything it throws. The farmer is standing in
 * a field on a bad connection: five good cards beat a blank screen because one
 * parcel came back from storage half-written.
 */
function safely(produce: () => Scored[]): Scored[] {
  try {
    return produce()
  } catch {
    return []
  }
}

/* ── Parcel reading ──────────────────────────────────────────── */

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** A polygon we can actually work with, or null. Persisted state can be partial. */
function ringOf(points: LatLng[] | null | undefined): LatLng[] | null {
  if (!Array.isArray(points) || points.length < 3) return null
  const clean = points.filter((point) => Array.isArray(point) && num(point[0]) !== null && num(point[1]) !== null)
  return clean.length >= 3 ? clean : null
}

/** The stored area, or the polygon measured again when the stored one is missing. */
function areaOf(parcel: Parcel): number {
  const stored = num(parcel.areaHa)
  if (stored !== null && stored > 0) return stored
  const ring = ringOf(parcel.points)
  if (!ring) return 0
  try {
    const measured = num(polygonAreaHa(ring))
    return measured !== null && measured > 0 ? measured : 0
  } catch {
    return 0
  }
}

function nameOf(parcel: Parcel): string {
  const name = typeof parcel.name === "string" ? parcel.name.trim() : ""
  return name || "this parcel"
}

function matchesOf(parcel: Parcel): CropMatch[] {
  const crops = parcel.analysis?.crops
  if (!Array.isArray(crops)) return []
  // Read the matches the way the parcel is actually farmed: a stated
  // irrigation source lifts the rain-fed assumption, exactly as the Decide
  // screen and the parcel detail do. One view of the truth everywhere.
  return applyIrrigation(
    crops,
    parcel.waterSource != null && parcel.waterSource !== "rainfed",
  )
}

type MissingField = "soil" | "water" | "salinity"

/**
 * A stated "none" for salinity is an answer, not a gap — it is a truthy id, so
 * a farmer who says the land is clean is never asked twice.
 */
function missingFields(parcel: Parcel): MissingField[] {
  const missing: MissingField[] = []
  if (!parcel.soilTexture) missing.push("soil")
  if (!parcel.waterSource) missing.push("water")
  if (!parcel.salinity) missing.push("salinity")
  return missing
}

/* ── Crop resolution ─────────────────────────────────────────── */

interface PlannedCrop {
  /** "Tomato" */
  crop: string
  /** Null when neither the analysis nor the shipped table knows it. */
  family: string | null
  /** The variety's warning line, which is where field history currently lives. */
  warn: string | null
}

/**
 * Resolves `parcel.plannedVarietyId` through `src/data/varieties`.
 *
 * Returns null rather than guessing at any step: a wrong family produces
 * confidently wrong rotation advice, which is worse than no advice.
 */
function plannedCrop(parcel: Parcel): PlannedCrop | null {
  const id = parcel.plannedVarietyId
  if (!id) return null
  const variety = (VARIETIES as Record<string, Variety | undefined>)[id]
  if (!variety || typeof variety.crop !== "string") return null

  // "TOMATO · PASTE" → "Tomato": the part before the dot is the crop, the rest
  // is the market type, which rotation and water budgeting do not care about.
  const crop = titleCase(variety.crop.split("·")[0].trim())
  if (!crop) return null

  return {
    crop,
    family: familyOf(crop, parcel),
    warn: typeof variety.warn === "string" ? variety.warn : null,
  }
}

/** EcoCrop's family from the parcel's own matches first, the shipped table second. */
function familyOf(crop: string, parcel: Parcel): string | null {
  for (const match of matchesOf(parcel)) {
    if (typeof match.name !== "string" || !sameCrop(match.name, crop)) continue
    if (typeof match.family === "string" && match.family.trim()) return match.family.trim()
  }
  return FAMILY_BY_CROP[crop.toLowerCase()] ?? null
}

/**
 * The names the variety table uses that no EcoCrop entry shares a prefix with.
 *
 * A prefix test gets "Tomato" to "Tomato" and "Rice" to "Rice (lowland)", but
 * the shipped Bell Pepper resolves to the crop word "Pepper", and EcoCrop ships
 * "Sweet pepper" and "Chilli pepper" — neither is a prefix of the other, in
 * either direction. Without this map that parcel silently budgets water for
 * whatever crop happens to rank first, and the crop list tells the farmer to
 * plant what they already committed to.
 */
const CROP_ALIASES: Record<string, string[]> = {
  pepper: ["sweet pepper", "chilli pepper"],
  aubergine: ["eggplant"],
  squash: ["courgette"],
  corn: ["maize"],
  wheat: ["bread wheat", "durum wheat"],
  groundnut: ["peanut"],
}

/** A crop word plus every other name it is known by, lower-cased. */
function namesOf(crop: string): string[] {
  const key = crop.trim().toLowerCase()
  if (!key) return []
  return [key, ...(CROP_ALIASES[key] ?? [])]
}

/** "Tomato" vs "Tomato, paste" — match on the head of the name, not the whole string. */
function sameCrop(a: string, b: string): boolean {
  const left = namesOf(a)
  const right = namesOf(b)
  if (left.length === 0 || right.length === 0) return false
  return left.some((l) => right.some((r) => l.startsWith(r) || r.startsWith(l)))
}

/** The prototype records field history in the warning line, e.g. "Rotation conflict: …". */
function isRotationWarning(warn: string | null): warn is string {
  return typeof warn === "string" && warn.toLowerCase().includes("rotation")
}

interface SeasonNeed {
  /** Season water demand, mm. */
  mm: number
  crop: string
  cycleDays: number
  /** First sensible planting month, 1–12, or null. */
  startMonth: number | null
}

/**
 * The demand to budget water against: the committed crop where we can resolve
 * it, otherwise the parcel's best match. Returns null instead of a default —
 * an invented demand produces an invented deficit, and the farmer acts on it.
 *
 * A parcel with a crop COMMITTED never falls through to the top match. Water
 * needs across this table run from 250 mm to 1 800 mm, so quietly budgeting the
 * top-ranked crop for a farmer who planted something else is wrong by up to
 * seven times, and the card would print that other crop's name as if it were
 * the plan. No card is the honest answer.
 */
function seasonNeed(parcel: Parcel): SeasonNeed | null {
  const planned = plannedCrop(parcel)
  if (!planned) {
    const top = matchesOf(parcel)[0]
    return top ? needFromMatch(top) : null
  }

  const match = matchesOf(parcel).find(
    (candidate) => typeof candidate.name === "string" && sameCrop(candidate.name, planned.crop),
  )
  // The match list is capped, so a committed crop that scored badly for this
  // site is simply not in it. Its requirements are still known — they are
  // bundled — and budgeting the farmer's actual crop from the table beats both
  // budgeting somebody else's and printing nothing.
  return match ? needFromMatch(match) : needFromEnvelope(planned.crop, parcel)
}

function needFromMatch(match: CropMatch): SeasonNeed | null {
  const mm = num(match.waterNeedMm)
  if (mm === null || mm <= 0) return null
  const cycleDays = num(match.cycleDays)
  return {
    mm,
    crop: typeof match.name === "string" && match.name.trim() ? match.name.trim() : "This crop",
    cycleDays: cycleDays !== null && cycleDays > 0 ? cycleDays : 120,
    startMonth: seasonStartMonth(Array.isArray(match.plantingMonths) ? match.plantingMonths : []),
  }
}

/** The same need, read straight off the bundled envelope for an unmatched crop. */
function needFromEnvelope(crop: string, parcel: Parcel): SeasonNeed | null {
  const envelope: CropEnvelope | undefined = ECOCROP.find((candidate) => sameCrop(candidate.name, crop))
  if (!envelope) return null
  const mm = num(envelope.waterNeedMm)
  if (mm === null || mm <= 0) return null

  const climate = parcel.analysis?.climate ?? null
  // Latitude only decides the hemisphere's midwinter fallback inside
  // `plantingMonthsFor`; the equator is the harmless default when the parcel
  // has no geometry to read it off.
  const latitude = num(parcel.analysis?.geometry?.centroid?.[0]) ?? 0
  let months: number[] = []
  try {
    months = plantingMonthsFor(envelope, climate, latitude)
  } catch {
    months = []
  }

  return {
    mm,
    crop: envelope.name,
    cycleDays: envelope.cycleDays > 0 ? envelope.cycleDays : 120,
    startMonth: seasonStartMonth(months),
  }
}

/**
 * Where the planting window actually BEGINS, 1–12.
 *
 * `plantingMonths` is in ascending calendar order, so a November-sown cereal
 * comes back as [1, 2, 11, 12] and the first element is January — the middle of
 * its own window. Walking the monthly rain forward from there understates
 * in-season rain by about a third in a winter-rain climate, which lands
 * straight in the deficit the water card prints. The season starts after the
 * largest gap between consecutive months, read round the year.
 */
function seasonStartMonth(months: number[]): number | null {
  const valid = [...new Set(months.map(num).filter((m): m is number => m !== null && m >= 1 && m <= 12))].sort(
    (a, b) => a - b,
  )
  if (valid.length === 0) return null
  if (valid.length >= 12) return valid[0]

  let start = valid[0]
  let widest = -1
  for (let i = 0; i < valid.length; i++) {
    const previous = valid[(i - 1 + valid.length) % valid.length]
    const gap = ((valid[i] - previous + 12) % 12) || 12
    if (gap > widest) {
      widest = gap
      start = valid[i]
    }
  }
  return start
}

/**
 * Rain that falls while the crop is in the ground.
 *
 * Annual rainfall flatters a summer crop in a winter-rain climate, so walk the
 * monthly normals forward from the planting month instead.
 *
 * The two fallbacks are deliberately different, and conflating them was worth a
 * whole card's worth of wrong advice. With NO MONTHLY SERIES the annual total is
 * all there is. With no START MONTH — the crop's planting window came back empty
 * — the months are known but not which ones, so the answer is the cycle's share
 * of the year, never the full twelve months. Handing a 110-day crop a year of
 * rain turned a 3 300 m³ deficit into a printed surplus.
 */
function seasonRainMm(climate: ClimateNormals, cycleDays: number, startMonth: number | null): number {
  const annual = num(climate.annualRainMm) ?? 0
  const monthly = Array.isArray(climate.monthly) ? climate.monthly : []
  const months = clamp(Math.round(cycleDays / 30), 1, 12)
  if (monthly.length === 0) return annual
  if (startMonth === null) return (annual * months) / 12

  const start = clamp(Math.round(startMonth), 1, 12)
  let total = 0
  for (let step = 0; step < months; step++) {
    const month = ((start - 1 + step) % 12) + 1
    const row = monthly.find((entry) => entry.month === month)
    total += num(row?.rainMm) ?? annual / 12
  }
  return total
}

/** The factor doing most of the work in a match, as its own sentence. */
function leadFactor(match: CropMatch): string | null {
  const factors = Array.isArray(match.factors) ? match.factors : []
  const lead = [...factors]
    .filter((factor) => typeof factor.note === "string" && factor.note.trim())
    .sort((a, b) => (num(b.weight) ?? 0) * (num(b.score) ?? 0) - (num(a.weight) ?? 0) * (num(a.score) ?? 0))[0]
  return lead ? lead.note.trim() : null
}

/* ── Split maths ─────────────────────────────────────────────── */

/**
 * `splitPolygon` on a self-touching or near-degenerate ring can throw or hand
 * back slivers. A preview the farmer cannot act on is worse than no card, so
 * anything unexpected drops the whole recommendation.
 */
function previewFor(ring: LatLng[], blocks: number): LatLng[][] | null {
  let cut: LatLng[][]
  try {
    cut = splitPolygon(ring, blocks)
  } catch {
    return null
  }
  if (!Array.isArray(cut) || cut.length !== blocks) return null
  for (const block of cut) {
    if (!ringOf(block)) return null
  }
  return cut
}

/**
 * One reason, chosen by what this parcel's data supports. A reason that could
 * be written about any field is a reason the farmer scrolls past.
 */
function splitReason(parcel: Parcel, blocks: number, areaHa: number): string {
  const planned = plannedCrop(parcel)
  if (planned && isRotationWarning(planned.warn)) {
    return `${planned.crop} is already flagged as a repeat here. In ${blocks} blocks you rest one block at a time, so the same family never holds all ${ha(areaHa)} two seasons running.`
  }

  const source = parcel.waterSource
  if (source && source !== "rainfed") {
    return `${ha(areaHa / blocks)} is one ${SEASON_DELIVERY[source].label} set, so the pump fills a block at a time instead of being asked to cover ${ha(areaHa)} at once.`
  }

  return `Plant the ${blocks} blocks a week apart and the harvest comes in over ${blocks} weeks instead of one impossible week of picking and hauling.`
}

/** "3 blocks of 1.6 ha", or the range when the cut came out uneven. */
function blockSizes(preview: LatLng[][], blocks: number, areaHa: number): string {
  const areas: number[] = []
  for (const block of preview) {
    try {
      const measured = num(polygonAreaHa(block))
      if (measured !== null && measured > 0) areas.push(measured)
    } catch {
      // Fall through to the even share below.
    }
  }
  // The measured blocks are only trusted when they add up to the area the rest
  // of the card is talking about. A stale stored `areaHa` would otherwise print
  // "6 blocks of 67.5 ha" under a sentence that says 4.8 ha, and the farmer
  // believes neither number.
  const measured = areas.reduce((sum, value) => sum + value, 0)
  if (areas.length !== blocks || Math.abs(measured - areaHa) > areaHa * 0.1) {
    return `${blocks} blocks of ${ha(areaHa / blocks)}`
  }

  const min = Math.min(...areas)
  const max = Math.max(...areas)
  if (max - min <= max * 0.1) {
    const mean = areas.reduce((sum, value) => sum + value, 0) / areas.length
    return `${blocks} blocks of ${ha(mean)}`
  }
  return `${blocks} blocks, ${min.toFixed(1)}–${ha(max)}`
}

/* ── Formatting ──────────────────────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function ha(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)} ha`
}

function m3(value: number): string {
  return `${fmt(Number.isFinite(value) ? value : 0)} m³`
}

/** Depths, for the rainfed branch — the only honest unit for water that falls. */
function mm(value: number): string {
  return `${fmt(Number.isFinite(value) ? value : 0)} mm`
}

function titleCase(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function list(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/**
 * "on Thursday" from an ISO date. Midday UTC because a bare date parses as
 * midnight UTC, which is the previous evening west of Greenwich — and naming
 * the wrong day sends someone to the field on the wrong day.
 */
function when(date: unknown): string {
  if (typeof date !== "string" || date.length < 10) return "in the next few days"
  const parsed = new Date(date.includes("T") ? date : `${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return "in the next few days"
  return `on ${parsed.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`
}
