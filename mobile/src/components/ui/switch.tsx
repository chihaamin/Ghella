import { Switch as RNSwitch, type StyleProp, type ViewStyle } from "react-native"

import { C } from "@/lib/colors"

/** Small leaf-green toggle, scaled to sit inside dense settings rows. */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  style,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <RNSwitch
      value={checked}
      onValueChange={onCheckedChange}
      disabled={disabled}
      trackColor={{ false: C.sand2, true: C.leaf }}
      thumbColor="#ffffff"
      // RN's switch is chunky; the design draws a 17px control.
      style={[{ transform: [{ scale: 0.78 }] }, style]}
    />
  )
}
