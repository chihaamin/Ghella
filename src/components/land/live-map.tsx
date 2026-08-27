import L from "leaflet"
import { useEffect, useRef, type JSX } from "react"

import { useT } from "@/i18n/use-t"
import { polygonAreaHa, polygonCentroid } from "@/lib/geo"
import { cn } from "@/lib/utils"
import type { LatLng, Parcel } from "@/types/land"

const TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

/** Mid-Mediterranean, whole-country view — where the map rests with no land. */
const NEUTRAL_CENTER: LatLng = [34, 9]
const NEUTRAL_ZOOM = 5

/**
 * A proposed division of one parcel, drawn dashed on top of it while the
 * farmer decides. `rings` come straight from `splitPolygon`.
 */
export interface SplitPreview {
  parcelId: string
  rings: LatLng[][]
}

/**
 * The mono chip every centroid label wears — same recipe as the HUD chips on
 * the drawing map, inlined because Leaflet divIcons live outside React and
 * Tailwind. `translate(-50%,-50%)` centres the chip on the anchor so the icon
 * needs no measured size.
 */
const LABEL_STYLE =
  "display:inline-block;transform:translate(-50%,-50%);background:rgba(31,36,22,.82);" +
  "color:#f0e3c0;font:700 10px 'Space Mono',monospace;border-radius:7px;" +
  "padding:3px 8px;pointer-events:none;white-space:nowrap"

/** Parcel names are farmer-typed and end up in divIcon HTML — escape them. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** A non-interactive centroid chip: "North · 0.8 ha", "A · 1.6 ha". */
function labelMarker(at: LatLng, text: string): L.Marker {
  return L.marker(at, {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: "",
      iconSize: [0, 0],
      html: `<span style="${LABEL_STYLE}">${text}</span>`,
    }),
  })
}

/**
 * The live parcels map — every mapped parcel on satellite imagery, each in its
 * own colour with a name · area chip at its centroid. Tapping a polygon
 * selects it; a `splitPreview` dims the parent and overlays the proposed
 * blocks as dashed lettered rings.
 *
 * Pure props — no store, no fetching — so the same component serves the land
 * screen, the recommendation preview and any test without mocking. Leaflet
 * lifecycle mirrors `parcel-map.tsx`: the map is created once, layers live in
 * refs and are redrawn in their own effect, and `fitBounds` is keyed on a
 * fingerprint of ids + point counts so a mere re-render, a selection tap or
 * an analysis landing on a parcel never yanks the viewport.
 */
export function LiveLandMap({
  parcels,
  selectedId,
  onSelect,
  splitPreview = null,
  heightPx = 230,
  className,
}: {
  parcels: Parcel[]
  selectedId: string | null
  onSelect: (id: string) => void
  splitPreview?: SplitPreview | null
  heightPx?: number
  className?: string
}): JSX.Element {
  const { t } = useT()

  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const parcelLayerRef = useRef<L.LayerGroup | null>(null)
  const previewLayerRef = useRef<L.LayerGroup | null>(null)
  /** What the viewport currently frames — refit only when this moves. */
  const fitKeyRef = useRef<string | null>(null)

  // Latest-ref mirror so polygon click handlers — bound once per redraw —
  // always call the current callback without the redraw effect depending on
  // an inline lambda's identity.
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Create the map once. Layers are only containers here; content arrives in
  // the redraw effect below so mount and data stay independent.
  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) return

    const map = L.map(host, {
      center: NEUTRAL_CENTER,
      zoom: NEUTRAL_ZOOM,
      zoomControl: false,
      attributionControl: false,
    })
    L.tileLayer(TILES, { maxZoom: 19 }).addTo(map)
    L.control
      .attribution({ prefix: false, position: "bottomleft" })
      .addAttribution("Esri World Imagery")
      .addTo(map)

    parcelLayerRef.current = L.layerGroup().addTo(map)
    previewLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // The phone frame animates in; measure again once layout has settled.
    const settle = setTimeout(() => map.invalidateSize(), 60)

    return () => {
      clearTimeout(settle)
      map.remove()
      mapRef.current = null
      parcelLayerRef.current = null
      previewLayerRef.current = null
      fitKeyRef.current = null
    }
  }, [])

  // Redraw layers whenever the data changes. Clearing and rebuilding a couple
  // of dozen vectors is cheaper than diffing them, and never touches the
  // viewport — panning stays smooth while an analysis updates a parcel.
  useEffect(() => {
    const map = mapRef.current
    const parcelLayer = parcelLayerRef.current
    const previewLayer = previewLayerRef.current
    if (!map || !parcelLayer || !previewLayer) return

    parcelLayer.clearLayers()
    previewLayer.clearLayers()

    for (const parcel of parcels) {
      if (parcel.points.length < 3) continue
      const isParent = splitPreview?.parcelId === parcel.id
      const isSelected = parcel.id === selectedId

      const poly = L.polygon(parcel.points, {
        color: parcel.color,
        fillColor: parcel.color,
        // The split parent fades to a dashed ghost so the proposed blocks on
        // top of it read as the subject, not as clutter.
        ...(isParent
          ? { weight: 2, fillOpacity: 0.05, dashArray: "6 6" }
          : isSelected
            ? { weight: 3, fillOpacity: 0.35 }
            : { weight: 2, fillOpacity: 0.18 }),
      }).addTo(parcelLayer)
      poly.on("click", () => onSelectRef.current(parcel.id))

      // The parent's own chip would sit exactly on the cut line, under the
      // block letters — drop it while its preview is showing. And past a few
      // parcels the chips collide (six side-by-side strips overprint into
      // noise), so a crowded map labels only the selected parcel.
      const crowded = parcels.length > 4
      if (!isParent && (!crowded || isSelected)) {
        labelMarker(
          polygonCentroid(parcel.points),
          `${escapeHtml(parcel.name)} · ${parcel.areaHa.toFixed(1)} ha`,
        ).addTo(parcelLayer)
      }
    }

    if (splitPreview) {
      splitPreview.rings.forEach((ring, i) => {
        if (ring.length < 3) return
        L.polygon(ring, {
          color: "#9fdc7e",
          fillColor: "#9fdc7e",
          weight: 2.5,
          fillOpacity: 0.25,
          dashArray: "6 6",
          interactive: false,
        }).addTo(previewLayer)
        const letter = String.fromCharCode(65 + (i % 26))
        labelMarker(
          polygonCentroid(ring),
          `${letter} · ${polygonAreaHa(ring).toFixed(1)} ha`,
        ).addTo(previewLayer)
      })
    }
  }, [parcels, selectedId, splitPreview])

  // Frame the land. The effect re-runs on any parcels identity change, but
  // only actually moves the camera when the fingerprint — ids and point
  // counts — moves, so re-renders, analysis updates and selection taps can't
  // cause a fitBounds loop or fight the farmer's own panning. Selection is
  // deliberately NOT part of the key: tapping a parcel restyles it in the
  // redraw effect and must never move the camera.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const fitKey = parcels.map((p) => `${p.id}:${p.points.length}`).join("|")
    if (fitKeyRef.current === fitKey) return
    fitKeyRef.current = fitKey

    const points = parcels.flatMap((p) => p.points)
    if (points.length === 0) {
      map.setView(NEUTRAL_CENTER, NEUTRAL_ZOOM)
      return
    }
    // maxZoom stops a single tiny parcel from zooming past the imagery.
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 })
  }, [parcels])

  return (
    <div
      className={cn(
        "gh-map relative overflow-hidden rounded-[14px] border border-line-strong bg-[#2c3522]",
        className,
      )}
    >
      <div ref={hostRef} style={{ height: heightPx }} />

      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-600 text-center">
        <span className="rounded-[7px] bg-ink/85 px-2.5 py-1 font-mono text-[10px] font-bold text-leaf-soft">
          {t.ldMapHint}
        </span>
      </div>
    </div>
  )
}
