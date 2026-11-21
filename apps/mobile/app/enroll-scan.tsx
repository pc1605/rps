import { ENROLL_PREFIX } from "@rps/shared";
import { CameraView } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../components/ui/AppButton";
import { BackIcon, BackLabel } from "../components/ui/BackIcon";
import { Screen } from "../components/ui/Screen";
import { Skeleton } from "../components/ui/Skeleton";
import { ENROLL_CODE_RE, useEnrollDraft } from "../features/auth/enroll-draft";
import { useStrings } from "../lib/language";
import { useCameraPermission } from "../lib/use-camera-permission";

export default function EnrollScan() {
  const strings = useStrings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setCode = useEnrollDraft((s) => s.setCode);
  const { permission, blocked, ask } = useCameraPermission();
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

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
        footer={
          <AppButton
            title={blocked ? strings.scanner.openSettings : strings.scanner.allowCamera}
            size="lg"
            onPress={ask}
          />
        }
      >
        <View style={styles.permContent}>
          <Text style={styles.permTitle}>{strings.scanner.cameraNeeded}</Text>
          <Text style={styles.permText}>
            {blocked ? strings.scanner.cameraBlocked : strings.enroll.cameraWhy}
          </Text>
          <AppButton
            title={strings.common.back}
            icon={<BackIcon />}
            variant="ghost"
            size="md"
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  const onScanned = ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    const scanned = data.trim();
    const code = scanned.startsWith(ENROLL_PREFIX) ? scanned.slice(ENROLL_PREFIX.length) : "";

    if (!ENROLL_CODE_RE.test(code)) {
      const msg = strings.enroll.notEnrollCode;
      setError(msg);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        AccessibilityInfo.announceForAccessibility(strings.scanner.errorA11y(msg));
      } catch {
        // Ignore haptics failure
      }
      setTimeout(() => {
        setError(null);
        lock.current = false;
      }, 1500);
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(strings.enroll.scannedA11y);
    } catch {
      // Ignore haptics failure
    }

    setCode(code);
    router.back();
  };

  return (
    <Screen edges={[]} scroll={false}>
      <StatusBar style="light" />
      <CameraView
        style={styles.cameraView}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />

      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.topBar(insets)}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={strings.enroll.cancelA11y}
            style={styles.topBarBtn}
          >
            <BackLabel tone="overlay" label={strings.enroll.cancel} textStyle={styles.topBarText} />
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
          <Text style={styles.hint}>{strings.enroll.hint}</Text>
        </View>

        <View style={styles.bottomFlashWrap(insets)} pointerEvents="box-none">
          {error && (
            <View style={styles.flash}>
              <Text style={styles.flashText}>✗ {error}</Text>
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
    alignItems: "center",
    backgroundColor: theme.colors.overlay,
  }),
  topBarBtn: {
    minHeight: theme.touch.min,
    minWidth: theme.touch.min,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
    alignSelf: "flex-start",
  },
  topBarText: {
    ...theme.text.bodyMed,
    color: theme.colors.overlayText,
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 220,
    height: 220,
    borderRadius: theme.radius.lg,
    borderWidth: 3,
    borderColor: theme.colors.overlayBorder,
  },
  hint: {
    ...theme.text.small,
    color: theme.colors.overlayTextMuted,
    marginTop: theme.spacing.md,
    textAlign: "center",
    paddingHorizontal: theme.spacing.xl,
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
    backgroundColor: theme.colors.flash.err,
  },
  flashText: {
    ...theme.text.heading,
    color: theme.colors.overlayText,
    textAlign: "center",
  },
}));
