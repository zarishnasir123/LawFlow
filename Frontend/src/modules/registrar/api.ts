import { apiClient } from "../../shared/api/axios";
import type { AuthResponse, RegistrarLoginPayload } from "../auth/types";

// Posts to the shared /auth/login endpoint (same as client and lawyer);
// passes expectedRole so the backend rejects the attempt if these
// credentials happen to belong to a different role. The dedicated
// /auth/login/registrar endpoint this previously called never existed
// in the backend — the registrar login was silently broken end-to-end.
export async function loginRegistrar(
  payload: RegistrarLoginPayload
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", {
    ...payload,
    expectedRole: "registrar",
  });
  return data;
}
