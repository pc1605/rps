/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { isWrongBatch, type ScanProgress, syncWithQueue } from "./scan-progress.ts";

const pill: ScanProgress = { done: 5, total: 10, mine: 3, target: 8 };

test("a co-worker's scan raises the batch count; an older re-read never lowers it", () => {
  assert.deepEqual(syncWithQueue(pill, { done: 6, total: 10, mine: 3, target: 8 }), { ...pill, done: 6 });
  assert.equal(syncWithQueue(pill, { done: 4, total: 10, mine: 2, target: 8 }), pill);
});

test("my count catches up after a scan whose answer was lost", () => {
  // Timed out on the phone but saved on the server; the re-scan answered "already done" (no +1).
  assert.equal(syncWithQueue(pill, { done: 6, total: 10, mine: 4, target: 8 }).mine, 4);
});

test("a target the admin changed is picked up, up or down", () => {
  assert.equal(syncWithQueue(pill, { done: 5, total: 10, mine: 3, target: 10 }).target, 10);
  assert.equal(syncWithQueue(pill, { done: 5, total: 10, mine: 3, target: 4 }).target, 4);
});

test("nothing changed, or the batch left the queue: the same object (no re-render)", () => {
  assert.equal(syncWithQueue(pill, { done: 5, total: 10, mine: 3, target: 8 }), pill);
  assert.equal(syncWithQueue(pill, undefined), pill);
});

test("wrong batch is checked against the code fixed when the scanner opened", () => {
  assert.equal(isWrongBatch("B-2026-008-003", "B-2026-008"), false);
  assert.equal(isWrongBatch("B-2026-009-001", "B-2026-008"), true);
  assert.equal(isWrongBatch("B-2026-0080-001", "B-2026-008"), true);
  assert.equal(isWrongBatch("B-2026-009-001", ""), false); // not known: the server decides
});
