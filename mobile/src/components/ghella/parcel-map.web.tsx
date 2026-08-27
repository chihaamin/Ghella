// Metro's web bundler inlines the stylesheet; tsc has no CSS module resolver.
// @ts-ignore
import "leaflet/dist/leaflet.css"

import L from "leaflet"
import { useEffect, useRef } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { MAP_START } from "@/data/onboarding"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { useApp, type LatLng } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

import type { ParcelMapProps } from "./parcel-map.types"

const TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

/** `bg-ink/85` — C.ink (#1f2416) at 85%. */
const INK_85 = "rgba(31, 36, 22, 0.85)"

/**
 * Satellite parcel drawing. Tapping the imagery drops a corner (as many as the
 * field needs); corners are draggable. Points live in a ref while the user is
 * dragging and are pushed to the store on commit, so a 60 fps drag never
 * re-renders the screen. When the device reports a position it becomes the map
 * centre — immediately if the fix beat the map, or with one setView when it
 * arrives late; after that the farmer's panning is never hijacked.
 */
export function ParcelMap(_props: ParcelMapProps) {
  const { t, isRtl } = useT()
  const ff = useFF()
  const setPts = useApp((s) => s.setPts)
  const setState = useApp((s) => s.set)
  const pts = useApp((s) => s.pts)
  const locatedAt = useApp((s) => s.locatedAt)
  const mapCenterTxt = useApp((s) => s.mapCenterTxt)

  // On react-native-web a View's ref IS the underlying HTMLElement.
  const hostRef = useRef<View | null>(null)
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
    const host = hostRef.current as unknown as HTMLElement | null
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
    // The web original's `.gh-map` stylesheet: dark ground under the tiles,
    // crosshair cursor, mono 9px attribution.
    const container = map.getContainer()
    container.style.background = "#2c3522"
    container.style.cursor = "crosshair"

    L.tileLayer(TILES, { maxZoom: 19 }).addTo(map)
    L.control.zoom({ position: "bottomright" }).addTo(map)
    const attribution = L.control.attribution({
      prefix: false,
      position: "bottomleft",
    })
    attribution.addAttribution("Esri World Imagery").addTo(map)
    const attEl = attribution.getContainer()
    if (attEl) {
      attEl.style.fontFamily = "SpaceMono_400Regular, monospace"
      attEl.style.fontSize = "9px"
    }

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
  const row = { flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const) }
  const monoTxt = { fontFamily: ff.mono.bold, fontSize: 10 }

  return (
    <View style={styles.frame}>
      <View ref={hostRef} style={styles.host} />

      <View pointerEvents="box-none" style={[styles.hudTop, row]}>
        <View pointerEvents="none" style={styles.chip}>
          <Text style={[monoTxt, { color: C.cream }]}>{mapCenterTxt}</Text>
        </View>
        <View pointerEvents="box-none" style={[styles.hudRight, row]}>
          {pts.length > 0 && (
            <Pressable
              onPress={() => useApp.getState().resetPts()}
              style={styles.chip}
            >
              <Text style={[monoTxt, { color: C.clayLight }]}>↺ RESET</Text>
            </Pressable>
          )}
          <View pointerEvents="none" style={styles.chip}>
            <Text style={[monoTxt, { color: C.leafLight }]}>{pts.length} PTS</Text>
          </View>
        </View>
      </View>

      <View pointerEvents="none" style={styles.hudBottom}>
        <View style={[styles.chip, styles.chipHint]}>
          <Text style={[monoTxt, { color: C.leafSoft }]}>{hint}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: "#2c3522",
  },
  host: { height: 330 },
  hudTop: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 600,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hudRight: { alignItems: "center", gap: 6 },
  hudBottom: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 56,
    zIndex: 600,
    alignItems: "center",
  },
  chip: {
    borderRadius: 7,
    backgroundColor: INK_85,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipHint: { paddingHorizontal: 10 },
})
