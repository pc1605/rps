/** "45 min", "6 h", "2.5 d" */
export function fmtHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

/** Change vs the previous period: "+12%", "−8%"; nothing when the previous period was 0. */
export function delta(now: number, before: number): string | undefined {
  if (before === 0) return undefined;
  const d = Math.round(((now - before) / before) * 100);
  return d === 0 ? "±0%" : `${d > 0 ? "+" : "−"}${Math.abs(d)}%`;
}

export const fmtActive = (secs: number) => (secs < 60 ? "—" : fmtHours(secs / 3600));
