import { apiClient } from "../../../shared/api/axios";

// Public lawyer directory entry returned by GET /api/lawyers. Mirrors
// the sanitized backend payload — no CNIC, phone, documents, or
// verification audit fields. Rating / cases handled / success rate
// are intentionally absent for now; the backend will surface them
// once the supporting tables exist.
export type DirectoryLawyer = {
  lawyerProfileId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  specialization: string | null;
  districtBar: string | null;
  experienceYears: number | null;
  consultationFee: number | null;
};

export type LawyerDirectoryResponse = {
  items: DirectoryLawyer[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type ListLawyersParams = {
  search?: string;
  // Use "all" or omit to disable the specialization filter.
  specialization?: "all" | "Civil" | "Family";
  limit?: number;
  offset?: number;
};

// Builds the query string and calls GET /api/lawyers. Empty / "all"
// values are dropped so the request URL stays clean and the backend
// doesn't have to special-case them on the wire.
export async function fetchLawyers(
  params: ListLawyersParams = {}
): Promise<LawyerDirectoryResponse> {
  const query: Record<string, string | number> = {};
  if (params.search && params.search.trim()) query.search = params.search.trim();
  if (params.specialization && params.specialization !== "all") {
    query.specialization = params.specialization;
  }
  if (params.limit !== undefined) query.limit = params.limit;
  if (params.offset !== undefined) query.offset = params.offset;

  const { data } = await apiClient.get<LawyerDirectoryResponse>("/lawyers", {
    params: query,
  });
  return data;
}
