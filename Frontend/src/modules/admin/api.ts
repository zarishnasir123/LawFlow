import { apiClient } from "../../shared/api/axios";
import type { AdminLoginPayload, AuthResponse } from "../auth/types";

export async function loginAdmin(payload: AdminLoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login/admin", payload);
  return data;
}
