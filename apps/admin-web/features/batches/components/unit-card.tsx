"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";
import type { ReworkPhoto } from "@rps/shared";
import { Chip } from "@/components/rps/chip";
import { Card } from "@/components/ui/card";
import { AuthImage } from "@/features/rework/components/auth-image";
import { PhotoLightbox } from "@/features/rework/components/photo-lightbox";
import { ReasonChip } from "@/features/rework/components/reason-chip";
import { unitTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { Unit } from "../types";

export function fmtStamp(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type UnitState = keyof typeof unitTone;

function displayState(u: Unit): UnitState {
  if (u.status === "rework") return "rework";
  return u.status === "pending" && u.stitched_at ? "stitched" : u.status;
}

export function UnitCard({ unit: u }: { unit: Unit }) {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxPhotos, setLightboxPhotos] = React.useState<ReworkPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  const tone = unitTone[displayState(u)];

  const events: { icon: string; who?: string; at?: string; label: string }[] = [
    {
      icon: "🧵",
      label: "Stitched",
      who: u.stitched_by_name,
      at: u.stitched_at,
    },
    { icon: "📦", label: "Packed", who: u.packed_by_name, at: u.packed_at },
  ];

  const handleOpenPhoto = (photos: ReworkPhoto[], idx: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const reworkHistory = u.rework ?? [];

  return (
    <>
      <Card className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-small">{u.unit_code}</span>
          <Chip tone={tone}>{tone.label}</Chip>
        </div>

        <ul className="space-y-1">
          {events.map((e) =>
            e.at ? (
              <li key={e.label} className="flex items-start gap-1.5 text-caption leading-tight">
                <span aria-hidden>{e.icon}</span>
                <span className="min-w-0">
                  <span className="text-foreground">{e.who ?? e.label}</span>
                  <time dateTime={e.at} className="tabular block text-muted-foreground">
                    {fmtStamp(e.at)}
                  </time>
                </span>
              </li>
            ) : (
              <li key={e.label} className="flex items-center gap-1.5 text-caption text-muted-foreground/60">
                <span aria-hidden>{e.icon}</span>
                <span>{e.label} — pending</span>
              </li>
            ),
          )}
        </ul>

        {/* Rework history disclosure */}
        {reworkHistory.length > 0 && (
          <details className="group border-t border-border pt-2 text-caption">
            <summary className="flex cursor-pointer select-none items-center justify-between text-muted-foreground transition-colors hover:text-foreground">
              <span className="font-medium">Rework history ({reworkHistory.length})</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-2">
              {reworkHistory.map((round) => {
                const isOpen = !round.fixed_at && round.decision !== "write_off";
                return (
                  <div
                    key={round.id}
                    className={cn(
                      "space-y-1.5 rounded-md border p-2",
                      isOpen ? "border-danger/40 bg-danger/5" : "border-border/60 bg-muted/30",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {round.round >= 2 ? "2nd time" : `Round ${round.round}`}
                      </span>
                      {isOpen && (
                        <span className="rounded-sm bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                          Open
                        </span>
                      )}
                    </div>

                    {/* Reasons */}
                    <div className="flex flex-wrap gap-1">
                      {round.reasons.map((r) => (
                        <ReasonChip key={r} reason={r} className="px-1.5 py-0 text-[11px]" />
                      ))}
                    </div>

                    {/* Note if any */}
                    {round.note && (
                      <div className="text-[11px] italic text-muted-foreground">
                        &ldquo;{round.note}&rdquo;
                      </div>
                    )}

                    {/* Photo thumbnails */}
                    {round.photos && round.photos.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {round.photos.map((photo, pIdx) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => handleOpenPhoto(round.photos, pIdx)}
                            className="h-10 w-10 overflow-hidden rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                            aria-label={`View photo ${pIdx + 1} of round ${round.round}`}
                          >
                            <AuthImage
                              key={photo.url}
                              src={photo.url}
                              alt={`Round ${round.round} thumbnail ${pIdx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Flagged info */}
                    <div className="text-[11px] text-muted-foreground">
                      Flagged by <span className="text-foreground">{round.flagged_by_name}</span>{" "}
                      {round.flagged_at && `· ${fmtStamp(round.flagged_at)}`}
                    </div>

                    {/* Decision info */}
                    {round.decision && (
                      <div className="text-[11px] text-muted-foreground">
                        Decision:{" "}
                        <span className="font-medium text-foreground">
                          {round.decision === "to_stitcher"
                            ? "Sent to stitcher"
                            : round.decision === "recut"
                              ? "Re-cut"
                              : "Written off"}
                        </span>
                        {round.decided_at && ` · ${fmtStamp(round.decided_at)}`}
                      </div>
                    )}

                    {/* Fixed info */}
                    {round.fixed_at && (
                      <div className="text-[11px] text-muted-foreground">
                        Fixed by <span className="text-foreground">{round.fixed_by_name ?? "Stitcher"}</span>{" "}
                        · {fmtStamp(round.fixed_at)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </Card>

      {/* Lightbox when clicking photo in rework history */}
      {lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          title={`Rework photos — ${u.unit_code}`}
        />
      )}
    </>
  );
}
