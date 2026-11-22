"use client";

import { Unlock } from "lucide-react";
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
import { useReleaseClaim } from "../hooks";

/** Free a stuck cutting claim: the batch goes back to Needs a cutter (D48). */
export function ReleaseClaimButton({ batchId, workerName }: { batchId: string; workerName: string }) {
  const release = useReleaseClaim(batchId);
  const confirm = async () => {
    try {
      await release.mutateAsync();
      toast.success("Claim released", {
        description: "The batch is back in Needs a cutter. Assign a cutter again.",
      });
    } catch (err) {
      toast.error("Couldn't release", { description: (err as Error).message });
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={release.isPending}>
          <Unlock className="h-3.5 w-3.5" aria-hidden /> Release
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Release {workerName}'s claim?</AlertDialogTitle>
          <AlertDialogDescription>
            The batch goes back to Needs a cutter and {workerName} no longer has it; assign a cutter again.
            Nothing was reported cut on this claim, so it is removed from the timeline (the batch history
            keeps a record).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Keep</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={confirm}>
            Release
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
