import RNSlider from "@react-native-community/slider"
import { type StyleProp, type ViewStyle } from "react-native"

import { C } from "@/lib/colors"

/**
 * Ghella slider — leaf-green range on a chip track, mirroring the web kit.
 * Value is controlled; `onValueChange` fires continuously while dragging.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled = false,
  style,
}: {
  value: number
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <RNSlider
      value={value}
      minimumValue={min}
      maximumValue={max}
      step={step}
      onValueChange={onValueChange}
      disabled={disabled}
      minimumTrackTintColor={C.leaf}
      maximumTrackTintColor={C.chip}
      thumbTintColor={C.leaf}
      style={[{ alignSelf: "stretch", height: 32 }, style]}
    />
  )
}
