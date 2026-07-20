import { Pressable, Text, ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native-unistyles";

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function AppButton({ title, onPress, disabled, loading }: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        off && styles.disabled,
        pressed && !off && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={styles.text.color} />
      ) : (
        <Text style={[styles.text, off && styles.textDisabled]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 18,
    alignItems: "center",
  },
  disabled: { backgroundColor: theme.colors.disabledBg },
  pressed: { opacity: 0.85 },
  text: { ...theme.text.button, color: theme.colors.accentFg },
  textDisabled: { color: theme.colors.disabledFg },
}));
