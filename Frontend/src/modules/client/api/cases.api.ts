import { apiClient } from "../../../shared/api/axios";

// Raw status as stored on the backend `cases` row. The client never sees the
// registrar's internal review trail — only this high-level lifecycle value.
export type ClientCaseStatus = "draft" | "submitted" | "returned" | "accepted";

// Read-only case row returned by GET /api/clients/cases. Mirrors the backend
// ClientCase contract exactly (camelCase). Deliberately high-level: no review
// remarks, signed PDF, edited HTML, or attachments are exposed to the client.
export type ClientCase = {
  id: string;
  title: string;
  caseTypeLabel: string | null;
  category: string | null;
  status: ClientCaseStatus;
  lawyerName: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
};

// GET /api/clients/cases — the caller client's own linked cases, newest first.
// The backend scopes the query to cases.client_user_id = req.user.sub in SQL,
// so a client can never see another client's cases. Returns just the array.
export async function listMyCases(): Promise<ClientCase[]> {
  const { data } = await apiClient.get<{ cases: ClientCase[] }>("/clients/cases");
  return data.cases;
}
