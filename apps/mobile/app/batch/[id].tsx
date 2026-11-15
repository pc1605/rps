import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../../components/ui/AppButton";
import { Banner } from "../../components/ui/Banner";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { Screen } from "../../components/ui/Screen";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { Stat } from "../../components/ui/Stat";
import { useAuth } from "../../features/auth/store";
import { useCompleteBatch, useMyBatches, useReleaseBatch, useStartBatch } from "../../features/batches/hooks";
import { packingRework } from "../../features/batches/packing";
import { errorText } from "../../lib/errors";
import { useStrings } from "../../lib/language";
import { useOnline } from "../../lib/use-online";

export default function BatchAction() {
  const strings = useStrings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { worker } = useAuth();
  const { data: batches, isPending } = useMyBatches();
  const startBatch = useStartBatch();
  const completeBatch = useCompleteBatch();
  const releaseBatch = useReleaseBatch();
  const isOnline = useOnline();

  const batch = useMemo(() => batches?.find((b) => b.id === id), [batches, id]);
  const [qty, setQty] = useState<string | null>(null); // null = untouched → prefill

  if (isPending) {
    return (
      <Screen header={<ScreenHeader back={strings.common.queue} />}>
        <View style={styles.skeletonContainer}>
          <Skeleton width="30%" height={36} />
          <Skeleton width="60%" height={28} />
          <Skeleton width="40%" height={20} />
          <Skeleton width="50%" height={56} />
          <Skeleton width="100%" height={90} />
        </View>
      </Screen>
    );
  }

  if (!batch) {
    return (
      <Screen header={<ScreenHeader back={strings.common.queue} />}>
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundTitle}>{strings.batch.notFoundTitle}</Text>
          <Text style={styles.notFoundText}>{strings.batch.notFoundBody}</Text>
          <AppButton
            title={strings.batch.backToQueue}
            variant="secondary"
            size="md"
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  const mine = batch.joined_by_me ?? false;
  const isCutter = worker?.station === "cutter";
  const isStitcher = worker?.station === "stitcher";
  const scanStation = isStitcher || worker?.station === "packer";
  const stitchDone = batch.units_stitched ?? 0;
  const remaining = batch.quantity - (batch.cut_qty ?? 0);
  const quantity = qty === null ? String(remaining) : qty;
  const qtyNum = parseInt(quantity, 10);
  const qtyValid = !Number.isNaN(qtyNum) && qtyNum >= 1 && qtyNum <= remaining;
  const sizeText = strings.size[batch.size_class] ?? batch.size_class;
  // Packer: mats out for rework stay in the batch — say so, so "3 / 4 packed" is not read as work left.
  const rework = worker?.station === "packer" ? packingRework(batch) : null;

  const onError = (e: unknown) => {
    Alert.alert(strings.common.couldntDoThat, errorText(strings, e, strings.common.somethingWrong));
  };

  const handleStart = () => startBatch.mutate(batch.id, { onError });

  const handleComplete = () => {
    if (qtyNum < remaining) {
      Alert.alert(strings.batch.shortCountTitle, strings.batch.shortCountBody(remaining, qtyNum), [
        { text: strings.common.cancel, style: "cancel" },
        { text: strings.batch.complete, onPress: doComplete },
      ]);
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
            strings.common.done,
            isCutter
              ? strings.batch.sentForAssignment(batch.batch_code)
              : strings.batch.sentToNext(batch.batch_code),
          );
          router.back();
        },
        onError,
      },
    );

  const handleRelease = () =>
    Alert.alert(strings.cutting.releaseTitle, strings.cutting.releaseBody, [
      { text: strings.cutting.keep, style: "cancel" },
      {
        text: strings.cutting.releaseConfirm,
        style: "destructive",
        onPress: () =>
          releaseBatch.mutate(batch.id, {
            onSuccess: () => {
              Alert.alert(strings.common.done, strings.cutting.released(batch.batch_code));
              router.back();
            },
            onError,
          }),
      },
    ]);

  const stepDecrement = () => {
    const current = Number.isNaN(qtyNum) ? 1 : qtyNum;
    setQty(String(Math.max(1, current - 1)));
  };

  const stepIncrement = () => {
    const current = Number.isNaN(qtyNum) ? 0 : qtyNum;
    setQty(String(Math.min(remaining, current + 1)));
  };

  const primaryAction = (() => {
    if (isCutter && !mine && batch.status === "pending") {
      return (
        <AppButton
          title={strings.batch.startCutting}
          size="lg"
          onPress={handleStart}
          loading={startBatch.isPending}
        />
      );
    }
    if (isCutter && mine) {
      return (
        <AppButton
          title={strings.batch.reportCut}
          size="lg"
          onPress={handleComplete}
          disabled={!qtyValid}
          loading={completeBatch.isPending}
        />
      );
    }
    if (scanStation && !mine) {
      return (
        <AppButton
          title={strings.batch.joinBatch}
          size="lg"
          onPress={handleStart}
          loading={startBatch.isPending}
        />
      );
    }
    if (scanStation && mine) {
      return (
        <AppButton
          title={strings.batch.openScanner}
          size="lg"
          onPress={() => router.push(`/scan/${batch.id}`)}
        />
      );
    }
    return undefined;
  })();

  return (
    <Screen
      header={<ScreenHeader back={strings.common.queue} title={batch.batch_code} />}
      footer={primaryAction}
    >
      {!isOnline && (
        <View style={styles.bannerWrap}>
          <Banner kind="warning" text={strings.common.offline} />
        </View>
      )}

      {/* Top: Batch Code + Phase */}
      <View style={styles.codeRow}>
        <Text style={styles.batchCode}>{batch.batch_code}</Text>
        <Chip
          label={strings.phase[batch.current_phase] ?? batch.current_phase}
          color={styles.phaseColor(batch.current_phase).color}
          dot
        />
      </View>

      <Text style={styles.modelLine}>
        {batch.brand_name} {batch.model_name}
        <Text style={styles.modelMeta}>
          {" · "}
          {sizeText}
          {batch.line_name ? ` · ${batch.line_name}` : ""}
        </Text>
      </Text>

      {/* Middle: Relevant Big Stat */}
      <Card style={styles.statCard}>
        {isCutter ? (
          <Stat value={batch.quantity} label={strings.batch.matsToCut} big />
        ) : batch.my_target_qty != null ? (
          <Stat value={batch.my_done_qty ?? 0} of={batch.my_target_qty} label={strings.batch.yourShare} big />
        ) : (
          <Stat
            value={isStitcher ? stitchDone : batch.units_packed}
            of={batch.units_total}
            label={isStitcher ? strings.batch.matsStitched : strings.batch.matsPacked}
            big
          />
        )}
        {rework && rework.inRework > 0 ? (
          <Text style={styles.reworkLine}>
            {strings.home.inRework(rework.inRework)}
            {" · "}
            {strings.home.leftToPack(rework.left)}
          </Text>
        ) : null}
      </Card>

      {/* Info Rows */}
      <View style={styles.infoSection}>
        {batch.assigned_workers ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{strings.batch.assignedWorkers}</Text>
            <Text style={styles.infoValue}>📌 {batch.assigned_workers}</Text>
          </View>
        ) : null}

        {batch.active_workers ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{strings.batch.activeWorkers}</Text>
            <Text style={styles.infoValue}>👤 {batch.active_workers}</Text>
          </View>
        ) : null}

        {batch.notes ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{strings.batch.notes}</Text>
            <Text style={styles.notesText}>✎ {batch.notes}</Text>
          </View>
        ) : null}
      </View>

      {/* Cutter mine stepper inside content */}
      {isCutter && mine && (
        <Card style={styles.stepperCard}>
          <Text style={styles.stepperCaption}>{strings.batch.piecesCompleted}</Text>
          <View style={styles.stepperRow}>
            <Pressable
              onPress={stepDecrement}
              disabled={qtyNum <= 1}
              accessibilityRole="button"
              accessibilityLabel={strings.batch.decreaseQty}
              accessibilityState={{ disabled: qtyNum <= 1 }}
              style={({ pressed }) => [
                styles.stepBtn,
                qtyNum <= 1 && styles.stepBtnDisabled,
                pressed && qtyNum > 1 && styles.stepBtnPressed,
              ]}
            >
              <Text style={[styles.stepBtnText, qtyNum <= 1 && styles.stepBtnTextDisabled]}>−</Text>
            </Pressable>

            <TextInput
              value={quantity}
              onChangeText={(t) => setQty(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              style={styles.stepperInput}
              accessibilityLabel={strings.batch.quantityCompleted}
            />

            <Pressable
              onPress={stepIncrement}
              disabled={qtyNum >= remaining}
              accessibilityRole="button"
              accessibilityLabel={strings.batch.increaseQty}
              accessibilityState={{ disabled: qtyNum >= remaining }}
              style={({ pressed }) => [
                styles.stepBtn,
                qtyNum >= remaining && styles.stepBtnDisabled,
                pressed && qtyNum < remaining && styles.stepBtnPressed,
              ]}
            >
              <Text style={[styles.stepBtnText, qtyNum >= remaining && styles.stepBtnTextDisabled]}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.stepperSubtext}>{strings.batch.remainingOf(remaining, batch.quantity)}</Text>
        </Card>
      )}

      {isCutter && mine && (
        <AppButton
          title={strings.cutting.release}
          variant="ghost"
          size="md"
          onPress={handleRelease}
          loading={releaseBatch.isPending}
        />
      )}

      {isCutter && !mine && batch.status === "in_progress" && (
        <View style={styles.takenNotice}>
          <Text style={styles.takenText}>{strings.batch.cuttingNow(batch.active_workers)}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  skeletonContainer: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    gap: theme.spacing.md,
  },
  notFoundWrap: {
    alignItems: "center",
    gap: theme.spacing.md,
    maxWidth: 400,
  },
  notFoundTitle: {
    ...theme.text.title,
    color: theme.colors.text,
    textAlign: "center",
  },
  notFoundText: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  bannerWrap: {
    marginBottom: theme.spacing.xs,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  batchCode: {
    ...theme.text.codeLarge,
    color: theme.colors.accent,
  },
  modelLine: {
    ...theme.text.bodyMed,
    color: theme.colors.text,
  },
  modelMeta: {
    ...theme.text.small,
    color: theme.colors.textMuted,
  },
  statCard: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  reworkLine: {
    ...theme.text.small,
    color: theme.colors.textMuted,
  },
  infoSection: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  infoRow: {
    gap: theme.spacing.xxs,
  },
  infoLabel: {
    ...theme.text.caption,
    color: theme.colors.textFaint,
  },
  infoValue: {
    ...theme.text.small,
    color: theme.colors.textMuted,
  },
  notesText: {
    ...theme.text.small,
    color: theme.colors.textMuted,
  },
  stepperCard: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  stepperCaption: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  stepBtn: {
    width: theme.touch.primary,
    minHeight: theme.touch.primary,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    justifyContent: "center",
    alignItems: "center",
  },
  stepBtnDisabled: {
    backgroundColor: theme.colors.disabledBg,
    borderColor: theme.colors.border,
  },
  stepBtnPressed: {
    opacity: 0.8,
  },
  stepBtnText: {
    ...theme.text.title,
    color: theme.colors.text,
  },
  stepBtnTextDisabled: {
    color: theme.colors.disabledFg,
  },
  stepperInput: {
    ...theme.text.display,
    fontVariant: ["tabular-nums"],
    color: theme.colors.text,
    minWidth: 100,
    textAlign: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
  },
  stepperSubtext: {
    ...theme.text.caption,
    color: theme.colors.textFaint,
  },
  takenNotice: {
    minHeight: theme.touch.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  takenText: {
    ...theme.text.small,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  phaseColor: (phase: string) => ({
    color: theme.colors.phase[phase as keyof typeof theme.colors.phase] ?? theme.colors.textMuted,
  }),
}));
