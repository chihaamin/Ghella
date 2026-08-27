# Ghella — Farmer App (React Native / Expo)

The React Native port of the Ghella web app that lives one directory up.
Same brain, native body: every store, service, hook, data table and i18n
dictionary is shared line-for-line with the web app; only the render layer
is written in React Native.

```bash
npm install
npx expo start          # QR code → Expo Go on a phone
npx expo start --web    # same app in a browser (react-native-web)
```

## Stack

| Concern    | Choice                                                          |
| ---------- | --------------------------------------------------------------- |
| Runtime    | Expo SDK 57, React Native 0.86, React 19, TypeScript strict     |
| State      | zustand (`src/store`) — parcels persisted via AsyncStorage      |
| Styling    | Plain StyleSheet objects over the Ghella token palette (`src/lib/colors.ts`) |
| Fonts      | Space Grotesk · Karla · Space Mono · IBM Plex Sans Arabic (`@expo-google-fonts`) |
| Map        | `react-native-maps` satellite on device; Leaflet + Esri tiles on web |
| Icons      | Hand-drawn brand glyphs on `react-native-svg`                   |
| Location   | `expo-location` (centers the onboarding map)                    |

## How the port works

- `src/{store,services,hooks,data,i18n,types,lib}` are copies of the web
  app's files, with three patches: the HTTP stale-cache and zustand persist
  ride a memory-first AsyncStorage facade (`src/services/storage.ts`,
  hydrated before first render), and geolocation speaks `expo-location`.
- `src/components/ui` re-implements the shadcn kit (Button, Badge, Card,
  Segmented, Progress, Slider, Switch, Separator) with the same variant
  vocabulary, plus a hand-built month `Calendar` replacing react-day-picker.
- Map components are platform-split: `*.native.tsx` (react-native-maps) and
  `*.web.tsx` (Leaflet), Metro picks per platform.
- The web prototype's reviewer panel became an in-app settings sheet (tap the
  avatar): language EN/FR/AR, the three demo scenarios (offline / rain /
  frost), screen shortcuts and reset.
- framer-motion became `src/lib/motion.tsx` (`FadeUp`, `Pop`, `Pulse`,
  `animateLayout()`), built on the core Animated API.

See [PORTING.md](./PORTING.md) for the full conversion conventions.

## Live land data

Identical to the web app: Open-Meteo (forecast/archive/elevation), OSM
Nominatim reverse geocode, ISRIC SoilGrids and the bundled FAO EcoCrop table,
all keyless, all cached to device storage so the app keeps answering offline.
