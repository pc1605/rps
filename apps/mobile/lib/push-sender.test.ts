/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { pushSender } from "./push-sender.ts";

function recorder(fail = 0) {
  const sent: string[] = [];
  const put = async (token: string, lang: string) => {
    if (fail > 0) {
      fail -= 1;
      throw new Error("offline");
    }
    sent.push(`${token}|${lang}`);
  };
  return { sent, put };
}

test("the same address is sent once, however often the token event fires", async () => {
  const r = recorder();
  const s = pushSender(r.put);
  await Promise.all([s.send("w1", "tok", "hi"), s.send("w1", "tok", "hi"), s.send("w1", "tok", "hi")]);
  assert.deepEqual(r.sent, ["tok|hi"]);
});

test("a new language or a new token is sent", async () => {
  const r = recorder();
  const s = pushSender(r.put);
  await s.send("w1", "tok", "hi");
  await s.send("w1", "tok", "en");
  await s.send("w1", "tok2", "en");
  assert.deepEqual(r.sent, ["tok|hi", "tok|en", "tok2|en"]);
});

test("after any sign-out, the next sign-in sends again — also the same worker on the same phone", async () => {
  const r = recorder();
  const s = pushSender(r.put);
  await s.send("w1", "tok", "hi");
  s.forget(); // signed out ("signed in elsewhere", sign-out button, expired …)
  await s.send("w1", "tok", "hi"); // set up again on this phone: the server dropped the address at sign-in
  assert.deepEqual(r.sent, ["tok|hi", "tok|hi"]);
});

test("another worker on this phone sends even without a forget", async () => {
  const r = recorder();
  const s = pushSender(r.put);
  await s.send("w1", "tok", "hi");
  await s.send("w2", "tok", "hi");
  assert.deepEqual(r.sent, ["tok|hi", "tok|hi"]);
});

test("a failed send is tried again next time", async () => {
  const r = recorder(1);
  const s = pushSender(r.put);
  await assert.rejects(s.send("w1", "tok", "hi"));
  await s.send("w1", "tok", "hi");
  assert.deepEqual(r.sent, ["tok|hi"]);
});
