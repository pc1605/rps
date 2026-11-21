import { create } from "zustand";
import { setSignedOutHandler, tokenStore } from "../../lib/api-client";
import { unregisterPush } from "../../lib/notifications";
import type { SignOutReason } from "../../lib/session";
import { authApi } from "./api";
import type { Worker } from "./types";

interface AuthState {
  worker: Worker | null;
  /** What the last login attempt threw (null = no error). The login screen words it in the current language. */
  error: unknown;
  submitting: boolean;
  /** The server signed this phone out, and why (null = it didn't). The login screen says why. */
  signedOut: SignOutReason | null;
  login: (code: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  worker: null,
  error: null,
  submitting: false,
  signedOut: null,

  login: async (code, pin) => {
    set({ submitting: true, error: null });
    try {
      const resp = await authApi.login(code, pin);
      await tokenStore.set(resp.tokens.access_token);
      set({ worker: resp.worker, submitting: false, signedOut: null });
      return true;
    } catch (e) {
      set({ error: e ?? new Error("login failed"), submitting: false });
      return false;
    }
  },

  logout: async () => {
    await unregisterPush(); // while the token still works
    await tokenStore.clear();
    set({ worker: null });
  },
  // Cold start: the token is there, the profile isn't loaded yet. If the server refuses the token, the
  // signed-out handler below signs out. Anything else (no network, server down) keeps the token — the
  // home screen tries again when the phone is back online, or on pull-to-refresh.
  restore: async () => {
    try {
      const w = await authApi.me();
      set({ worker: w });
    } catch {
      // kept signed in; see above
    }
  },
}));

// The server refused this phone's token (signed in on another phone, deactivated, expired): sign out
// here. <SessionGuard /> (app/_layout.tsx) then shows the login screen, which says why.
setSignedOutHandler((reason) => {
  if (useAuth.getState().signedOut) return;
  useAuth.setState({ worker: null, signedOut: reason });
  void tokenStore.clear();
});
