import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import SignatureSigningScreen from "../../../shared/components/signing/SignatureSigningScreen";
import {
  mySignaturesApi,
  type ApiSignatureRequestDetail,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";

// Client signing viewer (FE-6). All signing UX lives in the shared
// SignatureSigningScreen (one guided experience for client + lawyer);
// this page owns the data fetch, the client layout chrome, and the
// client-specific copy / navigation.
export default function ClientSignatureViewer() {
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
      <ClientLayout brandSubtitle="Sign Document">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading signature request…
        </div>
      </ClientLayout>
    );
  }

  if (error && !request) {
    return (
      <ClientLayout brandSubtitle="Sign Document">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
          <div className="mt-3">
            <button
              onClick={() => navigate({ to: "/case-tracking" })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Back to pending signatures
            </button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (!request || !requestId) return null;

  return (
    // pageSubtitle shows the case title under the "LawFlow" brand
    // wordmark so the header carries real context, not just a generic
    // "Sign Document" label. Back arrow returns to /case-tracking.
    <ClientLayout
      brandSubtitle="Sign Document"
      pageSubtitle={request.caseTitle}
      showBackButton
      onBackClick={() => navigate({ to: "/case-tracking" })}
      backLabel="Back to pending"
    >
      <SignatureSigningScreen
        request={request}
        requestId={requestId}
        eyebrow="Signature request"
        panelTitle="Your signature"
        successTitle="Signature submitted"
        successBody="Thank you. Your signature has been securely recorded and your lawyer will be notified for"
        successPrimaryLabel="View my cases"
        onSuccessPrimary={() => navigate({ to: "/client-my-cases" })}
      />
    </ClientLayout>
  );
}
