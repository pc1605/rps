import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function Skeleton({
  height = 16,
  width = "100%",
  radius,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
}) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(o, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <Animated.View
      style={[
        styles.box,
        {
          height,
          width,
          borderRadius: radius ?? styles.box.borderRadius,
          opacity: o,
        },
      ]}
    />
  );
}
const styles = StyleSheet.create((theme) => ({
  box: {
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.sm,
  },
}));
