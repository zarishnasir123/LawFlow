import { create } from "zustand";

import {
  signaturesApi,
  type ApiSignatureRequest,
  type CaseSignatureCompletion,
  type CreateSignatureRequestPayload,
} from "../api/signatures.api";

// Backend-synced cache for signature requests.
//
// Replaces the previous Zustand+persist store that lived entirely in
// localStorage. The case editor's `loadForCase(caseId)` action hits
// the backend on mount + after every mutation; the rest of the methods
// are pure selectors over the in-memory cache. There is no localStorage
// persistence — refreshing the page re-fetches from the server, which
// is the right behaviour now that the server is the source of truth.

export type { ApiSignatureRequest, CaseSignatureCompletion };

interface SignatureRequestsState {
  // Cached rows, keyed by caseId so the editor can re-render fast when
  // it switches between cases without re-fetching.
  requestsByCaseId: Record<string, ApiSignatureRequest[]>;
  completionByCaseId: Record<string, CaseSignatureCompletion>;
  loadingCaseId: string | null;
  loadError: string | null;

  // Pull the latest server state for a case + the rolled-up completion.
  // Called eagerly when the editor mounts and after every mutation.
  loadForCase: (caseId: string) => Promise<void>;

  // Create a batch of signature requests (one row per signer). Returns
  // the new rows from the server so the caller can show success state.
  create: (
    caseId: string,
    payload: CreateSignatureRequestPayload
  ) => Promise<ApiSignatureRequest[]>;

  // Cancel a single request (lawyer-only). Removes from cache + flips
  // status='cancelled'.
  cancel: (caseId: string, requestId: string) => Promise<void>;

  // ----- Pure selectors -----

  getRequestsByCaseId: (caseId: string) => ApiSignatureRequest[];

  // Pending = waiting for the signer. Includes both client and lawyer
  // pending rows.
  getPendingRequests: (caseId: string) => ApiSignatureRequest[];

  // Just the lawyer's own pending rows — drives the self-sign inbox in
  // the editor's signature panel.
  getPendingLawyerRequests: (caseId: string) => ApiSignatureRequest[];

  // Signed (per row). The case-level "fully signed" is on completion.
  getSignedRequests: (caseId: string) => ApiSignatureRequest[];

  // Convenience counters for badges.
  countPendingSignatures: (caseId: string) => number;
  countSignedSignatures: (caseId: string) => number;

  // Has every non-cancelled request reached signed? Cached from the
  // server response so we don't recompute client-side.
  isCaseFullySigned: (caseId: string) => boolean;
}

export const useSignatureRequestsStore = create<SignatureRequestsState>(
  (set, get) => ({
    requestsByCaseId: {},
    completionByCaseId: {},
    loadingCaseId: null,
    loadError: null,

    loadForCase: async (caseId) => {
      set({ loadingCaseId: caseId, loadError: null });
      try {
        const { signatureRequests, completion } =
          await signaturesApi.listForCase(caseId);
        set((state) => ({
          requestsByCaseId: {
            ...state.requestsByCaseId,
            [caseId]: signatureRequests,
          },
          completionByCaseId: {
            ...state.completionByCaseId,
            [caseId]: completion,
          },
          loadingCaseId: null,
        }));
      } catch (err) {
        set({
          loadingCaseId: null,
          loadError:
            err instanceof Error ? err.message : "Failed to load signatures",
        });
      }
    },

    create: async (caseId, payload) => {
      const { signatureRequests } = await signaturesApi.create(caseId, payload);
      // Refresh from server so completion + the full list (including any
      // existing rows) are in sync. Cheaper than reconciling client-side.
      await get().loadForCase(caseId);
      return signatureRequests;
    },

    cancel: async (caseId, requestId) => {
      await signaturesApi.cancel(caseId, requestId);
      await get().loadForCase(caseId);
    },

    getRequestsByCaseId: (caseId) => get().requestsByCaseId[caseId] || [],

    getPendingRequests: (caseId) =>
      (get().requestsByCaseId[caseId] || []).filter(
        (r) => r.status === "pending"
      ),

    getPendingLawyerRequests: (caseId) =>
      (get().requestsByCaseId[caseId] || []).filter(
        (r) => r.status === "pending" && r.signerRole === "lawyer"
      ),

    getSignedRequests: (caseId) =>
      (get().requestsByCaseId[caseId] || []).filter(
        (r) => r.status === "signed"
      ),

    countPendingSignatures: (caseId) =>
      (get().requestsByCaseId[caseId] || []).filter(
        (r) => r.status === "pending"
      ).length,

    countSignedSignatures: (caseId) =>
      (get().requestsByCaseId[caseId] || []).filter(
        (r) => r.status === "signed"
      ).length,

    isCaseFullySigned: (caseId) =>
      Boolean(get().completionByCaseId[caseId]?.fullySigned),
  })
);
