import type { ReworkReason } from "@rps/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
  const [permission, requestPermission] = useCameraPermissions();
  const flagRework = useFlagRework();
  const markSent = useReworkReturn((s) => s.markSent);

  const cameraRef = useRef<CameraView>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<ReworkReason[]>([]);
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

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

  return (
    <Screen
      header={<ScreenHeader back title={unitCode ?? "Rework"} />}
      footer={
        <AppButton
          title={strings.rework.sendToRework}
          size="lg"
          disabled={!canSubmit}
          loading={flagRework.isPending}
          onPress={handleSubmit}
          accessibilityLabel={strings.rework.sendToRework}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {errorMsg && (
          <View style={styles.bannerWrap}>
            <Banner kind="danger" text={errorMsg} />
          </View>
        )}

        {/* Section: Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {strings.rework.photosTitle} ({photos.length}/3)
          </Text>

          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.shutterOverlay} pointerEvents="box-none">
              <Pressable
                onPress={handleCapture}
                disabled={photos.length >= 3 || isCapturing}
                accessibilityRole="button"
                accessibilityLabel={strings.rework.shutterA11y}
                style={({ pressed }) => [
                  styles.shutterBtn,
                  photos.length >= 3 && styles.shutterDisabled,
                  pressed && styles.shutterPressed,
                ]}
              >
                <View style={styles.shutterInner} />
              </Pressable>
            </View>
          </View>

          {/* Thumbnails row */}
          {photos.length > 0 && (
            <View style={styles.thumbnailsRow}>
              {photos.map((uri, idx) => (
                <View key={uri} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumbImage} />
                  <Pressable
                    onPress={() => handleRemovePhoto(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={strings.rework.removePhoto}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section: Reasons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.rework.reasonsTitle}</Text>
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

        {/* Section: Note */}
        <View style={styles.section}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={strings.rework.notePlaceholder}
            placeholderTextColor={styles.placeholderText.color}
            style={styles.noteInput}
            returnKeyType="done"
            maxLength={200}
            accessibilityLabel="Rework note"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
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
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.text.heading,
    color: theme.colors.text,
  },
  cameraBox: {
    width: "100%",
    height: 220,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.cameraBg,
    position: "relative",
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  shutterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: theme.spacing.sm,
  },
  shutterBtn: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    borderWidth: 4,
    borderColor: theme.colors.overlayBorder,
    backgroundColor: theme.colors.overlaySurface,
    justifyContent: "center",
    alignItems: "center",
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterPressed: {
    opacity: 0.8,
  },
  shutterInner: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlayText,
  },
  thumbnailsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  thumbWrap: {
    position: "relative",
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: theme.touch.min,
    height: theme.touch.min,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlaySurface,
    justifyContent: "center",
    alignItems: "center",
  },
  removeBtnText: {
    ...theme.text.heading,
    color: theme.colors.overlayText,
    lineHeight: 20,
  },
  reasonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  reasonTile: {
    width: "48%",
    minHeight: 64,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    position: "relative",
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
    fontSize: 24,
    lineHeight: 28,
  },
  reasonLabel: {
    ...theme.text.small,
    color: theme.colors.text,
    flex: 1,
  },
  reasonLabelSelected: {
    ...theme.text.bodyMed,
    color: theme.colors.text,
  },
  checkBadge: {
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
}));
