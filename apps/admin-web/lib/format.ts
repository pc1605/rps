import { FACTORY_TZ } from "@rps/shared";

/** "31 Oct, 14:05" in factory time. */
export function fmtStamp(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FACTORY_TZ,
  });
}

/** "Fri 31 Oct" for a YYYY-MM-DD factory day. */
export function fmtDay(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** 5400 → "1h 30m", 300 → "5m", 40 → "40s". */
export function fmtDuration(s?: number | null) {
  if (s == null || s < 0) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** "3 hours ago" style, coarse. */
export function fmtAgo(iso?: string | null) {
  if (!iso) return null;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
