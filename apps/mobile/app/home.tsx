import { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native-unistyles";
import { useAuth } from "../features/auth/store";
import { useMyBatches } from "../features/batches/hooks";
import { Screen } from "../components/ui/Screen";
import { Card } from "../components/ui/Card";
import type { Batch } from "../features/batches/types";

const stationLabel: Record<string, string> = {
  cutter: "Cutting queue",
  stitcher: "Stitching queue",
  packer: "Packing queue",
};

function BatchCard({
  batch,
  myWorkerId,
  onOpen,
}: {
  batch: Batch;
  myWorkerId?: string;
  onOpen: (b: Batch) => void;
}) {
  const claimed = batch.status === "in_progress";
  const mine = claimed && batch.active_worker_id === myWorkerId;
  const daysAgo = Math.floor(
    (Date.now() - new Date(batch.created_at).getTime()) / 86_400_000,
  );

  return (
    <Pressable onPress={() => onOpen(batch)} disabled={claimed && !mine}>
      <Card
        style={[
          styles.batchCard,
          mine && styles.cardMine,
          claimed && !mine && styles.cardTaken,
        ]}
      >
        <View style={styles.batchRow}>
          <Text style={styles.batchCode}>{batch.batch_code}</Text>
          <Text style={styles.batchQty}>{batch.quantity} mats</Text>
        </View>
        <Text style={styles.batchModel}>
          {batch.brand_name} {batch.model_name}
          <Text style={styles.batchSize}>
            {" "}
            · {batch.size_class.toUpperCase()}
          </Text>
        </Text>
        {mine && (
          <Text style={styles.mineTag}>
            ▶ You're working on this — tap to continue
          </Text>
        )}
        {claimed && !mine && (
          <Text style={styles.takenTag}>
            ⏳ In progress · {batch.active_worker_name}
          </Text>
        )}
        {!claimed && (
          <Text style={styles.batchAge}>
            {daysAgo === 0 ? "Added today" : `Waiting ${daysAgo}d`}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const { worker, restore, logout } = useAuth();
  const { data: batches, isLoading, isRefetching, refetch } = useMyBatches();

  // Cold-start: token exists but profile not loaded yet
  useEffect(() => {
    if (!worker) restore();
  }, [worker, restore]);

  return (
    <Screen>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>
            {worker ? (stationLabel[worker.station] ?? "My queue") : "My queue"}
          </Text>
          <Text style={styles.name}>{worker?.name ?? "…"}</Text>
        </View>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
          hitSlop={12}
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {/* Queue */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={batches ?? []}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <BatchCard
              batch={item}
              myWorkerId={worker?.id}
              onOpen={(b) => router.push(`/batch/${b.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>All clear ✓</Text>
              <Text style={styles.emptyText}>
                No batches waiting at your station right now.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 64,
    paddingBottom: theme.spacing.md,
  },
  eyebrow: { ...theme.text.eyebrow, color: theme.colors.accent },
  name: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 2,
  },
  signOut: {
    color: theme.colors.textFaint,
    textDecorationLine: "underline",
    fontSize: 13,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
    flexGrow: 1,
  },
  batchCard: { gap: 4 },
  batchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  batchCode: {
    color: theme.colors.accent,
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  batchQty: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "600" },
  batchModel: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  batchSize: { color: theme.colors.textFaint, fontSize: 11, fontWeight: "700" },
  batchNotes: { color: theme.colors.textMuted, fontSize: 12 },
  batchAge: { color: theme.colors.textFaint, fontSize: 11, marginTop: 2 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingTop: 80,
  },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  cardMine: { borderColor: theme.colors.accent, borderWidth: 1.5 },
  cardTaken: { opacity: 0.45 },
  mineTag: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  takenTag: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
}));
