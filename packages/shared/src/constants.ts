import type { BatchStatus, Phase, SizeClass, Station } from "./domain";

/** Unit QR payload, e.g. B-2026-005-003. Labels, scanner and backend must agree. */
export const UNIT_CODE_RE = /^B-\d{4}-\d{3}-\d{3}$/;
/** Batch code prefix of a unit code: "B-2026-005-003" → "B-2026-005". */
export const batchCodeOf = (unitCode: string) => unitCode.split("-").slice(0, 3).join("-");

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
  | "unauthorized"
  | "internal";
