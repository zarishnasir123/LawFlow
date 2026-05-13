import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  clearStoredAuth,
  getStoredAccessToken,
  getStoredAuthUser,
} from "../../modules/auth/utils/authStorage";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const ACCESS_TOKEN_STORAGE_KEY = "lawflow_access_token";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Dedicated raw client for the refresh round-trip so the response interceptor
// below never recurses into itself on a failed refresh.
const refreshClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

const AUTH_PATHS_SKIP = [
  "/auth/refresh",
  "/auth/login",
  "/auth/logout",
  "/auth/register",
  "/auth/google",
  "/auth/verify-email",
  "/auth/resend-verification",
];

function isAuthPath(url?: string) {
  if (!url) return false;
  return AUTH_PATHS_SKIP.some((p) => url.includes(p));
}

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  try {
    const { data } = await refreshClient.post<{ accessToken?: string }>(
      "/auth/refresh"
    );
    const newToken = data?.accessToken;
    if (!newToken) return null;

    // Persist into whichever storage already holds the access token so that
    // the user's rememberMe preference is preserved across the refresh.
    if (localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) !== null) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, newToken);
    } else {
      sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, newToken);
    }
    return newToken;
  } catch {
    return null;
  }
}

function ensureRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

apiClient.interceptors.request.use((config) => {
  const accessToken = getStoredAccessToken();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;

    if (!original || status !== 401 || original._retry || isAuthPath(original.url)) {
      return Promise.reject(error);
    }

    // No persisted user means we have nothing to refresh against — let the
    // 401 propagate so the caller can route the visitor to /login.
    if (!getStoredAuthUser()) {
      return Promise.reject(error);
    }

    original._retry = true;

    const newToken = await ensureRefresh();
    if (!newToken) {
      clearStoredAuth();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.assign("/login");
      }
      return Promise.reject(error);
    }

    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
    return apiClient(original);
  }
);
