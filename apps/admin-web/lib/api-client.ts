import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

// ───────────────────────── Token storage ─────────────────────────
const ACCESS_KEY = "rps_access";
const REFRESH_KEY = "rps_refresh";

export const tokenStore = {
  access: (): string | null =>
    typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY),
  refresh: (): string | null =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh?: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
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
  waiters.forEach((cb) => cb(token));
  waiters = [];
}

// Bare axios (no interceptors) to avoid an infinite refresh loop.
async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.refresh();
  if (!refresh) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
    const data = res.data?.data ?? res.data;
    const newAccess: string = data.tokens?.access_token ?? data.access_token;
    const newRefresh: string | undefined = data.tokens?.refresh_token ?? data.refresh_token;
    if (newAccess) {
      tokenStore.set(newAccess, newRefresh);
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

    // Attempt one transparent refresh on 401
    if (status === 401 && original && !original._retried) {
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
  }
);

function buildApiError(error: AxiosError<{ error?: string; code?: string }>): ApiError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data;
  const code = body?.code ?? (error.code === "ECONNABORTED" ? "timeout" : "network_error");
  const message =
    body?.error ??
    (status === 0 ? "Cannot reach server" : error.message ?? "Request failed");
  return new ApiError(status, code, message);
}