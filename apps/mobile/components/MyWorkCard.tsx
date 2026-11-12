import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useMySummary } from "../features/me/hooks";
import { useStrings } from "../lib/language";
import { ForwardIcon } from "./ui/BackIcon";
import { Card } from "./ui/Card";
import { Stat } from "./ui/Stat";

/**
 * Home "My work": today and this week (from Monday) at the worker's station. Counts only — never ₹ (D40).
 * The whole card opens the month screen (app/history.tsx).
 */
export function MyWorkCard() {
  const strings = useStrings();
  const router = useRouter();
  const { data } = useMySummary();
  if (!data) return null;
  const unit = strings.myWork.unit[data.station] ?? data.unit;
  const notes: string[] = [];
  if (data.rework_returned) notes.push(strings.myWork.reworkReturned(data.rework_returned));
  if (data.rework_open) notes.push(strings.myWork.reworkOpen(data.rework_open));
  if (data.flagged) notes.push(strings.myWork.flagged(data.flagged));

  return (
    <Pressable
      onPress={() => router.push("/history")}
      accessibilityRole="button"
      accessibilityLabel={`${strings.myWork.title}, ${strings.myWork.seeMonth}`}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {strings.myWork.title} · <Text style={styles.unit}>{unit}</Text>
          </Text>
          <View style={styles.hint}>
            <Text style={styles.hintText}>{strings.myWork.seeMonth}</Text>
            <ForwardIcon tone="accent" />
          </View>
        </View>
        <View style={styles.row}>
          <Stat value={data.today} label={strings.myWork.today} />
          <Stat value={data.week} label={strings.myWork.thisWeek} />
        </View>
        {notes.map((n) => (
          <Text key={n} style={styles.note}>
            {n}
          </Text>
        ))}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  // Title left, "see month" right; the hint drops to its own line when the two don't fit (Hindi, large fonts).
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: theme.spacing.sm,
    rowGap: theme.spacing.xxs,
  },
  title: { ...theme.text.label, color: theme.colors.textMuted, flexShrink: 1 },
  unit: { ...theme.text.label, color: theme.colors.textFaint },
  hint: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs },
  hintText: { ...theme.text.caption, color: theme.colors.accent },
  row: { flexDirection: "row", gap: theme.spacing.xl },
  note: { ...theme.text.small, color: theme.colors.textMuted },
}));
