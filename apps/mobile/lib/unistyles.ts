import { StyleSheet } from "react-native-unistyles";
import { type AppTheme, darkTheme, lightTheme } from "./theme";

type AppThemes = { light: AppTheme; dark: AppTheme };

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: { light: lightTheme, dark: darkTheme },
  settings: {
    adaptiveThemes: true,
  },
});
