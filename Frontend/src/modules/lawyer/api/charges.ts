import type { ServiceCharge } from "../types/charges";
import { apiClient } from "../../../shared/api/axios";

export async function getServiceCharges(): Promise<ServiceCharge[]> {
  const { data } = await apiClient.get<ServiceCharge[]>("/lawyer/service-charges");
  return data;
}

export async function updateServiceCharge(
  chargeId: string,
  payload: Pick<ServiceCharge, "consultationFee" | "documentPreparationFee">
): Promise<ServiceCharge> {
  const { data } = await apiClient.put<ServiceCharge>(
    `/lawyer/service-charges/${chargeId}`,
    payload
  );
  return data;
}

export type CreateServiceChargePayload = Pick<
  ServiceCharge,
  "caseType" | "category" | "caseName" | "consultationFee" | "documentPreparationFee"
>;

export async function createServiceCharge(
  payload: CreateServiceChargePayload
): Promise<ServiceCharge> {
  const { data } = await apiClient.post<ServiceCharge>(
    "/lawyer/service-charges",
    payload
  );
  return data;
}

export async function deleteServiceCharge(chargeId: string): Promise<void> {
  await apiClient.delete(`/lawyer/service-charges/${chargeId}`);
}
