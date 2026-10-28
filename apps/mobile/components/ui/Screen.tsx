import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

type Props = {
  children: ReactNode;
  /** Fixed header above the scroll area (e.g. <ScreenHeader/>). */
  header?: ReactNode;
  /** Bottom-anchored action area (primary button). Stays above the gesture bar. */
  footer?: ReactNode;
  /** Wrap content in a ScrollView (default true). Use false for FlatList screens. */
  scroll?: boolean;
  /** Safe-area edges to respect. Camera screens pass []. */
  edges?: Edge[];
  /** Pull-to-refresh etc. for the ScrollView. */
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
  /** Center content vertically (login, empty states). */
  centered?: boolean;
};

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  edges = ["top", "bottom", "left", "right"],
  refreshControl,
  centered = false,
}: Props) {
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, centered && styles.centered]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.flex, centered && styles.centered]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header}
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  inner: { width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.md },
  centered: { justifyContent: "center" },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
}));
