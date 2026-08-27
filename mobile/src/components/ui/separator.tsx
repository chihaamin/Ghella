import { View, type StyleProp, type ViewStyle } from "react-native"

import { C } from "@/lib/colors"

export function Separator({
  orientation = "horizontal",
  style,
}: {
  orientation?: "horizontal" | "vertical"
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        { backgroundColor: C.line },
        orientation === "horizontal"
          ? { height: 1, alignSelf: "stretch" }
          : { width: 1, alignSelf: "stretch" },
        style,
      ]}
    />
  )
}
