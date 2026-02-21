export type FilingCaseType = "civil" | "family";

export type FilingCaseStatus = "prepared" | "submitted";

export type BundleDocumentCategory =
  | "petition"
  | "supporting"
  | "evidence"
  | "signature_summary";

export type BundleFileType = "pdf" | "docx" | "image";

export interface FilingCaseRecord {
  id: string;
  displayCaseId: string;
  title: string;
  caseType: FilingCaseType;
  clientName: string;
  assignedTehsil: string;
  assignedRegistrar: string;
  casePrepared: boolean;
  requiredDocumentKeywords: string[];
  status: FilingCaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BundleDocument {
  id: string;
  title: string;
  category: BundleDocumentCategory;
  fileType: BundleFileType;
  required: boolean;
  signedRequired: boolean;
  signedCompleted: boolean;
  source: "prepared_document" | "evidence" | "system";
}

export interface EvidenceFile {
  id: string;
  title: string;
  fileType: BundleFileType;
  sizeLabel: string;
  uploadedAt: string;
}

export interface SignatureItemStatus {
  id: string;
  documentTitle: string;
  required: boolean;
  completed: boolean;
}

export interface SignatureCompletionSnapshot {
  totalRequired: number;
  completed: number;
  pending: number;
  allCompleted: boolean;
  items: SignatureItemStatus[];
}

export interface CompiledCaseBundle {
  caseId: string;
  generatedAt: string;
  orderedDocuments: BundleDocument[];
  evidenceFiles: EvidenceFile[];
  signatureSnapshot: SignatureCompletionSnapshot;
}

export interface SubmittedCaseFilePreviewItem {
  id: string;
  title: string;
  type: "DOC" | "ATTACHMENT";
  source: "prepared_document" | "evidence" | "system";
  signedRequired: boolean;
  signedCompleted: boolean;
  signedByClient?: boolean;
  signedByLawyer?: boolean;
  mimeType?: string;
  htmlContent?: string;
  dataUrl?: string;
}

export interface SubmittedCaseFilePreview {
  generatedAt: string;
  items: SubmittedCaseFilePreviewItem[];
}

export interface FilingValidationChecklist {
  requiredDocumentsPresent: boolean;
  requiredSignaturesCompleted: boolean;
  casePrepared: boolean;
  registrarAssigned: boolean;
  missingItems: string[];
  isReady: boolean;
}

export interface CaseSubmissionRecord {
  caseId: string;
  displayCaseId: string;
  title: string;
  caseType: FilingCaseType;
  clientName: string;
  tehsil: string;
  registrar: string;
  submittedBy: string;
  submittedAt: string;
  status: "submitted";
  bundle: CompiledCaseBundle;
  submittedPreview?: SubmittedCaseFilePreview;
}
