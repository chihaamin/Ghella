import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { C } from "@/lib/colors"
import { useFF } from "@/theme/fonts"

export type SegmentedOption<T extends string> = { value: T; label: string }

/**
 * The chip-tray segmented control used for the calendar views and the
 * language picker. (The web version slid a shared layout pill between tabs;
 * here the active chip simply carries the ink background.)
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  style,
  itemStyle,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  style?: StyleProp<ViewStyle>
  itemStyle?: StyleProp<ViewStyle>
}) {
  const ff = useFF()
  return (
    <View
      style={[
        { flexDirection: "row", borderRadius: 9, backgroundColor: C.chip, padding: 3 },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              {
                borderRadius: 7,
                paddingHorizontal: 9,
                paddingVertical: 6,
                backgroundColor: active ? C.ink : "transparent",
              },
              itemStyle,
            ]}
          >
            <Text
              style={{
                fontFamily: ff.sans.bold,
                fontSize: 12,
                textAlign: "center",
                color: active ? C.cream : C.inkMuted,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
