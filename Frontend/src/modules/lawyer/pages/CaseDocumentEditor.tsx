import { useEffect, useState, useCallback, useRef } from "react";
import * as mammoth from "mammoth";
import { type JSONContent } from "@tiptap/react";
import { useParams } from "@tanstack/react-router";
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
    countPendingSignatures,
    getCompletedRequests,
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

  const signatureCaseId = caseId || "recovery-of-money";
  const signaturePendingCount = countPendingSignatures(signatureCaseId);

  useEffect(() => {
    const completed = getCompletedRequests(signatureCaseId);
    completed.forEach((request) => {
      if (!request.signedPdfDataUrl || !request.sentToLawyerAt) return;
      const hasSignedAttachment =
        request.signedAttachmentId && attachmentsById[request.signedAttachmentId];
      const stillHasOriginal = bundleItems.some(
        (item) => item.id === request.bundleItemId
      );

      if (hasSignedAttachment) {
        if (stillHasOriginal) {
          removeFromBundle(request.bundleItemId);
        }
        return;
      }

      if (!stillHasOriginal) return;

      if (request.signedAttachmentId && attachmentsById[request.signedAttachmentId]) {
        return;
      }

      const dataUrl = request.signedPdfDataUrl;
      const base64 = dataUrl.split(",")[1] || "";
      const sizeBytes = Math.floor((base64.length * 3) / 4);

      const attachmentId = addSignedAttachment(
        {
          name: `${request.docTitle}-Signed.pdf`,
          type: "application/pdf",
          size: sizeBytes,
          url: dataUrl,
        },
        request.bundleItemId
      );

      updateRequest(request.id, { signedAttachmentId: attachmentId });
      removeFromBundle(request.bundleItemId);
    });
  }, [
    signatureCaseId,
    getCompletedRequests,
    addSignedAttachment,
    updateRequest,
    attachmentsById,
    removeFromBundle,
    bundleItems,
  ]);

  // Load draft on mount (or initialize defaults)
  useEffect(() => {
    // If caseId is present, load that specific draft. Otherwise generic.
    loadDraft(caseId);

    // We only init defaults if the bundle is empty (handled inside store or here?)
    // initializeDefaultBundle checks emptiness internally.
    initializeDefaultBundle(DEFAULT_CASE_DOCS);
  }, [loadDraft, initializeDefaultBundle, caseId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentDocId && activeEditorRef) {
        saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
        saveDraft(caseId);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDocId, activeEditorRef, saveDocumentJSON, saveDraft, caseId]);

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
    if (!currentDocId) {
      loadDocument(DEFAULT_CASE_DOCS[0].id);
    }
  }, [currentDocId, loadDocument]);

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
    saveDraft(caseId);
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
            caseId={caseId || "recovery-of-money"}
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
