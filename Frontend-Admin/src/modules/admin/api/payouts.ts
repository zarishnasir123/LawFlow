import { apiClient } from "../../../shared/api/axios";

export type PayoutStatus =
  | "requested"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

// The statuses an admin sets via the generic PATCH endpoint. "paid" is NOT
// here — it goes through the dedicated mark-paid endpoint (with transfer proof).
export type PayoutPatchStatus = "processing" | "failed" | "cancelled";

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
  // Transfer proof (set when marked paid). `hasReceipt` says whether a receipt
  // image is on file; fetch its URL separately via getPayoutReceiptUrl.
  transferDate: string | null;
  transferBank: string | null;
  hasReceipt: boolean;
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
  status: PayoutPatchStatus;
  note?: string;
};

// Move a payout to processing / failed / cancelled (no proof needed).
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

export type MarkPaidInput = {
  reference: string;
  transferDate: string; // YYYY-MM-DD
  transferBank: string;
  note?: string;
  receipt: File;
};

// Mark a payout paid with proof: typed transfer details + a receipt file,
// sent as multipart/form-data.
export async function markPayoutPaid(
  payoutId: string,
  input: MarkPaidInput
): Promise<AdminPayout> {
  const form = new FormData();
  form.append("reference", input.reference);
  form.append("transferDate", input.transferDate);
  form.append("transferBank", input.transferBank);
  if (input.note) form.append("note", input.note);
  form.append("receipt", input.receipt);

  const { data } = await apiClient.post<{ data: AdminPayout }>(
    `/admin/payouts/${payoutId}/mark-paid`,
    form
  );
  return data.data;
}

// One-click payout: the platform "sends" the money via the disbursement adapter
// (a sandbox-simulated rail) and marks it paid with an auto-generated reference.
// Nothing to type or upload.
export async function disbursePayout(payoutId: string): Promise<AdminPayout> {
  const { data } = await apiClient.post<{ data: AdminPayout }>(
    `/admin/payouts/${payoutId}/disburse`
  );
  return data.data;
}

// Admin-only short-lived signed URL to view a payout's receipt.
export async function getPayoutReceiptUrl(payoutId: string): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>(
    `/admin/payouts/${payoutId}/receipt`
  );
  return data.url;
}
