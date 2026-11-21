import assert from "node:assert/strict";
import { test } from "node:test";
import type { AssignmentEntry } from "@rps/shared";
import { assignFormKey } from "./assign-key.ts";

const a = (worker_id: string, target_qty: number | undefined, done_qty: number): AssignmentEntry => ({
  phase: "stitching",
  worker_id,
  worker_name: worker_id,
  target_qty,
  done_qty,
});

test("a scan (done count) doesn't restart the form", () => {
  const before = assignFormKey("b1", [a("surya", 8, 3), a("mahesh", 2, 0)]);
  const after = assignFormKey("b1", [a("surya", 8, 4), a("mahesh", 2, 1)]);
  assert.equal(after, before);
});

test("a saved change of people or targets restarts it", () => {
  const before = assignFormKey("b1", [a("surya", 8, 3), a("mahesh", 2, 0)]);
  assert.notEqual(assignFormKey("b1", [a("surya", 7, 3), a("mahesh", 3, 0)]), before);
  assert.notEqual(assignFormKey("b1", [a("surya", 10, 3)]), before);
  assert.notEqual(assignFormKey("b2", [a("surya", 8, 3), a("mahesh", 2, 0)]), before);
});

test("order and packing assignments don't matter", () => {
  const packer: AssignmentEntry = { ...a("raju", undefined, 0), phase: "packing" };
  assert.equal(
    assignFormKey("b1", [a("mahesh", 2, 0), a("surya", 8, 3), packer]),
    assignFormKey("b1", [a("surya", 8, 3), a("mahesh", 2, 0)]),
  );
});
