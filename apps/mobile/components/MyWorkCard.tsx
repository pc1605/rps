import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useMySummary } from "../features/me/hooks";
import { strings } from "../lib/strings";
import { Card } from "./ui/Card";
import { Stat } from "./ui/Stat";

/** Home "My work": today and this week (from Monday) at the worker's station. No ₹ until Slice D. */
export function MyWorkCard() {
  const { data } = useMySummary();
  if (!data) return null;
  const unit = strings.myWork.unit[data.station] ?? data.unit;
  const notes: string[] = [];
  if (data.rework_returned) notes.push(strings.myWork.reworkReturned(data.rework_returned));
  if (data.rework_open) notes.push(strings.myWork.reworkOpen(data.rework_open));
  if (data.flagged) notes.push(strings.myWork.flagged(data.flagged));

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>
        {strings.myWork.title} · <Text style={styles.unit}>{unit}</Text>
      </Text>
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
  );
}

const styles = StyleSheet.create((theme) => ({
  card: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  title: { ...theme.text.label, color: theme.colors.textMuted },
  unit: { ...theme.text.label, color: theme.colors.textFaint },
  row: { flexDirection: "row", gap: theme.spacing.xl },
  note: { ...theme.text.small, color: theme.colors.textMuted },
}));
