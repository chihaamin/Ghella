# Ghella — Farmer App

A React implementation of the **Ghella Farmer App** artboard from the
[Agriculture mobile app design](https://claude.ai/design/p/828bb4c7-c683-47fc-8a46-bb3551cc42bc)
Claude Design project.

```bash
npm install
npm run dev
```

## Stack

| Concern    | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | React 19 + TypeScript, bundled by Vite                            |
| Styling    | Tailwind CSS v4 — design tokens live in `src/index.css` `@theme`   |
| Components | shadcn/ui (`src/components/ui`), configured via `components.json`  |
| Motion     | framer-motion                                                     |
| State      | zustand (`src/store/app-store.ts`)                                 |
| Map        | Leaflet + Esri World Imagery satellite tiles                      |

The brief left the framework open but named Tailwind and shadcn/ui, both of
which are web-only (shadcn/ui ships DOM components; there is no React Native
build). So this is a web app. It is laid out phone-first inside a Material 3
device frame, so it drops into a WebView or Capacitor shell unchanged.

## Layout

```
src/
  App.tsx                     artboard: phone frame + prototype control panel
  index.css                   Tailwind v4 theme — every Ghella colour token
  components/
    device/android-device.tsx port of the design's android-frame.jsx starter
    ghella/                   app-specific composites (header, nav, task card,
                              weather strip, parcel map, toast, phone shell)
    ui/                       shadcn/ui primitives, restyled to the tokens
  data/                       varieties, season plan, weather, market maths
  hooks/use-calendar.ts       derives the Today feed, month grid and budget
  i18n/                       en/fr/ar dictionaries + the useT() hook
  screens/                    the seven screens
  store/app-store.ts          all app + scenario state
```

## Screens

`onboard` → `decide` → `cal` → `disease` → `market` → `close`, plus `home`.
The panel beside the phone deep-links into any of them, switches language and
flips the three scenarios the demo hangs on.

## Scenarios

The three toggles are the point of the prototype — they change real content,
not just banners:

- **Offline** — cached-task banner above the header.
- **Rain tonight (18 mm)** — soaks the first two forecast days, moves soil prep
  to Friday and shows the saved-water note on the cancelled task.
- **Frost alert** — drops Tuesday to 12°C, reschedules transplanting Tue → Fri
  and moves the dot in the month grid from the 8th to the 11th.

Completing the disease flow sets `treated`, which injects three copper-spray
tasks into the calendar and locks Parcel North for harvest (PHI).

## Languages

`en` / `fr` / `ar`, with `ar` flipping the whole app to RTL and switching to
IBM Plex Sans Arabic. `fr` and `ar` are partial overlays on the English
dictionary, so untranslated strings fall back to English — the same coverage
the design shipped (Decision, Today and the shell are fully localised).

## Live land data (open APIs, no keys)

Drawing a parcel runs a real analysis of that exact spot, all client-side:

| Source | What it provides | Cache |
| ------ | ---------------- | ----- |
| OSM Nominatim | country / region / county (reverse geocode) | 30 d |
| Open-Meteo archive | 10 years of daily weather → climate normals, aridity zone, frost window, GDD, sun hours | 30 d |
| Open-Meteo forecast | live conditions + real 7-day outlook | 30 min |
| Open-Meteo elevation | 5-point stencil → elevation, slope, aspect | 90 d |
| ISRIC SoilGrids | sand/silt/clay, pH, organic carbon → USDA texture | 365 d |
| FAO EcoCrop (bundled) | 45 crop requirement envelopes, scored against the site | — |

Every source can fail independently (SoilGrids is slow and rate-limited);
the analysis degrades per source and records issues instead of failing.
Farmer-entered facts (soil texture, water source, salinity) always outrank
the model. All HTTP goes through `src/services/http.ts`: timeout, abort,
retry-with-backoff, localStorage cache with stale-on-failure fallback —
which is also what makes the app usable offline.

"My land" is the live view: a satellite map of the drawn parcels, current
weather, per-parcel detail (climate, soil, terrain, crop matches, water
budget) and ranked recommendations — including equal-area parcel **splits**
previewed on the map and applied with one tap (`splitPolygon` bisects on
area along the field's long axis).

## Fidelity

`design-src/Ghella Farmer App.dc.html` is the original artboard, kept as the
reference for future diffs. Two deliberate departures:

- The device frame's Gboard is ported but never mounted — the app has no text
  input, same as the design.
- The screen body scrolls back to the top on navigation. The design's single
  scroll container kept its offset, which reads as a bug on a phone.
