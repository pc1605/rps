import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function Stat({
  value,
  of,
  label,
  big,
}: {
  value: number | string;
  of?: number | string;
  label?: string;
  big?: boolean;
}) {
  return (
    <View>
      <Text style={big ? styles.display : styles.stat}>
        {value}
        {of !== undefined && <Text style={styles.of}> / {of}</Text>}
      </Text>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  display: { ...theme.text.display, color: theme.colors.text },
  stat: { ...theme.text.stat, color: theme.colors.text },
  of: { color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  label: { ...theme.text.small, color: theme.colors.textMuted, marginTop: 4 },
}));
