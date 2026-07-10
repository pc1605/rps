import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const TOKEN_KEY = "rps_worker_token";

export const tokenStore = {
  get: async (): Promise<string | null> => {
    if (Platform.OS === "web")
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(TOKEN_KEY)
        : null;
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  set: async (token: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(TOKEN_KEY, token);
      return;
    }
    return SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  clear: async (): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    return SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

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

export const http = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use(async (config) => {
  const token = await tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error) => {
    console.log("--ERROR--", error.response?.data);
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    return Promise.reject(
      new ApiError(
        status,
        body?.code ?? "network_error",
        body?.error ??
          (status === 0 ? "Cannot reach server" : "Request failed"),
      ),
    );
  },
);
