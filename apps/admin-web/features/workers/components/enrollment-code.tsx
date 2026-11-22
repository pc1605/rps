"use client";

import {
  ENROLL_CODE_TTL_MS,
  ENROLL_PREFIX,
  type EnrollmentCode as Code,
  type EnrollmentStatus,
} from "@rps/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { live } from "@/lib/live";
import { workerApi } from "../api";

type CodeState =
  | { kind: "waiting"; triesLeft: number | null }
  | { kind: "used" }
  | { kind: "blocked" }
  | { kind: "replaced" }
  | { kind: "expired" };

/**
 * What became of the code on screen, from the server's view of the worker's code. The code is never
 * sent back, so it is recognised by its expiry; a sign-in after it was made means it was used.
 */
function codeState(code: Code, status: EnrollmentStatus | undefined, secondsLeft: number): CodeState {
  const expires = Date.parse(code.expires_at);
  const liveExpires = status?.expires_at ? Date.parse(status.expires_at) : null;
  if (status && liveExpires !== expires) {
    const madeAt = expires - ENROLL_CODE_TTL_MS;
    if (status.last_login_at && Date.parse(status.last_login_at) >= madeAt) return { kind: "used" };
    if (liveExpires !== null && liveExpires > expires) return { kind: "replaced" };
    if (secondsLeft > 0) return { kind: "blocked" };
  }
  if (secondsLeft <= 0) return { kind: "expired" };
  return { kind: "waiting", triesLeft: status?.tries_left ?? null };
}

/**
 * One-time code for setting up a worker's phone: QR to scan, the same 6 digits to type, and the time
 * left. Mounting it makes a fresh code (the one before stops working), so mount it only while the
 * admin is looking at it. The code works once and for 10 minutes — there is nothing to copy or share.
 * Once the phone signs in with it (or wrong PINs block it, or another screen makes a newer one) it
 * says so, instead of showing a QR that no longer works.
 */
export function EnrollmentCode({ workerId }: { workerId: string }) {
  const [code, setCode] = useState<Code | null>(null);
  const [failed, setFailed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Every request makes a new code and kills the one before, so only the latest answer may be shown.
  const latest = useRef(0);
  // Requests run one after another: two at once could reach the server in the other order, leaving
  // on screen the code the server has already replaced. A request overtaken while waiting is dropped.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(() => {
    const request = ++latest.current;
    setCode(null);
    setFailed(false);
    queue.current = queue.current.then(async () => {
      if (request !== latest.current) return;
      try {
        const next = await workerApi.enrollment(workerId);
        if (request !== latest.current) return;
        setCode(next);
        setSecondsLeft(Math.max(0, Math.round((Date.parse(next.expires_at) - Date.now()) / 1000)));
      } catch (err) {
        if (request !== latest.current) return;
        setFailed(true);
        toast.error("Couldn't make a code", { description: (err as Error).message });
      }
    });
  }, [workerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!code) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((Date.parse(code.expires_at) - Date.now()) / 1000)));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [code]);

  const waiting = code != null && secondsLeft > 0;
  const { data: status } = useQuery({
    // One query per code: a newer code never starts from the status of the one before.
    queryKey: ["worker-enrollment", workerId, code?.expires_at],
    queryFn: () => workerApi.enrollmentStatus(workerId),
    enabled: waiting,
    ...live(),
    // A sign-in comes as a live note at once. A wrong PIN doesn't (failed requests send no note), so
    // the status is also read every few seconds while the code is still waiting — and no longer after.
    refetchInterval: (query) =>
      code && query.state.data && codeState(code, query.state.data, secondsLeft).kind !== "waiting"
        ? false
        : 5_000,
  });

  if (failed) {
    return (
      <div className="space-y-3">
        <p className="text-small text-danger">Couldn’t make a code. Check the connection and try again.</p>
        <Button type="button" variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }
  if (!code) return <p className="text-small text-muted-foreground">Making a code…</p>;

  const state = codeState(code, status, secondsLeft);
  const usable = state.kind === "waiting";
  const digits = `${code.code.slice(0, 3)} ${code.code.slice(3)}`;
  const timeLeft = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const panel: Record<Exclude<CodeState["kind"], "waiting">, React.ReactNode> = {
    used: (
      <>
        <CheckCircle2 className="h-8 w-8 text-working" aria-hidden />
        <span className="text-body text-foreground">Signed in on the phone.</span>
        <span>This code is used up. To sign in again, make a new code.</span>
      </>
    ),
    blocked: <span>Too many wrong PINs — this code no longer works. Make a new code.</span>,
    replaced: <span>A newer code was made on another screen — this one no longer works.</span>,
    expired: <span>This code has expired.</span>,
  };
  const note: Record<CodeState["kind"], string> = {
    waiting: `Works once. Expires in ${timeLeft}.${
      state.kind === "waiting" && state.triesLeft != null && state.triesLeft < 5
        ? ` ${state.triesLeft} wrong PIN${state.triesLeft === 1 ? "" : "s"} left.`
        : ""
    } Their old phone is signed out when this one signs in.`,
    used: "Used. A signed-out phone needs a new code to sign in again.",
    blocked: "Blocked after too many wrong PINs — make a new code.",
    replaced: "Replaced — make a new code here, or use the newer one.",
    expired: "Expired — make a new code.",
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center rounded-lg border bg-white p-4">
        {usable ? (
          <QRCodeSVG value={`${ENROLL_PREFIX}${code.code}`} size={200} level="M" />
        ) : (
          <div className="flex h-[200px] w-[200px] flex-col items-center justify-center gap-2 text-center text-small text-muted-foreground">
            {panel[state.kind]}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="min-w-0">
          <div className="text-caption text-muted-foreground">
            Can’t scan? Type this on the phone yourself
          </div>
          <div
            className={`font-mono text-h2 tabular tracking-widest ${usable ? "" : "text-muted-foreground line-through"}`}
          >
            {digits}
          </div>
        </div>
        <Button type="button" variant={usable ? "outline" : "default"} onClick={load} className="shrink-0">
          <RefreshCw className="h-4 w-4" aria-hidden /> New code
        </Button>
      </div>
      <p
        className={`text-small ${usable || state.kind === "used" ? "text-muted-foreground" : "text-danger"}`}
        aria-live="polite"
      >
        {note[state.kind]}
      </p>
    </div>
  );
}
