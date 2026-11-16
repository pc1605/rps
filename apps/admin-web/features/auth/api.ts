import { http } from "@/lib/api-client";
import type { LoginResponse, User } from "./types";

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    // withCredentials: the browser must keep the refresh cookie this response sets.
    const res = await http.post("/auth/login", { email, password }, { withCredentials: true });
    return res.data?.data ?? res.data;
  },

  /** Removes the refresh cookie (the page can't — it is httpOnly). */
  logout: async (): Promise<void> => {
    await http.post("/auth/logout", null, { withCredentials: true });
  },

  me: async (): Promise<User> => {
    const res = await http.get("/me");
    return res.data?.data ?? res.data;
  },
};
