import { useEffect, useRef, useState } from "react"
import { Animated, View, type StyleProp, type ViewStyle } from "react-native"

import { C } from "@/lib/colors"

/**
 * Track + indicator, with the indicator animated on value change so growth
 * reads as growth (the design's `gh-bar` keyframe).
 */
export function Progress({
  value = 0,
  trackHeight = 7,
  trackColor = C.chip,
  indicatorColor = C.leaf,
  style,
}: {
  /** 0–100. */
  value?: number
  trackHeight?: number
  trackColor?: string
  indicatorColor?: string
  style?: StyleProp<ViewStyle>
}) {
  const pct = Math.min(Math.max(value, 0), 100)
  const [trackWidth, setTrackWidth] = useState(0)
  const width = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(width, {
      toValue: (pct / 100) * trackWidth,
      stiffness: 120,
      damping: 22,
      mass: 1,
      // Width cannot ride the native driver.
      useNativeDriver: false,
    }).start()
  }, [width, pct, trackWidth])

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[
        {
          height: trackHeight,
          borderRadius: 999,
          backgroundColor: trackColor,
          overflow: "hidden",
          alignSelf: "stretch",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          height: "100%",
          width,
          borderRadius: 999,
          backgroundColor: indicatorColor,
        }}
      />
    </View>
  )
}
