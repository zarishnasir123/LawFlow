import { apiClient } from "../../shared/api/axios";
import type {
  AuthResponse,
  ClientCnicVerificationPayload,
  ClientEmailVerificationPayload,
  ClientEmailVerificationRequest,
  ClientLoginPayload,
  ClientRegisterPayload,
  RegisterResponse,
  VerificationResponse,
} from "../auth/types";

export async function registerClient(
  payload: ClientRegisterPayload
): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>("/auth/register/client", payload);
  return data;
}

export async function loginClient(payload: ClientLoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login/client", payload);
  return data;
}

export async function sendClientEmailVerification(
  payload: ClientEmailVerificationRequest
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/client/email/send",
    payload
  );
  return data;
}

export async function verifyClientEmail(
  payload: ClientEmailVerificationPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/client/email/verify",
    payload
  );
  return data;
}

export async function verifyClientCnic(
  payload: ClientCnicVerificationPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/client/cnic/verify",
    payload
  );
  return data;
}
