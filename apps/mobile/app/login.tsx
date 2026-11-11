import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../components/ui/AppButton";
import { Banner } from "../components/ui/Banner";
import { Screen } from "../components/ui/Screen";
import { useEnrollDraft } from "../features/auth/enroll-draft";
import { useAuth } from "../features/auth/store";
import { strings } from "../lib/strings";

export default function Login() {
  const router = useRouter();
  const { login, error, submitting } = useAuth();
  const [pin, setPin] = useState("");
  const code = useEnrollDraft((s) => s.badge);
  const setCode = useEnrollDraft((s) => s.setBadge);

  const canSubmit = code.trim().length > 0 && /^\d{4}$/.test(pin) && !submitting;

  const handleLogin = async () => {
    const ok = await login(code, pin);
    if (ok) {
      useEnrollDraft.getState().clear();
      router.replace("/home");
    }
  };

  return (
    <Screen
      centered
      footer={
        <View style={styles.bottomActionInner}>
          <AppButton
            title={strings.login.submit}
            size="lg"
            onPress={handleLogin}
            disabled={!canSubmit}
            loading={submitting}
          />
          <Text style={styles.footnote}>{strings.login.footnote}</Text>
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{strings.login.eyebrow}</Text>
        <Text style={styles.title}>{strings.login.title}</Text>
        <Text style={styles.subtitle}>{strings.login.subtitle}</Text>
      </View>

      {/* Primary Scan Button at top of form */}
      <View style={styles.scanBtnWrap}>
        <AppButton
          title={code ? strings.login.scanDifferent : strings.login.scanCode}
          icon={<Text style={styles.camIcon}>📷</Text>}
          variant={code ? "secondary" : "primary"}
          size="lg"
          onPress={() => router.push("/enroll-scan")}
        />
      </View>

      {/* Fallback code input */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{strings.login.codeLabel}</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder={strings.login.codePlaceholder}
          placeholderTextColor={styles.placeholder.color}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.codeInput, !!code && styles.inputFilled]}
        />
      </View>

      {/* PIN Input */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{strings.login.pinLabel}</Text>
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
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Banner kind="danger" text={error} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    marginBottom: theme.spacing.xs,
  },
  eyebrow: {
    ...theme.text.caption,
    color: theme.colors.accent,
  },
  title: {
    ...theme.text.title,
    color: theme.colors.text,
    marginTop: theme.spacing.xxs,
  },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  scanBtnWrap: {
    marginVertical: theme.spacing.xs,
  },
  camIcon: {
    ...theme.text.body,
  },
  field: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
  },
  input: {
    ...theme.text.body,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
    minHeight: theme.touch.min,
  },
  codeInput: {
    ...theme.text.code,
  },
  pinInput: {
    ...theme.text.title,
    fontVariant: ["tabular-nums"],
    letterSpacing: 12,
    textAlign: "center",
  },
  inputFilled: {
    borderColor: theme.colors.accent,
  },
  placeholder: {
    color: theme.colors.textFaint,
  },
  errorWrap: {
    marginTop: theme.spacing.xs,
  },
  bottomActionInner: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    gap: theme.spacing.xs,
  },
  footnote: {
    ...theme.text.caption,
    color: theme.colors.textFaint,
    textAlign: "center",
  },
}));
