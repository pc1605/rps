import { batchCodeOf, UNIT_CODE_RE } from "@rps/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../../components/ui/AppButton";
import { Banner } from "../../components/ui/Banner";
import { Screen } from "../../components/ui/Screen";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/store";
import { useMyBatches, useScanUnit } from "../../features/batches/hooks";
import { useReworkReturn } from "../../features/rework/store";
import { ApiError } from "../../lib/api-client";
import { feedback as triggerFeedback } from "../../lib/feedback";
import { strings } from "../../lib/strings";
import { useOnline } from "../../lib/use-online";

type FlashState =
  | { kind: "ok"; code: string }
  | { kind: "dup"; code: string }
  | { kind: "quota"; mine: number; target: number }
  | { kind: "err"; msg: string }
  | { kind: "in_rework"; code: string }
  | { kind: "written_off" }
  | { kind: "sent" };

export default function ScanScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const consumeReworkReturn = useReworkReturn((s) => s.consume);
  const [permission, requestPermission] = useCameraPermissions();
  const { data: batches } = useMyBatches();
  const scanUnit = useScanUnit();
  const { worker } = useAuth();
  const isOnline = useOnline();

  const batch = batches?.find((b) => b.id === batchId);
  const [batchCode] = useState(batch?.batch_code ?? "");
  const isStitcher = worker?.station === "stitcher";
  const isPacker = worker?.station === "packer";

  const [progress, setProgress] = useState({
    done: (isStitcher ? batch?.units_stitched : batch?.units_packed) ?? 0,
    total: batch?.units_total ?? 0,
    mine: batch?.my_done_qty ?? 0,
    target: batch?.my_target_qty ?? null,
  });
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [inspectUnit, setInspectUnit] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [torch, setTorch] = useState(false);
  const lock = useRef(false);

  const flashAndUnlock = useCallback((fb: FlashState) => {
    setFlash(fb);

    if (fb.kind === "in_rework") {
      triggerFeedback("dup");
    } else if (fb.kind === "written_off") {
      triggerFeedback("err");
    } else {
      triggerFeedback(fb.kind);
    }

    try {
      if (fb.kind === "ok") {
        AccessibilityInfo.announceForAccessibility(`Scanned ${fb.code}`);
      } else if (fb.kind === "dup") {
        AccessibilityInfo.announceForAccessibility(`Already scanned ${fb.code}`);
      } else if (fb.kind === "quota") {
        AccessibilityInfo.announceForAccessibility("Your share is complete");
      } else if (fb.kind === "err") {
        AccessibilityInfo.announceForAccessibility(`Error: ${fb.msg}`);
      } else if (fb.kind === "in_rework") {
        AccessibilityInfo.announceForAccessibility(`${strings.scanner.inRework}: ${fb.code}`);
      } else if (fb.kind === "written_off") {
        AccessibilityInfo.announceForAccessibility(strings.scanner.writtenOff);
      }
    } catch {
      // Ignore a11y failure
    }

    setTimeout(() => {
      setFlash(null);
      lock.current = false;
    }, 1400);
  }, []);

  // Focus effect: re-arm scanner when regaining focus and consume rework return flag
  useFocusEffect(
    useCallback(() => {
      setInspectUnit(null);
      lock.current = false;
      if (consumeReworkReturn()) {
        flashAndUnlock({ kind: "sent" });
      }
    }, [consumeReworkReturn, flashAndUnlock]),
  );

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

  const executeScan = (code: string) => {
    scanUnit.mutate(code, {
      onSuccess: (res) => {
        setProgress((p) => ({
          ...p,
          done: res.done_count,
          total: res.total_units,
          mine: res.already_done ? p.mine : p.mine + 1,
        }));
        if (res.phase_completed || res.batch_completed) {
          triggerFeedback("ok");
          try {
            AccessibilityInfo.announceForAccessibility(
              isStitcher ? "Stitching complete" : `${batchCode} complete`,
            );
          } catch {
            // Ignore a11y failure
          }
          setDone(true);
          return;
        }
        flashAndUnlock(
          res.already_done ? { kind: "dup", code: res.unit_code } : { kind: "ok", code: res.unit_code },
        );
      },
      onError: (e) => {
        if (e instanceof ApiError && e.code === "in_rework") {
          flashAndUnlock({ kind: "in_rework", code });
          return;
        }
        if (e instanceof ApiError && e.code === "written_off") {
          flashAndUnlock({ kind: "written_off" });
          return;
        }
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

    // Packer: show inspect sheet instead of immediately scanning
    if (isPacker) {
      triggerFeedback("tick");
      setInspectUnit(code);
      return;
    }

    executeScan(code);
  };

  const handlePack = () => {
    if (!inspectUnit) return;
    const code = inspectUnit;
    setInspectUnit(null);
    executeScan(code);
  };

  const handleNeedsRework = () => {
    if (!inspectUnit) return;
    const code = inspectUnit;
    setInspectUnit(null);
    router.push({
      pathname: "/rework/new",
      params: { unitCode: code, batchId },
    });
  };

  const handleCancelInspect = () => {
    setInspectUnit(null);
    lock.current = false;
  };

  return (
    <Screen edges={[]} scroll={false}>
      <StatusBar style="light" />
      <CameraView
        style={styles.cameraView}
        facing="back"
        active={isFocused}
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
            <Text style={styles.topBarText}>{torch ? "🔦 Torch off" : "🔦 Torch on"}</Text>
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

        {/* Packer Inspect Sheet */}
        {inspectUnit && (
          <View style={styles.inspectSheet(insets)}>
            <Text style={styles.inspectUnitCode}>{inspectUnit}</Text>
            {batch && (
              <Text style={styles.inspectModelLine}>
                {batch.brand_name} {batch.model_name}
                {batch.line_name ? ` · ${batch.line_name}` : ""}
              </Text>
            )}
            <View style={styles.inspectActions}>
              <AppButton
                title={strings.inspect.pack}
                size="lg"
                onPress={handlePack}
                accessibilityLabel="Pack mat"
              />
              <AppButton
                title={strings.inspect.needsRework}
                variant="danger"
                size="lg"
                onPress={handleNeedsRework}
                accessibilityLabel="Needs rework"
              />
              <AppButton
                title={strings.inspect.cancel}
                variant="ghost"
                size="md"
                onPress={handleCancelInspect}
                accessibilityLabel="Cancel inspect"
              />
            </View>
          </View>
        )}

        {/* Bottom feedback flash */}
        <View style={styles.bottomFlashWrap(insets)} pointerEvents="box-none">
          {flash && (
            <View
              style={[
                styles.flash,
                flash.kind === "ok" && styles.flashOk,
                flash.kind === "dup" && styles.flashDup,
                flash.kind === "quota" && styles.flashQuota,
                flash.kind === "err" && styles.flashErr,
                flash.kind === "in_rework" && styles.flashInRework,
                flash.kind === "written_off" && styles.flashWrittenOff,
                flash.kind === "sent" && styles.flashSent,
              ]}
            >
              <Text style={styles.flashTitle}>
                {flash.kind === "ok" && `✓ ${flash.code}`}
                {flash.kind === "dup" && "Already scanned"}
                {flash.kind === "quota" && "Your share is complete ✓"}
                {flash.kind === "err" && `✗ ${flash.msg}`}
                {flash.kind === "in_rework" && `⏳ ${strings.scanner.inRework}`}
                {flash.kind === "written_off" && `✗ ${strings.scanner.writtenOff}`}
                {flash.kind === "sent" && `✓ ${strings.scanner.sentToRework}`}
              </Text>
              {flash.kind === "dup" && <Text style={styles.flashSub}>{flash.code}</Text>}
              {flash.kind === "in_rework" && <Text style={styles.flashSub}>{flash.code}</Text>}
              {flash.kind === "quota" && (
                <Text style={styles.flashSub}>
                  {flash.mine} / {flash.target} mats — leave the rest for your co-workers
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
  inspectSheet: (insets: EdgeInsets) => ({
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: insets.bottom + theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    gap: theme.spacing.xs,
  }),
  inspectUnitCode: {
    ...theme.text.codeLarge,
    color: theme.colors.text,
    textAlign: "center",
  },
  inspectModelLine: {
    ...theme.text.bodyMed,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  inspectActions: {
    width: "100%",
    maxWidth: 400,
    gap: theme.spacing.sm,
  },
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
  flashInRework: {
    backgroundColor: theme.colors.flash.dup,
  },
  flashWrittenOff: {
    backgroundColor: theme.colors.flash.err,
  },
  flashSent: {
    backgroundColor: theme.colors.flash.quota,
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
