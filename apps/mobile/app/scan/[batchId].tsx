import { batchCodeOf, UNIT_CODE_RE } from "@rps/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, Text, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../../components/ui/AppButton";
import { BackIcon, BackLabel } from "../../components/ui/BackIcon";
import { Banner } from "../../components/ui/Banner";
import { Screen } from "../../components/ui/Screen";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/store";
import { peekUnit } from "../../features/batches/api";
import { useMyBatches, useScanUnit } from "../../features/batches/hooks";
import { useReworkReturn } from "../../features/rework/store";
import { ApiError } from "../../lib/api-client";
import { errorText } from "../../lib/errors";
import { feedback as triggerFeedback } from "../../lib/feedback";
import { useStrings } from "../../lib/language";
import { useCameraReady } from "../../lib/use-camera-ready";
import { useOnline } from "../../lib/use-online";

type FlashState =
  | { kind: "ok"; code: string }
  | { kind: "dup"; code: string }
  | { kind: "quota"; mine: number; target: number }
  | { kind: "err"; msg: string }
  | { kind: "in_rework"; code: string }
  | { kind: "written_off" }
  | { kind: "sent" }
  | { kind: "checking" };

export default function ScanScreen() {
  const strings = useStrings();
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraReady = useCameraReady();
  const consumeReworkReturn = useReworkReturn((s) => s.consume);
  const [permission, requestPermission] = useCameraPermissions();
  const { data: batches } = useMyBatches();
  const scanUnit = useScanUnit();
  const { worker } = useAuth();
  const isOnline = useOnline();

  const [cameraKey, setCameraKey] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [releasing, setReleasing] = useState(false);

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
  // Live updates (RT1): a co-worker's scan re-reads the queue, so the batch count on the pill follows
  // it. Only ever raised here — a re-read that started before my last scan would show one less.
  const queueDone = (isStitcher ? batch?.units_stitched : batch?.units_packed) ?? 0;
  useEffect(() => {
    setProgress((p) => (queueDone > p.done ? { ...p, done: queueDone } : p));
  }, [queueDone]);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [inspectUnit, setInspectUnit] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [torch, setTorch] = useState(false);
  const lock = useRef(false);

  const flashAndUnlock = useCallback(
    (fb: FlashState) => {
      setFlash(fb);

      if (fb.kind === "in_rework") {
        triggerFeedback("dup");
      } else if (fb.kind === "written_off") {
        triggerFeedback("err");
      } else if (fb.kind !== "checking") {
        triggerFeedback(fb.kind);
      }

      try {
        if (fb.kind === "ok") {
          AccessibilityInfo.announceForAccessibility(strings.scanner.scannedA11y(fb.code));
        } else if (fb.kind === "dup") {
          AccessibilityInfo.announceForAccessibility(
            `${isPacker ? strings.scanner.alreadyPacked : strings.scanner.alreadyScanned} ${fb.code}`,
          );
        } else if (fb.kind === "quota") {
          AccessibilityInfo.announceForAccessibility(strings.scanner.shareComplete);
        } else if (fb.kind === "err") {
          AccessibilityInfo.announceForAccessibility(strings.scanner.errorA11y(fb.msg));
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
    },
    [isPacker, strings],
  );

  // Focus effect: re-arm scanner when regaining focus and consume rework return flag
  useFocusEffect(
    useCallback(() => {
      setReleasing(false);
      setCameraError(false);
      setInspectUnit(null);
      lock.current = false;
      if (consumeReworkReturn()) {
        flashAndUnlock({ kind: "sent" });
      }
    }, [consumeReworkReturn, flashAndUnlock]),
  );

  const handleRetryCamera = useCallback(() => {
    setCameraError(false);
    setCameraKey((k) => k + 1);
  }, []);

  const handleBack = useCallback(() => {
    setReleasing(true);
    requestAnimationFrame(() => router.back());
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (inspectUnit) {
        setInspectUnit(null);
        lock.current = false;
        return true;
      }
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [inspectUnit, handleBack]);

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
              isStitcher ? strings.scanner.stitchingComplete : strings.scanner.batchComplete(batchCode),
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
        if (e instanceof ApiError && e.code === "spare") {
          flashAndUnlock({ kind: "err", msg: strings.scanner.spare });
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
          msg: errorText(strings, e, strings.scanner.scanFailed),
        });
      },
    });
  };

  const handleScannedLatest = useRef<({ data }: { data: string }) => void>(() => {});
  handleScannedLatest.current = ({ data }: { data: string }) => {
    lock.current = true;

    if (!isOnline) {
      flashAndUnlock({ kind: "err", msg: strings.scanner.offline });
      return;
    }

    const code = data.trim();

    // Local validation — no network for obviously wrong scans
    if (!UNIT_CODE_RE.test(code)) {
      flashAndUnlock({ kind: "err", msg: strings.scanner.notRpsLabel });
      return;
    }
    // Packers check against the server instead: a reused spare keeps the code of its old batch (U3).
    if (!isPacker && batch && !code.startsWith(`${batch.batch_code}-`)) {
      const otherBatch = batchCodeOf(code);
      flashAndUnlock({
        kind: "err",
        msg: strings.scanner.wrongBatch(otherBatch),
      });
      return;
    }

    // Packer: peek unit before showing inspect sheet
    if (isPacker) {
      setFlash({ kind: "checking" });
      peekUnit(code)
        .then((peek) => {
          if (peek.batch_id !== batchId) {
            flashAndUnlock({ kind: "err", msg: strings.scanner.wrongBatch(peek.batch_code) });
            return;
          }
          if (peek.can_pack) {
            setFlash(null);
            triggerFeedback("tick");
            setInspectUnit(code);
            return;
          }
          if (peek.reason === "already_packed") {
            flashAndUnlock({ kind: "dup", code });
            return;
          }
          if (peek.reason === "in_rework") {
            flashAndUnlock({ kind: "in_rework", code });
            return;
          }
          if (peek.reason === "written_off") {
            flashAndUnlock({ kind: "written_off" });
            return;
          }
          if (peek.reason === "spare") {
            flashAndUnlock({ kind: "err", msg: strings.scanner.spare });
            return;
          }
          if (peek.reason === "wrong_phase") {
            flashAndUnlock({ kind: "err", msg: strings.scanner.wrongPhase });
            return;
          }
          if (peek.reason === "not_started") {
            flashAndUnlock({ kind: "err", msg: strings.scanner.notStarted });
            return;
          }
          flashAndUnlock({ kind: "err", msg: strings.scanner.peekFailed });
        })
        .catch(() => {
          flashAndUnlock({ kind: "err", msg: strings.scanner.peekFailed });
        });
      return;
    }

    executeScan(code);
  };

  const handleScanned = useCallback(({ data }: { data: string }) => {
    if (lock.current) return;
    handleScannedLatest.current({ data });
  }, []);

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
    setReleasing(true);
    requestAnimationFrame(() => {
      router.push({
        pathname: "/rework/new",
        params: { unitCode: code, batchId },
      });
    });
  };

  const handleCancelInspect = () => {
    setInspectUnit(null);
    lock.current = false;
  };

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
      <Screen
        centered
        footer={<AppButton title={strings.scanner.allowCamera} size="lg" onPress={requestPermission} />}
      >
        <View style={styles.permContent}>
          <Text style={styles.permTitle}>{strings.scanner.cameraNeeded}</Text>
          <Text style={styles.permText}>{strings.scanner.cameraWhy}</Text>
          <AppButton
            title={strings.common.back}
            icon={<BackIcon />}
            variant="ghost"
            size="md"
            onPress={handleBack}
          />
        </View>
      </Screen>
    );
  }

  // --- batch completed state ---
  if (done) {
    return (
      <Screen
        centered
        footer={
          <AppButton title={strings.common.backToMyQueue} size="lg" onPress={() => router.replace("/home")} />
        }
      >
        <View style={styles.doneContent}>
          <Text style={styles.doneEmoji}>✓</Text>
          <Text style={styles.doneTitle}>
            {isStitcher ? strings.scanner.stitchingComplete : strings.scanner.batchComplete(batchCode)}
          </Text>
          <Text style={styles.doneText}>
            {isStitcher
              ? strings.scanner.allStitched(progress.total)
              : strings.scanner.allPacked(progress.total)}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]} scroll={false}>
      <StatusBar style="light" />
      <View style={styles.cameraBg} />
      {cameraReady && !releasing && (
        <CameraView
          key={cameraKey}
          style={styles.cameraView}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleScanned}
          onMountError={() => setCameraError(true)}
        />
      )}

      {/* Overlay container with flex positioning */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.topBar(insets)}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={strings.scanner.backToQueueA11y}
            style={styles.topBarBtn}
          >
            <BackLabel
              tone="overlay"
              label={batch?.batch_code ?? strings.common.back}
              textStyle={styles.topBarText}
            />
          </Pressable>
          <Pressable
            onPress={() => setTorch((t) => !t)}
            accessibilityRole="button"
            accessibilityLabel={torch ? strings.scanner.torchOffA11y : strings.scanner.torchOnA11y}
            accessibilityState={{ selected: torch }}
            style={styles.topBarBtn}
          >
            <Text style={styles.topBarText}>
              {torch ? strings.scanner.torchOff : strings.scanner.torchOn}
            </Text>
          </Pressable>
        </View>

        {/* Top badges / notices */}
        <View style={styles.topNotices(insets)} pointerEvents="box-none">
          {cameraError && (
            <View style={styles.offlineBannerWrap}>
              <Banner
                kind="danger"
                text={strings.scanner.cameraFailed}
                actionLabel={strings.common.retry}
                onAction={handleRetryCamera}
              />
            </View>
          )}
          {!isOnline && (
            <View style={styles.offlineBannerWrap}>
              <Banner kind="warning" text={strings.common.offline} />
            </View>
          )}

          <View style={styles.progressWrap}>
            <Text style={styles.progressText}>
              {progress.target != null
                ? strings.scanner.progressMine(progress.mine, progress.target, progress.done, progress.total)
                : isStitcher
                  ? strings.scanner.progressStitched(progress.done, progress.total)
                  : strings.scanner.progressPacked(progress.done, progress.total)}
            </Text>
          </View>
        </View>

        {/* Scan Frame */}
        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
          <Text style={styles.frameHint}>{strings.scanner.pointAtLabel}</Text>
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
                accessibilityLabel={strings.scanner.packA11y}
              />
              <AppButton
                title={strings.inspect.needsRework}
                variant="danger"
                size="lg"
                onPress={handleNeedsRework}
                accessibilityLabel={strings.scanner.needsReworkA11y}
              />
              <AppButton
                title={strings.inspect.cancel}
                variant="ghost"
                size="md"
                onPress={handleCancelInspect}
                accessibilityLabel={strings.scanner.cancelInspectA11y}
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
                flash.kind === "checking" && styles.flashChecking,
              ]}
            >
              <Text style={styles.flashTitle}>
                {flash.kind === "ok" && `✓ ${flash.code}`}
                {flash.kind === "dup" &&
                  (isPacker ? strings.scanner.alreadyPacked : strings.scanner.alreadyScanned)}
                {flash.kind === "quota" && strings.scanner.shareCompleteTitle}
                {flash.kind === "err" && `✗ ${flash.msg}`}
                {flash.kind === "in_rework" && `⏳ ${strings.scanner.inRework}`}
                {flash.kind === "written_off" && `✗ ${strings.scanner.writtenOff}`}
                {flash.kind === "sent" && `✓ ${strings.scanner.sentToRework}`}
                {flash.kind === "checking" && strings.scanner.checking}
              </Text>
              {flash.kind === "dup" && <Text style={styles.flashSub}>{flash.code}</Text>}
              {flash.kind === "in_rework" && <Text style={styles.flashSub}>{flash.code}</Text>}
              {flash.kind === "quota" && (
                <Text style={styles.flashSub}>
                  {strings.scanner.shareCompleteSub(flash.mine, flash.target)}
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
  cameraBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
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
  flashChecking: {
    backgroundColor: theme.colors.overlay,
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
