import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our custom type-scale tokens (globals.css `--text-*`) are font sizes. Without registering them,
// tailwind-merge treats `text-display` and `text-brand` as conflicting and drops the size.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["display", "h1", "h2", "body", "small", "caption"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
