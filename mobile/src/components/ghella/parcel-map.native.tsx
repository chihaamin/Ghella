import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import MapView, {
  Marker,
  Polygon,
  type MapPressEvent,
  type MarkerDragEvent,
  type MarkerDragStartEndEvent,
  type Region,
} from "react-native-maps"

import { MAP_START } from "@/data/onboarding"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { useApp, type LatLng } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

import type { ParcelMapProps } from "./parcel-map.types"

/** The web map opens at leaflet zoom 16 — latitudeDelta ≈ 360 / 2^zoom. */
const FIELD_DELTA = 360 / 2 ** 16

/** `bg-ink/85` — C.ink (#1f2416) at 85%. */
const INK_85 = "rgba(31, 36, 22, 0.85)"

/** `SAT · 36.7078°N 119.6850°W` — the web map's moveend readout. */
function centerTxt(lat: number, lng: number) {
  const la = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`
  const lo = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`
  return `SAT · ${la} ${lo}`
}

/**
 * Satellite parcel drawing. Tapping the imagery drops a corner (as many as the
 * field needs); corners are draggable. Points live in a ref while the user is
 * dragging and are pushed to the store on commit, so a 60 fps drag never
 * re-renders the screen — only this component repaints, via a local tick.
 * When the device reports a position it becomes the map centre — immediately
 * if the fix beat the map, or with one animateToRegion when it arrives late;
 * after that the farmer's panning is never hijacked.
 */
export function ParcelMap(_props: ParcelMapProps) {
  const { t, isRtl } = useT()
  const ff = useFF()
  const setPts = useApp((s) => s.setPts)
  const setState = useApp((s) => s.set)
  const pts = useApp((s) => s.pts)
  const locatedAt = useApp((s) => s.locatedAt)
  const mapCenterTxt = useApp((s) => s.mapCenterTxt)

  const mapRef = useRef<MapView | null>(null)
  const ptsRef = useRef<LatLng[]>([])
  const draggingRef = useRef(false)
  // If the geolocation fix already resolved, open straight on it.
  const centeredOnFixRef = useRef(useApp.getState().locatedAt !== null)
  const startRef = useRef<LatLng>(useApp.getState().locatedAt ?? MAP_START)

  // The web map drew imperative leaflet layers from ptsRef; here the same ref
  // drives declarative <Polygon>/<Marker>, and this tick is the "redraw".
  const [, setTick] = useState(0)
  const bump = () => setTick((n) => n + 1)

  // The web fired a synthetic moveend right after init to seed the HUD text.
  useEffect(() => {
    const [lat, lng] = startRef.current
    setState({ mapCenterTxt: centerTxt(lat, lng) })
  }, [setState])

  const onMapPress = (e: MapPressEvent) => {
    if (draggingRef.current) return
    // Android reports corner taps through onPress too; leaflet markers
    // swallowed those clicks, so a corner tap must not drop a new corner.
    if (e.nativeEvent.action === "marker-press") return
    const c = e.nativeEvent.coordinate
    ptsRef.current.push([c.latitude, c.longitude])
    bump()
    setPts(ptsRef.current.slice())
  }

  const onCornerDragStart = () => {
    draggingRef.current = true
  }
  const onCornerDrag = (i: number, e: MarkerDragEvent) => {
    const c = e.nativeEvent.coordinate
    ptsRef.current[i] = [c.latitude, c.longitude]
    bump() // the polygon follows the finger; the store is untouched mid-drag
  }
  const onCornerDragEnd = (i: number, e: MarkerDragStartEndEvent) => {
    const c = e.nativeEvent.coordinate
    ptsRef.current[i] = [c.latitude, c.longitude]
    setPts(ptsRef.current.slice())
    // Let the map's press handler see the drag before it re-arms.
    setTimeout(() => {
      draggingRef.current = false
    }, 80)
  }

  const onRegionChangeComplete = (region: Region) => {
    setState({ mapCenterTxt: centerTxt(region.latitude, region.longitude) })
  }

  // The device fix: recentre once when it arrives. The "you are here" dot is
  // rendered below so the farmer can find their way back after panning.
  useEffect(() => {
    if (!locatedAt) return
    if (!centeredOnFixRef.current) {
      centeredOnFixRef.current = true
      mapRef.current?.animateToRegion(
        {
          latitude: locatedAt[0],
          longitude: locatedAt[1],
          latitudeDelta: FIELD_DELTA,
          longitudeDelta: FIELD_DELTA,
        },
        600
      )
    }
  }, [locatedAt])

  // The screen can clear the outline from outside (Reset, or re-entering onboarding).
  useEffect(() => {
    if (pts.length === 0 && ptsRef.current.length > 0) {
      ptsRef.current = []
      bump()
    }
  }, [pts])

  const hint = pts.length >= 3 ? t.obHintGo : t.obHintTap
  const row = { flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const) }
  const monoTxt = { fontFamily: ff.mono.bold, fontSize: 10 }

  return (
    <View style={styles.frame}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="satellite"
        initialRegion={{
          latitude: startRef.current[0],
          longitude: startRef.current[1],
          latitudeDelta: FIELD_DELTA,
          longitudeDelta: FIELD_DELTA,
        }}
        rotateEnabled={false}
        pitchEnabled={false}
        zoomControlEnabled
        toolbarEnabled={false}
        onPress={onMapPress}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        <Polygon
          coordinates={ptsRef.current.map(([lat, lng]) => ({
            latitude: lat,
            longitude: lng,
          }))}
          strokeColor={C.leafLight}
          strokeWidth={3}
          // C.leafLight at the web polygon's 0.3 fill opacity.
          fillColor="rgba(159, 220, 126, 0.3)"
        />
        {ptsRef.current.map(([lat, lng], i) => (
          <Marker
            key={`corner-${i}`}
            coordinate={{ latitude: lat, longitude: lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            draggable
            onDragStart={onCornerDragStart}
            onDrag={(e) => onCornerDrag(i, e)}
            onDragEnd={(e) => onCornerDragEnd(i, e)}
          >
            <View style={styles.corner} />
          </Marker>
        ))}
        {locatedAt && (
          <Marker
            coordinate={{ latitude: locatedAt[0], longitude: locatedAt[1] }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.hereHalo}>
              <View style={styles.hereDot} />
            </View>
          </Marker>
        )}
      </MapView>

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

const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.4,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: "#2c3522",
  },
  map: { height: 330 },
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
  corner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.surface,
    borderWidth: 4,
    borderColor: C.leafBright,
    ...shadow,
  },
  hereHalo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(31, 127, 184, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  hereDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.water,
    borderWidth: 3,
    borderColor: "#fff",
    ...shadow,
  },
})
