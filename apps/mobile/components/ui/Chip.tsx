import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function Chip({ label, color, dot }: { label: string; color?: string; dot?: boolean }) {
  return (
    <View style={[styles.chip, color && { borderColor: `${color}55` }]}>
      {dot && <View style={[styles.dot, { backgroundColor: color ?? styles.fallback.color }]} />}
      <Text style={[styles.text, color && { color }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...theme.text.caption, color: theme.colors.textMuted },
  fallback: { color: theme.colors.textMuted },
}));
