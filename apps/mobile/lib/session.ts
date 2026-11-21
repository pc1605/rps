/**
 * Why this phone is signed out by the server:
 * - "elsewhere": the worker signed in on another phone (one phone per worker, D44);
 * - "unauthorized": the token is no longer accepted (worker deactivated, or the 30-day token ran out).
 */
export type SignOutReason = "elsewhere" | "unauthorized";

/**
 * Whether a failed request means this phone's session has ended. Only a 401 to a request that carried
 * the token does: no network, a timeout or a server error never sign the worker out (they would need
 * the admin to set the phone up again), and a 401 on the login itself is a wrong code or PIN.
 */
export function signOutReason(
  status: number,
  code: string,
  sentToken: boolean,
  url = "",
): SignOutReason | null {
  if (status !== 401 || !sentToken || url.includes("/worker/login")) return null;
  return code === "signed_in_elsewhere" ? "elsewhere" : "unauthorized";
}
