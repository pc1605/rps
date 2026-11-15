"use client";

import { LIVE_FALLBACK_POLL_MS, openLive } from "@rps/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiOrigin, tokenStore } from "./api-client";

// Live updates (RT1, D43): the server tells this tab "something changed" over one open line
// (GET /live) and every query marked live re-reads. Polling stays as a safety net.

let connected = false;

/**
 * Query options for data that should follow the factory floor as it happens.
 * - Re-read at once when the server says something changed (`meta.live`).
 * - `pollMs`: how often to poll while the live line is down — what the query polled before RT1.
 *   While the line is up it polls once a minute instead. Without `pollMs` it never polls.
 */
export function live(pollMs?: number) {
  return {
    meta: { live: true },
    ...(pollMs
      ? { refetchInterval: () => (connected ? Math.max(pollMs, LIVE_FALLBACK_POLL_MS) : pollMs) }
      : {}),
  };
}

/** Holds the live line while this tab is visible. Mounted once, in the signed-in shell. */
export function LiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let close: (() => void) | null = null;
    const start = () => {
      close ??= openLive({
        url: `${apiOrigin}/api/v1/live`,
        fetch: (url, init) => fetch(url, init),
        // An expired token gets a 401 and a retry; the normal API calls refresh it in the meantime.
        getToken: tokenStore.access,
        onChange: () => queryClient.invalidateQueries({ predicate: (query) => query.meta?.live === true }),
        onStatus: (up) => {
          connected = up;
        },
      });
    };
    const stop = () => {
      close?.();
      close = null;
    };
    // Only a visible tab holds a line: browsers allow about six connections per server on HTTP/1.1,
    // so many background tabs each holding one would block every other request. Coming back to the
    // tab reconnects, and connecting re-reads everything once.
    const sync = () => (document.visibilityState === "visible" ? start() : stop());
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      stop();
    };
  }, [queryClient]);
  return null;
}
