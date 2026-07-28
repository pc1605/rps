import { useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native-unistyles";
import { Screen } from "../../components/ui/Screen";
import { AppButton } from "../../components/ui/AppButton";
import { useMyBatches, useScanUnit } from "../../features/batches/hooks";
import { ApiError } from "../../lib/api-client";

type Feedback =
  | { kind: "ok"; code: string }
  | { kind: "dup"; code: string }
  | { kind: "err"; msg: string };

export default function ScanScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const { data: batches } = useMyBatches();
  const scanUnit = useScanUnit();

  const batch = batches?.find((b) => b.id === batchId);
  const [progress, setProgress] = useState({
    packed: batch?.units_packed ?? 0,
    total: batch?.units_total ?? 0,
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(false);
  const [torch, setTorch] = useState(false);
  const lock = useRef(false);

  // --- permission states ---
  if (!permission) return <Screen style={styles.center} />;
  if (!permission.granted) {
    return (
      <Screen style={styles.center}>
        <StatusBar style="auto" />
        <Text style={styles.permTitle}>Camera needed</Text>
        <Text style={styles.permText}>
          RPS uses the camera to scan unit QR labels.
        </Text>
        <View style={{ width: "70%", marginTop: 24 }}>
          <AppButton title="Allow camera" onPress={requestPermission} />
        </View>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
      </Screen>
    );
  }

  // --- batch completed state ---
  if (done) {
    return (
      <Screen style={styles.center}>
        <StatusBar style="auto" />
        <Text style={styles.doneEmoji}>✓</Text>
        <Text style={styles.doneTitle}>{batch?.batch_code} complete</Text>
        <Text style={styles.doneText}>
          All {progress.total} mats packed and sent to the stockyard.
        </Text>
        <View style={{ width: "70%", marginTop: 32 }}>
          <AppButton
            title="Back to my queue"
            onPress={() => router.replace("/home")}
          />
        </View>
      </Screen>
    );
  }

  const handleScanned = ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;

    scanUnit.mutate(data.trim(), {
      onSuccess: (res) => {
        setProgress({ packed: res.packed_count, total: res.total_units });
        if (res.batch_completed) {
          setDone(true);
          return;
        }
        setFeedback(
          res.already_packed
            ? { kind: "dup", code: res.unit_code }
            : { kind: "ok", code: res.unit_code },
        );
      },
      onError: (e) => {
        setFeedback({
          kind: "err",
          msg: e instanceof ApiError ? e.message : "Scan failed — try again",
        });
      },
      onSettled: () => {
        setTimeout(() => {
          setFeedback(null);
          lock.current = false;
        }, 1200);
      },
    });
  };

  return (
    <View style={styles.cameraScreen}>
      <StatusBar style="light" />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={feedback ? undefined : handleScanned}
      />

      {/* top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.topBarText}>← {batch?.batch_code ?? "Scan"}</Text>
        </Pressable>
        <Pressable onPress={() => setTorch((t) => !t)} hitSlop={12}>
          <Text style={styles.topBarText}>{torch ? "🔦 On" : "🔦 Off"}</Text>
        </Pressable>
      </View>

      {/* progress */}
      <View style={styles.progressWrap}>
        <Text style={styles.progressText}>
          {progress.packed} / {progress.total} packed
        </Text>
      </View>

      {/* scan frame */}
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame} />
        <Text style={styles.frameHint}>Point at a unit QR label</Text>
      </View>

      {/* feedback flash */}
      {feedback && (
        <View
          style={[
            styles.flash,
            feedback.kind === "ok" && styles.flashOk,
            feedback.kind === "dup" && styles.flashDup,
            feedback.kind === "err" && styles.flashErr,
          ]}
        >
          <Text style={styles.flashTitle}>
            {feedback.kind === "ok" && `✓ ${feedback.code}`}
            {feedback.kind === "dup" && `Already scanned`}
            {feedback.kind === "err" && `✗ ${feedback.msg}`}
          </Text>
          {feedback.kind === "dup" && (
            <Text style={styles.flashSub}>{feedback.code}</Text>
          )}
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

  permTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  permText: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  backLink: { color: theme.colors.textFaint, textDecorationLine: "underline" },

  doneEmoji: { fontSize: 64, color: theme.colors.success, fontWeight: "800" },
  doneTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 12,
  },
  doneText: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  topBarText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  progressWrap: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  progressText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

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
  frameHint: { color: "rgba(255,255,255,0.8)", marginTop: 16, fontSize: 13 },

  flash: {
    position: "absolute",
    bottom: 60,
    left: 24,
    right: 24,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  flashOk: { backgroundColor: "rgba(22,163,74,0.95)" },
  flashDup: { backgroundColor: "rgba(217,119,6,0.95)" },
  flashErr: { backgroundColor: "rgba(220,38,38,0.95)" },
  flashTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  flashSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 },
}));
