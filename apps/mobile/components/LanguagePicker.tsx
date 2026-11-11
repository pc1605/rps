import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { LANGUAGES, useLanguage, useStrings } from "../lib/language";

/** "English | हिन्दी" — small, on the login screen and the home header. The choice is saved on this phone. */
export function LanguagePicker() {
  const strings = useStrings();
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={strings.common.language}>
      {LANGUAGES.map(({ code, label }, i) => {
        const selected = code === language;
        return (
          <View key={code} style={styles.item}>
            {i > 0 && <Text style={styles.divider}>|</Text>}
            <Pressable
              onPress={() => setLanguage(code)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              style={styles.option}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: "row", alignItems: "center" },
  item: { flexDirection: "row", alignItems: "center" },
  divider: { ...theme.text.small, color: theme.colors.textFaint },
  option: {
    minHeight: theme.touch.min,
    minWidth: theme.touch.min,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xs,
  },
  label: { ...theme.text.small, color: theme.colors.textMuted },
  labelSelected: { color: theme.colors.accent, fontFamily: theme.fonts.semibold },
}));
