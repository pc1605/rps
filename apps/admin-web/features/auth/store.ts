import { create } from "zustand";
import { tokenStore, ApiError } from "@/lib/api-client";
import { authApi } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const resp = await authApi.login(email, password);
      tokenStore.set(resp.tokens.access_token, resp.tokens.refresh_token);
      set({ user: resp.user, loading: false });
      return true;
    } catch (e) {
      set({
        error: e instanceof ApiError ? e.message : "Login failed",
        loading: false,
      });
      return false;
    }
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null });
  },

  restore: async () => {
    if (!tokenStore.access()) {
      set({ loading: false });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, loading: false });
    } catch {
      tokenStore.clear();
      set({ user: null, loading: false });
    }
  },
}));
