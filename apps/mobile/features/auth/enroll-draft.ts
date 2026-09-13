import { create } from "zustand";

// Holds a badge scanned on the enroll-scan screen until login consumes it.
export const useEnrollDraft = create<{
  badge: string;
  setBadge: (b: string) => void;
  clear: () => void;
}>((set) => ({
  badge: "",
  setBadge: (badge) => set({ badge }),
  clear: () => set({ badge: "" }),
}));
