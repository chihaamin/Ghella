# Porting Ghella web → React Native (Expo)

The web app lives in `../src` (React 19 + Tailwind v4 + framer-motion). This
app is its React Native port. **The logic layer is already ported** — stores,
services, hooks, data, i18n, types are copied verbatim under `mobile/src` with
the same `@/` import paths. **Only the JSX/styling layer changes.**

## Hard rules

- Same file path as the web original: `src/screens/home-screen.tsx` (web) →
  `mobile/src/screens/home-screen.tsx` (RN). Same exported component names.
- Keep ALL logic, hooks, i18n keys, conditionals and copy identical to the web
  source. You are translating the render layer, not redesigning it.
- No new dependencies. Available: react-native, react-native-svg,
  react-native-maps (native only), @react-native-community/slider, expo-*,
  zustand, leaflet (web platform files only).
- No Tailwind, no `className`, no `cn()`. Styles are inline objects or
  `StyleSheet.create`. `sx(...)` from `@/lib/utils` merges conditional styles.
- Every string sits in a `<Text>`. Never render a bare string inside `<View>`.
- Web `div`→`View`, `button`→`Pressable`, `span`/text→`Text`,
  `input`→`TextInput`, `svg`→`react-native-svg` (see `components/ghella/icons.tsx`).

## Design tokens

- Colors: `import { C, TASK_COLOR } from "@/lib/colors"` — same names as web
  (`C.leaf`, `C.chip2`…). Tailwind classes map: `bg-leaf-tint` →
  `backgroundColor: C.leafTint`, `text-sun-ink-2` → `color: "#5c4a1e"`
  (sunInk2 = `#5c4a1e`, sunTint2 = `#fdf6e6`, chip3 = `#f0e6dc`,
  waterPale = `C.waterPale` — the few tokens missing from `C` are written hex).
- Fonts: `const ff = useFF()` from `@/theme/fonts`. `font-display` →
  `fontFamily: ff.display.bold|semibold|medium`; `font-sans` → `ff.sans.*`
  (regular/medium/semibold/bold/extrabold); `font-mono` → `ff.mono.regular|bold`.
  NEVER set `fontWeight` next to a custom `fontFamily` — pick the weighted
  family instead. `useFF()` swaps in IBM Plex Sans Arabic automatically for
  Arabic; mono stays Space Mono.
- Tailwind sizes: `text-[13px]` → `fontSize: 13`. Unitless line-height →
  `lineHeight: Math.round(fontSize * ratio)`. `tracking-[0.12em]` →
  `letterSpacing: fontSize * 0.12`. `p-3` = 12, `px-3.5` = 14, `gap-2` = 8,
  `rounded-[13px]` → `borderRadius: 13`, `size-[34px]` → width+height 34.
- `truncate` → `numberOfLines={1}` on the Text.
- Percentage / flex layouts: `flex-1` → `flex: 1`, `grid grid-cols-2 gap-2` →
  a row-wrapping View with two children at `flex: 1` or `width: "48.7%"`;
  keep it simple and phone-width.

## RTL (Arabic)

`const { isRtl } = useT()`. Web relied on `dir="rtl"`; here flip manually:
row containers that read left-to-right get
`flexDirection: isRtl ? "row-reverse" : "row"`, and free-standing paragraphs
get `textAlign: isRtl ? "right" : "left"` where alignment matters. Don't
overdo it — centered content needs nothing.

## Motion

framer-motion → `@/lib/motion`:
- `motion.div variants={fadeUp}` on mount → `<FadeUp>` (optional `delay`).
- staggered lists → `<FadeUp delay={i * 50}>` per item.
- `pop` → `<Pop>`, `pulse` → `<Pulse>`.
- `AnimatePresence` + expand/collapse (accordions) → call `animateLayout()`
  immediately before the setState that toggles, then render conditionally.
- Layout-id pill slides → just switch styles on the active item.

## Kit (same import paths as web)

- `Button` (`@/components/ui/button`): props `variant` (ink|leaf|sun|sunDeep|
  outline|ghost|light|outlineOnDark|muted|disabled), `size` (lg|md|sm|chip),
  `onPress`, `disabled`, `style`, `textStyle`. String children get styled
  automatically; for icon+label children use `buttonTextStyle(...)`/`buttonColor(...)`.
- `Badge` (`@/components/ui/badge`): `variant` (neutral|leaf|water|sun|
  sunOutline|clay|ink|earth), `size` (xs|sm|md), `textStyle`; `badgeColor(v)`.
- `Card, CardDark, CardHeader, CardTitle, CardContent` (`@/components/ui/card`).
- `Segmented` (`@/components/ui/segmented`): `value/options/onChange` (no
  `layoutId` here).
- `Progress` (`@/components/ui/progress`): `value` 0-100, `trackHeight`,
  `trackColor`, `indicatorColor`.
- `Separator`, `Slider` (`value/min/max/step/onValueChange`),
  `Switch` (`checked/onCheckedChange`).
- `Calendar` (`@/components/ui/calendar`): `selected`, `onSelect(Date)`,
  `initialMonth`, `lang`, `renderDay(day, {selected,today,outside})`,
  plus `dayCellStyle(modifiers)` for the shared cell chrome.
- Primitives (`@/components/ghella/primitives`): `SectionLabel`, `ScreenTitle`,
  `Stat` (`label/value/sub/style/labelStyle/valueStyle`), `NoteStrip`
  (`tone`: water|sun|clay|neutral, `icon`, children TEXT ONLY).
- Icons (`@/components/ghella/icons`): same exports as web + `PathIcon({d})`.

## Screens

Screens render inside a vertical `ScrollView` (the shell owns scrolling,
header and tab bar — see `App.tsx`). A screen returns its content column only:
`<View style={{ gap: 12 }}>…</View>`. Do NOT add your own ScrollView unless
the web screen scrolls horizontally (use `horizontal` ScrollView for chip rows).
`window.confirm` → `Alert.alert(title, msg, [{text: cancel}, {text: ok, onPress}])`.

## Maps

`react-native-maps` must only be imported from `*.native.tsx` files. Web
fallback (`*.web.tsx`) uses leaflet against the DOM (Expo web). Shared types
go in a `*.types.ts` file; consumers import the extensionless path.

## Verify

`cd mobile && npx tsc --noEmit` after each file. Zero errors is the bar.
