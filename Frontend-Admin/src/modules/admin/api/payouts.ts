import { apiClient } from "../../../shared/api/axios";

export type PayoutStatus =
  | "requested"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

// The statuses an admin can move a payout TO (everything except the lawyer's
// starting "requested" state). Mirrors the backend update validator.
export type PayoutTargetStatus = "processing" | "paid" | "failed" | "cancelled";

// One payout row as the admin queue sees it: the payout plus the lawyer it
// belongs to and who processed it. Bank fields are the snapshot taken when the
// lawyer requested the payout.
export type AdminPayout = {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  accountTitle: string | null;
  accountNumber: string | null;
  bankName: string | null;
  reference: string | null;
  note: string | null;
  requestedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lawyerUserId: string;
  lawyerName: string;
  lawyerEmail: string | null;
  processedByName: string | null;
};

export async function fetchPayouts(
  status?: PayoutStatus
): Promise<AdminPayout[]> {
  const { data } = await apiClient.get<{ items: AdminPayout[] }>(
    "/admin/payouts",
    { params: status ? { status } : undefined }
  );
  return data.items;
}

export type UpdatePayoutInput = {
  status: PayoutTargetStatus;
  reference?: string;
  note?: string;
};

export async function updatePayout(
  payoutId: string,
  input: UpdatePayoutInput
): Promise<AdminPayout> {
  const { data } = await apiClient.patch<{ data: AdminPayout }>(
    `/admin/payouts/${payoutId}`,
    input
  );
  return data.data;
}
