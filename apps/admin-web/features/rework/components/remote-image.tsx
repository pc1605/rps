"use client";

import { ImageIcon } from "lucide-react";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiOrigin } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentPropsWithoutRef<"img">, "src"> & {
  /** Path from the API, e.g. /api/v1/files/rework/<file>?exp=…&sig=… */
  src: string;
  alt: string;
};

export function RemoteImage({ src, alt, className, ...props }: Props) {
  const [state, setState] = React.useState<"loading" | "loaded" | "error">("loading");
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Catch images that finished loading before React attached onLoad (cache / hydration).
  React.useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  if (state === "error") {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center rounded-md border bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="h-5 w-5 opacity-40" aria-hidden />
      </div>
    );
  }

  return (
    <span className={cn("relative block overflow-hidden", className)}>
      {state === "loading" && <Skeleton className="absolute inset-0 h-full w-full rounded-md" />}
      {/* biome-ignore lint/performance/noImgElement: signed API URL; next/image adds nothing here */}
      <img
        ref={imgRef}
        src={src.startsWith("http") ? src : `${apiOrigin}${src}`}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          state === "loaded" ? "opacity-100" : "opacity-0",
        )}
        {...props}
      />
    </span>
  );
}
