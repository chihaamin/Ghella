/**
 * Polygon maths for farm parcels.
 *
 * Parcels here are 0.1–50 ha — a few hundred metres across at most — so every
 * areal calculation runs in a local equirectangular projection about the
 * parcel's own centre rather than in full geodesy. Over that span the only
 * error term that matters is the drift in cos(latitude), which changes by
 * ~1e-5 across a kilometre of latitude: four orders of magnitude below the
 * 0.5% the hectare figure needs, and far below the noise in a finger-traced
 * outline. Distances still use haversine, because perimeters sum many short
 * legs and their errors would accumulate.
 *
 * Two invariants every measure below shares, both enforced by `usableRing`:
 *
 * · NON-FINITE VERTICES ARE DROPPED ONCE, up front, so area, perimeter,
 *   centroid and bbox all describe the same ring. One bad GPS fix used to make
 *   them disagree — area 0, a real-looking perimeter and a NaN centroid that
 *   went on to be sent to the weather API as `latitude=NaN`.
 *
 * · LONGITUDES ARE UNWRAPPED against the first vertex before any longitude
 *   arithmetic. `destinationPoint` folds its answer back into [-180, 180), so a
 *   parcel on the 180th meridian (Fiji, Chukotka, Kiribati) comes out with
 *   vertices on both sides; taking a raw mean of those puts the projection
 *   origin 20 000 km away and the hectare figure out by five orders of
 *   magnitude. Unwrapping first makes the ring continuous; `unproject` folds
 *   the answer back at the very end.
 */

import type { BBox, Geometry, LatLng } from "@/types/land"

/** Mean Earth radius (IUGG), metres. Every projection in this file uses it. */
const EARTH_R_M = 6371008.8

const DEG = Math.PI / 180

/** A point in the local metric frame: `[east, north]` metres from an origin. */
type Vec2 = [number, number]

/* ── Distances ───────────────────────────────────────────────── */

/**
 * Great-circle distance between two points, metres.
 *
 * Returns 0 rather than NaN on non-finite input: a bad GPS fix should show up
 * as a zero-length leg, never poison a whole perimeter downstream.
 */
export function haversineM(a: LatLng, b: LatLng): number {
  const lat1 = a[0] * DEG
  const lat2 = b[0] * DEG
  const dLat = (b[0] - a[0]) * DEG
  const dLon = (b[1] - a[1]) * DEG
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const d = 2 * EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(h)))
  return Number.isFinite(d) ? d : 0
}

/**
 * The point `distanceM` away from `from` along the compass bearing
 * `bearingDeg` (0 = north, 90 = east), on the sphere.
 *
 * Spherical rather than planar so the corners of a seeded rectangle stay true
 * at high latitudes, where a naive `dLon = dx / R` would stretch noticeably.
 */
export function destinationPoint(from: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const d = distanceM / EARTH_R_M
  const brg = bearingDeg * DEG
  const lat1 = from[0] * DEG
  const lon1 = from[1] * DEG
  const sinLat2 = clamp(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg),
    -1,
    1,
  )
  const lat2 = Math.asin(sinLat2)
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * sinLat2,
    )
  return [lat2 / DEG, wrapLon(lon2 / DEG)]
}

/* ── Polygon measures ────────────────────────────────────────── */

/**
 * Parcel area, hectares. Fewer than 3 points has no area, so 0.
 *
 * Shoelace in the local metric frame. The projection origin is the vertex mean
 * rather than the true area centroid, which would be circular — and the choice
 * is immaterial, since shifting the origin inside the parcel only re-scales x
 * by the cos(lat) drift described at the top of this file.
 */
export function polygonAreaHa(points: LatLng[]): number {
  const ring = usableRing(points)
  if (ring.length < 3) return 0
  const origin = vertexMean(ring)
  const m2 = Math.abs(shoelaceM2(ring.map((p) => project(p, origin))))
  return Number.isFinite(m2) ? m2 / 10000 : 0
}

/**
 * Perimeter of the closed ring, metres. Rings are stored open (the last point
 * is not a repeat of the first), so the closing leg is added explicitly; an
 * already-closed ring still measures correctly because that leg is zero-length.
 */
export function polygonPerimeterM(points: LatLng[]): number {
  const ring = usableRing(points)
  if (ring.length < 2) return 0
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    sum += haversineM(ring[i], ring[(i + 1) % ring.length])
  }
  return sum
}

/**
 * The AREA centroid — the parcel's balance point, not the average of its
 * vertices. The difference is large for outlines traced with many clicks along
 * one edge and few along another, which is exactly how people draw fields.
 *
 * Falls back to the vertex mean when the ring has no area (collinear points, a
 * doubled-back trace), and handles 0–2 points without dividing by zero.
 *
 * The result is always finite. Every downstream fetch keys off this pair, so a
 * NaN here would go out on the wire as `latitude=NaN` and come back as a
 * confident-looking answer about nowhere.
 */
export function polygonCentroid(points: LatLng[]): LatLng {
  const clean = usableRing(points)
  if (clean.length === 0) return [0, 0]
  if (clean.length === 1) return wrapPoint(clean[0])
  const mean = vertexMean(clean)
  if (clean.length === 2) return wrapPoint(mean)
  const ring = clean.map((p) => project(p, mean))
  const a = shoelaceM2(ring)
  if (!Number.isFinite(a) || Math.abs(a) < 1e-9) return wrapPoint(mean)
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    const cross = p[0] * q[1] - q[0] * p[1]
    cx += (p[0] + q[0]) * cross
    cy += (p[1] + q[1]) * cross
  }
  const centre = unproject([cx / (6 * a), cy / (6 * a)], mean)
  return Number.isFinite(centre[0]) && Number.isFinite(centre[1]) ? centre : wrapPoint(mean)
}

/**
 * Bounding box as `[south, west, north, east]`. Empty input gives all zeros.
 *
 * `west <= east` always holds, even on a parcel that straddles the antimeridian
 * — in that case `east` runs past 180 rather than folding back to a negative,
 * which is what Leaflet's own bounds expect and the only form in which the box
 * describes a few hundred metres rather than the whole planet.
 */
export function polygonBBox(points: LatLng[]): BBox {
  const ring = usableRing(points)
  if (ring.length === 0) return [0, 0, 0, 0]
  let south = ring[0][0]
  let north = ring[0][0]
  let west = ring[0][1]
  let east = ring[0][1]
  for (const [lat, lng] of ring) {
    if (lat < south) south = lat
    if (lat > north) north = lat
    if (lng < west) west = lng
    if (lng > east) east = lng
  }
  return [south, west, north, east]
}

/**
 * Everything the rest of the app needs to know about a ring, in one pass.
 *
 * `points` comes back CLEANED — non-finite vertices removed — so the four
 * measures beside it and the outline the map draws are the same shape. Handing
 * back the raw input would let a stored parcel render one polygon and report
 * another's hectares.
 */
export function buildGeometry(points: LatLng[]): Geometry {
  const clean = finitePoints(points)
  return {
    points: clean,
    areaHa: polygonAreaHa(clean),
    perimeterM: polygonPerimeterM(clean),
    centroid: polygonCentroid(clean),
    bbox: polygonBBox(clean),
  }
}

/**
 * Ray casting: is `point` inside `polygon`?
 *
 * Runs on lat/lng rather than metres. Projecting first would change nothing at
 * parcel scale — the projection is affine here, and containment survives an
 * affine map — but the longitudes still have to be unwrapped, and the test
 * point unwrapped against the SAME reference, or a parcel on the antimeridian
 * would report a point 360° away as inside it.
 */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  const ring = usableRing(polygon)
  if (ring.length < 3 || !isFinitePoint(point)) return false
  const ref = ring[0][1]
  const lat = point[0]
  const lng = ref + wrapLon(point[1] - ref)
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i]
    const [latJ, lngJ] = ring[j]
    const straddles = latI > lat !== latJ > lat
    if (straddles && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) {
      inside = !inside
    }
  }
  return inside
}

/* ── Construction ────────────────────────────────────────────── */

/**
 * A 4-corner ring `widthM` across by `heightM` along, centred on `center` and
 * rotated to `bearingDeg`. Used to seed demo parcels around the farmer.
 *
 * Corners are placed with `destinationPoint` rather than by adding degrees, so
 * a 100 m side is 100 m at the equator and at 60° N alike. Order is
 * back-left → back-right → front-right → front-left relative to the bearing.
 */
export function rectanglePolygon(
  center: LatLng,
  widthM: number,
  heightM: number,
  bearingDeg = 0,
): LatLng[] {
  const w = widthM / 2
  const h = heightM / 2
  const offsets: Vec2[] = [
    [-w, h],
    [w, h],
    [w, -h],
    [-w, -h],
  ]
  return offsets.map(([dx, dy]) => {
    // atan2(east, north) is the compass bearing of the offset itself; adding
    // the parcel bearing rotates the whole rectangle about its centre.
    const brg = bearingDeg + Math.atan2(dx, dy) / DEG
    return destinationPoint(center, brg, Math.hypot(dx, dy))
  })
}

/**
 * The 5-point elevation stencil: `[center, north, east, south, west]`, the
 * outer four at `radiusM` from the centre.
 *
 * THE ORDER IS THE CONTRACT. Slope is read straight off these indices as a
 * north−south and an east−west difference, so a caller that reorders them gets
 * a slope pointing the wrong way with no error to show for it.
 */
export function samplePointsAround(center: LatLng, radiusM: number): LatLng[] {
  return [
    center,
    destinationPoint(center, 0, radiusM),
    destinationPoint(center, 90, radiusM),
    destinationPoint(center, 180, radiusM),
    destinationPoint(center, 270, radiusM),
  ]
}

/* ── Splitting ───────────────────────────────────────────────── */

/**
 * Divide a parcel into `blocks` roughly equal-AREA strips, cut perpendicular
 * to its longest axis.
 *
 * Cutting across the long axis is what makes the result workable: cutting
 * along it would hand the farmer `blocks` slivers the width of a tractor.
 *
 * Returns `[points]` unchanged for `blocks < 2` or a degenerate outline — the
 * callers render the result directly, so an empty array would blank the map.
 */
export function splitPolygon(points: LatLng[], blocks: number): LatLng[][] {
  const n = Math.floor(blocks)
  const clean = usableRing(points)
  if (!Number.isFinite(n) || n < 2 || clean.length < 3) return [points]

  const origin = vertexMean(clean)
  const ring = clean.map((p) => project(p, origin))
  const totalM2 = Math.abs(shoelaceM2(ring))
  // Under a square metre there is nothing to divide, and the bisection below
  // would be chasing floating-point dust.
  if (!Number.isFinite(totalM2) || totalM2 < 1) return [points]

  const axis = longestAxis(ring)
  const along = (v: Vec2) => v[0] * axis[0] + v[1] * axis[1]

  let lo = Infinity
  let hi = -Infinity
  for (const v of ring) {
    const t = along(v)
    if (t < lo) lo = t
    if (t > hi) hi = t
  }

  // Cuts are found by bisecting on area, not by dividing the span evenly:
  // in anything that is not a rectangle the area accrues non-linearly along
  // the axis, and the farmer wants equal work per block, not equal width.
  const cuts: number[] = [lo]
  for (let i = 1; i < n; i++) cuts.push(cutAtArea(ring, along, lo, hi, (i / n) * totalM2))
  cuts.push(hi)

  const out: LatLng[][] = []
  for (let i = 0; i < n; i++) {
    const near = cuts[i]
    const far = cuts[i + 1]
    const strip = clipHalfPlane(
      clipHalfPlane(ring, (v) => along(v) - near),
      (v) => far - along(v),
    )
    const cleaned = dedupe(strip)
    if (cleaned.length >= 3) out.push(cleaned.map((v) => unproject(v, origin)))
  }
  // A self-intersecting outline can clip down to nothing; better one honest
  // block than a screenful of empty ones.
  return out.length >= 2 ? out : [points]
}

/* ── Internals ───────────────────────────────────────────────── */

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n
}

/**
 * Fold a longitude back into [-180, 180).
 *
 * Correct for any input in [-540, 540], which covers both an absolute longitude
 * and the difference between two of them — the only two things it is asked.
 */
function wrapLon(lon: number): number {
  return ((lon + 540) % 360) - 180
}

/** A point with both halves finite; anything else came from a bad fix. */
function isFinitePoint(p: LatLng): boolean {
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
}

/** The vertices we can actually measure. Order is preserved. */
function finitePoints(points: LatLng[]): LatLng[] {
  return Array.isArray(points) ? points.filter(isFinitePoint) : []
}

/**
 * The ring every measure works on: finite vertices only, with longitudes made
 * continuous relative to the first one.
 *
 * Unwrapping can push a longitude past ±180 — that is the point. Inside this
 * file longitude is an ordinary number line; `unproject` and `wrapPoint` are
 * the only places it becomes a compass reading again.
 */
function usableRing(points: LatLng[]): LatLng[] {
  const clean = finitePoints(points)
  if (clean.length === 0) return clean
  const ref = clean[0][1]
  return clean.map(([lat, lng]) => [lat, ref + wrapLon(lng - ref)] as LatLng)
}

/** Fold a point's longitude back into [-180, 180) on the way out. */
function wrapPoint(p: LatLng): LatLng {
  return [p[0], wrapLon(p[1])]
}

/** Plain mean of the vertices. Callers must pass at least one point. */
function vertexMean(points: LatLng[]): LatLng {
  let lat = 0
  let lng = 0
  for (const p of points) {
    lat += p[0]
    lng += p[1]
  }
  return [lat / points.length, lng / points.length]
}

/** Lat/lng → local metres east/north of `origin`. */
function project(p: LatLng, origin: LatLng): Vec2 {
  const kx = Math.cos(origin[0] * DEG)
  return [EARTH_R_M * (p[1] - origin[1]) * DEG * kx, EARTH_R_M * (p[0] - origin[0]) * DEG]
}

/**
 * The inverse of `project`, about the same origin.
 *
 * This is where longitude stops being a number line and becomes a compass
 * reading again: the origin may sit past ±180 after unwrapping, so the answer
 * is folded back before it leaves the module.
 */
function unproject(v: Vec2, origin: LatLng): LatLng {
  // Guarded because cos(lat) collapses at the poles; nobody farms there, but a
  // divide-by-zero would still hand the UI a NaN marker.
  const kx = Math.max(Math.cos(origin[0] * DEG), 1e-9)
  return [
    origin[0] + v[1] / (EARTH_R_M * DEG),
    wrapLon(origin[1] + v[0] / (EARTH_R_M * DEG * kx)),
  ]
}

/** Signed shoelace area of a ring in the metric frame, m². */
function shoelaceM2(ring: Vec2[]): number {
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return sum / 2
}

/**
 * Unit vector along the parcel's long axis, in the metric frame.
 *
 * Method: rotate the ring through 1° steps over a quarter turn and keep the
 * rotation whose axis-aligned bounding box has the smallest area — the classic
 * minimum-area rectangle — then take that rectangle's longer side. Sampling
 * beats the bbox-diagonal shortcut on L-shaped and skewed parcels, where the
 * diagonal points at nothing in particular, and 1° costs a few hundred
 * multiplies. Ties keep the earlier angle, so a square stays axis-aligned
 * instead of being sliced corner to corner.
 */
function longestAxis(ring: Vec2[]): Vec2 {
  let best: Vec2 = [1, 0]
  let bestArea = Infinity
  for (let deg = 0; deg < 90; deg++) {
    const t = deg * DEG
    const ct = Math.cos(t)
    const st = Math.sin(t)
    let uLo = Infinity
    let uHi = -Infinity
    let vLo = Infinity
    let vHi = -Infinity
    for (const p of ring) {
      const u = p[0] * ct + p[1] * st
      const v = -p[0] * st + p[1] * ct
      if (u < uLo) uLo = u
      if (u > uHi) uHi = u
      if (v < vLo) vLo = v
      if (v > vHi) vHi = v
    }
    const w = uHi - uLo
    const h = vHi - vLo
    const area = w * h
    if (area < bestArea - 1e-9) {
      bestArea = area
      best = w >= h ? [ct, st] : [-st, ct]
    }
  }
  return best
}

/**
 * Bisect for the axis position where the part of `ring` behind the cut holds
 * `targetM2`. Area behind a sweeping parallel line is monotone in position, so
 * plain bisection converges without needing an analytic solution; 40 halvings
 * pin a kilometre-wide parcel to a nanometre.
 */
function cutAtArea(
  ring: Vec2[],
  along: (v: Vec2) => number,
  lo: number,
  hi: number,
  targetM2: number,
): number {
  let a = lo
  let b = hi
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2
    const behind = Math.abs(shoelaceM2(clipHalfPlane(ring, (v) => mid - along(v))))
    if (behind < targetM2) a = mid
    else b = mid
  }
  return (a + b) / 2
}

/**
 * Sutherland–Hodgman clip of a ring against one half-plane, kept where
 * `keep(v) >= 0`. Two of these back to back carve out the strip between a pair
 * of parallel cuts. Concave parcels can come back with zero-width bridges along
 * the cut line; they carry no area, so measurements are unaffected.
 */
function clipHalfPlane(ring: Vec2[], keep: (v: Vec2) => number): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i]
    const prev = ring[(i + ring.length - 1) % ring.length]
    const dCur = keep(cur)
    const dPrev = keep(prev)
    if (dCur >= 0) {
      if (dPrev < 0) out.push(crossing(prev, cur, dPrev, dCur))
      out.push(cur)
    } else if (dPrev >= 0) {
      out.push(crossing(prev, cur, dPrev, dCur))
    }
  }
  return out
}

/** Where segment a→b crosses the clip line, from the signed distances at each end. */
function crossing(a: Vec2, b: Vec2, dA: number, dB: number): Vec2 {
  // Only called when dA and dB straddle zero, so the denominator cannot vanish.
  const t = dA / (dA - dB)
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
}

/** Drop the sub-millimetre duplicates a clip leaves behind, including the wrap. */
function dedupe(ring: Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of ring) {
    if (out.length > 0 && sameSpot(out[out.length - 1], p)) continue
    out.push(p)
  }
  if (out.length > 1 && sameSpot(out[0], out[out.length - 1])) out.pop()
  return out
}

function sameSpot(a: Vec2, b: Vec2): boolean {
  return Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3
}
