import L from "leaflet"
import { useEffect, useImperativeHandle, useRef, type Ref } from "react"

import { MAP_START, MAX_PARCEL_POINTS } from "@/data/onboarding"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { useApp, type LatLng } from "@/store/app-store"

const TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

export interface ParcelMapHandle {
  /** Adopt the dashed boundary the satellite read suggested. */
  useDetected: () => void
}

/**
 * Satellite parcel drawing. Tapping the imagery drops a corner; corners are
 * draggable. Points live in a ref while the user is dragging and are pushed to
 * the store on commit, so a 60 fps drag never re-renders the screen.
 */
export function ParcelMap({ ref }: { ref?: Ref<ParcelMapHandle> }) {
  const { t } = useT()
  const setPts = useApp((s) => s.setPts)
  const setState = useApp((s) => s.set)
  const pts = useApp((s) => s.pts)
  const mapCenterTxt = useApp((s) => s.mapCenterTxt)

  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const polyRef = useRef<L.Polygon | null>(null)
  const marksRef = useRef<L.LayerGroup | null>(null)
  const ptsRef = useRef<LatLng[]>([])
  const suggestRef = useRef<LatLng[]>([])
  const draggingRef = useRef(false)

  useImperativeHandle(ref, () => ({
    useDetected: () => {
      if (!mapRef.current) return
      ptsRef.current = suggestRef.current.slice()
      redraw()
      setPts(ptsRef.current.slice())
    },
  }))

  function redraw() {
    const map = mapRef.current
    if (!map || !polyRef.current || !marksRef.current) return

    polyRef.current.setLatLngs(ptsRef.current)
    marksRef.current.clearLayers()

    ptsRef.current.forEach((p, i) => {
      const marker = L.marker(p, {
        draggable: true,
        icon: L.divIcon({
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${C.surface};border:4px solid ${C.leafBright};box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        }),
      }).addTo(marksRef.current!)

      marker.on("dragstart", () => {
        draggingRef.current = true
      })
      marker.on("drag", (e) => {
        const ll = (e.target as L.Marker).getLatLng()
        ptsRef.current[i] = [ll.lat, ll.lng]
        polyRef.current?.setLatLngs(ptsRef.current)
      })
      marker.on("dragend", () => {
        setPts(ptsRef.current.slice())
        // Let the map's click handler see the drag before it re-arms.
        setTimeout(() => {
          draggingRef.current = false
        }, 80)
      })
    })
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) return

    const map = L.map(host, {
      center: MAP_START,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    })
    L.tileLayer(TILES, { maxZoom: 19 }).addTo(map)
    L.control.zoom({ position: "bottomright" }).addTo(map)
    L.control
      .attribution({ prefix: false, position: "bottomleft" })
      .addAttribution("Esri World Imagery")
      .addTo(map)

    const c = map.getCenter()
    const d = 0.0011
    const d2 = 0.0016
    suggestRef.current = [
      [c.lat + d, c.lng - d2],
      [c.lat + d * 0.9, c.lng + d2],
      [c.lat - d, c.lng + d2 * 0.85],
      [c.lat - d * 0.8, c.lng - d2],
    ]
    L.polygon(suggestRef.current, {
      color: C.leafLight,
      weight: 2,
      dashArray: "6 6",
      fill: false,
    }).addTo(map)

    polyRef.current = L.polygon([], {
      color: C.leafLight,
      weight: 3,
      fillColor: C.leafLight,
      fillOpacity: 0.3,
    }).addTo(map)
    marksRef.current = L.layerGroup().addTo(map)

    map.on("click", (e) => {
      if (draggingRef.current || ptsRef.current.length >= MAX_PARCEL_POINTS) return
      ptsRef.current.push([e.latlng.lat, e.latlng.lng])
      redraw()
      setPts(ptsRef.current.slice())
    })

    map.on("moveend", () => {
      const cc = map.getCenter()
      const lat = `${Math.abs(cc.lat).toFixed(4)}°${cc.lat >= 0 ? "N" : "S"}`
      const lng = `${Math.abs(cc.lng).toFixed(4)}°${cc.lng >= 0 ? "E" : "W"}`
      setState({ mapCenterTxt: `SAT · ${lat} ${lng}` })
    })

    mapRef.current = map
    map.fire("moveend")
    // The frame animates in; size it once the layout has settled.
    const settle = setTimeout(() => map.invalidateSize(), 60)

    return () => {
      clearTimeout(settle)
      map.remove()
      mapRef.current = null
      polyRef.current = null
      marksRef.current = null
      ptsRef.current = []
    }
  }, [setPts, setState])

  // The screen can clear the outline from outside (Reset, or re-entering onboarding).
  useEffect(() => {
    if (pts.length === 0 && ptsRef.current.length > 0) {
      ptsRef.current = []
      redraw()
    }
  }, [pts])

  const hint = pts.length >= 3 ? t.obHintGo : t.obHintTap

  return (
    <div className="gh-map relative overflow-hidden rounded-[14px] border border-line-strong bg-[#2c3522]">
      <div ref={hostRef} className="h-[330px] cursor-crosshair" />

      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-600 flex justify-between">
        <span className="rounded-[7px] bg-ink/85 px-[9px] py-1 font-mono text-[10px] font-bold text-cream">
          {mapCenterTxt}
        </span>
        <div className="flex items-center gap-1.5">
          {pts.length > 0 && (
            <button
              type="button"
              onClick={() => useApp.getState().resetPts()}
              className="pointer-events-auto cursor-pointer rounded-[7px] bg-ink/85 px-[9px] py-1 font-mono text-[10px] font-bold text-clay-light"
            >
              ↺ RESET
            </button>
          )}
          <span className="rounded-[7px] bg-ink/85 px-[9px] py-1 font-mono text-[10px] font-bold text-leaf-light">
            {pts.length} PTS
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-14 z-600 text-center">
        <span className="rounded-[7px] bg-ink/85 px-2.5 py-1 font-mono text-[10px] font-bold text-leaf-soft">
          {hint}
        </span>
      </div>
    </div>
  )
}
