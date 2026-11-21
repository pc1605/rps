import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "../features/auth/store";
import { http } from "./api-client";
import { getStrings, useLanguage } from "./language";
import { pushSender } from "./push-sender";

// Phone notifications (N1, D47): the server tells this phone through Firebase when work comes to the
// worker — a batch assigned or handed over to them, a rework mat sent to them. Works with the app closed.

/** Android channel; the server sends on this one (internal/push ChannelID). Must match. */
const CHANNEL_ID = "work";

// A notification that arrives while the app is open is shown too (sound + banner), like when closed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: getStrings().notifications.channelName,
    importance: Notifications.AndroidImportance.HIGH,
    // No `sound`: the channel plays the phone's normal notification sound. (A text here — even
    // "default" — is read as the name of a sound file bundled in the app.)
    vibrationPattern: [0, 250, 150, 250],
  });
}

/** Sends this phone's address once per signed-in worker (never twice: see lib/push-sender.ts). */
const sender = pushSender((token, lang) => http.put("/worker/me/push-token", { token, lang }));

/** Ask for permission (Android 13+ shows a prompt once), then hand this phone's address to the server. */
async function register(workerId: string, language: string): Promise<void> {
  await ensureChannel();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return; // the worker said no: the app works as before, without notifications
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  await sender.send(workerId, token, language);
}

/** Signing out: stop notifications on this phone. Best effort — signing out never waits on it. */
export async function unregisterPush(): Promise<void> {
  try {
    await http.delete("/worker/me/push-token", { timeout: 4000 });
  } catch {
    // Offline or already signed out elsewhere (the server dropped this phone's address then).
  }
}

function open(data: Record<string, unknown> | undefined) {
  if (!data || !useAuth.getState().worker) return;
  if (data.kind === "batch" && typeof data.batch_id === "string") {
    router.push({ pathname: "/batch/[id]", params: { id: data.batch_id } });
  } else if (data.kind === "rework" && typeof data.rework_id === "string") {
    router.push({ pathname: "/rework/[id]", params: { id: data.rework_id } });
  }
}

/**
 * Registers this phone while a worker is signed in (again when the language or Firebase's address changes)
 * and opens the batch or rework mat when a notification is tapped. Mounted once, in app/_layout.tsx.
 */
export function PushNotifications() {
  const workerId = useAuth((s) => s.worker?.id);
  const language = useLanguage((s) => s.language);

  useEffect(() => {
    if (!workerId) {
      // Signed out, by any way (sign-out button, signed in elsewhere, expired): the server drops this
      // phone's address at the next sign-in, so that sign-in must send it again.
      sender.forget();
      return;
    }
    const run = () =>
      register(workerId, language).catch((e) => {
        // No Firebase setup in this build, no network, … — the app keeps working without notifications.
        console.warn("push registration failed", e);
      });
    void run();
    // Firebase gave this phone a new address. Use the token from the event — never fetch it here: fetching the
    // token fires this same event, which would loop (expo-notifications emits it on every fetch).
    const sub = Notifications.addPushTokenListener(({ data }) => {
      if (typeof data !== "string") return;
      sender.send(workerId, data, language).catch((e) => console.warn("push registration failed", e));
    });
    return () => sub.remove();
  }, [workerId, language]);

  // A tap on a notification — also the one that started the app.
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!workerId || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    open(last.notification.request.content.data);
    void Notifications.clearLastNotificationResponseAsync();
  }, [last, workerId]);

  return null;
}
