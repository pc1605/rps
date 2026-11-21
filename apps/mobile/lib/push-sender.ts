/**
 * Sends this phone's notification address (Firebase token) to the server once per signed-in worker.
 * - The same worker + token + language is never sent twice: expo-notifications fires its "token"
 *   event on every fetch of the token, so sending on each event would loop (N1).
 * - `forget()` when the worker signs out — by any way: the server drops the address at every sign-in,
 *   so the next sign-in on this phone (even the same worker's) must send it again.
 * - A failed send is forgotten too, so the next try goes out.
 */
export function pushSender(put: (token: string, lang: string) => Promise<unknown>) {
  let lastSent: string | null = null;
  return {
    send: async (workerId: string, token: string, lang: string): Promise<void> => {
      const key = `${workerId}|${token}|${lang}`;
      if (key === lastSent) return;
      lastSent = key; // before the request: the token event fired by our own fetch arrives while it is on its way
      try {
        await put(token, lang);
      } catch (e) {
        if (lastSent === key) lastSent = null;
        throw e;
      }
    },
    forget: () => {
      lastSent = null;
    },
  };
}
