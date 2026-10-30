"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import type { ReworkPhoto } from "@rps/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RemoteImage } from "./remote-image";

export interface PhotoLightboxProps {
  photos: ReworkPhoto[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export function PhotoLightbox({
  photos,
  initialIndex = 0,
  open,
  onOpenChange,
  title = "Rework photo",
}: PhotoLightboxProps) {
  const [index, setIndex] = React.useState(initialIndex);
  const [prevOpen, setPrevOpen] = React.useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1)));
    }
  }

  const hasMultiple = photos.length > 1;

  const handlePrev = React.useCallback(() => {
    setIndex((curr) => (curr > 0 ? curr - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = React.useCallback(() => {
    setIndex((curr) => (curr < photos.length - 1 ? curr + 1 : 0));
  }, [photos.length]);

  React.useEffect(() => {
    if (!open || !hasMultiple) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasMultiple, handlePrev, handleNext]);

  const currentPhoto = photos[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
          <div>
            <DialogTitle className="text-body font-medium">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Photo {index + 1} of {photos.length}
            </DialogDescription>
          </div>
          {hasMultiple && (
            <div className="tabular text-caption text-muted-foreground mr-8">
              {index + 1} / {photos.length}
            </div>
          )}
        </DialogHeader>

        <div className="relative flex min-h-[320px] max-h-[75vh] w-full items-center justify-center bg-black/5 p-4 dark:bg-black/40">
          {currentPhoto ? (
            <RemoteImage
              key={currentPhoto.url}
              src={currentPhoto.url}
              alt={`${title} (${index + 1} of ${photos.length})`}
              className="h-[68vh] w-full rounded-md"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div className="text-small text-muted-foreground">No photo available</div>
          )}

          {hasMultiple && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 shadow-md backdrop-blur-xs hover:bg-background"
                onClick={handlePrev}
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 shadow-md backdrop-blur-xs hover:bg-background"
                onClick={handleNext}
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
