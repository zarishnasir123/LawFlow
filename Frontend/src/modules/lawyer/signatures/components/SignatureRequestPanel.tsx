import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  History,
  Loader2,
  Send,
  X,
} from "lucide-react";

import { useSignatureRequestsStore } from "../store/signatureRequests.store";
import {
  getSignaturesErrorMessage,
  type ApiSignatureRequest,
  type SignerRole,
} from "../api/signatures.api";
import { buildEditorSnapshot } from "../../utils/editorSnapshot";
import { derivePageLabel } from "../../utils/pageLabel";

// Lawyer-side signature panel (FE-1, FE-2, FE-3, FE-4 entry surface).
//
// - FE-1: per-page checkbox list driven by the case editor's
//   `renderedPages` (the live <section.docx> DOM refs).
// - FE-2: per-page signer selector — client / lawyer / both.
// - FE-3: clicking Send posts the batch to the backend, which creates
//   1 or 2 signature_request rows + queues an in-app notification to
//   the recipient (email follow-up lands in Phase 2).
// - FE-4: existing batches for the case are listed below the form with
//   per-row signer + status. The Signatures button badge on the editor
//   toolbar reads from the same store cache, so the count stays in
//   sync after every send + every signer action.

interface SignatureRequestPanelProps {
  caseId: string;
  // Rendered DOM refs from CaseDocumentEditor → DocxPreviewSurface.
  // The panel reads each page's first heading/paragraph to label the
  // checkbox, mirroring how DocumentPagesPanel derives page titles.
  pages: HTMLElement[];
  // Pre-tick this page index when the panel opens — set by the
  // right-click context menu so "Send for Signature" on page N opens
  // the panel with page N already selected. Undefined = no pre-tick.
  initialSelectedPageIndex?: number;
  onClose: () => void;
}

type SignerChoice = SignerRole | "both";

// Small per-signer badge on a page row: emerald once that signer has
// signed the page (permanent), amber while their request is pending.
function CoverageChip({
  role,
  state,
}: {
  role: "Client" | "Lawyer";
  state?: "pending" | "signed";
}) {
  if (!state) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        state === "signed"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-amber-100 text-amber-800 ring-amber-200"
      }`}
    >
      {role} {state === "signed" ? "signed" : "pending"}
    </span>
  );
}

// derivePageLabel moved to ../../utils/pageLabel so the Submit-Case page can
// reuse the exact same page-naming logic.

// The snapshot helper used to live here; auto-save in
// CaseDocumentEditor now reuses the same logic, so it moved to
// utils/editorSnapshot.ts. Behaviour unchanged.

function statusBadge(status: ApiSignatureRequest["status"]) {
  switch (status) {
    case "signed":
      return { label: "Signed", className: "bg-emerald-100 text-emerald-700" };
    case "pending":
      return { label: "Pending", className: "bg-amber-100 text-amber-800" };
    case "expired":
      return { label: "Expired", className: "bg-gray-100 text-gray-600" };
    case "cancelled":
      return { label: "Cancelled", className: "bg-red-100 text-red-700" };
  }
}

export default function SignatureRequestPanel({
  caseId,
  pages,
  initialSelectedPageIndex,
  onClose,
}: SignatureRequestPanelProps) {
  const {
    loadForCase,
    create,
    cancel,
    getRequestsByCaseId,
  } = useSignatureRequestsStore();

  // Per-page UI state. selectedPages stores the page indices ticked;
  // signerByPage maps pageIndex → client/lawyer/both. Defaults to
  // "client" when a page is first ticked so the lawyer doesn't have to
  // think about it for the common case.
  //
  // When the panel was opened via the right-click "Send for Signature"
  // path, initialSelectedPageIndex points at the clicked page — we
  // pre-tick that one row and default it to "client" so the lawyer
  // sees the captured intent reflected immediately.
  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    initialSelectedPageIndex != null
      ? new Set([initialSelectedPageIndex])
      : new Set()
  );
  const [signerByPage, setSignerByPage] = useState<Record<number, SignerChoice>>(
    initialSelectedPageIndex != null
      ? { [initialSelectedPageIndex]: "client" }
      : {}
  );
  const [clientEmail, setClientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Activity log starts collapsed — lawyers rarely need to revisit
  // cancelled / expired rows, and keeping it folded makes the
  // active-requests section easier to scan.
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load the existing batch list once the panel opens. CaseDocumentEditor
  // also loads on mount, but this guarantees freshness when the panel
  // reopens after a long session.
  useEffect(() => {
    loadForCase(caseId);
  }, [caseId, loadForCase]);

  const requests = getRequestsByCaseId(caseId);

  // Split the cached requests into "active" (anything the lawyer
  // might still act on — pending or recently signed) and "history"
  // (cancelled / expired — terminal states that shouldn't clutter
  // the main list). The history bucket renders inside a collapsible
  // activity-log section below, so the lawyer can still audit what
  // was withdrawn / when, without it dominating the panel.
  const { activeRequests, historyRequests } = useMemo(() => {
    const active: typeof requests = [];
    const history: typeof requests = [];
    for (const req of requests) {
      if (req.status === "pending" || req.status === "signed") {
        active.push(req);
      } else {
        history.push(req);
      }
    }
    // History is best-read newest-first — server returns oldest-first
    // for the active list, so we reverse-sort the historical bucket
    // alone. updatedAt would be more accurate if it ever shipped on
    // the API shape; createdAt is the safe fallback we already have.
    history.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return { activeRequests: active, historyRequests: history };
  }, [requests]);

  // Per-signer page coverage. A page+signer combination is "covered" —
  // and can never be requested again — when that signer either already
  // SIGNED the page (permanent) or has an in-flight PENDING request for
  // it. Coverage drives three things: fully-covered pages render as
  // locked rows, partially-covered pages restrict the signer dropdown
  // to the free signer, and handleSend sanitizes the final assignments.
  // The backend enforces the same rule with a 409 as the authoritative
  // gate, so bypassing the UI can't create duplicates either.
  const pageCoverage = useMemo(() => {
    const client = new Map<number, "pending" | "signed">();
    const lawyer = new Map<number, "pending" | "signed">();
    for (const req of requests) {
      if (req.status !== "pending" && req.status !== "signed") continue;
      const map = req.signerRole === "client" ? client : lawyer;
      for (const idx of req.pageIndices || []) {
        // 'signed' outranks 'pending' for display purposes.
        if (req.status === "signed" || !map.has(idx)) map.set(idx, req.status);
      }
    }
    return { client, lawyer };
  }, [requests]);

  const clientCoveredAt = (idx: number) => pageCoverage.client.get(idx);
  const lawyerCoveredAt = (idx: number) => pageCoverage.lawyer.get(idx);
  const isFullyLocked = (idx: number) =>
    Boolean(clientCoveredAt(idx) && lawyerCoveredAt(idx));

  // Sanitized signer choice for a page: covered signers are stripped
  // from whatever the lawyer picked, falling back to the free signer.
  // Returns null when no signer is free (fully locked page).
  const effectiveSignerFor = (idx: number): SignerChoice | null => {
    const clientFree = !clientCoveredAt(idx);
    const lawyerFree = !lawyerCoveredAt(idx);
    if (!clientFree && !lawyerFree) return null;
    const choice = signerByPage[idx] || (clientFree ? "client" : "lawyer");
    if (choice === "both") {
      if (clientFree && lawyerFree) return "both";
      return clientFree ? "client" : "lawyer";
    }
    if (choice === "client") return clientFree ? "client" : "lawyer";
    return lawyerFree ? "lawyer" : "client";
  };

  // Selection with fully-locked pages filtered out at render time — a
  // requests-cache refresh can lock a page after it was ticked, and
  // deriving (rather than pruning state in an effect) means the UI can
  // never submit against a page that just became locked.
  const effectiveSelectedPages = new Set(
    Array.from(selectedPages).filter((idx) => !isFullyLocked(idx))
  );

  const pageItems = useMemo(
    () =>
      pages.map((page, index) => ({
        index,
        label: derivePageLabel(page, `Page ${index + 1}`),
      })),
    [pages]
  );

  // Any page that requires a client signature means we need an email.
  // Plain per-render computation over the sanitized selection (tiny
  // arrays, no memo needed).
  const needsClientEmail = Array.from(effectiveSelectedPages).some((idx) => {
    const choice = effectiveSignerFor(idx);
    return choice === "client" || choice === "both";
  });

  const togglePage = (index: number) => {
    // Fully-covered pages (every signer already signed or pending) are
    // locked — re-sending would duplicate a completed or in-flight
    // signature. Partially-covered pages stay selectable for the free
    // signer only.
    if (isFullyLocked(index)) return;
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setSignerByPage((prev) => {
      if (prev[index]) return prev;
      // Default to the free signer (client when both are free).
      return { ...prev, [index]: clientCoveredAt(index) ? "lawyer" : "client" };
    });
  };

  const setSigner = (index: number, choice: SignerChoice) => {
    setSignerByPage((prev) => ({ ...prev, [index]: choice }));
  };

  const handleSend = async () => {
    if (effectiveSelectedPages.size === 0) {
      setError("Pick at least one page that needs to be signed.");
      return;
    }
    if (needsClientEmail && !clientEmail.trim()) {
      setError("Enter the client's email address to send signature requests.");
      return;
    }

    // Assignments are built from the SANITIZED signer per page — covered
    // signers are stripped, so a stale UI can never re-request a page
    // someone already signed or was already asked to sign.
    const pageAssignments = Array.from(effectiveSelectedPages)
      .sort((a, b) => a - b)
      .flatMap((pageIndex) => {
        const choice = effectiveSignerFor(pageIndex);
        if (!choice) return [];
        const signers: SignerRole[] =
          choice === "both" ? ["client", "lawyer"] : [choice];
        return [{ pageIndex, signers }];
      });

    if (pageAssignments.length === 0) {
      setError("Pick at least one page that needs to be signed.");
      return;
    }

    // Snapshot the live editor HTML at this exact moment so the
    // recipient sees what the lawyer was looking at — including any
    // unsaved edits, inserted images, alignment changes, etc.
    const documentHtmlSnapshot = buildEditorSnapshot(pages);
    if (!documentHtmlSnapshot) {
      setError("Couldn't capture the document. Reopen the editor and try again.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const created = await create(caseId, {
        clientEmail: clientEmail.trim().toLowerCase() || undefined,
        pageAssignments,
        documentHtmlSnapshot,
      });
      setSelectedPages(new Set());
      setSignerByPage({});
      setClientEmail("");
      const clientRow = created.find((r) => r.signerRole === "client");
      const lawyerRow = created.find((r) => r.signerRole === "lawyer");
      const parts: string[] = [];
      if (clientRow) parts.push("client");
      if (lawyerRow) parts.push("you (lawyer)");
      setSuccessMessage(
        `Signature request sent. Pending signatures from ${parts.join(" + ")}.`
      );
    } catch (err) {
      setError(getSignaturesErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await cancel(caseId, requestId);
    } catch (err) {
      setError(getSignaturesErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Signatures</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Pick pages, assign signers, then send.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            Pages
          </h3>
          {pageItems.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
              The document hasn't finished rendering yet. Close the panel and
              reopen it once the pages are visible.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {pageItems.map((item) => {
                const clientState = clientCoveredAt(item.index);
                const lawyerState = lawyerCoveredAt(item.index);
                const locked = Boolean(clientState && lawyerState);
                const ticked = effectiveSelectedPages.has(item.index);
                const signer = effectiveSignerFor(item.index) ?? "client";

                // Fully-covered pages render as locked rows — no
                // checkbox, muted styling, per-signer badges — so the
                // lawyer immediately sees why the page can't be
                // re-selected. A signed page is complete forever;
                // cancelling a pending request unlocks that signer.
                if (locked) {
                  const bothSigned =
                    clientState === "signed" && lawyerState === "signed";
                  return (
                    <li
                      key={item.index}
                      className={`rounded-lg border p-3 ${
                        bothSigned
                          ? "border-emerald-200 bg-emerald-50/40"
                          : "border-amber-200 bg-amber-50/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          aria-hidden
                          className={`mt-1 flex h-4 w-4 items-center justify-center rounded border bg-white ${
                            bothSigned ? "border-emerald-300" : "border-amber-300"
                          }`}
                        >
                          <span
                            className={`block h-1.5 w-1.5 rounded-full ${
                              bothSigned ? "bg-emerald-400" : "bg-amber-400"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-gray-600">
                            {item.index + 1}. {item.label}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <CoverageChip role="Client" state={clientState} />
                            <CoverageChip role="Lawyer" state={lawyerState} />
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {bothSigned
                              ? "This page is fully signed — it can't be sent again."
                              : "Cancel the active request below to re-send this page."}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={item.index}
                    className={`rounded-lg border p-3 transition-colors ${
                      ticked
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ticked}
                        onChange={() => togglePage(item.index)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.index + 1}. {item.label}
                        </p>
                        {/* Partially-covered page: show who already
                            holds it so the restricted dropdown below
                            makes sense at a glance. */}
                        {(clientState || lawyerState) && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <CoverageChip role="Client" state={clientState} />
                            <CoverageChip role="Lawyer" state={lawyerState} />
                          </div>
                        )}
                        {ticked && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Signer
                            </span>
                            {/* Covered signers are not offered — a page
                                the client already signed can only be
                                sent to the lawyer, and vice versa. */}
                            <select
                              value={signer}
                              onChange={(e) =>
                                setSigner(
                                  item.index,
                                  e.target.value as SignerChoice
                                )
                              }
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                            >
                              {!clientState && (
                                <option value="client">Client</option>
                              )}
                              {!lawyerState && (
                                <option value="lawyer">Lawyer</option>
                              )}
                              {!clientState && !lawyerState && (
                                <option value="both">Both</option>
                              )}
                            </select>
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {needsClientEmail && (
          <section>
            <label
              htmlFor="client-email"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500"
            >
              Client email
            </label>
            <input
              id="client-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              The client must already have a LawFlow account. They'll see the
              pending pages in their dashboard.
            </p>
          </section>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            Active signature requests
          </h3>
          {activeRequests.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
              None yet. Pick pages above and hit Send.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {activeRequests.map((req) => {
                const badge = statusBadge(req.status);
                const pageCount = req.pageIndices?.length || 0;
                return (
                  <li
                    key={req.id}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900">
                          {req.signerRole === "client" ? "Client" : "Lawyer"} •{" "}
                          {pageCount} page{pageCount === 1 ? "" : "s"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          Created{" "}
                          {new Date(req.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {req.status === "pending" && (
                      <button
                        onClick={() => handleCancel(req.id)}
                        className="mt-2 text-[11px] font-medium text-red-600 hover:underline"
                      >
                        Cancel request
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Activity log — collapsed by default, shows cancelled +
            expired rows so the panel still has a paper trail without
            burying the active list. Header doubles as the toggle. */}
        {historyRequests.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              aria-expanded={historyOpen}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left transition-colors hover:bg-gray-50"
            >
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                <History className="h-3 w-3" />
                Activity log
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                  {historyRequests.length}
                </span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                  historyOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {historyOpen && (
              <ul className="mt-2 space-y-1">
                {historyRequests.map((req) => {
                  const pageCount = req.pageIndices?.length || 0;
                  const signerLabel =
                    req.signerRole === "client" ? "client" : "lawyer";
                  const actionVerb =
                    req.status === "cancelled" ? "Withdrew" : "Expired";
                  const date = new Date(req.createdAt).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" }
                  );
                  return (
                    <li
                      key={req.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50"
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                          req.status === "cancelled"
                            ? "bg-red-300"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="leading-relaxed">
                        <span className="font-medium text-gray-700">{date}</span>{" "}
                        · {actionVerb} {signerLabel} request for{" "}
                        <span className="font-medium text-gray-700">
                          {pageCount} page{pageCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      <footer className="border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={handleSend}
          disabled={submitting || effectiveSelectedPages.size === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send for signature
            </>
          )}
        </button>
        <p className="mt-2 text-[11px] text-gray-500 text-center">
          {effectiveSelectedPages.size === 0
            ? "Tick at least one page above."
            : `${effectiveSelectedPages.size} page${effectiveSelectedPages.size === 1 ? "" : "s"} selected.`}
        </p>
      </footer>
    </div>
  );
}
