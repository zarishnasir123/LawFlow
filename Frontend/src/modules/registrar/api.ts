import { apiClient } from "../../shared/api/axios";
import type { AuthResponse, RegistrarLoginPayload } from "../auth/types";

export async function loginRegistrar(
  payload: RegistrarLoginPayload
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login/registrar", payload);
  return data;
}
