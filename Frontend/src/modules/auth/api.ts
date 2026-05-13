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

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }

  return "Unexpected error. Please try again.";
}
