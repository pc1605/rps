import type { ReworkReason } from "@rps/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Image, Pressable, Text, TextInput, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../../components/ui/AppButton";
import { Banner } from "../../components/ui/Banner";
import { Screen } from "../../components/ui/Screen";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { useFlagRework } from "../../features/rework/hooks";
import { useReworkReturn } from "../../features/rework/store";
import { ApiError } from "../../lib/api-client";
import { feedback } from "../../lib/feedback";
import { strings } from "../../lib/strings";

const REASON_KEYS: ReworkReason[] = ["stitching_fault", "stain", "cutting_fault", "material_defect", "other"];

export default function NewReworkScreen() {
  const { unitCode } = useLocalSearchParams<{
    unitCode: string;
    batchId: string;
  }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const flagRework = useFlagRework();
  const markSent = useReworkReturn((s) => s.markSent);

  const cameraRef = useRef<CameraView>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<ReworkReason[]>([]);
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Handle hardware back button on Android: Step 2 returns to Step 1
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 2) {
        setStep(1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

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
          <Text style={styles.permText}>RPS uses the camera to capture rework defect photos.</Text>
          <AppButton title="← Back" variant="ghost" size="md" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const handleCapture = async () => {
    if (photos.length >= 3 || isCapturing) return;
    try {
      setIsCapturing(true);
      feedback("tick");
      const pic = await cameraRef.current?.takePictureAsync({
        quality: 0.5,
      });
      if (pic?.uri) {
        setPhotos((prev) => [...prev, pic.uri]);
      }
    } catch {
      // Photo capture failed silently
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleReason = (reason: ReworkReason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason],
    );
  };

  const canSubmit = photos.length >= 1 && selectedReasons.length >= 1 && !flagRework.isPending;

  const handleSubmit = async () => {
    if (!canSubmit || !unitCode) return;
    setErrorMsg(null);

    try {
      await flagRework.mutateAsync({
        unitCode,
        reasons: selectedReasons,
        note: note.trim() || undefined,
        photoUris: photos,
      });
      feedback("sent");
      markSent();
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "already_in_rework") {
          setErrorMsg(strings.rework.alreadyInRework);
        } else if (err.code === "not_started") {
          setErrorMsg(strings.rework.notStarted);
        } else {
          setErrorMsg(err.message || strings.rework.genericError);
        }
      } else {
        setErrorMsg(strings.rework.networkError);
      }
    }
  };

  // Step 1: Fullscreen photo capture
  if (step === 1) {
    return (
      <Screen edges={[]} scroll={false}>
        <StatusBar style="light" />
        <View style={styles.cameraBg} />
        {isFocused && <CameraView ref={cameraRef} style={styles.cameraView} facing="back" />}

        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* Top bar over camera */}
          <View style={styles.topBar(insets)}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.topBarBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.topBarBackText}>‹ Back</Text>
            </Pressable>
            <Text style={styles.topBarUnitCode} numberOfLines={1}>
              {unitCode}
            </Text>
            <View style={styles.topBarStepWrap}>
              <Text style={styles.topBarStepText}>{strings.rework.stepOneOfTwo}</Text>
            </View>
          </View>

          {/* Bottom panel over camera */}
          <View style={styles.bottomPanel(insets)}>
            {/* Thumbnails row (up to 3, 56x56, rounded, remove button + dashed slot) */}
            <View style={styles.thumbnailsRow}>
              {photos.map((uri, idx) => (
                <View key={uri} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumbImage} />
                  <Pressable
                    onPress={() => handleRemovePhoto(idx)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={strings.rework.removePhotoN(idx + 1)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>×</Text>
                  </Pressable>
                </View>
              ))}
              {photos.length < 3 && (
                <View style={styles.dashedSlot}>
                  <Text style={styles.dashedSlotText}>+</Text>
                </View>
              )}
            </View>

            {/* Shutter button (72px circle, centered, disabled at 3) */}
            <Pressable
              onPress={handleCapture}
              disabled={photos.length >= 3 || isCapturing}
              accessibilityRole="button"
              accessibilityLabel={strings.rework.shutterA11y}
              accessibilityState={{ disabled: photos.length >= 3 || isCapturing }}
              style={({ pressed }) => [
                styles.shutterBtn,
                (photos.length >= 3 || isCapturing) && styles.shutterDisabled,
                pressed && styles.shutterPressed,
              ]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            {/* Counter text */}
            <Text style={styles.counterText}>{strings.rework.photosCount(photos.length)}</Text>

            {/* Primary button */}
            <AppButton
              title={photos.length === 0 ? strings.rework.takeAPhoto : strings.rework.next}
              size="lg"
              disabled={photos.length === 0}
              onPress={() => setStep(2)}
              accessibilityLabel={photos.length === 0 ? strings.rework.takeAPhoto : strings.rework.next}
            />
          </View>
        </View>
      </Screen>
    );
  }

  // Step 2: What's wrong (reasons selection, note, submit)
  return (
    <Screen
      header={
        <ScreenHeader
          back
          onBack={() => setStep(1)}
          title={unitCode}
          right={<Text style={styles.stepIndicator}>{strings.rework.stepTwoOfTwo}</Text>}
        />
      }
      footer={
        <AppButton
          title={selectedReasons.length === 0 ? strings.rework.chooseWhatsWrong : strings.rework.sendToRework}
          size="lg"
          disabled={!canSubmit}
          loading={flagRework.isPending}
          onPress={handleSubmit}
          accessibilityLabel={
            selectedReasons.length === 0 ? strings.rework.chooseWhatsWrong : strings.rework.sendToRework
          }
        />
      }
    >
      {errorMsg && (
        <View style={styles.bannerWrap}>
          <Banner kind="danger" text={errorMsg} />
        </View>
      )}

      {/* Photos summary: thumbnails row (tap any -> back to step 1) */}
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          {photos.map((uri, idx) => (
            <Pressable
              key={uri}
              onPress={() => setStep(1)}
              accessibilityRole="button"
              accessibilityLabel={`${strings.rework.tapToEditPhotos} (${idx + 1})`}
              style={styles.summaryThumbWrap}
            >
              <Image source={{ uri }} style={styles.summaryThumbImage} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Reasons: 2-column grid */}
      <View style={styles.reasonsSection}>
        <Text style={styles.reasonsTitle}>{strings.rework.reasonsTitle}</Text>
        <View style={styles.reasonsGrid}>
          {REASON_KEYS.map((key) => {
            const item = strings.rework.reasons[key];
            const isSelected = selectedReasons.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleReason(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.reasonTile,
                  isSelected && styles.reasonTileSelected,
                  pressed && styles.reasonTilePressed,
                ]}
              >
                <Text style={styles.reasonEmoji}>{item.emoji}</Text>
                <Text
                  style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkBadgeText}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Note: optional single-line TextInput with label */}
      <View style={styles.noteSection}>
        <Text style={styles.noteLabel}>{strings.rework.noteLabel}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={strings.rework.notePlaceholder}
          placeholderTextColor={styles.placeholderText.color}
          style={styles.noteInput}
          returnKeyType="done"
          maxLength={200}
          numberOfLines={1}
          accessibilityLabel={strings.rework.noteLabel}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  cameraBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.cameraBg,
  },
  cameraView: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: (insets: EdgeInsets) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56 + insets.top,
    paddingTop: insets.top,
    paddingLeft: insets.left + theme.spacing.sm,
    paddingRight: insets.right + theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.overlay,
    zIndex: 10,
  }),
  topBarBtn: {
    minHeight: theme.touch.min,
    minWidth: theme.touch.min,
    justifyContent: "center",
  },
  topBarBackText: {
    ...theme.text.bodyMed,
    color: theme.colors.overlayText,
  },
  topBarUnitCode: {
    ...theme.text.code,
    color: theme.colors.overlayText,
    textAlign: "center",
    flex: 1,
  },
  topBarStepWrap: {
    minWidth: theme.touch.min,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  topBarStepText: {
    ...theme.text.bodyMed,
    color: theme.colors.overlayTextMuted,
  },
  bottomPanel: (insets: EdgeInsets) => ({
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: Math.max(insets.bottom, theme.spacing.md),
    backgroundColor: theme.colors.overlaySurface,
    gap: theme.spacing.md,
    zIndex: 10,
  }),
  thumbnailsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  thumbWrap: {
    position: "relative",
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.overlayBorder,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlaySurface,
    justifyContent: "center",
    alignItems: "center",
  },
  removeBtnText: {
    ...theme.text.small,
    color: theme.colors.overlayText,
    lineHeight: 16,
    textAlign: "center",
  },
  dashedSlot: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.overlayBorder,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.overlay,
  },
  dashedSlotText: {
    ...theme.text.heading,
    color: theme.colors.overlayTextMuted,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.pill,
    borderWidth: 4,
    borderColor: theme.colors.overlayBorder,
    backgroundColor: theme.colors.overlaySurface,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  shutterDisabled: {
    opacity: 0.35,
  },
  shutterPressed: {
    opacity: 0.75,
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlayText,
  },
  counterText: {
    ...theme.text.bodyMed,
    color: theme.colors.overlayText,
    textAlign: "center",
  },
  stepIndicator: {
    ...theme.text.bodyMed,
    color: theme.colors.textMuted,
    paddingRight: theme.spacing.xs,
  },
  summarySection: {
    gap: theme.spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  summaryThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryThumbImage: {
    width: "100%",
    height: "100%",
  },
  reasonsSection: {
    gap: theme.spacing.sm,
  },
  reasonsTitle: {
    ...theme.text.heading,
    color: theme.colors.text,
  },
  reasonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  reasonTile: {
    flexBasis: "48%",
    minHeight: 96,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: theme.spacing.xs,
  },
  reasonTileSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 2,
  },
  reasonTilePressed: {
    opacity: 0.8,
  },
  reasonEmoji: {
    ...theme.text.emoji,
    textAlign: "center",
  },
  reasonLabel: {
    ...theme.text.bodyMed,
    color: theme.colors.text,
    textAlign: "center",
  },
  reasonLabelSelected: {
    color: theme.colors.text,
  },
  checkBadge: {
    position: "absolute",
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  checkBadgeText: {
    ...theme.text.caption,
    color: theme.colors.accentFg,
  },
  noteSection: {
    gap: theme.spacing.xs,
  },
  noteLabel: {
    ...theme.text.small,
    color: theme.colors.textMuted,
  },
  noteInput: {
    minHeight: theme.touch.min,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    ...theme.text.body,
  },
  placeholderText: {
    color: theme.colors.textMuted,
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
  bannerWrap: {
    width: "100%",
  },
}));
