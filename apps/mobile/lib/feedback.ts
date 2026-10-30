import { createAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

const sounds = {
  ok: require("../assets/sounds/ok.wav"),
  warn: require("../assets/sounds/warn.wav"),
  err: require("../assets/sounds/err.wav"),
};

let okPlayer: ReturnType<typeof createAudioPlayer> | null = null;
let warnPlayer: ReturnType<typeof createAudioPlayer> | null = null;
let errPlayer: ReturnType<typeof createAudioPlayer> | null = null;

function playSound(type: "ok" | "warn" | "err") {
  try {
    if (type === "ok") {
      if (!okPlayer) okPlayer = createAudioPlayer(sounds.ok);
      okPlayer.seekTo(0);
      okPlayer.play();
    } else if (type === "warn") {
      if (!warnPlayer) warnPlayer = createAudioPlayer(sounds.warn);
      warnPlayer.seekTo(0);
      warnPlayer.play();
    } else {
      if (!errPlayer) errPlayer = createAudioPlayer(sounds.err);
      errPlayer.seekTo(0);
      errPlayer.play();
    }
  } catch {
    // Audio playback can fail silently (unsupported platform or muted)
  }
}

export type FeedbackKind = "ok" | "dup" | "quota" | "err" | "sent";

export function feedback(kind: FeedbackKind): void {
  // 1. Haptics
  try {
    switch (kind) {
      case "ok":
      case "sent":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "dup":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "quota":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "err":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Haptics can fail silently on unsupported platforms
  }

  // 2. Sound
  switch (kind) {
    case "ok":
    case "sent":
      playSound("ok");
      break;
    case "dup":
    case "quota":
      playSound("warn");
      break;
    case "err":
      playSound("err");
      break;
  }
}
