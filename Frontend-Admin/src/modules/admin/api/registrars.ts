import { apiClient } from "../../../shared/api/axios";

export type Registrar = {
  id: string;
  registrarProfileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  cnic: string | null;
  accountStatus: "active" | "inactive" | "suspended" | "pending_verification";
  emailVerified: boolean;
  mustChangePassword: boolean;
  assignedCourt: string | null;
  assignedTehsil: string | null;
  credentialsEmailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistrarsResponse = {
  items: Registrar[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type RegistrarCredentialsEmailDelivery = {
  emailSent: boolean;
  deliveryMode: "smtp" | "console" | "failed";
  deliveryReason?: string;
};

export type RegistrarCredentialsResponse = {
  message: string;
  registrar: Registrar;
  emailDelivery: RegistrarCredentialsEmailDelivery;
};

export type CreateRegistrarPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cnic: string;
  assignedCourt?: string | null;
  assignedTehsil?: string | null;
};

export type UpdateRegistrarPayload = {
  registrarProfileId: string;
  firstName: string;
  lastName: string;
  phone: string;
  assignedCourt?: string | null;
  assignedTehsil?: string | null;
};

export async function fetchRegistrars(
  params: { limit?: number; offset?: number } = {}
): Promise<RegistrarsResponse> {
  const { data } = await apiClient.get<RegistrarsResponse>(
    "/registrars",
    { params }
  );
  return data;
}

export async function fetchRegistrar(
  registrarProfileId: string
): Promise<Registrar> {
  const { data } = await apiClient.get<{ registrar: Registrar }>(
    `/registrars/${registrarProfileId}`
  );
  return data.registrar;
}

export async function createRegistrar(
  payload: CreateRegistrarPayload
): Promise<RegistrarCredentialsResponse> {
  const { data } = await apiClient.post<RegistrarCredentialsResponse>(
    "/registrars",
    payload
  );
  return data;
}

export async function updateRegistrar(
  payload: UpdateRegistrarPayload
): Promise<Registrar> {
  const { registrarProfileId, ...body } = payload;
  const { data } = await apiClient.patch<{ message: string; registrar: Registrar }>(
    `/registrars/${registrarProfileId}`,
    body
  );
  return data.registrar;
}

export async function setRegistrarStatus(
  registrarProfileId: string,
  accountStatus: "active" | "inactive"
): Promise<Registrar> {
  const { data } = await apiClient.patch<{ message: string; registrar: Registrar }>(
    `/registrars/${registrarProfileId}/status`,
    { accountStatus }
  );
  return data.registrar;
}

export async function resendRegistrarCredentials(
  registrarProfileId: string
): Promise<RegistrarCredentialsResponse> {
  const { data } = await apiClient.post<RegistrarCredentialsResponse>(
    `/registrars/${registrarProfileId}/resend-credentials`
  );
  return data;
}

export async function deleteRegistrar(
  registrarProfileId: string
): Promise<void> {
  await apiClient.delete(`/registrars/${registrarProfileId}`);
}
