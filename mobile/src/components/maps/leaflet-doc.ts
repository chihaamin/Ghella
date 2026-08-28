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

/**
 * Serialize a value into JS source safe to embed in page scripts (both the
 * document template and `injectJavaScript` strings). `JSON.stringify` alone is
 * not enough: U+2028/U+2029 are legal inside JSON strings but end a line in JS
 * source, so farmer-typed text containing them would break the script.
 */
export function jsValue(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

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
<script>
  /* Defined in its OWN script tag, before anything that can fail: a syntax
     error in the body script below would kill that whole tag, but this
     window.onerror still fires for it and reports it to the RN side. */
  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }
  window.onerror = function (message) {
    post({ type: "error", message: String(message) });
  };
</script>
<script src="${LEAFLET_JS}"></script>
<script>
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

/**
 * The mono centroid-label chip, as an inline style for leaflet divIcons.
 * Contains single quotes ('Space Mono'), so never splice it into a quoted
 * string inside page JS — embed it as a value via `jsValue(LABEL_CHIP_STYLE)`.
 */
export const LABEL_CHIP_STYLE =
  "display:inline-block;transform:translate(-50%,-50%);background:rgba(31,36,22,.82);" +
  "color:#f0e3c0;font:700 10px 'Space Mono',monospace;border-radius:7px;" +
  "padding:3px 8px;pointer-events:none;white-space:nowrap"
