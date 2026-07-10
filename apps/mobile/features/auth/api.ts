import { http } from "../../lib/api-client";
import type { Worker, WorkerLoginResponse } from "./types";

export const authApi = {
  // Enrollment code IS the badge_token — backend unchanged.
  login: async (
    enrollmentCode: string,
    pin: string,
  ): Promise<WorkerLoginResponse> => {
    console.log("--ENROLLMENT CODE--", enrollmentCode);
    console.log("--PIN--", pin);
    const res = await http.post("/worker/login", {
      badge_token: enrollmentCode.trim(),
      pin,
      device_id: "emulator-dev", // real device id later
    });
    console.log("--RES--", res);
    return res.data?.data ?? res.data;
  },
  me: async (): Promise<Worker> => {
    const res = await http.get("/worker/me");
    return res.data?.data ?? res.data;
  },
};
