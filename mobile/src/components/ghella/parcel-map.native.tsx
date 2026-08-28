import { useEffect, useMemo, useRef } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { WebView, type WebViewMessageEvent } from "react-native-webview"

import { ESRI_TILES, leafletDoc } from "@/components/maps/leaflet-doc"
import { MAP_START } from "@/data/onboarding"
import { useT } from "@/i18n/use-t"
import { C } from "@/lib/colors"
import { useApp, type LatLng } from "@/store/app-store"
import { useFF } from "@/theme/fonts"

import type { ParcelMapProps } from "./parcel-map.types"

/** `bg-ink/85` — C.ink (#1f2416) at 85%. */
const INK_85 = "rgba(31, 36, 22, 0.85)"

/**
 * Satellite parcel drawing — leaflet in a WebView (Expo Go has no
 * react-native-maps, and Esri imagery needs no key). Behavior mirrors the web
 * build exactly: tapping the imagery drops a corner, corners are draggable,
 * points live inside the page while dragging and are pushed to the store on
 * commit. The HUD chips stay native, drawn over the WebView.
 *
 * Page → RN: {type:"pts", pts}, {type:"center", lat, lng}, {type:"ready"}.
 * RN → page: __reset(), __located(lat, lng).
 */
export function ParcelMap(_props: ParcelMapProps) {
  const { t, isRtl } = useT()
  const ff = useFF()
  const setPts = useApp((s) => s.setPts)
  const setState = useApp((s) => s.set)
  const pts = useApp((s) => s.pts)
  const locatedAt = useApp((s) => s.locatedAt)
  const mapCenterTxt = useApp((s) => s.mapCenterTxt)

  const webviewRef = useRef<WebView>(null)
  const readyRef = useRef(false)
  /** The fix that arrived before the page was ready, delivered on ready. */
  const pendingFixRef = useRef<LatLng | null>(null)
  const lastPtsCountRef = useRef(0)

  // Built once: if the geolocation fix already resolved, open straight on it.
  const html = useMemo(() => {
    const start = useApp.getState().locatedAt ?? MAP_START
    return leafletDoc(`
      var SURFACE = ${JSON.stringify(C.surface)};
      var LEAF_BRIGHT = ${JSON.stringify(C.leafBright)};
      var LEAF_LIGHT = ${JSON.stringify(C.leafLight)};
      var WATER = ${JSON.stringify(C.water)};
      var centeredOnFix = ${useApp.getState().locatedAt !== null};

      var map = L.map(document.getElementById("map"), {
        center: [${start[0]}, ${start[1]}],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });
      L.tileLayer(${JSON.stringify(ESRI_TILES)}, { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ prefix: false, position: "bottomleft" })
        .addAttribution("Esri World Imagery").addTo(map);

      var poly = L.polygon([], {
        color: LEAF_LIGHT, weight: 3, fillColor: LEAF_LIGHT, fillOpacity: 0.3
      }).addTo(map);
      var marks = L.layerGroup().addTo(map);
      var here = null;
      var pts = [];
      var dragging = false;

      function cornerIcon() {
        return L.divIcon({
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          html: '<div style="width:18px;height:18px;border-radius:50%;background:' + SURFACE +
            ';border:4px solid ' + LEAF_BRIGHT + ';box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>'
        });
      }

      function redraw() {
        poly.setLatLngs(pts);
        marks.clearLayers();
        pts.forEach(function (p, i) {
          var marker = L.marker(p, { draggable: true, icon: cornerIcon() }).addTo(marks);
          marker.on("dragstart", function () { dragging = true; });
          marker.on("drag", function (e) {
            var ll = e.target.getLatLng();
            pts[i] = [ll.lat, ll.lng];
            poly.setLatLngs(pts);
          });
          marker.on("dragend", function () {
            post({ type: "pts", pts: pts });
            // Let the map's click handler see the drag before it re-arms.
            setTimeout(function () { dragging = false; }, 80);
          });
        });
      }

      map.on("click", function (e) {
        if (dragging) return;
        pts.push([e.latlng.lat, e.latlng.lng]);
        redraw();
        post({ type: "pts", pts: pts });
      });

      map.on("moveend", function () {
        var cc = map.getCenter();
        post({ type: "center", lat: cc.lat, lng: cc.lng });
      });
      map.fire("moveend");

      window.__reset = function () {
        pts = [];
        redraw();
      };

      // The device fix: recentre once when it arrives, and keep a
      // "you are here" dot on it.
      window.__located = function (lat, lng) {
        if (!centeredOnFix) {
          centeredOnFix = true;
          map.setView([lat, lng], 16);
        }
        if (here) {
          here.setLatLng([lat, lng]);
        } else {
          here = L.marker([lat, lng], {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: "",
              iconSize: [14, 14],
              iconAnchor: [7, 7],
              html: '<div style="width:14px;height:14px;border-radius:50%;background:' + WATER +
                ';border:3px solid #fff;box-shadow:0 0 0 4px rgba(31,127,184,.25),0 1px 4px rgba(0,0,0,.4)"></div>'
            })
          }).addTo(map);
        }
      };
    `)
  }, [])

  const inject = (js: string) => {
    webviewRef.current?.injectJavaScript(`${js}; true;`)
  }

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: { type?: string; pts?: LatLng[]; lat?: number; lng?: number }
    try {
      msg = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (msg.type === "pts" && Array.isArray(msg.pts)) {
      lastPtsCountRef.current = msg.pts.length
      setPts(msg.pts)
    } else if (msg.type === "center" && msg.lat != null && msg.lng != null) {
      const lat = `${Math.abs(msg.lat).toFixed(4)}°${msg.lat >= 0 ? "N" : "S"}`
      const lng = `${Math.abs(msg.lng).toFixed(4)}°${msg.lng >= 0 ? "E" : "W"}`
      setState({ mapCenterTxt: `SAT · ${lat} ${lng}` })
    } else if (msg.type === "ready") {
      readyRef.current = true
      if (pendingFixRef.current) {
        const [la, ln] = pendingFixRef.current
        pendingFixRef.current = null
        inject(`window.__located(${la}, ${ln})`)
      }
    }
  }

  // Late fix → recentre once; buffered until the page reports ready.
  useEffect(() => {
    if (!locatedAt) return
    if (readyRef.current) inject(`window.__located(${locatedAt[0]}, ${locatedAt[1]})`)
    else pendingFixRef.current = locatedAt
  }, [locatedAt])

  // The screen can clear the outline from outside (Reset, re-entering).
  useEffect(() => {
    if (pts.length === 0 && lastPtsCountRef.current > 0) {
      lastPtsCountRef.current = 0
      if (readyRef.current) inject("window.__reset()")
    }
  }, [pts])

  const hint = pts.length >= 3 ? t.obHintGo : t.obHintTap
  const row = { flexDirection: isRtl ? ("row-reverse" as const) : ("row" as const) }
  const monoTxt = { fontFamily: ff.mono.bold, fontSize: 10 }

  return (
    <View style={styles.frame}>
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
        allowsInlineMediaPlayback
        style={styles.host}
      />

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
  host: { height: 330, backgroundColor: "#2c3522" },
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
