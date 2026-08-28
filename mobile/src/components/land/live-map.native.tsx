import { useEffect, useMemo, useRef, type JSX } from "react"
import {
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import { WebView, type WebViewMessageEvent } from "react-native-webview"

import {
  ESRI_TILES,
  LABEL_CHIP_STYLE,
  leafletDoc,
} from "@/components/maps/leaflet-doc"
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

interface PagePolygon {
  id: string | null
  points: LatLng[]
  color: string
  weight: number
  fillOpacity: number
  dashed: boolean
}

interface PageLabel {
  at: LatLng
  text: string
}

interface PagePayload {
  polygons: PagePolygon[]
  labels: PageLabel[]
  fit: null | { points: LatLng[] } | { view: LatLng; zoom: number }
}

/**
 * The live parcels map — leaflet in a WebView (Expo Go has no
 * react-native-maps; Esri imagery needs no key), mirroring the web build.
 * All geometry math (centroids, areas, the fit fingerprint) happens HERE so
 * the page stays a dumb renderer: it receives ready-to-draw polygons and
 * label chips through `__setData` and posts back only selection taps.
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

  const webviewRef = useRef<WebView>(null)
  const readyRef = useRef(false)
  /** What the viewport currently frames — refit only when this moves. */
  const fitKeyRef = useRef<string | null>(null)
  const payloadRef = useRef<PagePayload | null>(null)

  // Latest-ref mirror so the message handler always calls the current callback.
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const html = useMemo(
    () =>
      leafletDoc(`
      var map = L.map(document.getElementById("map"), {
        center: [${NEUTRAL_CENTER[0]}, ${NEUTRAL_CENTER[1]}],
        zoom: ${NEUTRAL_ZOOM},
        zoomControl: false,
        attributionControl: false
      });
      L.tileLayer(${JSON.stringify(ESRI_TILES)}, { maxZoom: 19 }).addTo(map);
      L.control.attribution({ prefix: false, position: "bottomleft" })
        .addAttribution("Esri World Imagery").addTo(map);

      var layer = L.layerGroup().addTo(map);

      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }

      window.__setData = function (payload) {
        layer.clearLayers();

        payload.polygons.forEach(function (p) {
          var poly = L.polygon(p.points, {
            color: p.color,
            fillColor: p.color,
            weight: p.weight,
            fillOpacity: p.fillOpacity,
            dashArray: p.dashed ? "6 6" : null,
            interactive: p.id !== null
          }).addTo(layer);
          if (p.id !== null) {
            poly.on("click", function () { post({ type: "select", id: p.id }); });
          }
        });

        payload.labels.forEach(function (lb) {
          L.marker(lb.at, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: "",
              iconSize: [0, 0],
              html: '<span style="${LABEL_CHIP_STYLE}">' + escapeHtml(lb.text) + "</span>"
            })
          }).addTo(layer);
        });

        if (payload.fit) {
          if (payload.fit.points) {
            map.fitBounds(L.latLngBounds(payload.fit.points), {
              padding: [24, 24],
              maxZoom: 17
            });
          } else {
            map.setView(payload.fit.view, payload.fit.zoom);
          }
        }
      };
    `),
    []
  )

  // The web build's redraw effect, compressed into a drawable payload. The
  // fit decision happens in the ship effect below — deciding it here would
  // consume the fit fingerprint during renders that may never commit.
  const drawable = useMemo<Omit<PagePayload, "fit">>(() => {
    const polygons: PagePolygon[] = []
    const labels: PageLabel[] = []

    for (const parcel of parcels) {
      if (parcel.points.length < 3) continue
      const isParent = splitPreview?.parcelId === parcel.id
      const isSelected = parcel.id === selectedId

      polygons.push({
        id: parcel.id,
        points: parcel.points,
        color: parcel.color,
        // The split parent fades to a dashed ghost so the proposed blocks on
        // top of it read as the subject, not as clutter.
        ...(isParent
          ? { weight: 2, fillOpacity: 0.05, dashed: true }
          : isSelected
            ? { weight: 3, fillOpacity: 0.35, dashed: false }
            : { weight: 2, fillOpacity: 0.18, dashed: false }),
      })

      // Past a few parcels the chips collide — label only the selection.
      const crowded = parcels.length > 4
      if (!isParent && (!crowded || isSelected)) {
        labels.push({
          at: polygonCentroid(parcel.points),
          text: `${parcel.name} · ${parcel.areaHa.toFixed(1)} ha`,
        })
      }
    }

    if (splitPreview) {
      splitPreview.rings.forEach((ring, i) => {
        if (ring.length < 3) return
        polygons.push({
          id: null,
          points: ring,
          color: "#9fdc7e",
          weight: 2.5,
          fillOpacity: 0.25,
          dashed: true,
        })
        const letter = String.fromCharCode(65 + (i % 26))
        labels.push({
          at: polygonCentroid(ring),
          text: `${letter} · ${polygonAreaHa(ring).toFixed(1)} ha`,
        })
      })
    }

    return { polygons, labels }
  }, [parcels, selectedId, splitPreview])

  // Ship the payload — buffered until the page reports ready. Frames the land
  // only when the fingerprint — ids and point counts — moves; selection taps
  // and analysis updates never yank the viewport.
  useEffect(() => {
    const fitKey = parcels.map((p) => `${p.id}:${p.points.length}`).join("|")
    let fit: PagePayload["fit"] = null
    if (fitKeyRef.current !== fitKey) {
      fitKeyRef.current = fitKey
      const points = parcels.flatMap((p) => p.points)
      fit =
        points.length === 0
          ? { view: NEUTRAL_CENTER, zoom: NEUTRAL_ZOOM }
          : { points }
    }
    const payload: PagePayload = { ...drawable, fit }
    payloadRef.current = payload
    if (readyRef.current) {
      webviewRef.current?.injectJavaScript(
        `window.__setData(${JSON.stringify(payload)}); true;`
      )
    }
  }, [drawable, parcels])

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: { type?: string; id?: string }
    try {
      msg = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (msg.type === "select" && msg.id) {
      onSelectRef.current(msg.id)
    } else if (msg.type === "ready") {
      readyRef.current = true
      if (payloadRef.current) {
        webviewRef.current?.injectJavaScript(
          `window.__setData(${JSON.stringify(payloadRef.current)}); true;`
        )
      }
    }
  }

  return (
    <View style={sx<ViewStyle>(styles.frame, style)}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ height: heightPx, backgroundColor: "#2c3522" }}
      />

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
  hud: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 600,
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
