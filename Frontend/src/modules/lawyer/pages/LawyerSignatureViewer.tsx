import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import SignatureSigningScreen from "../../../shared/components/signing/SignatureSigningScreen";
import {
  mySignaturesApi,
  type ApiSignatureRequestDetail,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";

// Lawyer self-signing viewer (FE-7). All signing UX lives in the shared
// SignatureSigningScreen (one guided experience for client + lawyer);
// this page owns the data fetch, the lawyer layout chrome, and the
// lawyer-specific copy / navigation.
export default function LawyerSignatureViewer() {
  const navigate = useNavigate();
  const { requestId } = useParams({ strict: false }) as { requestId?: string };

  const [request, setRequest] = useState<ApiSignatureRequestDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    mySignaturesApi
      .getOne(requestId)
      .then((data) => {
        if (!cancelled) setRequest(data);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(getMySignaturesErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Missing-id is derived at render time (not set in the effect) so the
  // effect only ever synchronizes with the API. Loading is implied:
  // we have an id but neither a result nor an error yet.
  const error = !requestId ? "No signature request selected." : fetchError;
  const loading = Boolean(requestId) && !request && !fetchError;

  if (loading) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Sign Document">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading signature request…
        </div>
      </LawyerLayout>
    );
  }

  if (error && !request) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Sign Document">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
          <div className="mt-3">
            <button
              onClick={() => navigate({ to: "/lawyer-signatures" })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Back to your inbox
            </button>
          </div>
        </div>
      </LawyerLayout>
    );
  }

  if (!request || !requestId) return null;

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Sign Document"
      pageSubtitle={request.caseTitle}
      showBackButton
      onBackClick={() => navigate({ to: "/lawyer-signatures" })}
      backLabel="Back to inbox"
    >
      <SignatureSigningScreen
        request={request}
        requestId={requestId}
        eyebrow="Sign as advocate"
        panelTitle="Sign as advocate"
        successTitle="Signature recorded"
        successBody="Your signature has been added. The case will be marked fully signed once every signer has completed their part of"
        successPrimaryLabel="Back to inbox"
        onSuccessPrimary={() => navigate({ to: "/lawyer-signatures" })}
      />
    </LawyerLayout>
  );
}
