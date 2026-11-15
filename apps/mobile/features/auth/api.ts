import { http } from "../../lib/api-client";
import type { Worker, WorkerLoginResponse } from "./types";

export const authApi = {
  // The one-time enrollment code the admin made for this worker (works once, for 10 minutes) + the PIN.
  login: async (enrollmentCode: string, pin: string): Promise<WorkerLoginResponse> => {
    const res = await http.post("/worker/login", {
      code: enrollmentCode.trim(),
      pin,
      device_id: "emulator-dev", // real device id later
    });
    return res.data?.data ?? res.data;
  },
  me: async (): Promise<Worker> => {
    const res = await http.get("/worker/me");
    return res.data?.data ?? res.data;
  },
};
