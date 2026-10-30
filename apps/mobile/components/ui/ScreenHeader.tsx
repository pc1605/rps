import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type Props = {
  title?: string;
  subtitle?: string;
  back?: boolean | string;
  onBack?: () => void;
  onPress?: () => void;
  right?: ReactNode;
  large?: boolean;
};

/** Standard 56px top bar. `large` = big title below (home-style). */
export function ScreenHeader({ title, subtitle, back, onBack, onPress, right, large }: Props) {
  const router = useRouter();
  return (
    <View>
      <View style={styles.bar}>
        {back ? (
          <Pressable
            onPress={onBack ?? onPress ?? (() => router.back())}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={typeof back === "string" ? `Back to ${back}` : "Back"}
          >
            <Text style={styles.backText}>‹ {typeof back === "string" ? back : "Back"}</Text>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
        {!large && title ? (
          <Text style={styles.barTitle} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <View style={styles.flex} />
        )}
        <View style={styles.right}>{right}</View>
      </View>
      {large && title ? (
        <View style={styles.large}>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.largeTitle} accessibilityRole="header">
            {title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  iconBtn: {
    minHeight: theme.touch.min,
    minWidth: theme.touch.min,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xs,
  },
  backText: { ...theme.text.bodyMed, color: theme.colors.accent },
  spacer: { width: theme.touch.min },
  flex: { flex: 1 },
  barTitle: { ...theme.text.heading, color: theme.colors.text, flex: 1, textAlign: "center" },
  right: { minWidth: theme.touch.min, alignItems: "flex-end" },
  large: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  subtitle: { ...theme.text.small, color: theme.colors.textMuted },
  largeTitle: { ...theme.text.title, color: theme.colors.text },
}));
