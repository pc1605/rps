"use client";

import { Check, Copy, Plus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateWorker } from "../hooks";
import type { Station } from "../types";

export function CreateWorkerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [station, setStation] = useState<Station | "">("");
  const [pin, setPin] = useState("");
  const [createdBadge, setCreatedBadge] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createWorker = useCreateWorker();
  const canSubmit = name.trim().length > 0 && !!station && /^\d{4}$/.test(pin) && !createWorker.isPending;

  const reset = () => {
    setName("");
    setPhone("");
    setStation("");
    setPin("");
    setCreatedBadge(null);
    setCopied(false);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    try {
      const worker = await createWorker.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || undefined,
        station: station as Station,
        pin,
      });
      setCreatedBadge(worker.badge_token ?? null);
      toast.success(`${worker.name} added`);
    } catch (err) {
      toast.error("Couldn't add worker", {
        description: (err as Error).message,
      });
    }
  };

  const copyBadge = async () => {
    if (!createdBadge) return;
    try {
      await navigator.clipboard.writeText(createdBadge);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the code and copy it manually");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden /> Add worker
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!createdBadge ? (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Add worker</DialogTitle>
              <DialogDescription>
                Create a worker and set their PIN. You’ll get an enrollment QR next.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="worker-name">Name</Label>
                <Input
                  id="worker-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ramesh Kumar"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="worker-station">Station</Label>
                <Select value={station} onValueChange={(v) => setStation(v as Station)}>
                  <SelectTrigger id="worker-station" className="w-full">
                    <SelectValue placeholder="Select station…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cutter">Cutter</SelectItem>
                    <SelectItem value="stitcher">Stitcher</SelectItem>
                    <SelectItem value="packer">Packer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="worker-phone">
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="worker-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="worker-pin">4-digit PIN</Label>
                <Input
                  id="worker-pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  className="tabular tracking-widest"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {createWorker.isPending ? "Adding…" : "Add worker"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{name} added</DialogTitle>
              <DialogDescription>
                Enroll their phone now, or any time later from Workers → Enroll.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="flex justify-center rounded-lg border bg-white p-4">
                <QRCodeSVG value={`RPS-ENROLL:${createdBadge}`} size={180} level="M" />
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-small text-muted-foreground">
                <li>On their phone, open RPS Worker.</li>
                <li>
                  Tap <span className="font-medium text-foreground">Scan enrollment code</span> and point at
                  this QR.
                </li>
                <li>Enter their PIN.</li>
              </ol>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                <div className="min-w-0">
                  <div className="text-caption text-muted-foreground">
                    Can’t scan? Share this code instead
                  </div>
                  <code className="font-mono text-small break-all">{createdBadge}</code>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyBadge}
                  className="shrink-0"
                  aria-label={copied ? "Copied" : "Copy enrollment code"}
                >
                  {copied ? <Check className="h-4 w-4 text-working" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
