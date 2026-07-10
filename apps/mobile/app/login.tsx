import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native-unistyles";
import { useAuth } from "../features/auth/store";

export default function Login() {
  const router = useRouter();
  const { login, error, submitting } = useAuth();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");

  const canSubmit =
    code.trim().length > 0 && /^\d{4}$/.test(pin) && !submitting;

  const handleLogin = async () => {
    const ok = await login(code, pin);
    if (ok) router.replace("/home");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>AMBIKA · RIDDHI</Text>
        <Text style={styles.title}>RPS Worker</Text>
        <Text style={styles.subtitle}>
          Enter your enrollment code and PIN to set up this phone.
        </Text>

        <Text style={styles.label}>ENROLLMENT CODE</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="BADGE-…"
          placeholderTextColor={styles.placeholder.color}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={[styles.label, styles.labelSpaced]}>4-DIGIT PIN</Text>
        <TextInput
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          placeholderTextColor={styles.placeholder.color}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          style={[styles.input, styles.pinInput]}
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={handleLogin}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.button,
            !canSubmit && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={styles.buttonText.color} />
          ) : (
            <Text
              style={[
                styles.buttonText,
                !canSubmit && styles.buttonTextDisabled,
              ]}
            >
              Set up this phone →
            </Text>
          )}
        </Pressable>

        <Text style={styles.footnote}>
          One-time setup. You'll stay signed in on this phone.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, justifyContent: "center", padding: theme.spacing.lg },
  eyebrow: { ...theme.text.eyebrow, color: theme.colors.accent },
  title: {
    ...theme.text.title,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    marginTop: 6,
    marginBottom: theme.spacing.xl,
  },
  label: {
    ...theme.text.label,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  labelSpaced: { marginTop: theme.spacing.lg - 4 },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 16,
  },
  pinInput: { letterSpacing: 12, fontSize: 24, textAlign: "center" },
  placeholder: { color: theme.colors.textFaint },
  errorBox: {
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm + 2,
    padding: theme.spacing.md - 4,
    marginTop: theme.spacing.lg - 4,
  },
  errorText: { color: theme.colors.danger, fontSize: 14 },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: theme.spacing.lg + 4,
  },
  buttonDisabled: { backgroundColor: theme.colors.disabledBg },
  buttonPressed: { opacity: 0.85 },
  buttonText: { ...theme.text.button, color: theme.colors.accentFg },
  buttonTextDisabled: { color: theme.colors.disabledFg },
  footnote: {
    color: theme.colors.textFaint,
    fontSize: 12,
    textAlign: "center",
    marginTop: theme.spacing.lg,
  },
}));
