"use client";

import { ImageIcon } from "lucide-react";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { http } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface AuthImageProps extends Omit<React.ComponentPropsWithoutRef<"img">, "src"> {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
}

export function AuthImage({ src, alt, className, skeletonClassName, ...props }: AuthImageProps) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(src));
  const [error, setError] = React.useState(!src);

  React.useEffect(() => {
    if (!src) {
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    const controller = new AbortController();

    // Strip duplicate /api/v1 prefix since axios baseURL already includes it
    const requestPath = src.startsWith("/api/v1/") ? src.replace(/^\/api\/v1/, "") : src;

    http
      .get(requestPath, {
        responseType: "blob",
        signal: controller.signal,
      })
      .then((res) => {
        if (!active) return;
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        console.error("Failed to load authenticated image:", err);
        setError(true);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  if (error || !src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-border bg-muted text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="h-5 w-5 opacity-40" aria-hidden />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <>
      {loading && <Skeleton className={cn("h-full w-full rounded-md", skeletonClassName || className)} />}
      {objectUrl && (
        // biome-ignore lint/performance/noImgElement: Blob object URLs cannot be loaded via next/image
        <img
          src={objectUrl}
          alt={alt}
          className={cn("object-cover", className, loading && "hidden")}
          {...props}
        />
      )}
    </>
  );
}
