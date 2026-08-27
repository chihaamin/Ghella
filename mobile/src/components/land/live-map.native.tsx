import { Fragment, useEffect, useRef, useState, type JSX } from "react"
import {
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import MapView, { Marker, Polygon, type Region } from "react-native-maps"

import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { polygonAreaHa, polygonCentroid } from "@/lib/geo"
import { sx } from "@/lib/utils"
import { useFF } from "@/theme/fonts"
import type { LatLng } from "@/types/land"

import type { LiveLandMapProps } from "./live-map.types"

export type { SplitPreview } from "./live-map.types"

/** Mid-Mediterranean, whole-country view — where the map rests with no land. */
const NEUTRAL_CENTER: LatLng = [34, 9]
const NEUTRAL_ZOOM = 5

/**
 * The web map's neutral `center`/`zoom` as a region: the world is 360° of
 * latitude-span at zoom 0, halving per level, so z5 ≈ 11.25°.
 */
const NEUTRAL_REGION: Region = {
  latitude: NEUTRAL_CENTER[0],
  longitude: NEUTRAL_CENTER[1],
  latitudeDelta: 360 / 2 ** NEUTRAL_ZOOM,
  longitudeDelta: 360 / 2 ** NEUTRAL_ZOOM,
}

/** `[lat, lng]` tuple → the `{latitude, longitude}` react-native-maps wants. */
function toCoord([latitude, longitude]: LatLng): {
  latitude: number
  longitude: number
} {
  return { latitude, longitude }
}

/**
 * "#4c6b2f" + 0.18 → "rgba(76,107,47,0.18)" — leaflet's separate
 * `fillOpacity` baked into the fill colour, which is how native maps take it.
 */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/**
 * A centroid chip: "North · 0.8 ha", "A · 1.6 ha" — the same mono recipe as
 * the web map's divIcon labels. Native `Text` needs no HTML escaping. The web
 * chip was `pointer-events:none` so a tap fell through to the polygon below
 * and selected it; native markers swallow their taps, so `onPress` forwards
 * the selection the tap would have caused.
 */
function LabelMarker({
  at,
  text,
  onPress,
}: {
  at: LatLng
  text: string
  onPress: () => void
}): JSX.Element {
  const ff = useFF()
  return (
    <Marker
      coordinate={toCoord(at)}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={onPress}
    >
      <View style={styles.chip}>
        <Text
          numberOfLines={1}
          style={sx<TextStyle>(styles.chipText, { fontFamily: ff.mono.bold })}
        >
          {text}
        </Text>
      </View>
    </Marker>
  )
}

/**
 * The live parcels map — every mapped parcel on satellite imagery, each in its
 * own colour with a name · area chip at its centroid. Tapping a polygon
 * selects it; a `splitPreview` dims the parent and overlays the proposed
 * blocks as dashed lettered rings.
 *
 * Pure props — no store, no fetching — so the same component serves the land
 * screen, the recommendation preview and any test without mocking. Unlike the
 * leaflet build, layers are declarative here; only the camera needs imperative
 * care: `fitToCoordinates` is keyed on a fingerprint of ids + point counts so
 * a mere re-render, a selection tap or an analysis landing on a parcel never
 * yanks the viewport.
 */
export function LiveLandMap({
  parcels,
  selectedId,
  onSelect,
  splitPreview = null,
  heightPx = 230,
  style,
}: LiveLandMapProps): JSX.Element {
  const { t } = useT()
  const ff = useFF()

  const mapRef = useRef<MapView | null>(null)
  const [mapReady, setMapReady] = useState(false)
  /** What the viewport currently frames — refit only when this moves. */
  const fitKeyRef = useRef<string | null>(null)

  // Frame the land. The effect re-runs on any parcels identity change, but
  // only actually moves the camera when the fingerprint — ids and point
  // counts — moves, so re-renders, analysis updates and selection taps can't
  // cause a fit loop or fight the farmer's own panning. Selection is
  // deliberately NOT part of the key: tapping a parcel restyles it and must
  // never move the camera.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const fitKey = parcels.map((p) => `${p.id}:${p.points.length}`).join("|")
    if (fitKeyRef.current === fitKey) return
    fitKeyRef.current = fitKey

    const points = parcels.flatMap((p) => p.points)
    if (points.length === 0) {
      map.animateToRegion(NEUTRAL_REGION)
      return
    }
    map.fitToCoordinates(points.map(toCoord), {
      edgePadding: { top: 24, right: 24, bottom: 24, left: 24 },
      animated: true,
    })
  }, [parcels, mapReady])

  // Past a few parcels the chips collide (six side-by-side strips overprint
  // into noise), so a crowded map labels only the selected parcel.
  const crowded = parcels.length > 4

  return (
    <View style={sx<ViewStyle>(styles.frame, style)}>
      <MapView
        ref={mapRef}
        style={{ height: heightPx }}
        mapType="satellite"
        initialRegion={NEUTRAL_REGION}
        onMapReady={() => setMapReady(true)}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        {parcels.map((parcel) => {
          if (parcel.points.length < 3) return null
          const isParent = splitPreview?.parcelId === parcel.id
          const isSelected = parcel.id === selectedId
          return (
            <Fragment key={parcel.id}>
              <Polygon
                coordinates={parcel.points.map(toCoord)}
                strokeColor={parcel.color}
                // The split parent fades to a dashed ghost so the proposed
                // blocks on top of it read as the subject, not as clutter.
                fillColor={withAlpha(
                  parcel.color,
                  isParent ? 0.05 : isSelected ? 0.35 : 0.18,
                )}
                strokeWidth={isParent ? 2 : isSelected ? 3 : 2}
                lineDashPattern={isParent ? [6, 6] : undefined}
                tappable
                onPress={() => onSelect(parcel.id)}
              />
              {/* The parent's own chip would sit exactly on the cut line,
                  under the block letters — drop it while its preview is
                  showing. */}
              {!isParent && (!crowded || isSelected) && (
                <LabelMarker
                  at={polygonCentroid(parcel.points)}
                  text={`${parcel.name} · ${parcel.areaHa.toFixed(1)} ha`}
                  onPress={() => onSelect(parcel.id)}
                />
              )}
            </Fragment>
          )
        })}

        {splitPreview
          ? splitPreview.rings.map((ring, i) => {
              if (ring.length < 3) return null
              const letter = String.fromCharCode(65 + (i % 26))
              return (
                <Fragment key={`split-${i}`}>
                  <Polygon
                    coordinates={ring.map(toCoord)}
                    strokeColor="#9fdc7e"
                    fillColor={withAlpha("#9fdc7e", 0.25)}
                    strokeWidth={2.5}
                    lineDashPattern={[6, 6]}
                  />
                  {/* On the web a click on a letter chip fell through to the
                      parent polygon; forward the same selection here. */}
                  <LabelMarker
                    at={polygonCentroid(ring)}
                    text={`${letter} · ${polygonAreaHa(ring).toFixed(1)} ha`}
                    onPress={() => onSelect(splitPreview.parcelId)}
                  />
                </Fragment>
              )
            })
          : null}
      </MapView>

      <View pointerEvents="none" style={styles.hud}>
        <Text style={sx<TextStyle>(styles.hint, { fontFamily: ff.mono.bold })}>
          {t.ldMapHint}
        </Text>
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
  chip: {
    backgroundColor: "rgba(31,36,22,0.82)",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 10,
    color: C.cream,
  },
  hud: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    alignItems: "center",
  },
  hint: {
    fontSize: 10,
    color: C.leafSoft,
    backgroundColor: "rgba(31,36,22,0.85)",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
})
