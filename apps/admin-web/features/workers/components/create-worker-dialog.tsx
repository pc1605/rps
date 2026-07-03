"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Copy, Check } from "lucide-react";
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

  const reset = () => {
    setName("");
    setPhone("");
    setStation("");
    setPin("");
    setCreatedBadge(null);
    setCopied(false);
  };

  const submit = async () => {
    if (!name || !station || !/^\d{4}$/.test(pin)) return;
    try {
      const worker = await createWorker.mutateAsync({
        name,
        phone: phone || undefined,
        station: station as Station,
        pin,
      });
      setCreatedBadge(worker.badge_token ?? null);
      toast.success(`Worker ${worker.name} created`);
    } catch (e) {
      toast.error("Failed to create worker", {
        description: (e as Error).message,
      });
    }
  };

  const copyBadge = () => {
    if (createdBadge) {
      navigator.clipboard.writeText(createdBadge);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          <Plus className="h-4 w-4" /> Add Worker
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!createdBadge ? (
          <>
            <DialogHeader>
              <DialogTitle>Add worker</DialogTitle>
              <DialogDescription>
                Create a worker and set their PIN.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ramesh Kumar"
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Station
                </label>
                <Select
                  value={station}
                  onValueChange={(v) => setStation(v as Station)}
                >
                  <SelectTrigger>
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
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Phone (optional)
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91…"
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  4-digit PIN
                </label>
                <Input
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="1234"
                  inputMode="numeric"
                  maxLength={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={
                  !name ||
                  !station ||
                  !/^\d{4}$/.test(pin) ||
                  createWorker.isPending
                }
              >
                {createWorker.isPending ? "Creating…" : "Create worker"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Worker created ✓</DialogTitle>
              <DialogDescription>
                Share this enrollment code with {name}. It won&apos;t be shown
                again.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-between gap-3">
                <code className="font-mono text-sm break-all">
                  {createdBadge}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyBadge}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                The worker enters this code once in the app to enroll their
                phone. (QR generation comes later.)
              </p>
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
