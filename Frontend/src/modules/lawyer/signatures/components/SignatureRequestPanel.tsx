import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send, X } from "lucide-react";

import { useSignatureRequestsStore } from "../store/signatureRequests.store";
import {
  getSignaturesErrorMessage,
  type ApiSignatureRequest,
  type SignerRole,
} from "../api/signatures.api";
import { buildEditorSnapshot } from "../../utils/editorSnapshot";

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

function derivePageLabel(page: HTMLElement, fallback: string): string {
  const heading = page.querySelector("h1, h2, h3, h4, h5, h6");
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim().replace(/[─—-]+/g, "").trim();
  }
  const paragraphs = page.querySelectorAll("p");
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim() || "";
    if (/^[─—-]{2,}\s*.+?\s*[─—-]{2,}$/.test(text)) {
      return text.replace(/[─—-]+/g, "").trim();
    }
  }
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim();
    if (text && text.length > 2) {
      return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    }
  }
  return fallback;
}

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

  // Load the existing batch list once the panel opens. CaseDocumentEditor
  // also loads on mount, but this guarantees freshness when the panel
  // reopens after a long session.
  useEffect(() => {
    loadForCase(caseId);
  }, [caseId, loadForCase]);

  const requests = getRequestsByCaseId(caseId);

  const pageItems = useMemo(
    () =>
      pages.map((page, index) => ({
        index,
        label: derivePageLabel(page, `Page ${index + 1}`),
      })),
    [pages]
  );

  // Any page that requires a client signature means we need an email.
  const needsClientEmail = useMemo(
    () =>
      Array.from(selectedPages).some((idx) => {
        const choice = signerByPage[idx] || "client";
        return choice === "client" || choice === "both";
      }),
    [selectedPages, signerByPage]
  );

  const togglePage = (index: number) => {
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
      return { ...prev, [index]: "client" };
    });
  };

  const setSigner = (index: number, choice: SignerChoice) => {
    setSignerByPage((prev) => ({ ...prev, [index]: choice }));
  };

  const handleSend = async () => {
    if (selectedPages.size === 0) {
      setError("Pick at least one page that needs to be signed.");
      return;
    }
    if (needsClientEmail && !clientEmail.trim()) {
      setError("Enter the client's email address to send signature requests.");
      return;
    }

    const pageAssignments = Array.from(selectedPages)
      .sort((a, b) => a - b)
      .map((pageIndex) => {
        const choice = signerByPage[pageIndex] || "client";
        const signers: SignerRole[] =
          choice === "both" ? ["client", "lawyer"] : [choice];
        return { pageIndex, signers };
      });

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
                const ticked = selectedPages.has(item.index);
                const signer = signerByPage[item.index] || "client";
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
                        {ticked && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Signer
                            </span>
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
                              <option value="client">Client</option>
                              <option value="lawyer">Lawyer</option>
                              <option value="both">Both</option>
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
          {requests.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
              None yet. Pick pages above and hit Send.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {requests.map((req) => {
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
      </div>

      <footer className="border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={handleSend}
          disabled={submitting || selectedPages.size === 0}
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
          {selectedPages.size === 0
            ? "Tick at least one page above."
            : `${selectedPages.size} page${selectedPages.size === 1 ? "" : "s"} selected.`}
        </p>
      </footer>
    </div>
  );
}
