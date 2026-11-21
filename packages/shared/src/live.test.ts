/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { type LiveFetch, openLive } from "./live.ts";

// A fake server: every connection says ": connected", then the line ends after `upMs`.
function fakeServer(upMs: number) {
  const connects: number[] = [];
  const fetch: LiveFetch = async () => {
    connects.push(Date.now());
    let step = 0;
    return {
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            step += 1;
            if (step === 1) return { done: false, value: new TextEncoder().encode(": connected\n\n") };
            await new Promise((resolve) => setTimeout(resolve, upMs));
            return { done: true };
          },
        }),
      },
    };
  };
  return { fetch, connects };
}

async function run(ms: number) {
  for (let t = 0; t < ms; t += 100) {
    mock.timers.tick(100);
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  }
}

beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 }));
afterEach(() => mock.timers.reset());

test("a line that drops right after connecting backs off instead of reconnecting every second", async () => {
  const server = fakeServer(0);
  const close = openLive({
    url: "x",
    fetch: server.fetch,
    getToken: () => "t",
    onChange: () => {},
    onStatus: () => {},
  });
  await run(40_000);
  close();
  // Waits of 1, 2, 5, then 10 s: connects at about 0, 1, 3, 8, 18, 28, 38 s.
  assert.ok(server.connects.length <= 8, `${server.connects.length} connects in 40 s`);
});

test("after a line that stayed up, the next reconnect is quick again", async () => {
  const server = fakeServer(31_000);
  const close = openLive({
    url: "x",
    fetch: server.fetch,
    getToken: () => "t",
    onChange: () => {},
    onStatus: () => {},
  });
  await run(33_000);
  close();
  assert.equal(server.connects.length, 2);
  const [first = 0, second = 0] = server.connects;
  assert.ok(second - first <= 32_500, `reconnected after ${second - first} ms`);
});
