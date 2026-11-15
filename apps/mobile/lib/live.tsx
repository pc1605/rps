import { LIVE_FALLBACK_POLL_MS, openLive } from "@rps/shared";
import { useQueryClient } from "@tanstack/react-query";
import { fetch as streamFetch } from "expo/fetch";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../features/auth/store";
import { tokenStore } from "./api-client";

// Live updates (RT1, D43): the server tells this phone "something changed" over one open line
// (GET /live) and every query marked live re-reads. Polling stays as a safety net.

const API_URL = process.env.EXPO_PUBLIC_API_URL;

let connected = false;

/**
 * Query options for data that follows the factory floor as it happens.
 * - Re-read at once when the server says something changed (`meta.live`).
 * - `pollMs`: how often to poll while the live line is down — what the query polled before RT1.
 *   While the line is up it polls once a minute instead.
 */
export function live(pollMs: number) {
  return {
    meta: { live: true },
    refetchInterval: () => (connected ? Math.max(pollMs, LIVE_FALLBACK_POLL_MS) : pollMs),
  };
}

/**
 * Holds the live line while a worker is signed in and the app is on screen. Mounted once, in
 * app/_layout.tsx. In the background the line is closed (saves battery; the OS would cut it anyway);
 * coming back reconnects, and connecting re-reads everything once.
 */
export function LiveUpdates() {
  const queryClient = useQueryClient();
  const signedIn = useAuth((s) => !!s.worker);
  const [active, setActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!signedIn || !active || !API_URL) return;
    return openLive({
      url: `${API_URL.replace(/\/$/, "")}/live`,
      // expo/fetch streams the response body; React Native's own fetch does not.
      fetch: (url, init) => streamFetch(url, init),
      getToken: tokenStore.get,
      onChange: () => queryClient.invalidateQueries({ predicate: (query) => query.meta?.live === true }),
      onStatus: (up) => {
        connected = up;
      },
    });
  }, [signedIn, active, queryClient]);

  return null;
}
