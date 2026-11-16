import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set — check apps/admin-web/.env.local");

export const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, "");
// ───────────────────────── Token storage ─────────────────────────
// Only the short-lived access token is kept here. The refresh token lives in an httpOnly cookie
// the server sets on login — page scripts (and so an injected script) can never read it.
const ACCESS_KEY = "rps_access";
const OLD_REFRESH_KEY = "rps_refresh"; // where the refresh token was kept before the cookie

export const tokenStore = {
  access: (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY)),
  set: (access: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.removeItem(OLD_REFRESH_KEY);
  },
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(OLD_REFRESH_KEY);
  },
};

// ───────────────────────── Normalized error ─────────────────────────
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ───────────────────────── Axios instance ─────────────────────────
export const http = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach access token
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ───────────────────────── 401 refresh logic ─────────────────────────
// When the access token expires, transparently refresh once and retry.
// Concurrent 401s are queued so we only refresh a single time.
let isRefreshing = false;
let waiters: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  for (const cb of waiters) cb(token);
  waiters = [];
}

// Bare axios (no interceptors) to avoid an infinite refresh loop.
// `withCredentials` makes the browser send the refresh cookie (and store the renewed one).
async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, null, { withCredentials: true });
    const data = res.data?.data ?? res.data;
    const newAccess: string | undefined = data.tokens?.access_token;
    if (newAccess) {
      tokenStore.set(newAccess);
      return newAccess;
    }
    return null;
  } catch {
    return null;
  }
}

// Response interceptor: normalize errors + handle 401 refresh-and-retry
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; code?: string }>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status ?? 0;

    // Attempt one transparent refresh on 401 — not for the auth calls themselves: a wrong
    // password is a 401 too, and must not be answered by reviving an older session.
    if (status === 401 && original && !original._retried && !original.url?.startsWith("/auth/")) {
      original._retried = true;

      if (isRefreshing) {
        // Wait for the in-flight refresh, then retry
        return new Promise((resolve, reject) => {
          waiters.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(http(original));
            } else {
              reject(buildApiError(error));
            }
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      onRefreshed(newToken);

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      }
      // refresh failed → clear and bubble up so app redirects to login
      tokenStore.clear();
    }

    return Promise.reject(buildApiError(error));
  },
);

function buildApiError(error: AxiosError<{ error?: string; code?: string }>): ApiError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data;
  const code = body?.code ?? (error.code === "ECONNABORTED" ? "timeout" : "network_error");
  const message = body?.error ?? (status === 0 ? "Cannot reach server" : (error.message ?? "Request failed"));
  return new ApiError(status, code, message);
}
