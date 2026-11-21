import { useCameraPermissions } from "expo-camera";
import { useEffect } from "react";
import { AppState, Linking } from "react-native";

/**
 * Camera permission for the camera screens.
 * - Asks Android as soon as the screen opens (no extra tap on our own "Allow camera" button first).
 * - `blocked`: Android won't show its pop-up any more (the worker chose "Deny" + "Don't ask again"), so `ask`
 *   opens RPS's page in Android settings instead of doing nothing.
 * - Checks again when the app comes back to the front, so turning the camera on in settings works without
 *   leaving the screen.
 */
export function useCameraPermission() {
  const [permission, requestPermission, getPermission] = useCameraPermissions({ request: true });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  const blocked = permission != null && !permission.granted && !permission.canAskAgain;
  const ask = () => (blocked ? Linking.openSettings() : requestPermission());
  return { permission, blocked, ask };
}
