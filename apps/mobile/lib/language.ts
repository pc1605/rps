import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { UnistylesRuntime } from "react-native-unistyles";
import { create } from "zustand";
import { en, type Language, type Strings } from "./strings";
import { hi } from "./strings.hi";
import { themesFor } from "./theme";

// Per phone, not per worker: kept on sign-out (logout only clears the token) and across restarts.
const LANGUAGE_KEY = "rps_language";
/** Language of a fresh install (owner decision D41: workers read Hindi). */
const DEFAULT_LANGUAGE: Language = "hi";

/** Picker order. Each name is written in its own language and never translated. */
export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

const tables: Record<Language, Strings> = { en, hi };

const onWeb = Platform.OS === "web";

// Read synchronously so the very first screen is already in the saved language.
function readSaved(): Language {
  try {
    const saved = onWeb
      ? typeof localStorage !== "undefined"
        ? localStorage.getItem(LANGUAGE_KEY)
        : null
      : SecureStore.getItem(LANGUAGE_KEY);
    return saved === "en" || saved === "hi" ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function save(language: Language) {
  try {
    if (onWeb) localStorage.setItem(LANGUAGE_KEY, language);
    else SecureStore.setItem(LANGUAGE_KEY, language);
  } catch {
    // Not saved: the language still changes now, the phone just starts in the old one next time.
  }
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguage = create<LanguageState>((set, get) => ({
  language: readSaved(),
  setLanguage: (language) => {
    if (language === get().language) return;
    set({ language });
    // Swap the font and line heights in both themes (lib/theme.ts); Unistyles re-styles every screen.
    const themes = themesFor(language);
    UnistylesRuntime.updateTheme("light", () => themes.light);
    UnistylesRuntime.updateTheme("dark", () => themes.dark);
    save(language);
  },
}));

/** Current language outside React (lib/unistyles.ts picks the first theme with it). */
export const getLanguage = (): Language => useLanguage.getState().language;

/** Texts outside React (e.g. lib/api-client.ts). Read at the moment of use, never at module load. */
export const getStrings = (): Strings => tables[getLanguage()];

/** Texts in components: re-renders the component when the language changes. */
export const useStrings = (): Strings => tables[useLanguage((s) => s.language)];
