import axios from "axios";
import { apiClient } from "../../shared/api/axios";
import type { AdminLoginPayload, AuthResponse } from "./types";

export async function loginAdmin(
  payload: AdminLoginPayload
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", {
    ...payload,
    expectedRole: "admin",
  });
  return data;
}

export async function logoutAdmin(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }

  return "Unexpected error. Please try again.";
}
