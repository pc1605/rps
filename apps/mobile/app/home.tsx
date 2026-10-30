import { PHASE_LABEL, SIZE_LABEL, STATION_LABEL, type ReworkEntry } from "@rps/shared";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AuthImage } from "../components/AuthImage";
import { AppButton } from "../components/ui/AppButton";
import { Banner } from "../components/ui/Banner";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Screen } from "../components/ui/Screen";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { Stat } from "../components/ui/Stat";
import { useAuth } from "../features/auth/store";
import { useMyBatches } from "../features/batches/hooks";
import type { Batch } from "../features/batches/types";
import { useMyRework } from "../features/rework/hooks";
import { strings } from "../lib/strings";
import { useOnline } from "../lib/use-online";

function ReworkCard({ item, onOpen }: { item: ReworkEntry; onOpen: (item: ReworkEntry) => void }) {
  const modelText =
    item.brand_name && item.model_name ? `${item.brand_name} ${item.model_name}` : (item.batch_code ?? "");
  const metaText = item.size_class
    ? `${SIZE_LABEL[item.size_class] ?? item.size_class}${item.line_name ? ` · ${item.line_name}` : ""}`
    : (item.line_name ?? "");

  const firstPhoto = item.photos?.[0];

  return (
    <Pressable
      onPress={() => onOpen(item)}
      accessibilityRole="button"
      accessibilityLabel={`Rework ${item.unit_code ?? ""}, ${modelText}`}
    >
      <Card style={styles.reworkCard}>
        <View style={styles.reworkCardContent}>
          {firstPhoto && (
            <AuthImage
              url={firstPhoto.url}
              accessibilityLabel="Rework defect photo"
              style={styles.reworkThumb}
            />
          )}
          <View style={styles.reworkInfo}>
            <View style={styles.cardHeader}>
              <Text style={styles.reworkCode}>{item.unit_code}</Text>
              {item.round > 1 && (
                <View style={styles.roundBadge}>
                  <Text style={styles.roundBadgeText}>{strings.rework.roundBadge(item.round)}</Text>
                </View>
              )}
            </View>

            <View style={styles.modelLine}>
              <Text style={styles.modelName}>{modelText}</Text>
              {metaText ? <Text style={styles.modelMeta}>{metaText}</Text> : null}
            </View>

            <View style={styles.reasonsRow}>
              {item.reasons.map((r) => {
                const reasonInfo = strings.rework.reasons[r];
                return (
                  <Chip
                    key={r}
                    label={`${reasonInfo?.emoji ?? "•"} ${reasonInfo?.label ?? r}`}
                    color={styles.dangerColor.color}
                  />
                );
              })}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function BatchCard({
  batch,
  station,
  onOpen,
}: {
  batch: Batch;
  station?: string;
  onOpen: (b: Batch) => void;
}) {
  const mine = batch.joined_by_me ?? false;
  // Only cutters are locked out of an in-progress batch;
  // stitchers/packers can always open & join.
  const blocked = station === "cutter" && batch.status === "in_progress" && !mine;
  const sizeText = SIZE_LABEL[batch.size_class as keyof typeof SIZE_LABEL] ?? batch.size_class;

  return (
    <Pressable
      onPress={() => onOpen(batch)}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={`Batch ${batch.batch_code}, ${batch.brand_name} ${batch.model_name}`}
      accessibilityState={{ disabled: blocked }}
    >
      <Card style={[styles.batchCard, mine && styles.cardMine, blocked && styles.cardBlocked]}>
        <View style={styles.cardHeader}>
          <Text style={styles.batchCode}>{batch.batch_code}</Text>
          <Chip
            label={PHASE_LABEL[batch.current_phase] ?? batch.current_phase}
            color={styles.phaseColor(batch.current_phase).color}
            dot
          />
        </View>

        <View style={styles.modelLine}>
          <Text style={styles.modelName}>
            {batch.brand_name} {batch.model_name}
          </Text>
          <Text style={styles.modelMeta}>
            {sizeText}
            {batch.line_name ? ` · ${batch.line_name}` : ""}
          </Text>
        </View>

        <View style={styles.statWrap}>
          {station === "cutter" ? (
            <Stat value={batch.quantity} label="mats" />
          ) : batch.my_target_qty != null ? (
            <Stat value={batch.my_done_qty ?? 0} of={batch.my_target_qty} label="your share" />
          ) : (
            <Stat
              value={station === "stitcher" ? (batch.units_stitched ?? 0) : batch.units_packed}
              of={batch.units_total}
              label={station === "stitcher" ? "stitched" : "packed"}
            />
          )}
        </View>

        {blocked ? (
          <View style={styles.footerRow}>
            <Chip
              label={`⏳ ${batch.active_workers ?? "Another cutter"} is cutting`}
              color={styles.textMuted.color}
            />
          </View>
        ) : (
          (batch.assigned_to_me || batch.active_workers || mine) && (
            <View style={styles.footerRow}>
              {batch.assigned_to_me && (
                <Chip
                  label={
                    batch.assigned_workers?.includes(",")
                      ? `📌 Assigned to you (with ${batch.assigned_workers})`
                      : "📌 Assigned to you"
                  }
                  color={styles.accentColor.color}
                />
              )}
              {batch.active_workers && !mine && (
                <Chip label={`👤 ${batch.active_workers}`} color={styles.textMuted.color} />
              )}
              {mine && <Chip label="You're in" color={styles.successColor.color} dot />}
            </View>
          )
        )}
      </Card>
    </Pressable>
  );
}

function QueueSkeleton() {
  return (
    <View style={styles.listContent}>
      {[0, 1, 2].map((key) => (
        <Card key={key} style={styles.skeletonCard}>
          <View style={styles.cardHeader}>
            <Skeleton width="40%" height={20} />
            <Skeleton width="25%" height={20} radius={6} />
          </View>
          <Skeleton width="55%" height={16} />
          <Skeleton width="35%" height={32} />
          <Skeleton width="45%" height={14} />
        </Card>
      ))}
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { worker, restore, logout } = useAuth();
  const { data: batches, isPending, isError, isRefetching, refetch } = useMyBatches();
  const { data: reworkItems, refetch: refetchRework } = useMyRework();
  const isOnline = useOnline();

  // Cold-start: token exists but profile not loaded yet
  useEffect(() => {
    if (!worker) restore();
  }, [worker, restore]);

  const stationTitle = worker
    ? `${STATION_LABEL[worker.station as keyof typeof STATION_LABEL] ?? worker.station} queue`
    : "My queue";

  const handleRefresh = () => {
    refetch();
    if (worker?.station === "stitcher") {
      refetchRework();
    }
  };

  const hasRework = (reworkItems?.length ?? 0) > 0;

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          large
          subtitle={stationTitle}
          title={worker?.name ?? "…"}
          right={
            <AppButton
              title="Sign out"
              variant="ghost"
              size="md"
              onPress={async () => {
                await logout();
                router.replace("/login");
              }}
            />
          }
        />
      }
    >
      {!isOnline && (
        <View style={styles.bannerWrap}>
          <Banner kind="warning" text="You're offline — changes will sync when you reconnect" />
        </View>
      )}

      {/* Queue */}
      {isPending ? (
        <QueueSkeleton />
      ) : isError ? (
        <View style={styles.center}>
          <Banner
            kind="danger"
            text="Couldn't load your queue. Check connection and retry."
            actionLabel="Retry"
            onAction={() => handleRefresh()}
          />
        </View>
      ) : (
        <FlatList
          data={batches ?? []}
          keyExtractor={(b) => b.id}
          ListHeaderComponent={
            hasRework ? (
              <View style={styles.reworkSection}>
                <View style={styles.reworkSectionHeader}>
                  <Text style={styles.reworkSectionTitle}>{strings.rework.homeSectionTitle}</Text>
                  <View style={styles.reworkCountBadge}>
                    <Text style={styles.reworkCountBadgeText}>{reworkItems?.length}</Text>
                  </View>
                </View>
                <View style={styles.reworkList}>
                  {reworkItems?.map((item) => (
                    <ReworkCard key={item.id} item={item} onOpen={(it) => router.push(`/rework/${it.id}`)} />
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <BatchCard batch={item} station={worker?.station} onOpen={(b) => router.push(`/batch/${b.id}`)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !hasRework ? (
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>All clear</Text>
                <Text style={styles.emptyText}>Nothing waiting at your station.</Text>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  bannerWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  listContent: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
    flexGrow: 1,
  },
  batchCard: {
    gap: theme.spacing.sm,
  },
  cardMine: {
    borderColor: theme.colors.accent,
    borderWidth: 1.5,
  },
  cardBlocked: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  batchCode: {
    ...theme.text.code,
    color: theme.colors.accent,
  },
  modelLine: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  modelName: {
    ...theme.text.bodyMed,
    color: theme.colors.text,
  },
  modelMeta: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
  },
  statWrap: {
    paddingVertical: theme.spacing.xxs,
  },
  footerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xxs,
  },
  skeletonCard: {
    gap: theme.spacing.sm,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
  },
  emptyTitle: {
    ...theme.text.heading,
    color: theme.colors.text,
    textAlign: "center",
  },
  emptyText: {
    ...theme.text.small,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  reworkSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  reworkSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  reworkSectionTitle: {
    ...theme.text.heading,
    color: theme.colors.text,
  },
  reworkCountBadge: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reworkCountBadgeText: {
    ...theme.text.caption,
    color: theme.colors.overlayText,
  },
  reworkList: {
    gap: theme.spacing.sm,
  },
  reworkCard: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reworkCardContent: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "center",
  },
  reworkThumb: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  reworkInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  reworkCode: {
    ...theme.text.code,
    color: theme.colors.text,
  },
  roundBadge: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  roundBadgeText: {
    ...theme.text.caption,
    color: theme.colors.danger,
  },
  reasonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xxs,
    marginTop: theme.spacing.xxs,
  },
  phaseColor: (phase: string) => ({
    color: theme.colors.phase[phase as keyof typeof theme.colors.phase] ?? theme.colors.textMuted,
  }),
  accentColor: {
    color: theme.colors.accent,
  },
  textMuted: {
    color: theme.colors.textMuted,
  },
  successColor: {
    color: theme.colors.success,
  },
  dangerColor: {
    color: theme.colors.danger,
  },
}));
