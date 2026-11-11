import { ApiError } from "./api-client";
import type { Strings } from "./strings";

/**
 * Text for a failed request, in the current language. A code the phone knows (strings.errors) wins;
 * an unknown code shows the server's (English) message; anything else shows `fallback`.
 */
export function errorText(strings: Strings, error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const known = (strings.errors as Record<string, string | undefined>)[error.code];
  return known ?? (error.message || fallback);
}
