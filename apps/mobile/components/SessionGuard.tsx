import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../features/auth/store";

/**
 * Mounted once, in app/_layout.tsx.
 * - When the server signs this phone out (signed in on another phone, deactivated, token expired),
 *   leave whatever screen is open and show the login screen, which says why.
 * - When a worker signs out, by any way, forget everything loaded for them: the next worker on this
 *   phone must never see their queue, counts or work history (D42).
 */
export function SessionGuard() {
  const queryClient = useQueryClient();
  const signedOut = useAuth((s) => s.signedOut);
  const workerId = useAuth((s) => s.worker?.id);
  const lastWorkerId = useRef(workerId);

  useEffect(() => {
    if (lastWorkerId.current && !workerId) queryClient.clear();
    lastWorkerId.current = workerId;
  }, [workerId, queryClient]);

  useEffect(() => {
    if (!signedOut) return;
    if (router.canDismiss()) router.dismissAll();
    router.replace("/login");
  }, [signedOut]);

  return null;
}
