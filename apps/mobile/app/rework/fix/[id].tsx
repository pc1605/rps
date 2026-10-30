import { UNIT_CODE_RE } from "@rps/shared";
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, Text, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../../../components/ui/AppButton";
import { Banner } from "../../../components/ui/Banner";
import { Screen } from "../../../components/ui/Screen";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useScanUnit } from "../../../features/batches/hooks";
import { ApiError } from "../../../lib/api-client";
import { feedback as triggerFeedback } from "../../../lib/feedback";
import { strings } from "../../../lib/strings";
import { useCameraReady } from "../../../lib/use-camera-ready";
import { useOnline } from "../../../lib/use-online";

type FlashState = { kind: "ok"; code: string } | { kind: "err"; msg: string };

export default function ReworkFixScreen() {
  const { unitCode } = useLocalSearchParams<{
    id: string;
    unitCode: string;
  }>();
  const router = useRouter();
  const cameraReady = useCameraReady();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const scanUnit = useScanUnit();
  const isOnline = useOnline();

  const [flash, setFlash] = useState<FlashState | null>(null);
  const [fixed, setFixed] = useState(false);
  const [torch, setTorch] = useState(false);
  const lock = useRef(false);

  const [cameraKey, setCameraKey] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [releasing, setReleasing] = useState(false);

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
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const flashAndUnlock = useCallback((fb: FlashState) => {
    setFlash(fb);
    triggerFeedback(fb.kind);

    try {
      if (fb.kind === "ok") {
        AccessibilityInfo.announceForAccessibility(`Fixed ${fb.code}`);
      } else {
        AccessibilityInfo.announceForAccessibility(`Error: ${fb.msg}`);
      }
    } catch {
      // Ignore a11y failure
    }

    setTimeout(() => {
      setFlash(null);
      lock.current = false;
    }, 1400);
  }, []);

  const handleScannedLatest = useRef<({ data }: { data: string }) => void>(() => {});
  handleScannedLatest.current = ({ data }: { data: string }) => {
    lock.current = true;

    if (!isOnline) {
      flashAndUnlock({ kind: "err", msg: "Offline — reconnect to scan" });
      return;
    }

    const code = data.trim();

    // Local validation
    if (!UNIT_CODE_RE.test(code)) {
      flashAndUnlock({ kind: "err", msg: "Not an RPS unit label" });
      return;
    }

    // Accept ONLY the expected unit code
    if (unitCode && code !== unitCode) {
      flashAndUnlock({
        kind: "err",
        msg: strings.rework.wrongMat(code),
      });
      return;
    }

    scanUnit.mutate(code, {
      onSuccess: (res) => {
        if (res.rework_fixed) {
          triggerFeedback("ok");
          queryClient.invalidateQueries({ queryKey: ["my-rework"] });
          queryClient.invalidateQueries({ queryKey: ["my-batches"] });
          setReleasing(true);
          setFixed(true);
          return;
        }
        flashAndUnlock({ kind: "ok", code: res.unit_code });
      },
      onError: (e) => {
        if (e instanceof ApiError) {
          if (e.code === "rework_pending_decision") {
            flashAndUnlock({
              kind: "err",
              msg: strings.rework.pendingDecision,
            });
            return;
          }
          if (e.code === "not_your_rework") {
            flashAndUnlock({
              kind: "err",
              msg: strings.rework.notYourRework,
            });
            return;
          }
          flashAndUnlock({
            kind: "err",
            msg: e.message || "Scan failed — try again",
          });
          return;
        }
        flashAndUnlock({
          kind: "err",
          msg: "Scan failed — try again",
        });
      },
    });
  };

  const handleScanned = useCallback(({ data }: { data: string }) => {
    if (lock.current) return;
    handleScannedLatest.current({ data });
  }, []);

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
          <AppButton title="← Back" variant="ghost" size="md" onPress={handleBack} />
        </View>
      </Screen>
    );
  }

  // --- success screen ---
  if (fixed) {
    return (
      <Screen
        centered
        footer={
          <AppButton title={strings.rework.backToQueue} size="lg" onPress={() => router.replace("/home")} />
        }
      >
        <View style={styles.doneContent}>
          <Text style={styles.doneEmoji}>✓</Text>
          <Text style={styles.doneTitle}>{strings.rework.fixedTitle}</Text>
          <Text style={styles.doneText}>{strings.rework.fixedDesc}</Text>
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
            accessibilityLabel="Back to detail"
            style={styles.topBarBtn}
          >
            <Text style={styles.topBarText}>← {unitCode ?? "Back"}</Text>
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

        {/* Top hint notice */}
        <View style={styles.topNotices(insets)} pointerEvents="box-none">
          {cameraError && (
            <View style={styles.bannerWrap}>
              <Banner
                kind="danger"
                text="Camera didn't start — tap to retry"
                actionLabel="Retry"
                onAction={handleRetryCamera}
              />
            </View>
          )}
          <View style={styles.targetWrap}>
            <Text style={styles.targetLabel}>Target Mat</Text>
            <Text style={styles.targetCode}>{unitCode}</Text>
          </View>
        </View>

        {/* Scan Frame */}
        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
          <Text style={styles.frameHint}>{strings.rework.pointAtQr}</Text>
        </View>

        {/* Bottom feedback flash */}
        <View style={styles.bottomFlashWrap(insets)} pointerEvents="box-none">
          {flash && (
            <View style={[styles.flash, flash.kind === "ok" ? styles.flashOk : styles.flashErr]}>
              <Text style={styles.flashTitle}>
                {flash.kind === "ok" ? `✓ ${flash.code}` : `✗ ${flash.msg}`}
              </Text>
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
  }),
  bannerWrap: {
    width: "100%",
    maxWidth: 480,
  },
  targetWrap: {
    backgroundColor: theme.colors.overlaySurface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    alignItems: "center",
  },
  targetLabel: {
    ...theme.text.caption,
    color: theme.colors.overlayTextMuted,
  },
  targetCode: {
    ...theme.text.codeLarge,
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
  flashErr: {
    backgroundColor: theme.colors.flash.err,
  },
  flashTitle: {
    ...theme.text.heading,
    color: theme.colors.overlayText,
    textAlign: "center",
  },
}));
