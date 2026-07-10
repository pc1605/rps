import "../lib/unistyles";
import { Stack } from "expo-router";
import { QueryProvider } from "../lib/query-provider";

export default function RootLayout() {
  return (
    <QueryProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryProvider>
  );
}
