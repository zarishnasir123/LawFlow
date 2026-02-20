import { useState, useMemo } from "react";
import { X, Send, AlertCircle } from "lucide-react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/react";
import { useSignatureRequestsStore } from "../store/signatureRequests.store";
import { useDocumentEditorStore } from "../../store/documentEditor.store";
import type { BundleItem } from "../../store/documentEditor.store";
import { AttachmentBlock } from "../../extensions/AttachmentBlock";
import { ImageAttachment } from "../../extensions/ImageAttachment";

interface SignatureRequestPanelProps {
  caseId: string;
  bundleItems: BundleItem[];
  onClose: () => void;
}

export default function SignatureRequestPanel({
  caseId,
  bundleItems,
  onClose,
}: SignatureRequestPanelProps) {
  const {
    getRequestsByCaseId,
    getCompletedRequests,
    getPendingRequests,
    sendSignatureRequestsForCase,
    updateRequest,
  } = useSignatureRequestsStore();
  const {
    addSignedAttachment,
    attachmentsById,
    documentsById,
    currentDocId,
    activeEditorRef,
  } = useDocumentEditorStore();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [signerByItemId, setSignerByItemId] = useState<
    Record<string, "client" | "lawyer" | "both">
  >({});
  const [showSuccess, setShowSuccess] = useState(false);

  const exportExtensions = useMemo(
    () => [
      StarterKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse table-auto w-full",
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: "border border-gray-300 px-4 py-2 bg-gray-100 font-bold",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-gray-300 px-4 py-2",
        },
      }),
      AttachmentBlock,
      ImageAttachment,
    ],
    []
  );

  const resolveDocHtml = (docId: string): string => {
    if (activeEditorRef && currentDocId === docId) {
      return activeEditorRef.getHTML();
    }
    const doc = documentsById[docId];
    if (doc?.contentJSON) {
      return generateHTML(doc.contentJSON as JSONContent, exportExtensions);
    }
    if (doc?.legacyHtml) return doc.legacyHtml;
    return "";
  };

  const bundleItemIdSet = useMemo(
    () => new Set(bundleItems.map((item) => item.id)),
    [bundleItems]
  );

  const existingRequests = useMemo(
    () => getRequestsByCaseId(caseId),
    [caseId, getRequestsByCaseId]
  );

  const pendingRequests = useMemo(
    () => existingRequests.filter((req) => !req.clientSigned),
    [existingRequests]
  );
  const requestByBundleItemId = useMemo(
    () =>
      new Map(existingRequests.map((req) => [req.bundleItemId, req] as const)),
    [existingRequests]
  );
  const requestBySignedAttachmentId = useMemo(
    () =>
      new Map(
        existingRequests
          .filter((req) => req.signedAttachmentId)
          .map((req) => [req.signedAttachmentId as string, req] as const)
      ),
    [existingRequests]
  );
  const requestedBundleItemIds = useMemo(
    () => new Set(pendingRequests.map((req) => req.bundleItemId)),
    [pendingRequests]
  );

  const pendingCount = useMemo(() => {
    const pending = getPendingRequests(caseId);
    if (bundleItemIdSet.size === 0) return 0;
    return pending.filter((req) => bundleItemIdSet.has(req.bundleItemId)).length;
  }, [caseId, getPendingRequests, bundleItemIdSet]);

  const signedRequests = useMemo(
    () =>
      getCompletedRequests(caseId).filter(
        (req) =>
          req.clientSigned &&
          req.sentToLawyerAt &&
          bundleItemIdSet.has(req.bundleItemId)
      ),
    [caseId, getCompletedRequests, bundleItemIdSet]
  );

  const handleToggleItem = (bundleItemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(bundleItemId)) {
        next.delete(bundleItemId);
      } else {
        next.add(bundleItemId);
      }
      return next;
    });
  };

  const handleSendRequests = () => {
    const selectedBundleItems = bundleItems.filter((item) =>
      selectedItems.has(item.id)
    );

    sendSignatureRequestsForCase(
      caseId,
      Array.from(selectedItems),
      selectedBundleItems.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type as "DOC" | "ATTACHMENT",
        requiresClientSignature:
          (signerByItemId[item.id] || "client") !== "lawyer",
        requiresLawyerSignature:
          (signerByItemId[item.id] || "client") !== "client",
        // Capture HTML snapshot for documents to preserve formatting
        docHtmlSnapshot:
          item.type === "DOC" ? resolveDocHtml(item.refId) : undefined,
      }))
    );

    setShowSuccess(true);
    setSelectedItems(new Set());
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const canSend = selectedItems.size > 0;

  const getSignerSelection = (itemId: string) => {
    const manual = signerByItemId[itemId];
    if (manual) return manual;
    const existing = requestByBundleItemId.get(itemId);
    if (existing) {
      if (existing.requiresClientSignature && existing.requiresLawyerSignature) {
        return "both";
      }
      if (existing.requiresLawyerSignature) {
        return "lawyer";
      }
    }
    return "client";
  };

  const getRequestForItem = (item: BundleItem) =>
    requestByBundleItemId.get(item.id) ||
    (item.type === "ATTACHMENT"
      ? requestBySignedAttachmentId.get(item.refId)
      : undefined);

  return (
    <div className="fixed right-0 top-0 h-screen w-full sm:w-[26rem] bg-slate-50 border-l border-slate-200 shadow-2xl z-40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Request Client Signature
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose files that require client approval
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
          aria-label="Close signature request panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* Pending Count */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-700">Pending</p>
              <p className="text-sm text-amber-800">{pendingCount} document{pendingCount !== 1 ? 's' : ''} awaiting client signature</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <p className="text-sm text-emerald-800 font-medium">
              Success: Signature requests sent to client.
            </p>
          </div>
        )}

        {/* Documents List */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Select documents for client signature:
          </h3>

          {bundleItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-600">No documents in bundle</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bundleItems.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const request = getRequestForItem(item);
                const isRequested =
                  requestedBundleItemIds.has(item.id) ||
                  Boolean(request && !request.clientSigned);
                const signerSelection = getSignerSelection(item.id);

                if (request?.clientSigned) {
                  return null;
                }

                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200/60"
                        : isRequested
                          ? "bg-amber-50/50 border-amber-200"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleItem(item.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 accent-emerald-600 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {item.type === "DOC" ? "Document" : "Attachment"}
                        </span>
                        {isRequested && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Signature required
                        </label>
                        <select
                          value={signerSelection}
                          onChange={(event) => {
                            setSignerByItemId((prev) => ({
                              ...prev,
                              [item.id]: event.target.value as
                                | "client"
                                | "lawyer"
                                | "both",
                            }));
                            setSelectedItems((prev) => {
                              const next = new Set(prev);
                              next.add(item.id);
                              return next;
                            });
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                        >
                          <option value="client">Client signature</option>
                          <option value="lawyer">Lawyer signature</option>
                          <option value="both">Client + Lawyer</option>
                        </select>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Count */}
        {selectedItems.size > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <p className="text-sm text-emerald-900">
              <strong>{selectedItems.size}</strong> document{selectedItems.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {signedRequests.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Client signed documents
            </h3>
            <div className="space-y-3">
              {signedRequests.map((req) => {
                const isAttached = Boolean(
                  req.signedAttachmentId &&
                    attachmentsById[req.signedAttachmentId]
                );

                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-emerald-100 bg-white p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {req.docTitle}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Signed by {req.clientSignatureName || "Client"}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Signed
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const signedDataUrl =
                            req.lawyerSignedPdfDataUrl ||
                            req.signedPdfDataUrl ||
                            (req.lawyerSigned ? req.pdfDataUrl : undefined);
                          if (!signedDataUrl || isAttached) return;
                          const base64 = signedDataUrl.split(",")[1] || "";
                          const sizeBytes = Math.floor((base64.length * 3) / 4);
                          const attachmentId = addSignedAttachment(
                            {
                              name: `${req.docTitle}-Signed.pdf`,
                              type: "application/pdf",
                              size: sizeBytes,
                              url: signedDataUrl,
                            },
                            req.bundleItemId
                          );
                          updateRequest(req.id, { signedAttachmentId: attachmentId });
                        }}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                          isAttached
                            ? "bg-emerald-50 text-emerald-600"
                            : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                        disabled={isAttached}
                      >
                        {isAttached ? "Attached to case" : "Attach to case file"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer - Action Buttons */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-5 py-4 space-y-2">
        <button
          onClick={handleSendRequests}
          disabled={!canSend}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
            canSend
              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200/60"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          <Send className="w-4 h-4" />
          Send to Client ({selectedItems.size})
        </button>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-xl font-medium text-sm border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
