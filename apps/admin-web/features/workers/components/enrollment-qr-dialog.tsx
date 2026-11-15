"use client";

import { QrCode } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EnrollmentCode } from "./enrollment-code";

export function EnrollmentQrDialog({
  workerId,
  workerName,
  trigger,
}: {
  workerId: string;
  workerName: string;
  /** Custom trigger (defaults to a QR icon button). */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            title="Set up phone"
            aria-label={`Set up ${workerName}’s phone`}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set up {workerName}’s phone</DialogTitle>
          <DialogDescription>
            On their phone: RPS Worker → Scan enrollment code → enter PIN. Do it here, with the phone in front
            of you.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: every opening makes a fresh one-time code. */}
        {open ? <EnrollmentCode workerId={workerId} /> : null}
      </DialogContent>
    </Dialog>
  );
}
