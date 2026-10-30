"use client";

import { ImageIcon } from "lucide-react";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiOrigin } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface RemoteImageProps extends Omit<React.ComponentPropsWithoutRef<"img">, "src"> {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
}

export function RemoteImage({ src, alt, className, skeletonClassName, ...props }: RemoteImageProps) {
  const [loading, setLoading] = React.useState(Boolean(src));
  const [error, setError] = React.useState(!src);

  const fullSrc = src ? (src.startsWith("http") ? src : `${apiOrigin}${src}`) : "";

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
      {/* biome-ignore lint/performance/noImgElement: dynamic signed remote URL */}
      <img
        src={fullSrc}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        className={cn("object-cover", className, loading && "hidden")}
        {...props}
      />
    </>
  );
}
