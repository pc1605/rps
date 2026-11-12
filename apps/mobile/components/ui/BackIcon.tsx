import { type StyleProp, Text, type TextStyle, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type Tone = "text" | "accent" | "overlay";

/**
 * The app's one back arrow (←), drawn with views so it looks the same in every font and language
 * (as text characters, "←" is missing from the Hindi font and "‹" is too small to read as back).
 * `tone`: text = normal screens, accent = header back link, overlay = on top of the camera.
 */
export function BackIcon({ tone = "text" }: { tone?: Tone }) {
  const color = styles[tone].color;
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.shaft, { backgroundColor: color }]} />
      <View style={[styles.head, { borderColor: color }]} />
    </View>
  );
}

/** Back arrow followed by a label (a word, or a batch / unit code), on one line. */
export function BackLabel({
  label,
  tone = "text",
  textStyle,
}: {
  label: string;
  tone?: Tone;
  textStyle: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.row}>
      <BackIcon tone={tone} />
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs },
  box: { width: 20, height: 20 },
  // Shaft: a 2 px line through the middle. Head: a square's left + bottom edges turned 45°, tip at the left.
  shaft: { position: "absolute", left: 3, top: 9, width: 15, height: 2, borderRadius: 1 },
  head: {
    position: "absolute",
    left: 4,
    top: 5,
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  text: { color: theme.colors.text },
  accent: { color: theme.colors.accent },
  overlay: { color: theme.colors.overlayText },
}));
