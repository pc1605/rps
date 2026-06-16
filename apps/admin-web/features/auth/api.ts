import { http } from "@/lib/api-client";
import type { LoginResponse, User } from "./types";

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await http.post("/auth/login", { email, password });
    return res.data?.data ?? res.data;
  },

  me: async (): Promise<User> => {
    const res = await http.get("/me");
    return res.data?.data ?? res.data;
  },
};
