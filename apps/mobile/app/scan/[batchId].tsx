import { batchCodeOf, UNIT_CODE_RE } from "@rps/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../../components/ui/AppButton";
import { Banner } from "../../components/ui/Banner";
import { Screen } from "../../components/ui/Screen";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/store";
import { useMyBatches, useScanUnit } from "../../features/batches/hooks";
import { ApiError } from "../../lib/api-client";
import { useOnline } from "../../lib/use-online";

type Feedback =
  | { kind: "ok"; code: string }
  | { kind: "dup"; code: string }
  | { kind: "quota"; mine: number; target: number }
  | { kind: "err"; msg: string };

export default function ScanScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { data: batches } = useMyBatches();
  const scanUnit = useScanUnit();
  const { worker } = useAuth();
  const isOnline = useOnline();

  const batch = batches?.find((b) => b.id === batchId);
  const [batchCode] = useState(batch?.batch_code ?? "");
  const isStitcher = worker?.station === "stitcher";

  const [progress, setProgress] = useState({
    done: (isStitcher ? batch?.units_stitched : batch?.units_packed) ?? 0,
    total: batch?.units_total ?? 0,
    mine: batch?.my_done_qty ?? 0,
    target: batch?.my_target_qty ?? null,
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(false);
  const [torch, setTorch] = useState(false);
  const lock = useRef(false);

  // --- permission states ---
  if (!permission) {
    return (
      <Screen centered>
        <Skeleton width="60%" height={24} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen centered footer={<AppButton title="Allow camera" size="lg" onPress={requestPermission} />}>
        <View style={styles.permContent}>
          <Text style={styles.permTitle}>Camera needed</Text>
          <Text style={styles.permText}>RPS uses the camera to scan unit QR labels.</Text>
          <AppButton title="← Back" variant="ghost" size="md" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  // --- batch completed state ---
  if (done) {
    return (
      <Screen
        centered
        footer={<AppButton title="Back to my queue" size="lg" onPress={() => router.replace("/home")} />}
      >
        <View style={styles.doneContent}>
          <Text style={styles.doneEmoji}>✓</Text>
          <Text style={styles.doneTitle}>{isStitcher ? "Stitching complete" : `${batchCode} complete`}</Text>
          <Text style={styles.doneText}>
            {isStitcher
              ? `All ${progress.total} mats stitched — batch sent to packing.`
              : `All ${progress.total} mats packed and sent to the stockyard.`}
          </Text>
        </View>
      </Screen>
    );
  }

  const flashAndUnlock = (fb: Feedback) => {
    setFeedback(fb);

    // Haptics & a11y announcements
    try {
      if (fb.kind === "ok") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(`Scanned ${fb.code}`);
      } else if (fb.kind === "dup") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        AccessibilityInfo.announceForAccessibility(`Already scanned ${fb.code}`);
      } else if (fb.kind === "quota") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        AccessibilityInfo.announceForAccessibility("Your share is complete");
      } else if (fb.kind === "err") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        AccessibilityInfo.announceForAccessibility(`Error: ${fb.msg}`);
      }
    } catch {
      // Haptics can silently fail on unsupported devices
    }

    setTimeout(() => {
      setFeedback(null);
      lock.current = false;
    }, 1400);
  };

  const handleScanned = ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;

    if (!isOnline) {
      flashAndUnlock({ kind: "err", msg: "Offline — reconnect to scan" });
      return;
    }

    const code = data.trim();

    // Local validation — no network for obviously wrong scans
    if (!UNIT_CODE_RE.test(code)) {
      flashAndUnlock({ kind: "err", msg: "Not an RPS unit label" });
      return;
    }
    if (batch && !code.startsWith(`${batch.batch_code}-`)) {
      const otherBatch = batchCodeOf(code);
      flashAndUnlock({
        kind: "err",
        msg: `Wrong batch — this mat is from ${otherBatch}`,
      });
      return;
    }

    scanUnit.mutate(code, {
      onSuccess: (res) => {
        setProgress((p) => ({
          ...p,
          done: res.done_count,
          total: res.total_units,
          mine: res.already_done ? p.mine : p.mine + 1,
        }));
        if (res.phase_completed || res.batch_completed) {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            AccessibilityInfo.announceForAccessibility(
              isStitcher ? "Stitching complete" : `${batchCode} complete`,
            );
          } catch {
            // Ignore haptic failure
          }
          setDone(true);
          return;
        }
        flashAndUnlock(
          res.already_done ? { kind: "dup", code: res.unit_code } : { kind: "ok", code: res.unit_code },
        );
      },
      onError: (e) => {
        if (e instanceof ApiError && e.code === "quota_reached") {
          flashAndUnlock({
            kind: "quota",
            mine: progress.mine,
            target: progress.target ?? progress.mine,
          });
          return;
        }
        flashAndUnlock({
          kind: "err",
          msg: e instanceof ApiError ? e.message : "Scan failed — try again",
        });
      },
    });
  };

  return (
    <Screen edges={[]} scroll={false}>
      <StatusBar style="light" />
      <CameraView
        style={styles.cameraView}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScanned}
      />

      {/* Overlay container with flex positioning */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.topBar(insets)}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to queue"
            style={styles.topBarBtn}
          >
            <Text style={styles.topBarText}>← {batch?.batch_code ?? "Back"}</Text>
          </Pressable>
          <Pressable
            onPress={() => setTorch((t) => !t)}
            accessibilityRole="button"
            accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
            accessibilityState={{ selected: torch }}
            style={styles.topBarBtn}
          >
            <Text style={styles.topBarText}>{torch ? "🔦 Torch on" : "🔦 Torch off"}</Text>
          </Pressable>
        </View>

        {/* Top badges / notices */}
        <View style={styles.topNotices(insets)} pointerEvents="box-none">
          {!isOnline && (
            <View style={styles.offlineBannerWrap}>
              <Banner kind="warning" text="You're offline — changes will sync when you reconnect" />
            </View>
          )}

          <View style={styles.progressWrap}>
            <Text style={styles.progressText}>
              {progress.target != null
                ? `${progress.mine}/${progress.target} yours · ${progress.done}/${progress.total} batch`
                : `${progress.done} / ${progress.total} ${isStitcher ? "stitched" : "packed"}`}
            </Text>
          </View>
        </View>

        {/* Scan Frame */}
        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
          <Text style={styles.frameHint}>Point at a unit QR label</Text>
        </View>

        {/* Bottom feedback flash */}
        <View style={styles.bottomFlashWrap(insets)} pointerEvents="box-none">
          {feedback && (
            <View
              style={[
                styles.flash,
                feedback.kind === "ok" && styles.flashOk,
                feedback.kind === "dup" && styles.flashDup,
                feedback.kind === "quota" && styles.flashQuota,
                feedback.kind === "err" && styles.flashErr,
              ]}
            >
              <Text style={styles.flashTitle}>
                {feedback.kind === "ok" && `✓ ${feedback.code}`}
                {feedback.kind === "dup" && "Already scanned"}
                {feedback.kind === "quota" && "Your share is complete ✓"}
                {feedback.kind === "err" && `✗ ${feedback.msg}`}
              </Text>
              {feedback.kind === "dup" && <Text style={styles.flashSub}>{feedback.code}</Text>}
              {feedback.kind === "quota" && (
                <Text style={styles.flashSub}>
                  {feedback.mine} / {feedback.target} mats — leave the rest for your co-workers
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  cameraView: {
    ...StyleSheet.absoluteFillObject,
  },
  permContent: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  permTitle: {
    ...theme.text.title,
    color: theme.colors.text,
    textAlign: "center",
  },
  permText: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  doneContent: {
    alignItems: "center",
  },
  doneEmoji: {
    ...theme.text.display,
    color: theme.colors.success,
  },
  doneTitle: {
    ...theme.text.title,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
  doneText: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: (insets: EdgeInsets) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56 + insets.top + theme.spacing.xs,
    paddingTop: insets.top + theme.spacing.xs,
    paddingLeft: insets.left + theme.spacing.md,
    paddingRight: insets.right + theme.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.overlay,
  }),
  topBarBtn: {
    minHeight: theme.touch.min,
    minWidth: theme.touch.min,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  topBarText: {
    ...theme.text.bodyMed,
    color: theme.colors.overlayText,
  },
  topNotices: (insets: EdgeInsets) => ({
    position: "absolute",
    top: insets.top + 56 + theme.spacing.xs,
    left: insets.left + theme.spacing.md,
    right: insets.right + theme.spacing.md,
    alignItems: "center",
    gap: theme.spacing.xs,
  }),
  offlineBannerWrap: {
    width: "100%",
    maxWidth: 480,
  },
  progressWrap: {
    backgroundColor: theme.colors.overlaySurface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  progressText: {
    ...theme.text.stat,
    fontVariant: ["tabular-nums"],
    color: theme.colors.overlayText,
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: theme.radius.lg,
    borderWidth: 3,
    borderColor: theme.colors.overlayBorder,
  },
  frameHint: {
    ...theme.text.small,
    color: theme.colors.overlayTextMuted,
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
  bottomFlashWrap: (insets: EdgeInsets) => ({
    position: "absolute",
    bottom: insets.bottom + theme.spacing.lg,
    left: insets.left + theme.spacing.md,
    right: insets.right + theme.spacing.md,
    alignItems: "center",
  }),
  flash: {
    width: "100%",
    maxWidth: 480,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: "center",
  },
  flashOk: {
    backgroundColor: theme.colors.flash.ok,
  },
  flashDup: {
    backgroundColor: theme.colors.flash.dup,
  },
  flashQuota: {
    backgroundColor: theme.colors.flash.quota,
  },
  flashErr: {
    backgroundColor: theme.colors.flash.err,
  },
  flashTitle: {
    ...theme.text.heading,
    color: theme.colors.overlayText,
    textAlign: "center",
  },
  flashSub: {
    ...theme.text.small,
    color: theme.colors.overlayTextMuted,
    marginTop: theme.spacing.xxs,
    textAlign: "center",
  },
}));
