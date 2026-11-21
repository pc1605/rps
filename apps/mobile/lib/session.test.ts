/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { signOutReason } from "./session.ts";

test("no network, a timeout or a server error keep the worker signed in", () => {
  assert.equal(signOutReason(0, "network_error", true, "/worker/me"), null);
  assert.equal(signOutReason(500, "internal", true, "/worker/me"), null);
  assert.equal(signOutReason(502, "", true, "/worker/me"), null);
  assert.equal(signOutReason(403, "forbidden", true, "/worker/batches"), null);
});

test("a refused token signs the phone out, with the reason", () => {
  assert.equal(signOutReason(401, "signed_in_elsewhere", true, "/worker/me"), "elsewhere");
  assert.equal(signOutReason(401, "unauthorized", true, "/worker/me"), "unauthorized");
});

test("a wrong code or PIN, or a request sent without a token, is not a session ending", () => {
  assert.equal(signOutReason(401, "unauthorized", false, "/worker/login"), null);
  assert.equal(signOutReason(401, "unauthorized", true, "/worker/login"), null);
  // A request still on its way when the worker signed out goes without a token.
  assert.equal(signOutReason(401, "unauthorized", false, "/worker/batches"), null);
});
