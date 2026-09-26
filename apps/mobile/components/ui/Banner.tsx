import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function Banner({
  kind = "info",
  text,
  actionLabel,
  onAction,
}: {
  kind?: "info" | "warning" | "danger";
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.wrap, styles[kind]]} accessibilityRole="alert">
      <Text style={styles.text}>{text}</Text>
      {actionLabel && (
        <Pressable onPress={onAction} hitSlop={12}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  info: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.border,
  },
  warning: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: `${theme.colors.accent}55`,
  },
  danger: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: `${theme.colors.danger}55`,
  },
  text: { ...theme.text.small, color: theme.colors.text, flex: 1 },
  action: {
    ...theme.text.caption,
    color: theme.colors.accent,
    minHeight: 32,
    lineHeight: 32,
  },
}));
