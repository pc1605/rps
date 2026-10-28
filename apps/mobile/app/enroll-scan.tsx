import { ENROLL_PREFIX } from "@rps/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../components/ui/AppButton";
import { Screen } from "../components/ui/Screen";
import { Skeleton } from "../components/ui/Skeleton";
import { useEnrollDraft } from "../features/auth/enroll-draft";

export default function EnrollScan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setBadge = useEnrollDraft((s) => s.setBadge);
  const [permission, requestPermission] = useCameraPermissions();
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
      <Screen centered footer={<AppButton title="Allow camera" size="lg" onPress={requestPermission} />}>
        <View style={styles.permContent}>
          <Text style={styles.permTitle}>Camera needed</Text>
          <Text style={styles.permText}>To scan your enrollment code.</Text>
          <AppButton title="← Back" variant="ghost" size="md" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const onScanned = ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    const code = data.trim();

    if (!code.startsWith(ENROLL_PREFIX)) {
      const msg = "Not an enrollment code — ask your admin for the QR";
      setError(msg);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        AccessibilityInfo.announceForAccessibility(`Error: ${msg}`);
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
      AccessibilityInfo.announceForAccessibility("Enrollment code scanned");
    } catch {
      // Ignore haptics failure
    }

    setBadge(code.slice(ENROLL_PREFIX.length));
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
            accessibilityLabel="Cancel enrollment scan"
            style={styles.topBarBtn}
          >
            <Text style={styles.topBarText}>← Cancel</Text>
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
          <Text style={styles.hint}>Point at the enrollment QR on the admin screen</Text>
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
