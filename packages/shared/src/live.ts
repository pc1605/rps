// Live updates client (RT1, D43) — shared by the admin web and the phone.
//
// Keeps one open line to GET /live (server-sent events). The server sends "data: changed" after every
// saved change and ": ping" every 25 s. A note carries no data: the app re-reads what it shows through
// the normal endpoints. This file only manages the line: connect, notice a dead line, reconnect.

/** No bytes for this long (two missed heartbeats and some slack) = the line is dead; reconnect. */
const SILENCE_MS = 60_000;
/** Wait before reconnecting: 1 s, 2 s, 5 s, then every 10 s. Back to 1 s after a good connection. */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000] as const;
/** Several notes in a row (a burst of scans) become one re-read. */
const COALESCE_MS = 250;
/** How often the apps poll while the line is up — a safety net only. */
export const LIVE_FALLBACK_POLL_MS = 60_000;

/** The part of fetch this needs: a streamed body. The browser's fetch and expo/fetch both fit. */
export type LiveFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{
  ok: boolean;
  body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } } | null;
}>;

export interface LiveOptions {
  /** Full URL of GET /live. */
  url: string;
  fetch: LiveFetch;
  /** Current access token; null = signed out (it keeps retrying quietly). */
  getToken: () => string | null | Promise<string | null>;
  /** Something changed — re-read. Also called once after every (re)connect, for whatever was missed. */
  onChange: () => void;
  /** The line went up (true) or down (false). */
  onStatus: (connected: boolean) => void;
}

/** Opens the line and keeps it open until the returned function is called. */
export function openLive({ url, fetch, getToken, onChange, onStatus }: LiveOptions): () => void {
  let closed = false;
  let connected = false;
  let attempt = 0;
  let abort: AbortController | null = null;
  let silence: ReturnType<typeof setTimeout> | undefined;
  let coalesce: ReturnType<typeof setTimeout> | undefined;
  let wake: (() => void) | null = null;

  const setConnected = (next: boolean) => {
    if (connected === next) return;
    connected = next;
    onStatus(next);
  };
  const changed = () => {
    if (coalesce) return;
    coalesce = setTimeout(() => {
      coalesce = undefined;
      if (!closed) onChange();
    }, COALESCE_MS);
  };
  const heard = () => {
    clearTimeout(silence);
    silence = setTimeout(() => abort?.abort(), SILENCE_MS);
  };

  const listen = async () => {
    const token = await getToken();
    if (!token || closed) return;
    abort = new AbortController();
    heard();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal: abort.signal,
    });
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done || closed) return;
      heard();
      if (!connected) {
        // First bytes (": connected"): the server is subscribed — catch up on anything missed.
        setConnected(true);
        attempt = 0;
        changed();
      }
      // The stream is plain ASCII, so no TextDecoder is needed (not every phone runtime has one).
      for (const byte of value ?? []) text += String.fromCharCode(byte);
      const lines = text.split("\n");
      text = lines.pop() ?? "";
      if (lines.some((line) => line.startsWith("data:"))) changed();
    }
  };

  const run = async () => {
    while (!closed) {
      try {
        await listen();
      } catch {
        // Network error, aborted, signed out … all the same here: wait and try again.
      }
      clearTimeout(silence);
      abort = null;
      setConnected(false);
      if (closed) return;
      const wait = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)] ?? 10_000;
      attempt += 1;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, wait);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      wake = null;
    }
  };
  void run();

  return () => {
    closed = true;
    clearTimeout(silence);
    clearTimeout(coalesce);
    abort?.abort();
    wake?.();
    setConnected(false);
  };
}
