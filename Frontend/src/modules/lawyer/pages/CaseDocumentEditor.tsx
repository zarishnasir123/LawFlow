import { useEffect, useState, useCallback, useRef } from "react";
import * as mammoth from "mammoth";
import { type JSONContent } from "@tiptap/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Document, Page, pdfjs } from "react-pdf";
import LawyerLayout from "../components/LawyerLayout";
import DocumentSidebar from "../components/documentEditor/DocumentSidebar";
import DocEditor from "../components/documentEditor/DocEditor";
import TopActionBar from "../components/documentEditor/TopActionBar";
import DownloadModal from "../components/documentEditor/DownloadModal";
import SignatureRequestPanel from "../signatures/components/SignatureRequestPanel";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import { DEFAULT_CASE_DOCS } from "../data/defaultCaseDocuments";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const resolveTemplateUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

export default function CaseDocumentEditor() {
  const { caseId } = useParams({ strict: false }) as { caseId?: string }; // Retrieve generic params
  const navigate = useNavigate();
  const effectiveCaseId = caseId || "default-case";

  const {
    currentDocId,
    setCurrentDocId,
    activeEditorRef,
    documentsById,
    saveDocumentJSON,
    getDocumentJSON,
    setLoading,
    isLoading,
    saveDraft,
    loadDraft,
    addAttachment,
    addUploadedDocument,
    addSignedAttachment,
    attachmentsById,
    removeFromBundle,
    initializeDefaultBundle,
    bundleItems,
  } = useDocumentEditorStore();

  const {
    getRequestsByCaseId,
    getPendingRequests,
    updateRequest,
  } = useSignatureRequestsStore();

  const [editorContent, setEditorContent] = useState<string | JSONContent>("");
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isSignaturePanelOpen, setIsSignaturePanelOpen] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfContainerWidth, setPdfContainerWidth] = useState(0);
  const [pdfReady, setPdfReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const signatureCaseId = effectiveCaseId;
  const signaturePendingCount = (() => {
    const pending = getPendingRequests(signatureCaseId);
    if (bundleItems.length === 0) return 0;
    const bundleItemIds = new Set(bundleItems.map((item) => item.id));
    return pending.filter((req) => bundleItemIds.has(req.bundleItemId)).length;
  })();

  useEffect(() => {
    const requests = getRequestsByCaseId(signatureCaseId);
    const linkedSignedAttachmentIds = new Set(
      requests
        .map((req) => req.signedAttachmentId)
        .filter((id): id is string => Boolean(id))
    );

    requests.forEach((request) => {
      const existingAttachment = request.signedAttachmentId
        ? attachmentsById[request.signedAttachmentId]
        : undefined;
      const stillHasOriginal = bundleItems.some(
        (item) => item.id === request.bundleItemId
      );

      const latestSignedDataUrl =
        (request.clientSigned || request.lawyerSigned
          ? request.pdfDataUrl
          : undefined) ||
        request.lawyerSignedPdfDataUrl ||
        request.signedPdfDataUrl;

      // For client-required docs, wait until client actually sends to lawyer.
      const waitingForClientSend =
        request.requiresClientSignature !== false &&
        request.clientSigned &&
        !request.sentToLawyerAt;

      if (!latestSignedDataUrl || waitingForClientSend) return;

      const signedName = `${request.docTitle}-Signed.pdf`;
      const base64 = latestSignedDataUrl.split(",")[1] || "";
      const sizeBytes = Math.floor((base64.length * 3) / 4);

      // Keep only the latest signed artifact for this request in the bundle.
      // Older signed attachments (same file name) become stale after re-signing.
      bundleItems
        .filter((item) => {
          if (item.type !== "ATTACHMENT") return false;
          if (request.signedAttachmentId && item.refId === request.signedAttachmentId) {
            return false;
          }
          const attachment = attachmentsById[item.refId];
          if (!attachment) return false;
          if (attachment.name !== signedName) return false;
          return !linkedSignedAttachmentIds.has(item.refId);
        })
        .forEach((staleItem) => removeFromBundle(staleItem.id));

      if (existingAttachment) {
        const needsRefresh =
          existingAttachment.url !== latestSignedDataUrl ||
          existingAttachment.name !== signedName ||
          existingAttachment.size !== sizeBytes;

        if (needsRefresh) {
          const oldBundleItem = bundleItems.find(
            (item) =>
              item.type === "ATTACHMENT" && item.refId === existingAttachment.id
          );
          const insertAfterId = oldBundleItem?.id || request.bundleItemId;
          const updatedAttachmentId = addSignedAttachment(
            {
              name: signedName,
              type: "application/pdf",
              size: sizeBytes,
              url: latestSignedDataUrl,
            },
            insertAfterId
          );
          updateRequest(request.id, { signedAttachmentId: updatedAttachmentId });
          if (oldBundleItem) {
            removeFromBundle(oldBundleItem.id);
          }
        }
      } else {
        const attachmentId = addSignedAttachment(
          {
            name: signedName,
            type: "application/pdf",
            size: sizeBytes,
            url: latestSignedDataUrl,
          },
          request.bundleItemId
        );
        updateRequest(request.id, { signedAttachmentId: attachmentId });
      }
      if (stillHasOriginal) {
        removeFromBundle(request.bundleItemId);
      }
    });
  }, [
    signatureCaseId,
    getRequestsByCaseId,
    addSignedAttachment,
    updateRequest,
    attachmentsById,
    removeFromBundle,
    bundleItems,
  ]);

  // Load draft on mount (or initialize defaults)
  useEffect(() => {
    // If caseId is present, load that specific draft. Otherwise generic.
    loadDraft(effectiveCaseId);

    // We only init defaults if the bundle is empty (handled inside store or here?)
    // initializeDefaultBundle checks emptiness internally.
    initializeDefaultBundle(DEFAULT_CASE_DOCS);
  }, [loadDraft, initializeDefaultBundle, effectiveCaseId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentDocId && activeEditorRef) {
        saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
        saveDraft(effectiveCaseId);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDocId, activeEditorRef, saveDocumentJSON, saveDraft, effectiveCaseId]);

  useEffect(() => {
    const storageKey = effectiveCaseId
      ? `lawyer_case_draft_${effectiveCaseId}`
      : "lawyer_case_draft";

    const handleBeforeUnload = () => {
      // If the draft key was manually removed (e.g. via DevTools),
      // do not recreate it on refresh.
      if (!localStorage.getItem(storageKey)) {
        return;
      }
      if (currentDocId && activeEditorRef) {
        saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
      }
      saveDraft(effectiveCaseId);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentDocId, activeEditorRef, saveDocumentJSON, saveDraft, effectiveCaseId]);

  const loadDocument = useCallback(
    async (docId: string) => {
      // Check if content is cached (JSON)
      const cachedJSON = getDocumentJSON(docId);
      if (cachedJSON) {
        setCurrentDocId(docId);
        setEditorContent(cachedJSON);
        return;
      }

      // Check for legacy HTML (migration)
      const docData = documentsById[docId];
      const legacyHtml = docData?.legacyHtml;
      const isErrorPlaceholder =
        typeof legacyHtml === "string" &&
        legacyHtml.includes("Unable to load the template");
      if (legacyHtml && !isErrorPlaceholder) {
        setCurrentDocId(docId);
        setEditorContent(legacyHtml);
        return;
      }

      // Load from DOCX
      const doc = DEFAULT_CASE_DOCS.find((d) => d.id === docId);
      if (!doc) return;

      setCurrentDocId(docId);
      setLoading(true);

      try {
        console.log(`[DOCX Loader] Loading document: ${doc.title}`);

        // ... (existing fetch logic) ...
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(resolveTemplateUrl(doc.url), { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        let htmlContent = "";
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          htmlContent = result.value || "";
        } catch (convertError) {
          console.warn("[DOCX Loader] HTML conversion failed, falling back to text.", convertError);
          const textResult = await mammoth.extractRawText({ arrayBuffer });
          const plainText = textResult.value || "";
          htmlContent = plainText
            .split("\n")
            .map((line) => `<p>${line}</p>`)
            .join("");
        }

        // Initialize as HTML (DocEditor will handle it)
        setEditorContent(htmlContent);
        // Note: We don't save immediately, wait for auto-save or edit
      } catch (error) {
        const message =
          error instanceof DOMException && error.name === "AbortError"
            ? "Request timed out while loading the template."
            : "Unable to load the template. Please check that the file exists in /public/templates.";
        console.error(`[DOCX Loader] Error loading document:`, error);
        setEditorContent(`<p>${message}</p>`);
      } finally {
        setLoading(false);
      }
    },
    [getDocumentJSON, documentsById, setCurrentDocId, setLoading]
  );

  // Auto-open first document on mount
  useEffect(() => {
    const docItems = bundleItems.filter((item) => item.type === "DOC");
    if (docItems.length === 0) {
      if (currentDocId) {
        setCurrentDocId(null);
      }
      setEditorContent("");
      return;
    }

    const validDocIds = new Set(docItems.map((item) => item.refId));
    const nextDocId = currentDocId && validDocIds.has(currentDocId)
      ? currentDocId
      : docItems[0]?.refId;

    if (nextDocId && nextDocId !== currentDocId) {
      loadDocument(nextDocId);
    }
  }, [bundleItems, currentDocId, loadDocument, setCurrentDocId]);

  const handleContentChange = (newContent: JSONContent) => {
    setEditorContent(newContent);
    // Optionally auto-save immediately on change? Or wait for interval.
    // Interval is safer for performance.
  };

  const handleDocumentSelect = (docId: string) => {
    // Save current document before switching
    if (currentDocId && activeEditorRef) {
      saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
    }

    if (docId !== currentDocId) {
      loadDocument(docId);
    }
  };

  const handleSaveDraft = () => {
    if (currentDocId && activeEditorRef) {
      saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
    }
    saveDraft(effectiveCaseId);
  };

  const handleDownload = () => {
    setIsDownloadModalOpen(true);
  };

  const handleAddAttachment = () => {
    attachmentInputRef.current?.click();
  };

  const handleAddDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type;
    const fileName = file.name;

    // Check if it's a DOCX file
    if (
      fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      // Convert DOCX to HTML and add as document
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const htmlContent = result.value;

        addUploadedDocument({
          title: fileName.replace(".docx", ""),
          type: "docx",
          content: htmlContent,
        });
        saveDraft(effectiveCaseId);

        // Optionally switch to the newly uploaded document
        // You would need to handle this in the store
      } catch (error) {
        console.error("Error converting DOCX:", error);
        alert("Failed to convert DOCX file");
      }
    } else {
      // Add as attachment (PDF, image, etc.)
      const url = URL.createObjectURL(file);
      addAttachment({
        name: fileName,
        type: fileType,
        size: file.size,
        url: url,
      });
      saveDraft(effectiveCaseId);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAttachmentUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    addAttachment({
      name: file.name,
      type: file.type,
      size: file.size,
      url: url,
    });
    saveDraft(effectiveCaseId);

    // Reset input
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const currentDocTitle =
    DEFAULT_CASE_DOCS.find((d) => d.id === currentDocId)?.title || "Document";
  const selectedAttachment = selectedAttachmentId
    ? attachmentsById[selectedAttachmentId]
    : null;
  const isAttachmentView = Boolean(selectedAttachment);

  useEffect(() => {
    const element = pdfContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth;
      setPdfContainerWidth((prev) =>
        Math.abs(prev - nextWidth) > 2 ? nextWidth : prev
      );
    });
    observer.observe(element);
    setPdfContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [selectedAttachmentId]);

  useEffect(() => {
    setPdfNumPages(0);
    setPdfReady(false);
  }, [selectedAttachmentId]);

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Case Document Preparation"
    >
      <div className="flex flex-col h-full bg-gray-50 -m-6">
        <TopActionBar
          onSaveDraft={handleSaveDraft}
          onDownload={handleDownload}
          onRequestSignatures={() => setIsSignaturePanelOpen(true)}
          signaturePendingCount={signaturePendingCount}
          onSubmitCase={() =>
            navigate({ to: `/lawyer-submit-case/${effectiveCaseId}` })
          }
          onAddAttachment={handleAddAttachment}
          onAddDocument={handleAddDocument}
        />

        <div className="flex flex-1 overflow-hidden">
          <DocumentSidebar
            onDocumentSelect={handleDocumentSelect}
            onAttachmentSelect={(attachmentId) => {
              setSelectedAttachmentId(attachmentId);
              if (attachmentId) {
                setCurrentDocId(null);
              }
            }}
            caseId={caseId}
          />
          {isAttachmentView && selectedAttachment ? (
            <div className="flex-1 overflow-auto bg-white p-6">
              <div className="mx-auto w-full max-w-4xl rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedAttachment.name}
                  </p>
                  <p className="text-xs text-gray-500">{selectedAttachment.type}</p>
                </div>
                <div className="mt-4 h-[75vh] overflow-hidden rounded-lg border border-gray-200 bg-white">
                  {selectedAttachment.type.includes("pdf") ? (
                    <div
                      ref={pdfContainerRef}
                      className="pdf-scroll h-full w-full overflow-y-auto overflow-x-hidden bg-white"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      <style>{`
                        .pdf-scroll::-webkit-scrollbar {
                          width: 0px;
                          height: 0px;
                        }
                      `}</style>
                      <Document
                        file={selectedAttachment.url}
                        onLoadSuccess={(doc) => setPdfNumPages(doc.numPages)}
                      >
                        {pdfNumPages > 0 && pdfContainerWidth > 0 ? (
                          Array.from({ length: pdfNumPages }, (_, index) => (
                            <div
                              key={`pdf-page-${index + 1}`}
                              className="mx-auto mb-6 w-full bg-white"
                            >
                              <Page
                                pageNumber={index + 1}
                                width={Math.max(pdfContainerWidth - 24, 320)}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                onRenderSuccess={() => {
                                  if (index === 0) {
                                    setPdfReady(true);
                                  }
                                }}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-gray-500">Preparing PDF preview...</div>
                        )}
                      </Document>
                      {!pdfReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                          <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                        </div>
                      )}
                    </div>
                  ) : selectedAttachment.type.includes("image") ? (
                    <img
                      src={selectedAttachment.url}
                      alt={selectedAttachment.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                      Preview is not available for this file type.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <DocEditor
              content={editorContent}
              onContentChange={handleContentChange}
              isLoading={isLoading}
            />
          )}
        </div>

        <DownloadModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          currentDocTitle={currentDocTitle}
          currentDocContent={activeEditorRef?.getHTML() || (typeof editorContent === 'string' ? editorContent : "")}
          selectedAttachmentId={selectedAttachmentId}
        />

        {/* Signature Request Panel */}
        {isSignaturePanelOpen && (
          <SignatureRequestPanel
            caseId={effectiveCaseId}
            bundleItems={bundleItems}
            onClose={() => setIsSignaturePanelOpen(false)}
          />
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={attachmentInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          onChange={handleAttachmentUpload}
          className="hidden"
        />
      </div>
    </LawyerLayout>
  );
}
