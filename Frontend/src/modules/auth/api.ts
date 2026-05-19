import axios from "axios";
import { apiClient } from "../../shared/api/axios";

type ResetPasswordPayload = {
  token: string;
  password: string;
  confirmPassword: string;
};

export const authApi = {
  forgotPassword: (email: string) =>
    apiClient.post("/auth/forgot-password", { email }),
  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post("/auth/reset-password", payload),
};

type ApiErrorBody = {
  message?: string;
  errors?: { msg?: string; path?: string }[];
};

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;

    // Single-message errors (ApiError throws on the backend land here).
    if (data?.message) {
      return data.message;
    }

    // express-validator middleware returns { errors: [{ msg, path }, ...] }.
    // Surface the first message so the user sees the real validation reason
    // rather than a generic "Request failed with status code 400".
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (first?.msg) {
        return first.path ? `${first.path}: ${first.msg}` : first.msg;
      }
    }

    return error.message;
  }

  return "Unexpected error. Please try again.";
}
