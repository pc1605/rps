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
  accessibilityRole?: "button" | "link";
  accessibilityLabel?: string;
};

const HIT_SLOP = 6;

export function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  loading,
  disabled,
  icon,
  accessibilityRole = "button",
  accessibilityLabel,
}: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      // A new Pressable each time the button switches on or off: on the phone, a tap on a button that
      // had just come back on (Join batch → Open scanner) was sometimes ignored.
      key={off ? "off" : "on"}
      // A tap that lands just outside the button still counts. Half the gap between stacked buttons,
      // so two neighbours never claim the same spot.
      hitSlop={HIT_SLOP}
      onPress={onPress}
      disabled={off}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? title}
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
    paddingVertical: theme.spacing.xs,
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
  // A long title (Hindi, or the largest font size) wraps inside the button.
  text: { ...theme.text.button, flexShrink: 1, textAlign: "center" },
  primaryText: { color: theme.colors.accentFg },
  secondaryText: { color: theme.colors.text },
  offText: { color: theme.colors.disabledFg },
}));
