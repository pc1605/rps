import type { GiveBackReason } from "@rps/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../../../components/ui/AppButton";
import { Screen } from "../../../components/ui/Screen";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import { useMyBatches, useReleaseBatch } from "../../../features/batches/hooks";
import { errorText } from "../../../lib/errors";
import { useStrings } from "../../../lib/language";

const REASON_KEYS: GiveBackReason[] = [
  "machine_issue",
  "material_issue",
  "too_much_work",
  "shift_over",
  "other",
];

/** The cutter gives a batch back to the admin and says why (D48). */
export default function GiveBack() {
  const strings = useStrings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: batches } = useMyBatches();
  const release = useReleaseBatch();
  const batch = useMemo(() => batches?.find((b) => b.id === id), [batches, id]);

  const [reason, setReason] = useState<GiveBackReason | null>(null);
  const [note, setNote] = useState("");
  const noteNeeded = reason === "other";
  const canSubmit = reason !== null && (!noteNeeded || note.trim() !== "") && !release.isPending;

  const submit = () => {
    if (!id || reason === null || !canSubmit) return;
    release.mutate(
      { id, reason, note: note.trim() || undefined },
      {
        onSuccess: () => {
          Alert.alert(strings.common.done, strings.cutting.released(batch?.batch_code ?? ""));
          router.dismissTo("/home");
        },
        onError: (e) =>
          Alert.alert(strings.common.couldntDoThat, errorText(strings, e, strings.common.somethingWrong)),
      },
    );
  };

  return (
    <Screen
      header={<ScreenHeader back title={batch?.batch_code} />}
      footer={
        <AppButton
          title={reason === null ? strings.cutting.chooseReason : strings.cutting.releaseConfirm}
          size="lg"
          disabled={!canSubmit}
          loading={release.isPending}
          onPress={submit}
        />
      }
    >
      <View style={styles.intro}>
        <Text style={styles.title}>{strings.cutting.reasonTitle}</Text>
        <Text style={styles.body}>{strings.cutting.releaseBody}</Text>
      </View>

      <View style={styles.grid} accessibilityRole="radiogroup">
        {REASON_KEYS.map((key) => {
          const item = strings.cutting.reasons[key];
          const selected = reason === key;
          return (
            <Pressable
              key={key}
              onPress={() => setReason(key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.tile,
                selected && styles.tileSelected,
                pressed && styles.tilePressed,
              ]}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.label}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.noteSection}>
        <Text style={styles.noteLabel}>
          {noteNeeded ? strings.cutting.noteNeeded : strings.cutting.noteLabel}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={strings.cutting.notePlaceholder}
          placeholderTextColor={styles.placeholder.color}
          style={styles.noteInput}
          returnKeyType="done"
          maxLength={200}
          accessibilityLabel={noteNeeded ? strings.cutting.noteNeeded : strings.cutting.noteLabel}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  intro: {
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.text.heading,
    color: theme.colors.text,
  },
  body: {
    ...theme.text.small,
    color: theme.colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  tile: {
    flexBasis: "48%",
    minHeight: 96,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
  },
  tileSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 2,
  },
  tilePressed: {
    opacity: 0.8,
  },
  emoji: {
    ...theme.text.emoji,
    textAlign: "center",
  },
  label: {
    ...theme.text.bodyMed,
    color: theme.colors.text,
    textAlign: "center",
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
  placeholder: {
    color: theme.colors.textMuted,
  },
}));
