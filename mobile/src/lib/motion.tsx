/**
 * The web app's framer-motion vocabulary (`gh-in`, `gh-pop`, `gh-pulse`),
 * rebuilt on the built-in Animated API so no extra native module is needed.
 *
 * - `<FadeUp>`   — content arriving from just below (mount only).
 * - `<Pop>`      — a number or badge landing with a slight overshoot.
 * - `<Pulse>`    — the "working on it" breathing loop.
 * - `animateLayout()` — call right BEFORE a setState that grows/shrinks
 *   content; the accordion expand/collapse of the web app.
 */
import { useEffect, useRef, type ReactNode } from "react"
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  type StyleProp,
  type ViewStyle,
} from "react-native"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

/** Smooth grow/shrink for the next layout change (no-op on web). */
export function animateLayout() {
  LayoutAnimation.configureNext({
    duration: 240,
    create: { type: "easeInEaseOut", property: "opacity" },
    update: { type: "easeInEaseOut" },
    delete: { type: "easeInEaseOut", property: "opacity", duration: 140 },
  })
}

export function FadeUp({
  children,
  delay = 0,
  distance = 10,
  style,
}: {
  children: ReactNode
  delay?: number
  distance?: number
  style?: StyleProp<ViewStyle>
}) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [progress, delay])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

export function Pop({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode
  delay?: number
  style?: StyleProp<ViewStyle>
}) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      delay,
      stiffness: 420,
      damping: 18,
      mass: 1,
      useNativeDriver: true,
    }).start()
  }, [progress, delay])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

export function Pulse({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>
}
