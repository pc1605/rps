import { create } from "zustand";
import { setSignedInElsewhereHandler, tokenStore } from "../../lib/api-client";
import { authApi } from "./api";
import type { Worker } from "./types";

interface AuthState {
  worker: Worker | null;
  /** What the last login attempt threw (null = no error). The login screen words it in the current language. */
  error: unknown;
  submitting: boolean;
  /** This phone was signed out because the worker signed in on another one (one phone per worker). */
  signedOutElsewhere: boolean;
  login: (code: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  worker: null,
  error: null,
  submitting: false,
  signedOutElsewhere: false,

  login: async (code, pin) => {
    set({ submitting: true, error: null });
    try {
      const resp = await authApi.login(code, pin);
      await tokenStore.set(resp.tokens.access_token);
      set({ worker: resp.worker, submitting: false, signedOutElsewhere: false });
      return true;
    } catch (e) {
      set({ error: e ?? new Error("login failed"), submitting: false });
      return false;
    }
  },

  logout: async () => {
    await tokenStore.clear();
    set({ worker: null });
  },
  restore: async () => {
    try {
      const w = await authApi.me();
      set({ worker: w });
    } catch {
      // token invalid/expired → clear and let index redirect to login
      await tokenStore.clear();
      set({ worker: null });
    }
  },
}));

// The server refused this phone's token because the worker signed in on another phone: sign out here.
// <SessionGuard /> (app/_layout.tsx) then shows the login screen, which says why.
setSignedInElsewhereHandler(() => {
  if (useAuth.getState().signedOutElsewhere) return;
  useAuth.setState({ worker: null, signedOutElsewhere: true });
  void tokenStore.clear();
});
