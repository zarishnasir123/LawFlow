import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SignatureRequest {
  id: string;
  caseId: string;
  bundleItemId: string;
  docTitle: string;
  docType: "DOC" | "ATTACHMENT";
  requestedAt: string;
  requestedBy?: string;
  dueAt?: string;
  requiresClientSignature: boolean;
  requiresLawyerSignature: boolean;
  clientSigned: boolean;
  clientSignedAt?: string;
  clientSignatureName?: string;
  pdfDataUrl?: string;
  docHtmlSnapshot?: string;
  signedPdfDataUrl?: string;
  lawyerSigned: boolean;
  lawyerSignedAt?: string;
  lawyerSignatureName?: string;
  lawyerSignedPdfDataUrl?: string;
  signedAttachmentId?: string;
  sentToLawyerAt?: string;
}

interface SignatureRequestsState {
  requests: SignatureRequest[];

  addRequest: (request: Omit<SignatureRequest, "id" | "requestedAt">) => string;
  updateRequest: (id: string, updates: Partial<SignatureRequest>) => void;
  deleteRequest: (id: string) => void;

  getRequestsByCaseId: (caseId?: string) => SignatureRequest[];
  getPendingRequests: (caseId?: string) => SignatureRequest[];
  getPendingLawyerRequests: (caseId?: string) => SignatureRequest[];
  getCompletedRequests: (caseId?: string) => SignatureRequest[];
  countPendingSignatures: (caseId?: string) => number;
  countCompletedSignatures: (caseId?: string) => number;

  sendSignatureRequestsForCase: (
    caseId: string,
    bundleItemIds: string[],
    bundleItems: Array<{
      id: string;
      title: string;
      type: "DOC" | "ATTACHMENT";
      requiresClientSignature: boolean;
      requiresLawyerSignature: boolean;
      docHtmlSnapshot?: string;
    }>
  ) => void;
}

function generateRequestId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useSignatureRequestsStore = create<SignatureRequestsState>()(
  persist(
    (set, get) => ({
      requests: [],

    addRequest: (request) => {
      const id = generateRequestId();
      const fullRequest: SignatureRequest = {
        ...request,
        requiresClientSignature:
          request.requiresClientSignature ?? true,
        requiresLawyerSignature:
          request.requiresLawyerSignature ?? false,
        id,
        requestedAt: new Date().toISOString(),
        lawyerSigned: request.lawyerSigned ?? false,
      };
      set((state) => ({
        requests: [...state.requests, fullRequest],
      }));
      return id;
    },

    updateRequest: (id, updates) => {
      set((state) => ({
        requests: state.requests.map((req) =>
          req.id === id ? { ...req, ...updates } : req
        ),
      }));
    },

    deleteRequest: (id) => {
      set((state) => ({
        requests: state.requests.filter((req) => req.id !== id),
      }));
    },

    getRequestsByCaseId: (caseId) => {
      return get().requests.filter((req) => !caseId || req.caseId === caseId);
    },

    getPendingRequests: (caseId) => {
      return get().requests.filter(
        (req) => {
          const requiresClient = req.requiresClientSignature !== false;
          return (!caseId || req.caseId === caseId) && requiresClient && !req.clientSigned;
        }
      );
    },

    getPendingLawyerRequests: (caseId) => {
      return get().requests.filter(
        (req) => {
          const requiresLawyer = req.requiresLawyerSignature === true;
          return (!caseId || req.caseId === caseId) && requiresLawyer && !req.lawyerSigned;
        }
      );
    },

    getCompletedRequests: (caseId) => {
      const isClientComplete = (req: SignatureRequest) => {
        const requiresClient = req.requiresClientSignature !== false;
        return !requiresClient || req.clientSigned;
      };
      const isLawyerComplete = (req: SignatureRequest) => {
        const requiresLawyer = req.requiresLawyerSignature === true;
        return !requiresLawyer || req.lawyerSigned;
      };
      return get().requests.filter(
        (req) =>
          (!caseId || req.caseId === caseId) &&
          isClientComplete(req) &&
          isLawyerComplete(req)
      );
    },

    countPendingSignatures: (caseId) => {
      return get()
        .requests.filter(
          (req) => {
            const requiresClient = req.requiresClientSignature !== false;
            return (!caseId || req.caseId === caseId) && requiresClient && !req.clientSigned;
          }
        )
        .length;
    },

    countCompletedSignatures: (caseId) => {
      const isClientComplete = (req: SignatureRequest) => {
        const requiresClient = req.requiresClientSignature !== false;
        return !requiresClient || req.clientSigned;
      };
      const isLawyerComplete = (req: SignatureRequest) => {
        const requiresLawyer = req.requiresLawyerSignature === true;
        return !requiresLawyer || req.lawyerSigned;
      };
      return get()
        .requests.filter(
          (req) =>
            (!caseId || req.caseId === caseId) &&
            isClientComplete(req) &&
            isLawyerComplete(req)
        )
        .length;
    },

    sendSignatureRequestsForCase: (caseId, bundleItemIds, bundleItems) => {
      const itemsMap = new Map(bundleItems.map((item) => [item.id, item]));
      const selectedIds = new Set(bundleItemIds);

      // Remove stale pending requests for items that are no longer selected
      set((state) => ({
        requests: state.requests.filter((req) => {
          if (req.caseId !== caseId) return true;
          const stillSelected = selectedIds.has(req.bundleItemId);
          if (stillSelected) return true;
          const clientComplete = req.clientSigned || req.requiresClientSignature === false;
          const lawyerComplete = req.lawyerSigned || req.requiresLawyerSignature === false;
          return clientComplete && lawyerComplete;
        }),
      }));

      bundleItemIds.forEach((bundleItemId) => {
        const item = itemsMap.get(bundleItemId);
        if (!item) return;

        const existingRequest = get().requests.find(
          (req) => req.caseId === caseId && req.bundleItemId === bundleItemId
        );

        if (!existingRequest) {
          get().addRequest({
            caseId,
            bundleItemId,
            docTitle: item.title,
            docType: item.type,
            requestedBy: "Lawyer",
            requiresClientSignature: item.requiresClientSignature,
            requiresLawyerSignature: item.requiresLawyerSignature,
            clientSigned: false,
            lawyerSigned: false,
            docHtmlSnapshot: item.docHtmlSnapshot,
          });
          return;
        }

        get().updateRequest(existingRequest.id, {
          docTitle: item.title,
          requestedBy: existingRequest.requestedBy ?? "Lawyer",
          requestedAt: new Date().toISOString(),
          requiresClientSignature: item.requiresClientSignature,
          requiresLawyerSignature: item.requiresLawyerSignature,
          docHtmlSnapshot: item.docHtmlSnapshot || existingRequest.docHtmlSnapshot,
        });
      });
    },
    }),
    {
      name: "lawflow_signature_requests",
    }
  )
);
