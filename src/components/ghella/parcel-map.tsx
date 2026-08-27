import L from "leaflet"
import { useEffect, useRef } from "react"

import { MAP_START } from "@/data/onboarding"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { useApp, type LatLng } from "@/store/app-store"

const TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

/**
 * Satellite parcel drawing. Tapping the imagery drops a corner (as many as the
 * field needs); corners are draggable. Points live in a ref while the user is
 * dragging and are pushed to the store on commit, so a 60 fps drag never
 * re-renders the screen. When the device reports a position it becomes the map
 * centre — immediately if the fix beat the map, or with one setView when it
 * arrives late; after that the farmer's panning is never hijacked.
 */
export function ParcelMap() {
  const { t } = useT()
  const setPts = useApp((s) => s.setPts)
  const setState = useApp((s) => s.set)
  const pts = useApp((s) => s.pts)
  const locatedAt = useApp((s) => s.locatedAt)
  const mapCenterTxt = useApp((s) => s.mapCenterTxt)

  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const polyRef = useRef<L.Polygon | null>(null)
  const marksRef = useRef<L.LayerGroup | null>(null)
  const hereRef = useRef<L.Marker | null>(null)
  const ptsRef = useRef<LatLng[]>([])
  const draggingRef = useRef(false)
  const centeredOnFixRef = useRef(false)

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

    // If the geolocation fix already resolved, open straight on it.
    const start = useApp.getState().locatedAt
    centeredOnFixRef.current = start !== null

    const map = L.map(host, {
      center: start ?? MAP_START,
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

    polyRef.current = L.polygon([], {
      color: C.leafLight,
      weight: 3,
      fillColor: C.leafLight,
      fillOpacity: 0.3,
    }).addTo(map)
    marksRef.current = L.layerGroup().addTo(map)

    map.on("click", (e) => {
      if (draggingRef.current) return
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
      hereRef.current = null
      ptsRef.current = []
    }
  }, [setPts, setState])

  // The device fix: recentre once when it arrives, and keep a "you are here"
  // dot on it so the farmer can find their way back after panning.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !locatedAt) return

    if (!centeredOnFixRef.current) {
      centeredOnFixRef.current = true
      map.setView(locatedAt, 16)
    }

    if (hereRef.current) {
      hereRef.current.setLatLng(locatedAt)
    } else {
      hereRef.current = L.marker(locatedAt, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${C.water};border:3px solid #fff;box-shadow:0 0 0 4px rgba(31,127,184,.25),0 1px 4px rgba(0,0,0,.4)"></div>`,
        }),
      }).addTo(map)
    }
  }, [locatedAt])

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
