import { useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native-unistyles";
import { Screen } from "../components/ui/Screen";
import { AppButton } from "../components/ui/AppButton";
import { useEnrollDraft } from "../features/auth/enroll-draft";

const PREFIX = "RPS-ENROLL:";

export default function EnrollScan() {
  const router = useRouter();
  const setBadge = useEnrollDraft((s) => s.setBadge);
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  if (!permission) return <Screen style={styles.center} />;
  if (!permission.granted) {
    return (
      <Screen style={styles.center}>
        <StatusBar style="auto" />
        <Text style={styles.title}>Camera needed</Text>
        <Text style={styles.text}>To scan your enrollment code.</Text>
        <View style={{ width: "70%", marginTop: 24 }}>
          <AppButton title="Allow camera" onPress={requestPermission} />
        </View>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
      </Screen>
    );
  }

  const onScanned = ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    const code = data.trim();
    if (!code.startsWith(PREFIX)) {
      setError("Not an enrollment code — ask your admin for the QR");
      setTimeout(() => {
        setError(null);
        lock.current = false;
      }, 1500);
      return;
    }
    setBadge(code.slice(PREFIX.length));
    router.back();
  };

  return (
    <View style={styles.cameraScreen}>
      <StatusBar style="light" />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.topBarText}>← Cancel</Text>
        </Pressable>
      </View>
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame} />
        <Text style={styles.hint}>
          Point at the enrollment QR on the admin screen
        </Text>
      </View>
      {error && (
        <View style={styles.flash}>
          <Text style={styles.flashText}>✗ {error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  center: {
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  cameraScreen: { flex: 1, backgroundColor: "#000" },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  text: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  link: { color: theme.colors.textFaint, textDecorationLine: "underline" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  topBarText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  frameWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
  },
  hint: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 16,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  flash: {
    position: "absolute",
    bottom: 60,
    left: 24,
    right: 24,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    backgroundColor: "rgba(220,38,38,0.95)",
  },
  flashText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
}));
