import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { AuthImage } from "../../components/AuthImage";
import { AppButton } from "../../components/ui/AppButton";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { useMyRework } from "../../features/rework/hooks";
import { strings } from "../../lib/strings";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function ReworkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: reworkItems, isPending } = useMyRework();

  const [modalPhotoUrl, setModalPhotoUrl] = useState<string | null>(null);

  const item = reworkItems?.find((r) => r.id === id);

  if (isPending) {
    return (
      <Screen header={<ScreenHeader back title="Rework" />}>
        <View style={styles.skeletonWrap}>
          <Skeleton width="100%" height={240} />
          <Skeleton width="60%" height={28} />
          <Skeleton width="40%" height={20} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen header={<ScreenHeader back title="Rework" />}>
        <View style={styles.center}>
          <Text style={styles.notFoundTitle}>Rework item not found</Text>
          <Text style={styles.notFoundText}>This item may have already been fixed or reassigned.</Text>
          <AppButton title="Back to queue" variant="secondary" size="md" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const modelText =
    item.brand_name && item.model_name ? `${item.brand_name} ${item.model_name}` : (item.batch_code ?? "");

  const screenWidth = Dimensions.get("window").width;
  const photoCardWidth = Math.min(screenWidth - 48, 320);

  return (
    <Screen
      header={<ScreenHeader back title={item.unit_code ?? "Rework"} />}
      footer={
        <AppButton
          title={strings.rework.scanToFix}
          size="lg"
          onPress={() =>
            router.push({
              pathname: "/rework/fix/[id]",
              params: { id: item.id, unitCode: item.unit_code ?? "" },
            })
          }
          accessibilityLabel={strings.rework.scanToFix}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Photos horizontal pager */}
        {item.photos && item.photos.length > 0 && (
          <View style={styles.photosSection}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={item.photos}
              keyExtractor={(p) => p.id}
              contentContainerStyle={styles.photoPagerContent}
              snapToAlignment="center"
              renderItem={({ item: photo }) => (
                <Pressable
                  onPress={() => setModalPhotoUrl(photo.url)}
                  accessibilityRole="button"
                  accessibilityLabel="View full photo"
                  style={styles.photoPressable(photoCardWidth)}
                >
                  <AuthImage
                    url={photo.url}
                    aspectRatio={4 / 3}
                    accessibilityLabel="Defect photo"
                    style={styles.photoThumb}
                  />
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Model and Round meta */}
        <View style={styles.metaSection}>
          <View style={styles.modelRow}>
            <Text style={styles.modelName}>{modelText}</Text>
            {item.round > 1 && (
              <View style={styles.roundBadge}>
                <Text style={styles.roundBadgeText}>{strings.rework.roundBadge(item.round)}</Text>
              </View>
            )}
          </View>
          {item.line_name ? <Text style={styles.lineName}>{item.line_name}</Text> : null}
        </View>

        {/* Reasons as large picture chips */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{strings.rework.reasonsTitle}</Text>
          <View style={styles.reasonsGrid}>
            {item.reasons.map((r) => {
              const reasonInfo = strings.rework.reasons[r];
              return (
                <View key={r} style={styles.reasonTile}>
                  <Text style={styles.reasonEmoji}>{reasonInfo?.emoji ?? "•"}</Text>
                  <Text style={styles.reasonLabel} numberOfLines={2}>
                    {reasonInfo?.label ?? r}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Note if present */}
        {item.note ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Note</Text>
            <Card style={styles.noteCard}>
              <Text style={styles.noteText}>{item.note}</Text>
            </Card>
          </View>
        ) : null}

        {/* Sent back by */}
        <View style={styles.flaggedWrap}>
          <Text style={styles.flaggedText}>
            {strings.rework.sentBackBy(item.flagged_by_name, formatTime(item.flagged_at))}
          </Text>
        </View>
      </ScrollView>

      {/* Full-screen photo modal */}
      <Modal
        visible={modalPhotoUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPhotoUrl(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalTopBar(insets)}>
            <Pressable
              onPress={() => setModalPhotoUrl(null)}
              accessibilityRole="button"
              accessibilityLabel="Close photo preview"
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.modalImageWrap}>
            {modalPhotoUrl && (
              <AuthImage
                url={modalPhotoUrl}
                aspectRatio={4 / 3}
                resizeMode="contain"
                accessibilityLabel="Full-screen rework photo"
                style={styles.fullModalImage}
              />
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  skeletonWrap: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  notFoundTitle: {
    ...theme.text.heading,
    color: theme.colors.text,
    textAlign: "center",
  },
  notFoundText: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  photosSection: {
    marginHorizontal: -theme.spacing.md,
  },
  photoPagerContent: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  photoPressable: (width: number) => ({
    width,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  }),
  photoThumb: {
    width: "100%",
  },
  metaSection: {
    gap: theme.spacing.xxs,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modelName: {
    ...theme.text.title,
    color: theme.colors.text,
  },
  lineName: {
    ...theme.text.body,
    color: theme.colors.textMuted,
  },
  roundBadge: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  roundBadgeText: {
    ...theme.text.caption,
    color: theme.colors.danger,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionHeading: {
    ...theme.text.heading,
    color: theme.colors.text,
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
  noteCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface2,
  },
  noteText: {
    ...theme.text.body,
    color: theme.colors.text,
  },
  flaggedWrap: {
    paddingTop: theme.spacing.xs,
    alignItems: "center",
  },
  flaggedText: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  modalBg: {
    flex: 1,
    backgroundColor: theme.colors.cameraBg,
  },
  modalTopBar: (insets: EdgeInsets) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56 + insets.top,
    paddingTop: insets.top,
    paddingRight: theme.spacing.md,
    justifyContent: "center",
    alignItems: "flex-end",
    zIndex: 10,
  }),
  modalCloseBtn: {
    width: theme.touch.min,
    height: theme.touch.min,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlaySurface,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    ...theme.text.heading,
    color: theme.colors.overlayText,
  },
  modalImageWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  fullModalImage: {
    width: "100%",
    maxHeight: "80%",
  },
}));
