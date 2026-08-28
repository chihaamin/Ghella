/**
 * Builds the self-contained HTML document the native maps load into a
 * WebView. Expo Go removed react-native-maps on Android (and Google tiles
 * would need an API key anyway), so on device the maps run the SAME leaflet +
 * Esri World Imagery stack as the web build — inside a WebView, keyless.
 *
 * The page JS is written in plain ES5-ish concatenation (no template
 * literals) so this TS template literal needs no escaping. Communication:
 * page → RN via `post({type, ...})` (window.ReactNativeWebView.postMessage),
 * RN → page via webviewRef.injectJavaScript calling the `window.__*` hooks a
 * map document defines. Every page posts `{type:"ready"}` once leaflet is up
 * so the RN side knows when injections will stick.
 */

export const ESRI_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"

/** Wrap a map document's body script into the full HTML page. */
export function leafletDoc(bodyJs: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@700&display=swap" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  /* Dark ground under the tiles — the web original's .gh-map stylesheet. */
  #map { background: #2c3522; }
  .leaflet-control-attribution {
    font-family: "Space Mono", monospace; font-size: 9px;
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET_JS}"></script>
<script>
  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }
  window.onerror = function (message) {
    post({ type: "error", message: String(message) });
  };
  try {
    if (typeof L === "undefined") {
      // The CDN did not load (offline) — tiles could not load either, so the
      // dark ground with the RN HUD on top is the whole offline story.
      post({ type: "error", message: "leaflet-unavailable" });
    } else {
${bodyJs}
      post({ type: "ready" });
    }
  } catch (e) {
    post({ type: "error", message: String(e && e.message ? e.message : e) });
  }
</script>
</body>
</html>`
}

/** The mono centroid-label chip, as an inline style for leaflet divIcons. */
export const LABEL_CHIP_STYLE =
  "display:inline-block;transform:translate(-50%,-50%);background:rgba(31,36,22,.82);" +
  "color:#f0e3c0;font:700 10px 'Space Mono',monospace;border-radius:7px;" +
  "padding:3px 8px;pointer-events:none;white-space:nowrap"
