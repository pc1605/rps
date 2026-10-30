"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import type { ReworkEntry } from "@rps/shared";
import { Chip } from "@/components/rps/chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDecideRework } from "../hooks";
import { AuthImage } from "./auth-image";
import { PhotoLightbox } from "./photo-lightbox";
import { ReasonChip } from "./reason-chip";

function fmtStamp(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DecisionCard({ entry }: { entry: ReworkEntry }) {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [photoIndex, setPhotoIndex] = React.useState(0);

  const [recutOpen, setRecutOpen] = React.useState(false);
  const [writeOffOpen, setWriteOffOpen] = React.useState(false);
  const [writeOffNote, setWriteOffNote] = React.useState("");

  // Disabled if unit has no assigned stitcher
  const hasNoStitcher = !entry.stitcher_name;

  const decideMutation = useDecideRework();
  const isPending = decideMutation.isPending;

  const handleOpenPhoto = (idx: number) => {
    setPhotoIndex(idx);
    setLightboxOpen(true);
  };

  const handleSendToStitcher = async () => {
    try {
      await decideMutation.mutateAsync({
        id: entry.id,
        decision: "to_stitcher",
        batchId: entry.batch_id,
      });
      toast.success("Sent to stitcher");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send to stitcher";
      toast.error(msg);
    }
  };

  const handleConfirmRecut = async () => {
    try {
      const res = await decideMutation.mutateAsync({
        id: entry.id,
        decision: "recut",
        batchId: entry.batch_id,
      });
      setRecutOpen(false);
      if (res.new_batch_code) {
        toast.success(
          <span>
            New batch created:{" "}
            <Link
              href="/batches?phase=cutting"
              className="font-mono font-medium underline underline-offset-2 hover:text-brand"
            >
              {res.new_batch_code}
            </Link>
          </span>,
        );
      } else {
        toast.success("Mat sent for re-cut");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to re-cut mat";
      toast.error(msg);
    }
  };

  const handleConfirmWriteOff = async () => {
    try {
      await decideMutation.mutateAsync({
        id: entry.id,
        decision: "write_off",
        note: writeOffNote.trim() ? writeOffNote.trim() : undefined,
        batchId: entry.batch_id,
      });
      setWriteOffOpen(false);
      setWriteOffNote("");
      toast.success("Mat written off");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to write off mat";
      toast.error(msg);
    }
  };

  const carModelLine = [entry.brand_name, entry.model_name].filter(Boolean).join(" ");
  const lineDetails = entry.line_name ? ` · ${entry.line_name}` : "";

  return (
    <>
      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          {/* Header row: unit code, batch link, round badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-body font-semibold tracking-tight">{entry.unit_code}</span>
            <span className="text-muted-foreground text-small">in</span>
            <Link
              href={`/batches/${entry.batch_id}`}
              className="font-mono text-small text-muted-foreground underline-offset-3 hover:text-foreground hover:underline"
            >
              {entry.batch_code}
            </Link>
            {entry.round >= 2 ? (
              <Chip
                tone={{
                  text: "text-brand",
                  border: "border-brand/30",
                  bg: "bg-brand/10",
                }}
              >
                Round {entry.round}
              </Chip>
            ) : (
              <span className="text-caption text-muted-foreground">Round {entry.round}</span>
            )}
          </div>

          {/* Model & Line */}
          <div className="text-body text-foreground">
            <span className="font-medium">{carModelLine || "Unknown model"}</span>
            <span className="text-muted-foreground">{lineDetails}</span>
          </div>

          {/* Reason chips */}
          <div className="flex flex-wrap gap-1.5">
            {entry.reasons.map((reason) => (
              <ReasonChip key={reason} reason={reason} />
            ))}
          </div>

          {/* Note if present */}
          {entry.note && (
            <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-small text-foreground/90">
              <span className="text-caption font-medium text-muted-foreground">Note: </span>
              {entry.note}
            </div>
          )}

          {/* Flagged by / at and stitcher info */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
            <span>
              Flagged by <span className="font-medium text-foreground">{entry.flagged_by_name}</span>{" "}
              {entry.flagged_at && `· ${fmtStamp(entry.flagged_at)}`}
            </span>
            {entry.stitcher_name && (
              <>
                <span>·</span>
                <span>
                  Stitched by <span className="font-medium text-foreground">{entry.stitcher_name}</span>
                </span>
              </>
            )}
          </div>

          {/* Photo thumbnails */}
          {entry.photos.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {entry.photos.map((photo, idx) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handleOpenPhoto(idx)}
                  className="group relative h-16 w-16 overflow-hidden rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`View photo ${idx + 1} of ${entry.photos.length}`}
                >
                  <AuthImage
                    key={photo.url}
                    src={photo.url}
                    alt={`Rework thumbnail ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-col sm:items-stretch">
          {hasNoStitcher ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Send to stitcher
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Unit has no assigned stitcher</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" size="sm" onClick={handleSendToStitcher} disabled={isPending}>
              Send to stitcher
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => setRecutOpen(true)} disabled={isPending}>
            Re-cut
          </Button>

          <Button variant="destructive" size="sm" onClick={() => setWriteOffOpen(true)} disabled={isPending}>
            Write off
          </Button>
        </div>
      </Card>

      {/* Lightbox for entry photos */}
      {entry.photos.length > 0 && (
        <PhotoLightbox
          photos={entry.photos}
          initialIndex={photoIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          title={`Rework photos — ${entry.unit_code}`}
        />
      )}

      {/* Re-cut confirmation dialog */}
      <AlertDialog open={recutOpen} onOpenChange={setRecutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-cut this mat?</AlertDialogTitle>
            <AlertDialogDescription>
              A new 1-mat batch will be created and sent to cutting. This mat is written off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRecut} disabled={isPending}>
              Re-cut
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Write off confirmation dialog */}
      <AlertDialog open={writeOffOpen} onOpenChange={setWriteOffOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Write off this mat?</AlertDialogTitle>
            <AlertDialogDescription>
              This mat will be marked as defective and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor={`write-off-note-${entry.id}`} className="text-small font-medium text-foreground">
              Note (optional)
            </label>
            <Textarea
              id={`write-off-note-${entry.id}`}
              placeholder="Add an optional reason or note"
              value={writeOffNote}
              onChange={(e) => setWriteOffNote(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmWriteOff} disabled={isPending}>
              Write off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
