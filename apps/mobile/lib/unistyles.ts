import { StyleSheet } from "react-native-unistyles";
import { getLanguage } from "./language";
import { type AppTheme, themesFor } from "./theme";

type AppThemes = { light: AppTheme; dark: AppTheme };

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  // Start in the saved language's font; lib/language.ts swaps the themes when the language changes.
  themes: themesFor(getLanguage()),
  settings: {
    adaptiveThemes: true,
  },
});
