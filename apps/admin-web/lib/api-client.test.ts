import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

// The access token runs out (401). What the refresh then does decides whether the admin stays signed in.

process.env.NEXT_PUBLIC_API_URL = "http://api.test/api/v1";
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: {},
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
const { ApiError, http, tokenStore } = await import("./api-client.ts");

const fail = (config: InternalAxiosRequestConfig, status?: number): Promise<never> =>
  Promise.reject(
    status
      ? new AxiosError("failed", "ERR_BAD_REQUEST", config, null, {
          status,
          statusText: "",
          headers: {},
          config,
          data: { code: "unauthorized", error: "invalid or expired token" },
        } as AxiosResponse)
      : new AxiosError("Network Error", "ERR_NETWORK", config, null),
  );

// The API: 200 for the new token, 401 for the old one.
http.defaults.adapter = async (config) =>
  config.headers.Authorization === "Bearer new"
    ? { data: { data: "ok" }, status: 200, statusText: "", headers: {}, config }
    : fail(config, 401);

beforeEach(() => tokenStore.set("old"));

test("the server can't be reached during the refresh: still signed in, a network error", async () => {
  axios.defaults.adapter = (config) => fail(config);
  const err = await http.get("/batches").catch((e: unknown) => e);
  assert.ok(err instanceof ApiError);
  assert.equal(err.code, "network_error");
  assert.equal(tokenStore.access(), "old");
});

test("the server refuses the refresh: signed out", async () => {
  axios.defaults.adapter = (config) => fail(config, 401);
  const err = await http.get("/batches").catch((e: unknown) => e);
  assert.ok(err instanceof ApiError);
  assert.equal(err.status, 401);
  assert.equal(tokenStore.access(), null);
});

test("the refresh works: the request is sent again with the new token", async () => {
  axios.defaults.adapter = async (config) => ({
    data: { data: { tokens: { access_token: "new" } } },
    status: 200,
    statusText: "",
    headers: {},
    config,
  });
  const res = await http.get("/batches");
  assert.equal(res.data.data, "ok");
  assert.equal(tokenStore.access(), "new");
});
