import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  loading,
  disabled,
  icon,
}: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === "lg" ? styles.lg : styles.md,
        off && styles.off,
        pressed && !off && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? styles.primaryText.color : styles.secondaryText.color}
        />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            style={[
              styles.text,
              variant === "primary" || variant === "danger" ? styles.primaryText : styles.secondaryText,
              off && styles.offText,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  lg: { minHeight: theme.touch.primary },
  md: { minHeight: theme.touch.min },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  primary: { backgroundColor: theme.colors.accent },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: theme.colors.danger },
  pressed: { opacity: 0.85 },
  off: {
    backgroundColor: theme.colors.disabledBg,
    borderColor: theme.colors.disabledBg,
  },
  text: { ...theme.text.button },
  primaryText: { color: theme.colors.accentFg },
  secondaryText: { color: theme.colors.text },
  offText: { color: theme.colors.disabledFg },
}));
