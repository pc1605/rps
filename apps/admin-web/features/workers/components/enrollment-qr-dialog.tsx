"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { http } from "@/lib/api-client";

export function EnrollmentQrDialog({
  workerId,
  workerName,
}: {
  workerId: string;
  workerName: string;
}) {
  const [badge, setBadge] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async (open: boolean) => {
    if (!open) return setBadge(null);
    const res = await http.get(`/workers/${workerId}/enrollment`);
    setBadge((res.data?.data ?? res.data).badge_token);
  };

  return (
    <Dialog onOpenChange={load}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Show enrollment QR">
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Enroll {workerName}</DialogTitle>
          <DialogDescription>
            On their phone: RPS Worker → Scan enrollment code → enter PIN.
          </DialogDescription>
        </DialogHeader>
        {badge ? (
          <>
            <div className="flex justify-center rounded-lg border bg-white p-4">
              <QRCodeSVG value={`RPS-ENROLL:${badge}`} size={200} level="M" />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 flex items-center justify-between gap-3">
              <code className="font-mono text-xs break-all">{badge}</code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(badge);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <p className="font-mono text-sm text-muted-foreground">Loading…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
