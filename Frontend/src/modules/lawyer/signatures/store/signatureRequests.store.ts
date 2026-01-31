import { create } from "zustand";

export interface SignatureRequest {
  id: string;
  caseId: string;
  bundleItemId: string;
  docTitle: string;
  docType: "DOC" | "ATTACHMENT";
  requestedAt: string;
  clientSigned: boolean;
  clientSignedAt?: string;
  clientSignatureName?: string;
}

interface SignatureRequestsState {
  requests: SignatureRequest[];

  addRequest: (request: Omit<SignatureRequest, "id" | "requestedAt">) => string;
  updateRequest: (id: string, updates: Partial<SignatureRequest>) => void;
  deleteRequest: (id: string) => void;

  getRequestsByCaseId: (caseId: string) => SignatureRequest[];
  getPendingRequests: (caseId: string) => SignatureRequest[];
  getCompletedRequests: (caseId: string) => SignatureRequest[];
  countPendingSignatures: (caseId: string) => number;
  countCompletedSignatures: (caseId: string) => number;

  sendSignatureRequestsForCase: (
    caseId: string,
    bundleItemIds: string[],
    bundleItems: Array<{ id: string; title: string; type: "DOC" | "ATTACHMENT" }>
  ) => void;
}

function generateRequestId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useSignatureRequestsStore = create<SignatureRequestsState>(
  (set, get) => ({
    requests: [],

    addRequest: (request) => {
      const id = generateRequestId();
      const fullRequest: SignatureRequest = {
        ...request,
        id,
        requestedAt: new Date().toISOString(),
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
      return get().requests.filter((req) => req.caseId === caseId);
    },

    getPendingRequests: (caseId) => {
      return get().requests.filter(
        (req) => req.caseId === caseId && !req.clientSigned
      );
    },

    getCompletedRequests: (caseId) => {
      return get().requests.filter(
        (req) => req.caseId === caseId && req.clientSigned
      );
    },

    countPendingSignatures: (caseId) => {
      return get()
        .requests.filter((req) => req.caseId === caseId && !req.clientSigned)
        .length;
    },

    countCompletedSignatures: (caseId) => {
      return get()
        .requests.filter((req) => req.caseId === caseId && req.clientSigned)
        .length;
    },

    sendSignatureRequestsForCase: (caseId, bundleItemIds, bundleItems) => {
      const itemsMap = new Map(bundleItems.map((item) => [item.id, item]));

      bundleItemIds.forEach((bundleItemId) => {
        const item = itemsMap.get(bundleItemId);
        if (item) {
          const existingRequest = get().requests.find(
            (req) => req.caseId === caseId && req.bundleItemId === bundleItemId
          );

          if (!existingRequest) {
            get().addRequest({
              caseId,
              bundleItemId,
              docTitle: item.title,
              docType: item.type,
              clientSigned: false,
            });
          }
        }
      });
    },
  })
);
