import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native-unistyles";
import { Screen } from "../../components/ui/Screen";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../features/auth/store";
import {
  useMyBatches,
  useStartBatch,
  useCompleteBatch,
} from "../../features/batches/hooks";
import { ApiError } from "../../lib/api-client";
import { AppButton } from "../../components/ui/AppButton";

export default function BatchAction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { worker } = useAuth();
  const { data: batches } = useMyBatches();
  const startBatch = useStartBatch();
  const completeBatch = useCompleteBatch();

  const batch = useMemo(() => batches?.find((b) => b.id === id), [batches, id]);
  const [qty, setQty] = useState<string | null>(null); // null = untouched → prefill

  if (!batch) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator />
      </Screen>
    );
  }

  const mine =
    batch.status === "in_progress" && batch.active_worker_id === worker?.id;
  const available = batch.status === "pending";
  const quantity = qty === null ? String(batch.quantity) : qty;
  const qtyNum = parseInt(quantity, 10);
  const qtyValid =
    !isNaN(qtyNum) && qtyNum >= 0 && qtyNum <= batch.quantity * 2;

  const onError = (e: unknown) => {
    const msg = e instanceof ApiError ? e.message : "Something went wrong";
    Alert.alert("Couldn't do that", msg);
  };

  const handleStart = () => startBatch.mutate(batch.id, { onError });

  const handleComplete = () => {
    if (qtyNum < batch.quantity) {
      Alert.alert(
        "Short count",
        `Batch is ${batch.quantity} mats but you entered ${qtyNum}. Complete anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete", onPress: doComplete },
        ],
      );
    } else {
      doComplete();
    }
  };

  const doComplete = () =>
    completeBatch.mutate(
      { id: batch.id, qty: qtyNum },
      {
        onSuccess: () => {
          Alert.alert(
            "Done ✓",
            `${batch.batch_code} sent to the next station.`,
          );
          router.back();
        },
        onError,
      },
    );

  return (
    <Screen>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Queue</Text>
        </Pressable>

        <Text style={styles.code}>{batch.batch_code}</Text>
        <Text style={styles.model}>
          {batch.brand_name} {batch.model_name} · {batch.quantity} mats ·{" "}
          {batch.size_class.toUpperCase()}
        </Text>
        {batch.notes ? <Text style={styles.notes}>✎ {batch.notes}</Text> : null}

        {available && (
          <Card style={styles.actionCard}>
            <Text style={styles.actionHint}>
              Starting locks this batch to you until you complete it.
            </Text>
            <AppButton
              title="Start cutting ▶"
              onPress={handleStart}
              loading={startBatch.isPending}
            />
          </Card>
        )}

        {mine && (
          <Card style={styles.actionCard}>
            <Text style={styles.label}>PIECES COMPLETED</Text>
            <TextInput
              value={quantity}
              onChangeText={setQty}
              keyboardType="number-pad"
              style={styles.qtyInput}
            />
            <AppButton
              title="Complete → send to next station"
              onPress={handleComplete}
              disabled={!qtyValid}
              loading={completeBatch.isPending}
            />
          </Card>
        )}

        {batch.status === "in_progress" && !mine && (
          <Card style={styles.actionCard}>
            <Text style={styles.takenText}>
              ⏳ {batch.active_worker_name} is working on this batch.
            </Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  center: { justifyContent: "center", alignItems: "center" },
  content: { flex: 1, padding: theme.spacing.lg, paddingTop: 64 },
  back: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: theme.spacing.lg,
  },
  code: {
    color: theme.colors.accent,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  model: { color: theme.colors.text, fontSize: 15, marginTop: 6 },
  notes: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: theme.spacing.sm,
  },
  actionCard: { marginTop: theme.spacing.xl, gap: theme.spacing.md },
  actionHint: { color: theme.colors.textMuted, fontSize: 13 },
  label: { ...theme.text.label, color: theme.colors.textMuted },
  qtyInput: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  takenText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
}));
