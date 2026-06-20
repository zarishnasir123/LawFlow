import { apiClient } from "../../../shared/api/axios";

// The two tracks LawFlow supports (mirrors the backend case_types.category check).
export type CaseCategory = "civil" | "family";

// custom  = an admin-uploaded template is in place
// default = no upload, but a built-in .docx ships on disk (the original 10)
// missing = no template at all yet (an admin-added type awaiting its upload)
export type TemplateStatus = "custom" | "default" | "missing";

export type CaseTypeTemplateMeta = {
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  updatedAt: string | null;
};

// One case type as the admin Templates page sees it.
export type AdminCaseType = {
  id: string;
  category: CaseCategory;
  code: string;
  displayName: string;
  governingLaw: string | null;
  sortOrder: number;
  // True for the original 10 (they ship a built-in file); admin-added types are
  // false. Drives the "Built-in" badge.
  isBuiltIn: boolean;
  // True when at least one real case references this type — blocks deletion.
  inUse: boolean;
  caseCount: number;
  templateStatus: TemplateStatus;
  // Present only when templateStatus === "custom".
  template: CaseTypeTemplateMeta | null;
};

// Query key shared by the page + every invalidation after a mutation.
export const CASE_TYPES_QUERY_KEY = ["admin", "case-types"] as const;

export async function fetchCaseTypes(): Promise<AdminCaseType[]> {
  const { data } = await apiClient.get<{ caseTypes: AdminCaseType[] }>(
    "/admin/case-types"
  );
  return data.caseTypes;
}

export type CreateCaseTypeInput = {
  category: CaseCategory;
  displayName: string;
  governingLaw?: string;
};

export async function createCaseType(
  input: CreateCaseTypeInput
): Promise<AdminCaseType> {
  const { data } = await apiClient.post<{ caseType: AdminCaseType }>(
    "/admin/case-types",
    input
  );
  return data.caseType;
}

// Delete a case type. The backend 409s (with a clear message) when real cases
// still reference it, so callers surface that error to the admin.
export async function deleteCaseType(id: string): Promise<void> {
  await apiClient.delete(`/admin/case-types/${id}`);
}

// Upload (or replace) the .docx template for a case type. Sent as multipart;
// the field name must be "template" to match the multer middleware.
export async function uploadCaseTypeTemplate(
  id: string,
  file: File
): Promise<AdminCaseType> {
  const form = new FormData();
  form.append("template", file);
  const { data } = await apiClient.post<{ caseType: AdminCaseType }>(
    `/admin/case-types/${id}/template`,
    form
  );
  return data.caseType;
}

// Remove an uploaded template, reverting the type to its built-in default (or
// "missing" for an admin-added type).
export async function removeCaseTypeTemplate(
  id: string
): Promise<AdminCaseType> {
  const { data } = await apiClient.delete<{ caseType: AdminCaseType }>(
    `/admin/case-types/${id}/template`
  );
  return data.caseType;
}

// Download the current template's raw .docx bytes (admin upload, else built-in
// default) for the page-by-page preview. Goes through apiClient so the admin's
// auth token is attached — the endpoint is admin-gated and streams the bytes.
export async function fetchCaseTypeTemplateBytes(
  id: string
): Promise<ArrayBuffer> {
  const { data } = await apiClient.get<ArrayBuffer>(
    `/admin/case-types/${id}/template`,
    { responseType: "arraybuffer" }
  );
  return data;
}
