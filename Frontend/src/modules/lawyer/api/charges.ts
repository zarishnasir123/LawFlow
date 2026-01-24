import type { ServiceCharge } from "../types/charges";
import { apiClient } from "../../../shared/api/axios";

export async function getServiceCharges(): Promise<ServiceCharge[]> {
  try {
    const { data } = await apiClient.get<ServiceCharge[]>("/lawyer/service-charges");
    return data;
  } catch {
    // Fallback to mock data if API fails
    return [];
  }
}

export async function updateServiceCharge(
  chargeId: string,
  payload: Partial<ServiceCharge>
): Promise<ServiceCharge> {
  const { data } = await apiClient.put<ServiceCharge>(
    `/lawyer/service-charges/${chargeId}`,
    payload
  );
  return data;
}

export async function createServiceCharge(
  payload: Omit<ServiceCharge, "id" | "createdAt" | "updatedAt">
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
