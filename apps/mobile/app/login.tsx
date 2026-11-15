import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AppButton } from "../components/ui/AppButton";
import { LanguagePicker } from "../components/LanguagePicker";
import { Banner } from "../components/ui/Banner";
import { Screen } from "../components/ui/Screen";
import { ENROLL_CODE_RE, useEnrollDraft } from "../features/auth/enroll-draft";
import { useAuth } from "../features/auth/store";
import { ApiError } from "../lib/api-client";
import { errorText } from "../lib/errors";
import { useStrings } from "../lib/language";

export default function Login() {
  const strings = useStrings();
  const router = useRouter();
  const { login, error, submitting, signedOutElsewhere } = useAuth();
  // On this screen "unauthorized" can only mean a wrong code or PIN.
  const errorMessage =
    error == null
      ? null
      : error instanceof ApiError && error.code === "unauthorized"
        ? strings.login.wrongCodeOrPin
        : errorText(strings, error, strings.common.loginFailed);
  const [pin, setPin] = useState("");
  const code = useEnrollDraft((s) => s.code);
  const setCode = useEnrollDraft((s) => s.setCode);
  // The code is never shown: a scanned one is only confirmed, a typed one (by the admin) shows as dots.
  const [typing, setTyping] = useState(false);
  const scanned = !typing && ENROLL_CODE_RE.test(code);

  const canSubmit = ENROLL_CODE_RE.test(code) && /^\d{4}$/.test(pin) && !submitting;

  const handleScan = () => {
    setTyping(false);
    setCode("");
    router.push("/enroll-scan");
  };

  const handleType = () => {
    setCode("");
    setTyping(true);
  };

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
      header={
        <View style={styles.languageBar}>
          <LanguagePicker />
        </View>
      }
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
          title={scanned ? strings.login.scanDifferent : strings.login.scanCode}
          icon={<Text style={styles.camIcon}>📷</Text>}
          variant={scanned ? "secondary" : "primary"}
          size="lg"
          onPress={handleScan}
        />
      </View>

      {scanned ? (
        <Text style={styles.codeScanned} accessibilityRole="text">
          {strings.login.codeScanned}
        </Text>
      ) : typing ? (
        /* Camera not working: the admin types the code from their screen. Shown as dots, like the PIN. */
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{strings.login.codeLabel}</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor={styles.placeholder.color}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
            style={[styles.input, styles.pinInput]}
          />
        </View>
      ) : (
        <AppButton title={strings.login.typeCode} variant="ghost" size="md" onPress={handleType} />
      )}

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

      {errorMessage ? (
        <View style={styles.errorWrap}>
          <Banner kind="danger" text={errorMessage} />
        </View>
      ) : signedOutElsewhere ? (
        <View style={styles.errorWrap}>
          <Banner kind="warning" text={strings.login.signedOutElsewhere} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  languageBar: {
    alignItems: "flex-end",
    paddingHorizontal: theme.spacing.xs,
  },
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
  codeScanned: {
    ...theme.text.bodyMed,
    color: theme.colors.success,
    textAlign: "center",
    minHeight: theme.touch.min,
    textAlignVertical: "center",
  },
  pinInput: {
    ...theme.text.title,
    fontVariant: ["tabular-nums"],
    letterSpacing: 12,
    textAlign: "center",
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
