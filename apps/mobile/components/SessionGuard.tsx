import { router } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../features/auth/store";

/**
 * One phone per worker: when this phone is signed out because the worker signed in on another one,
 * leave whatever screen is open and show the login screen. Mounted once, in app/_layout.tsx.
 */
export function SessionGuard() {
  const signedOutElsewhere = useAuth((s) => s.signedOutElsewhere);

  useEffect(() => {
    if (!signedOutElsewhere) return;
    if (router.canDismiss()) router.dismissAll();
    router.replace("/login");
  }, [signedOutElsewhere]);

  return null;
}
