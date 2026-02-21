import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  compiledBundlesMock,
  filingCasesMock,
  submittedCasesMock,
} from "../data/caseFiling.mock";
import type {
  BundleDocument,
  CaseSubmissionRecord,
  CompiledCaseBundle,
  FilingCaseRecord,
} from "../types/caseFiling";
import {
  buildSignatureSnapshot,
  orderBundleDocuments,
  validateCaseBundle,
} from "../utils/caseFiling.utils";

type EditorBundleItemInput = {
  id: string;
  title: string;
  type: "DOC" | "ATTACHMENT";
  attachmentType?: string;
};

type SignatureRequestInput = {
  bundleItemId: string;
  docTitle: string;
  requiresClientSignature: boolean;
  requiresLawyerSignature: boolean;
  clientSigned: boolean;
  lawyerSigned: boolean;
  signedAttachmentId?: string;
};

type SubmitCaseInput = {
  caseId: string;
  submittedBy: string;
  forceFailure?: boolean;
  skipReadinessCheck?: boolean;
};

interface CaseFilingState {
  cases: FilingCaseRecord[];
  bundlesByCaseId: Record<string, CompiledCaseBundle>;
  submittedCases: CaseSubmissionRecord[];

  ensureCaseContext: (caseId: string, title?: string) => void;
  getCaseById: (caseId: string) => FilingCaseRecord | null;
  getBundleByCaseId: (caseId: string) => CompiledCaseBundle | null;
  refreshBundleFromWorkspace: (
    caseId: string,
    editorItems: EditorBundleItemInput[],
    signatureRequests: SignatureRequestInput[]
  ) => void;
  mockDownloadBundle: (caseId: string) => { ok: boolean; error?: string };
  submitCaseToRegistrar: (
    input: SubmitCaseInput
  ) => {
    ok: boolean;
    error?: string;
    type?: "not_ready" | "technical";
    submission?: CaseSubmissionRecord;
  };
  getSubmittedCasesForRegistrar: () => CaseSubmissionRecord[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function toDisplayCaseId(caseId: string): string {
  const compact = caseId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  const year = new Date().getFullYear();
  return `CF-${year}-${compact || "CASE"}`;
}

function toCaseTitle(caseId: string): string {
  const normalized = caseId.replace(/[-_]+/g, " ").trim();
  if (!normalized) return "Case File";
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function classifyDocumentCategory(title: string): BundleDocument["category"] {
  const normalized = title.toLowerCase();
  if (normalized.includes("petition") || normalized.includes("plaint")) {
    return "petition";
  }
  if (normalized.includes("signature")) {
    return "signature_summary";
  }
  if (
    normalized.includes("evidence") ||
    normalized.includes("photo") ||
    normalized.includes("registry")
  ) {
    return "evidence";
  }
  return "supporting";
}

function classifyFileType(item: EditorBundleItemInput): BundleDocument["fileType"] {
  const type = item.attachmentType?.toLowerCase() || "";
  if (type.includes("image")) return "image";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("word") || type.includes("doc")) return "docx";
  return "pdf";
}

function deriveSignedStatus(
  itemId: string,
  title: string,
  signatureRequests: SignatureRequestInput[]
): { required: boolean; completed: boolean } {
  const request = signatureRequests.find(
    (item) =>
      item.bundleItemId === itemId ||
      item.signedAttachmentId === itemId ||
      item.docTitle === title
  );
  if (!request) {
    return { required: false, completed: false };
  }

  const signatureRequired =
    request.requiresClientSignature || request.requiresLawyerSignature;
  const completed =
    (!request.requiresClientSignature || request.clientSigned) &&
    (!request.requiresLawyerSignature || request.lawyerSigned);

  return { required: signatureRequired, completed };
}

export const useCaseFilingStore = create<CaseFilingState>()(
  persist(
    (set, get) => ({
      cases: filingCasesMock,
      bundlesByCaseId: compiledBundlesMock,
      submittedCases: submittedCasesMock,

      ensureCaseContext: (caseId, title) => {
        if (!caseId) return;
        const exists = get().cases.some((item) => item.id === caseId);
        if (exists) return;

        const timestamp = nowIso();
        const newCase: FilingCaseRecord = {
          id: caseId,
          displayCaseId: toDisplayCaseId(caseId),
          title: title?.trim() || toCaseTitle(caseId),
          caseType: "civil",
          clientName: "Client",
          assignedTehsil: "Assigned Tehsil",
          assignedRegistrar: "Assigned Registrar",
          casePrepared: true,
          requiredDocumentKeywords: [],
          status: "prepared",
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const emptyBundle: CompiledCaseBundle = {
          caseId,
          generatedAt: timestamp,
          orderedDocuments: [],
          evidenceFiles: [],
          signatureSnapshot: {
            totalRequired: 0,
            completed: 0,
            pending: 0,
            allCompleted: true,
            items: [],
          },
        };

        set((state) => ({
          cases: [newCase, ...state.cases],
          bundlesByCaseId: {
            ...state.bundlesByCaseId,
            [caseId]: emptyBundle,
          },
        }));
      },

      getCaseById: (caseId) => get().cases.find((item) => item.id === caseId) || null,

      getBundleByCaseId: (caseId) => get().bundlesByCaseId[caseId] || null,

      refreshBundleFromWorkspace: (caseId, editorItems, signatureRequests) => {
        const existingBundle = get().getBundleByCaseId(caseId) || {
          caseId,
          generatedAt: nowIso(),
          orderedDocuments: [],
          evidenceFiles: [],
          signatureSnapshot: {
            totalRequired: 0,
            completed: 0,
            pending: 0,
            allCompleted: true,
            items: [],
          },
        };

        const mappedDocuments: BundleDocument[] = editorItems.map((item) => {
          const signedStatus = deriveSignedStatus(
            item.id,
            item.title,
            signatureRequests
          );
          return {
            id: item.id,
            title: item.title,
            category: classifyDocumentCategory(item.title),
            fileType: classifyFileType(item),
            required: item.type === "DOC",
            signedRequired: signedStatus.required,
            signedCompleted: signedStatus.completed,
            source: item.type === "DOC" ? "prepared_document" : "evidence",
          };
        });

        const orderedDocuments = orderBundleDocuments(mappedDocuments);

        const evidenceFiles = editorItems
          .filter((item) => item.type === "ATTACHMENT")
          .map((item) => ({
            id: `ev-${item.id}`,
            title: item.title,
            fileType: classifyFileType(item),
            sizeLabel: "Uploaded",
            uploadedAt: nowIso(),
          }));

        const signatureSnapshot = buildSignatureSnapshot(orderedDocuments);

        set((state) => ({
          bundlesByCaseId: {
            ...state.bundlesByCaseId,
            [caseId]: {
              ...existingBundle,
              generatedAt: nowIso(),
              orderedDocuments,
              evidenceFiles,
              signatureSnapshot,
            },
          },
        }));
      },

      mockDownloadBundle: (caseId) => {
        const filingCase = get().getCaseById(caseId);
        const bundle = get().getBundleByCaseId(caseId);
        if (!filingCase || !bundle) {
          return { ok: false, error: "Case bundle data is not available." };
        }
        return { ok: true };
      },

      submitCaseToRegistrar: ({
        caseId,
        submittedBy,
        forceFailure,
        skipReadinessCheck,
      }) => {
        const filingCase = get().getCaseById(caseId);
        const bundle = get().getBundleByCaseId(caseId);
        if (!filingCase || !bundle) {
          return { ok: false, error: "Case record not found.", type: "technical" as const };
        }

        const checklist = validateCaseBundle(filingCase, bundle);
        const hasBundleDocuments = bundle.orderedDocuments.length > 0;
        if (!skipReadinessCheck && !checklist.isReady) {
          return {
            ok: false,
            type: "not_ready" as const,
            error: "Case file not ready for submission.",
          };
        }
        if (skipReadinessCheck && !hasBundleDocuments) {
          return {
            ok: false,
            type: "not_ready" as const,
            error: "No documents found in the case bundle.",
          };
        }

        if (forceFailure) {
          return {
            ok: false,
            type: "technical" as const,
            error:
              "Submission failed due to connectivity issue. Please retry.",
          };
        }

        const submittedAt = nowIso();
        const submission: CaseSubmissionRecord = {
          caseId: filingCase.id,
          displayCaseId: filingCase.displayCaseId,
          title: filingCase.title,
          caseType: filingCase.caseType,
          clientName: filingCase.clientName,
          tehsil: filingCase.assignedTehsil,
          registrar: filingCase.assignedRegistrar,
          submittedBy,
          submittedAt,
          status: "submitted",
          bundle: {
            ...bundle,
            generatedAt: submittedAt,
          },
        };

        set((state) => ({
          cases: state.cases.map((item) =>
            item.id === caseId
              ? { ...item, status: "submitted", updatedAt: submittedAt }
              : item
          ),
          submittedCases: [
            submission,
            ...state.submittedCases.filter((item) => item.caseId !== caseId),
          ],
        }));

        return { ok: true, submission };
      },

      getSubmittedCasesForRegistrar: () => get().submittedCases,
    }),
    {
      name: "lawflow_case_filing_store",
    }
  )
);
