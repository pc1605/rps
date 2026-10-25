import { ENROLL_PREFIX } from "@rps/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
      <Screen style={styles.centerLoading}>
        <Skeleton width="60%" height={24} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen style={styles.permScreen}>
        <StatusBar style="auto" />
        <ScrollView contentContainerStyle={styles.permScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.permContent}>
            <Text style={styles.permTitle}>Camera needed</Text>
            <Text style={styles.permText}>To scan your enrollment code.</Text>
            <View style={styles.permBtnWrap}>
              <AppButton title="Allow camera" size="lg" onPress={requestPermission} />
            </View>
            <AppButton title="← Back" variant="ghost" size="md" onPress={() => router.back()} />
          </View>
        </ScrollView>
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
    <View style={styles.cameraScreen}>
      <StatusBar style="light" />
      <CameraView
        style={styles.cameraView}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />

      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 36) }]}>
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

        <View
          style={[styles.bottomFlashWrap, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
          pointerEvents="box-none"
        >
          {error && (
            <View style={styles.flash}>
              <Text style={styles.flashText}>✗ {error}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  cameraScreen: {
    flex: 1,
    backgroundColor: theme.colors.cameraBg,
  },
  cameraView: {
    flex: 1,
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  permScreen: {
    flex: 1,
  },
  permScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
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
  permBtnWrap: {
    width: "100%",
    marginTop: theme.spacing.sm,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    backgroundColor: theme.colors.overlay,
  },
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
  bottomFlashWrap: {
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
  },
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
