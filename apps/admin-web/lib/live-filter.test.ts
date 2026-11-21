import assert from "node:assert/strict";
import { test } from "node:test";
import { reReadOnNote } from "./live-filter.ts";

const live = { live: true };

test("live queries are re-read, others not", () => {
  assert.equal(reReadOnNote({ meta: live, state: { data: [1, 2] } }), true);
  assert.equal(reReadOnNote({ meta: live, state: { data: undefined } }), true);
  assert.equal(reReadOnNote({ meta: undefined, state: { data: [1] } }), false);
});

test("a paged list is re-read only while just its first page is open", () => {
  assert.equal(reReadOnNote({ meta: live, state: { data: { pages: [{}], pageParams: [null] } } }), true);
  assert.equal(reReadOnNote({ meta: live, state: { data: { pages: [{}, {}, {}], pageParams: [] } } }), false);
});
