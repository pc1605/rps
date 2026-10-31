import type { BatchStatus, Phase, ReworkReason, SizeClass, Station } from "./domain";

/** Unit QR payload, e.g. B-2026-005-003. Labels, scanner and backend must agree. */
export const UNIT_CODE_RE = /^B-\d{4}-\d{3}-\d{3}$/;
/** Batch code prefix of a unit code: "B-2026-005-003" → "B-2026-005". */
export const batchCodeOf = (unitCode: string) => unitCode.split("-").slice(0, 3).join("-");

/** Factory calendar timezone. Must match backend FACTORY_TZ. All "days" (reports, today) are factory days. */
export const FACTORY_TZ = "Asia/Kolkata";

/** YYYY-MM-DD of `d` in the factory timezone (never UTC — `toISOString()` is wrong before 05:30 IST). */
export function factoryDay(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FACTORY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Enrollment QR payload prefix: RPS-ENROLL:<badge_token>. */
export const ENROLL_PREFIX = "RPS-ENROLL:";

export const PHASE_FOR_STATION: Record<Station, Phase> = {
  cutter: "cutting",
  stitcher: "stitching",
  packer: "packing",
};

export const SIZE_LABEL: Record<SizeClass, string> = { small: "S", medium: "M", large: "L" };
export const STATION_LABEL: Record<Station, string> = {
  cutter: "Cutter",
  stitcher: "Stitcher",
  packer: "Packer",
};
export const PHASE_LABEL: Record<Phase, string> = {
  cutting: "Cutting",
  stitching: "Stitching",
  packing: "Packing",
  completed: "Completed",
};
export const STATUS_LABEL: Partial<Record<BatchStatus, string>> = {
  awaiting_assignment: "Ready for stitching",
  cancelled: "Cancelled",
};

export const REWORK_REASON_LABEL: Record<ReworkReason, string> = {
  stitching_fault: "Stitching fault",
  stain: "Stain / dirt",
  cutting_fault: "Cutting fault",
  material_defect: "Material defect",
  other: "Other",
};

/** API error codes (the `code` field of error responses). */
export type ApiErrorCode =
  | "not_found"
  | "unit_not_found"
  | "wrong_phase"
  | "already_started"
  | "not_started"
  | "not_assigned"
  | "quota_reached"
  | "duplicate_barcode"
  | "duplicate_code"
  | "in_rework"
  | "already_in_rework"
  | "rework_pending_decision"
  | "not_your_rework"
  | "rework_not_open"
  | "written_off"
  | "unauthorized"
  | "internal";
