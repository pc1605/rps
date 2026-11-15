"use client";

import { ENROLL_PREFIX, type EnrollmentCode as Code } from "@rps/shared";
import { RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { workerApi } from "../api";

/**
 * One-time code for setting up a worker's phone: QR to scan, the same 6 digits to type, and the time
 * left. Mounting it makes a fresh code (the one before stops working), so mount it only while the
 * admin is looking at it. The code works once and for 10 minutes — there is nothing to copy or share.
 */
export function EnrollmentCode({ workerId }: { workerId: string }) {
  const [code, setCode] = useState<Code | null>(null);
  const [failed, setFailed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Every request makes a new code and kills the one before, so only the latest answer may be shown.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setCode(null);
    setFailed(false);
    try {
      const next = await workerApi.enrollment(workerId);
      if (request !== latest.current) return;
      setCode(next);
      setSecondsLeft(Math.max(0, Math.round((new Date(next.expires_at).getTime() - Date.now()) / 1000)));
    } catch (err) {
      if (request !== latest.current) return;
      setFailed(true);
      toast.error("Couldn't make a code", { description: (err as Error).message });
    }
  }, [workerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!code) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((new Date(code.expires_at).getTime() - Date.now()) / 1000)));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [code]);

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

  const expired = secondsLeft <= 0;
  const digits = `${code.code.slice(0, 3)} ${code.code.slice(3)}`;
  const timeLeft = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex justify-center rounded-lg border bg-white p-4">
        {expired ? (
          <div className="flex h-[200px] w-[200px] items-center justify-center text-center text-small text-muted-foreground">
            This code has expired.
          </div>
        ) : (
          <QRCodeSVG value={`${ENROLL_PREFIX}${code.code}`} size={200} level="M" />
        )}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="min-w-0">
          <div className="text-caption text-muted-foreground">
            Can’t scan? Type this on the phone yourself
          </div>
          <div
            className={`font-mono text-h2 tabular tracking-widest ${expired ? "text-muted-foreground line-through" : ""}`}
          >
            {digits}
          </div>
        </div>
        <Button type="button" variant="outline" onClick={load} className="shrink-0">
          <RefreshCw className="h-4 w-4" aria-hidden /> New code
        </Button>
      </div>
      <p className={`text-small ${expired ? "text-danger" : "text-muted-foreground"}`} aria-live="polite">
        {expired
          ? "Expired — make a new code."
          : `Works once. Expires in ${timeLeft}. Their old phone is signed out when this one signs in.`}
      </p>
    </div>
  );
}
