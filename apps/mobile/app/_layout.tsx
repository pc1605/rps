import "../lib/unistyles";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from "@expo-google-fonts/ibm-plex-sans";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useUnistyles } from "react-native-unistyles";
import { QueryProvider } from "../lib/query-provider";

export default function RootLayout() {
  const { theme } = useUnistyles();
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryProvider>
        {/* One status bar for the app: dark icons on light theme, light icons on dark. */}
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            // Paint every screen and the gaps between screen transitions with the theme
            // background, so no white flash shows during navigation in dark mode.
            contentStyle: { backgroundColor: theme.colors.bg },
            animation: "slide_from_right",
          }}
        />
      </QueryProvider>
    </SafeAreaProvider>
  );
}
