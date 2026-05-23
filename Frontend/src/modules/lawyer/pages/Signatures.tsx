import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, PenLine } from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import {
  mySignaturesApi,
  type ApiPendingSignature,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";

// Lawyer's own pending-signatures inbox.
//
// FE-7: when a lawyer composes a batch where they themselves are a
// signer (signer_role='lawyer'), a row appears here. Clicking opens the
// in-app lawyer signature viewer. The backend's /api/me/signature-requests
// endpoint returns rows where recipient_user_id === current user, so
// the same API powers both this page and the client's pending list.
export default function Signatures() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<ApiPendingSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    mySignaturesApi
      .listPending()
      .then((rows) => {
        if (!cancelled) {
          // Filter to lawyer rows only — clients shouldn't normally land
          // here, but a defensive filter keeps the page coherent if a
          // lawyer is also a signer on a batch they didn't create.
          setPending(rows.filter((r) => r.signerRole === "lawyer"));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getMySignaturesErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Signatures">
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Sign Your Documents
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Documents that require your signature before the case can move
                forward.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {pending.length} pending
            </span>
          </div>

          {loading ? (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your signature inbox…
            </div>
          ) : error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : pending.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500">
              No documents waiting for your signature.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {pending.map((req) => {
                const pageCount = req.pageIndices?.length || 0;
                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {req.caseTitle}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {pageCount > 0
                            ? `${pageCount} page${pageCount === 1 ? "" : "s"} • `
                            : ""}
                          Requested{" "}
                          {req.createdAt
                            ? new Date(req.createdAt).toLocaleString()
                            : "Recently"}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Pending
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        navigate({ to: `/lawyer-signatures/${req.id}` })
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#024a23]"
                    >
                      <PenLine className="h-4 w-4" />
                      Review & Sign
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </LawyerLayout>
  );
}
