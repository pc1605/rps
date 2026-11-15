import { create } from "zustand";

/** The one-time enrollment code: 6 digits, made by the admin for one worker. */
export const ENROLL_CODE_RE = /^\d{6}$/;

// Holds the enrollment code (scanned on the enroll-scan screen, or typed by the admin) until login
// consumes it. Kept in memory only and never shown on screen.
export const useEnrollDraft = create<{
  code: string;
  setCode: (code: string) => void;
  clear: () => void;
}>((set) => ({
  code: "",
  setCode: (code) => set({ code }),
  clear: () => set({ code: "" }),
}));
