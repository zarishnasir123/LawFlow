import { useState, useMemo } from "react";
import { X, Send, AlertCircle } from "lucide-react";
import { useSignatureRequestsStore } from "../store/signatureRequests.store";
import type { BundleItem } from "../../store/documentEditor.store";

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
    sendSignatureRequestsForCase,
    countPendingSignatures,
  } = useSignatureRequestsStore();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  const existingRequests = useMemo(
    () => getRequestsByCaseId(caseId),
    [caseId, getRequestsByCaseId]
  );

  const requestedBundleItemIds = useMemo(
    () => new Set(existingRequests.map((req) => req.bundleItemId)),
    [existingRequests]
  );

  const pendingCount = countPendingSignatures(caseId);

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
      }))
    );

    setShowSuccess(true);
    setSelectedItems(new Set());
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const canSend = selectedItems.size > 0;

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
                const isRequested = requestedBundleItemIds.has(item.id);

                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200/60"
                        : isRequested
                          ? "bg-amber-50/50 border-amber-200"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    } ${isRequested && !isSelected ? "opacity-75" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleItem(item.id)}
                      disabled={isRequested && !isSelected}
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
