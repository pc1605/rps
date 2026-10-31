"use client";

import { STATION_LABEL, type Station, type WorkerDetail } from "@rps/shared";
import { KeyRound, Pencil, Power } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { useResetPin, useUpdateWorker } from "../hooks";

const STATIONS: Station[] = ["cutter", "stitcher", "packer"];

export function EditWorkerDialog({ worker }: { worker: WorkerDetail }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(worker.name);
  const [phone, setPhone] = useState(worker.phone ?? "");
  const [station, setStation] = useState<Station>(worker.station);
  const update = useUpdateWorker(worker.id);
  const busy = worker.open_claims.length > 0 || worker.assigned.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        ...(station !== worker.station ? { station } : {}),
      });
      toast.success(`${name.trim()} updated`);
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't update worker", { description: (err as Error).message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(worker.name);
          setPhone(worker.phone ?? "");
          setStation(worker.station);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit {worker.name}</DialogTitle>
            <DialogDescription>Name, phone and station.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="worker-name">Name</Label>
            <Input id="worker-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worker-phone">
              Phone <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="worker-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worker-station">Station</Label>
            <Select value={station} onValueChange={(v) => setStation(v as Station)}>
              <SelectTrigger id="worker-station" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATION_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {busy && station !== worker.station && (
              <p className="text-caption text-danger">
                Has open work — the station can only change once their claims and quotas are finished or
                reassigned.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResetPinDialog({ worker }: { worker: WorkerDetail }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const reset = useResetPin(worker.id);
  const valid = pin === "" || /^\d{4}$/.test(pin);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await reset.mutateAsync(pin || undefined);
      setResult(res.pin);
      toast.success(`PIN reset for ${worker.name}`);
    } catch (err) {
      toast.error("Couldn't reset PIN", { description: (err as Error).message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setPin("");
        setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <KeyRound className="h-4 w-4" aria-hidden /> Reset PIN
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {result ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>New PIN for {worker.name}</DialogTitle>
              <DialogDescription>Tell them now — it isn't shown again.</DialogDescription>
            </DialogHeader>
            <div className="tabular rounded-lg border p-4 text-center text-display tracking-[0.3em]">
              {result}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Reset PIN</DialogTitle>
              <DialogDescription>
                Type a 4-digit PIN, or leave it empty to generate one. Their phone keeps working until they
                sign out.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-pin">
                New PIN <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="new-pin"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Generate"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || reset.isPending}>
                {reset.isPending ? "Resetting…" : "Reset PIN"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ActiveToggle({ worker }: { worker: WorkerDetail }) {
  const update = useUpdateWorker(worker.id);
  const deactivating = worker.is_active;
  const openWork = worker.open_claims.length + worker.assigned.length;

  const run = async () => {
    try {
      await update.mutateAsync({ is_active: !worker.is_active });
      toast.success(deactivating ? `${worker.name} deactivated` : `${worker.name} reactivated`);
    } catch (err) {
      toast.error(deactivating ? "Couldn't deactivate" : "Couldn't reactivate", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className={deactivating ? "text-danger" : undefined}>
          <Power className="h-4 w-4" aria-hidden /> {deactivating ? "Deactivate" : "Reactivate"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? `Deactivate ${worker.name}?` : `Reactivate ${worker.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating
              ? openWork > 0
                ? `They still have ${openWork} open batch${openWork === 1 ? "" : "es"}. Reassign first — deactivating will be refused until then.`
                : "Their phone is signed out immediately and they disappear from assignment lists. History stays."
              : `${STATION_LABEL[worker.station]} again: they can sign in with their badge and PIN.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={run} disabled={update.isPending}>
            {deactivating ? "Deactivate" : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
