/**
 * The contract both platform implementations of the live parcels map share.
 * Consumers import the extensionless path (`@/components/land/live-map`):
 * Metro picks `.native.tsx` / `.web.tsx`, tsc resolves `.native` through
 * `moduleSuffixes`.
 */
import type { StyleProp, ViewStyle } from "react-native"

import type { LatLng, Parcel } from "@/types/land"

/**
 * A proposed division of one parcel, drawn dashed on top of it while the
 * farmer decides. `rings` come straight from `splitPolygon`.
 */
export interface SplitPreview {
  parcelId: string
  rings: LatLng[][]
}

export interface LiveLandMapProps {
  parcels: Parcel[]
  selectedId: string | null
  onSelect: (id: string) => void
  splitPreview?: SplitPreview | null
  heightPx?: number
  style?: StyleProp<ViewStyle>
}
