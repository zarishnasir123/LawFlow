import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CaseDomain,
  CaseTemplateCategory,
  TemplateDocument,
} from "../types";

type AddCaseCategoryInput = {
  domain: CaseDomain;
  caseType: string;
  governingLaw: string;
};

type AddDocumentInput = {
  caseCategoryId: string;
  name: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
};

type UpdateDocumentInput = {
  caseCategoryId: string;
  documentId: string;
  name: string;
};

type UploadDocumentInput = {
  caseCategoryId: string;
  files: Array<{
    name: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  }>;
};

type TemplateCaseState = {
  caseCategories: CaseTemplateCategory[];
  addCaseCategory: (input: AddCaseCategoryInput) => CaseTemplateCategory;
  deleteCaseCategory: (caseCategoryId: string) => void;
  addDocument: (input: AddDocumentInput) => TemplateDocument;
  uploadDocumentsFromDevice: (input: UploadDocumentInput) => TemplateDocument[];
  updateDocument: (input: UpdateDocumentInput) => void;
  deleteDocument: (caseCategoryId: string, documentId: string) => void;
  toggleDocumentStatus: (caseCategoryId: string, documentId: string) => void;
};

const nowIso = () => new Date().toISOString();

const createDocument = (input: {
  name: string;
  source: "manual" | "device_upload";
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
}): TemplateDocument => ({
  id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: input.name,
  status: "active",
  updatedAt: nowIso(),
  source: input.source,
  fileName: input.fileName,
  fileSizeBytes: input.fileSizeBytes,
  mimeType: input.mimeType,
});

const civilDefaultDocuments = [
  "Plaint",
  "Affidavit",
  "Vakalatnama",
  "List of Witnesses",
  "Annexures",
];

const familyDefaultDocuments = [
  "Family Petition",
  "Affidavit",
  "Marriage Proof / Nikahnama Copy",
  "Identity Documents",
  "Supporting Evidence",
];

const createCategory = (
  id: string,
  domain: CaseDomain,
  caseType: string,
  governingLaw: string,
  defaultDocs: string[],
): CaseTemplateCategory => {
  const timestamp = nowIso();
  return {
    id,
    domain,
    caseType,
    governingLaw,
    documents: defaultDocs.map((docName, index) => ({
      id: `${id}-doc-${index + 1}`,
      name: docName,
      status: "active",
      updatedAt: timestamp,
      source: "manual",
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const seedCaseCategories: CaseTemplateCategory[] = [
  createCategory(
    "civil-1",
    "civil",
    "Suit for Recovery of Money",
    "Civil Procedure Code (CPC), 1908",
    civilDefaultDocuments,
  ),
  createCategory(
    "civil-2",
    "civil",
    "Suit for Permanent Injunction",
    "Specific Relief Act, 1877",
    civilDefaultDocuments,
  ),
  createCategory(
    "civil-3",
    "civil",
    "Suit for Declaration",
    "Specific Relief Act, 1877",
    civilDefaultDocuments,
  ),
  createCategory(
    "civil-4",
    "civil",
    "Suit for Specific Performance of Agreement",
    "Specific Relief Act, 1877",
    civilDefaultDocuments,
  ),
  createCategory(
    "civil-5",
    "civil",
    "Suit for Possession of Property",
    "Civil Procedure Code (CPC), 1908",
    civilDefaultDocuments,
  ),
  createCategory(
    "family-1",
    "family",
    "Khula (Wife's Judicial Divorce)",
    "Dissolution of Muslim Marriages Act, 1939 & MFLO, 1961",
    familyDefaultDocuments,
  ),
  createCategory(
    "family-2",
    "family",
    "Maintenance (Wife & Children)",
    "MFLO, 1961 & Family Courts Act, 1964",
    familyDefaultDocuments,
  ),
  createCategory(
    "family-3",
    "family",
    "Recovery of Dowry Articles / Personal Property",
    "Dowry & Bridal Gifts Act, 1976 & Family Courts Act, 1964",
    familyDefaultDocuments,
  ),
  createCategory(
    "family-4",
    "family",
    "Custody of Minors (Hizanat)",
    "Guardian and Wards Act, 1890 & Family Courts Act, 1964",
    familyDefaultDocuments,
  ),
  createCategory(
    "family-5",
    "family",
    "Restitution of Conjugal Rights",
    "Family Courts Act, 1964",
    familyDefaultDocuments,
  ),
];

export const useTemplateCasesStore = create<TemplateCaseState>()(
  persist(
    (set, get) => ({
      caseCategories: seedCaseCategories,

      addCaseCategory: (input) => {
        const normalizedCaseType = input.caseType.trim();
        const normalizedLaw = input.governingLaw.trim();

        if (!normalizedCaseType) {
          throw new Error("Case type is required.");
        }
        if (!normalizedLaw) {
          throw new Error("Governing law is required.");
        }

        const exists = get().caseCategories.some(
          (category) =>
            category.domain === input.domain &&
            category.caseType.toLowerCase() === normalizedCaseType.toLowerCase(),
        );

        if (exists) {
          throw new Error("This case type already exists in selected category.");
        }

        const timestamp = nowIso();
        const created: CaseTemplateCategory = {
          id: `case-template-${Date.now()}`,
          domain: input.domain,
          caseType: normalizedCaseType,
          governingLaw: normalizedLaw,
          documents: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((state) => ({
          caseCategories: [created, ...state.caseCategories],
        }));

        return created;
      },

      deleteCaseCategory: (caseCategoryId) => {
        set((state) => ({
          caseCategories: state.caseCategories.filter(
            (item) => item.id !== caseCategoryId,
          ),
        }));
      },

      addDocument: (input) => {
        const normalizedName = input.name.trim();
        if (!normalizedName) {
          throw new Error("Document name is required.");
        }
        const existingCaseCategory = get().caseCategories.find(
          (item) => item.id === input.caseCategoryId,
        );
        const alreadyExists = existingCaseCategory?.documents.some(
          (doc) => doc.name.toLowerCase() === normalizedName.toLowerCase(),
        );
        if (alreadyExists) {
          throw new Error("A template document with this name already exists.");
        }

        const created = createDocument({
          name: normalizedName,
          source: input.fileName ? "device_upload" : "manual",
          fileName: input.fileName,
          fileSizeBytes: input.fileSizeBytes,
          mimeType: input.mimeType,
        });

        set((state) => ({
          caseCategories: state.caseCategories.map((item) => {
            if (item.id !== input.caseCategoryId) return item;
            return {
              ...item,
              documents: [created, ...item.documents],
              updatedAt: nowIso(),
            };
          }),
        }));

        return created;
      },

      uploadDocumentsFromDevice: (input) => {
        if (input.files.length === 0) {
          throw new Error("Select at least one file to upload.");
        }

        const existingCaseCategory = get().caseCategories.find(
          (item) => item.id === input.caseCategoryId,
        );
        if (!existingCaseCategory) {
          throw new Error("Selected case type was not found.");
        }

        const existingNames = new Set(
          existingCaseCategory.documents.map((doc) => doc.name.toLowerCase()),
        );
        const deduplicatedByName = new Set<string>();
        const preparedUploads = input.files
          .map((file) => ({
            ...file,
            name: file.name.trim(),
          }))
          .filter((file) => file.name.length > 0)
          .filter((file) => {
            const lower = file.name.toLowerCase();
            if (existingNames.has(lower) || deduplicatedByName.has(lower)) {
              return false;
            }
            deduplicatedByName.add(lower);
            return true;
          });

        if (preparedUploads.length === 0) {
          throw new Error(
            "All selected documents already exist in this case type.",
          );
        }

        const createdDocuments = preparedUploads.map((file) =>
          createDocument({
            name: file.name,
            source: "device_upload",
            fileName: file.fileName,
            fileSizeBytes: file.fileSizeBytes,
            mimeType: file.mimeType,
          }),
        );

        set((state) => ({
          caseCategories: state.caseCategories.map((item) => {
            if (item.id !== input.caseCategoryId) return item;
            return {
              ...item,
              documents: [...createdDocuments, ...item.documents],
              updatedAt: nowIso(),
            };
          }),
        }));

        return createdDocuments;
      },

      updateDocument: (input) => {
        const normalizedName = input.name.trim();
        if (!normalizedName) {
          throw new Error("Document name is required.");
        }

        set((state) => ({
          caseCategories: state.caseCategories.map((item) => {
            if (item.id !== input.caseCategoryId) return item;
            return {
              ...item,
              documents: item.documents.map((doc) =>
                doc.id === input.documentId
                  ? { ...doc, name: normalizedName, updatedAt: nowIso() }
                  : doc,
              ),
              updatedAt: nowIso(),
            };
          }),
        }));
      },

      deleteDocument: (caseCategoryId, documentId) => {
        set((state) => ({
          caseCategories: state.caseCategories.map((item) => {
            if (item.id !== caseCategoryId) return item;
            return {
              ...item,
              documents: item.documents.filter((doc) => doc.id !== documentId),
              updatedAt: nowIso(),
            };
          }),
        }));
      },

      toggleDocumentStatus: (caseCategoryId, documentId) => {
        set((state) => ({
          caseCategories: state.caseCategories.map((item) => {
            if (item.id !== caseCategoryId) return item;
            return {
              ...item,
              documents: item.documents.map((doc) =>
                doc.id === documentId
                  ? {
                      ...doc,
                      status: doc.status === "active" ? "archived" : "active",
                      updatedAt: nowIso(),
                    }
                  : doc,
              ),
              updatedAt: nowIso(),
            };
          }),
        }));
      },
    }),
    {
      name: "lawflow_admin_template_case_categories",
      version: 1,
    },
  ),
);
