import { create } from "zustand";

interface ReworkReturnState {
  sent: boolean;
  markSent: () => void;
  consume: () => boolean;
}

export const useReworkReturn = create<ReworkReturnState>((set, get) => ({
  sent: false,
  markSent: () => set({ sent: true }),
  consume: () => {
    const wasSent = get().sent;
    if (wasSent) {
      set({ sent: false });
    }
    return wasSent;
  },
}));
