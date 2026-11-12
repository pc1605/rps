// Calendar helpers for the work history screen. Plain arithmetic on "YYYY-MM" / "YYYY-MM-DD" strings
// (as the server sends them) — no Intl, which Hermes doesn't fully carry.

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11" → { year: 2026, monthIndex: 10 } (monthIndex 0 = January). */
export function parseMonth(month: string): { year: number; monthIndex: number } {
  const [y, m] = month.split("-");
  return { year: Number(y), monthIndex: Number(m) - 1 };
}

/** "2026-01", -1 → "2025-12". */
export function addMonths(month: string, delta: number): string {
  const { year, monthIndex } = parseMonth(month);
  const n = year * 12 + monthIndex + delta;
  return `${Math.floor(n / 12)}-${pad((n % 12) + 1)}`;
}

/** "2026-11-03" → { date: 3, weekday: 2 } (weekday 0 = Sunday). */
export function parseDay(day: string): { date: number; weekday: number } {
  const [y, m, d] = day.split("-").map(Number);
  return { date: d ?? 1, weekday: new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getDay() };
}

/** Today on this phone as "YYYY-MM-DD" — only used to mark today's row. */
export function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
