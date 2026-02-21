import { useCallback, useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Paperclip,
  UploadCloud,
} from "lucide-react";
import * as mammoth from "mammoth";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/react";
import { AttachmentBlock } from "../extensions/AttachmentBlock";
import { ImageAttachment } from "../extensions/ImageAttachment";
import { pdfjs } from "react-pdf";
import LawyerLayout from "../components/LawyerLayout";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import SubmitConfirmationModal from "../components/caseFiling/SubmitConfirmationModal";
import { useCaseFilingStore } from "../store/caseFiling.store";
import { formatFilingDateTime } from "../utils/caseFiling.utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const exportExtensions = [
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
];

function toCaseTitle(caseId: string): string {
  return caseId
    .replace(/[-_]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Case File";
}

export default function LawyerCaseFilingSubmissionPage() {
  const params = useParams({ strict: false }) as { caseId?: string };
  const {
    submittedCases,
    ensureCaseContext,
    getCaseById,
    getBundleByCaseId,
    refreshBundleFromWorkspace,
    mockDownloadBundle,
    submitCaseToRegistrar,
  } = useCaseFilingStore();

  const selectedCaseId = params.caseId || "default-case";
  const filingCase = getCaseById(selectedCaseId);
  const bundle = getBundleByCaseId(selectedCaseId);

  const [feedback, setFeedback] = useState<{
    tone: "success" | "info" | "error";
    message: string;
  } | null>(null);
  const [successModalMessage, setSuccessModalMessage] = useState<string | null>(
    null
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [technicalError, setTechnicalError] = useState<string | undefined>();

  const latestSubmission = submittedCases.find(
    (item) => item.caseId === selectedCaseId
  );

  const canSubmit = Boolean(
    filingCase &&
      bundle &&
      bundle.orderedDocuments.length > 0
  );

  const syncWorkspaceBundle = useCallback(() => {
    if (!selectedCaseId) return;

    useDocumentEditorStore.getState().loadDraft(selectedCaseId);
    const editorState = useDocumentEditorStore.getState();
    const signatureRequests = useSignatureRequestsStore
      .getState()
      .getRequestsByCaseId(selectedCaseId);

    const editorItems = editorState.bundleItems.map((item) => {
      const attachment = editorState.attachmentsById[item.refId];
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        attachmentType: attachment?.type,
      };
    });

    const derivedTitle = filingCase?.title || toCaseTitle(selectedCaseId);

    ensureCaseContext(selectedCaseId, derivedTitle);
    refreshBundleFromWorkspace(selectedCaseId, editorItems, signatureRequests);
  }, [ensureCaseContext, filingCase?.title, refreshBundleFromWorkspace, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;
    syncWorkspaceBundle();
  }, [selectedCaseId, syncWorkspaceBundle]);

  const handleDownloadBundle = async () => {
    const latestCase = getCaseById(selectedCaseId);
    if (!latestCase) return;

    const result = mockDownloadBundle(selectedCaseId);
    if (!result.ok) {
      setFeedback({
        tone: "error",
        message: result.error || "Unable to download case bundle.",
      });
      return;
    }

    useDocumentEditorStore.getState().loadDraft(selectedCaseId);
    const editorState = useDocumentEditorStore.getState();

    const {
      bundleItems,
      documentsById,
      attachmentsById,
      attachments,
      documentContents,
      currentDocId,
      activeEditorRef,
    } = editorState;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setFeedback({
        tone: "error",
        message: "Popup blocked. Please allow popups to download the case file.",
      });
      return;
    }

    const resolveTemplateUrl = (path: string) => {
      if (path.startsWith("http://") || path.startsWith("https://")) return path;
      const base = import.meta.env.BASE_URL || "/";
      const normalizedBase = base.endsWith("/") ? base : `${base}/`;
      const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
      return `${normalizedBase}${normalizedPath}`;
    };

    const getAttachment = (attachmentId: string) =>
      attachmentsById[attachmentId] ||
      attachments.find((attachment) => attachment.id === attachmentId);

    const collectImageAttachmentIds = (
      content: JSONContent | null | undefined,
      bucket: Set<string>
    ) => {
      if (!content) return;
      const walk = (node: JSONContent) => {
        const isImageAttachment =
          node.type === "imageAttachment" ||
          (node.type === "attachmentBlock" &&
            typeof node.attrs?.mimeType === "string" &&
            node.attrs.mimeType.includes("image"));
        if (isImageAttachment && node.attrs?.attachmentId) {
          bucket.add(String(node.attrs.attachmentId));
        }
        if (node.content) node.content.forEach((child) => walk(child));
      };
      walk(content);
    };

    const collectImageAttachmentIdsFromHtml = (
      html: string,
      bucket: Set<string>
    ) => {
      if (typeof DOMParser === "undefined") return;
      const parsed = new DOMParser().parseFromString(html, "text/html");
      parsed
        .querySelectorAll("[data-image-attachment][data-attachment-id]")
        .forEach((node) => {
          const id = node.getAttribute("data-attachment-id");
          if (id) bucket.add(id);
        });

      parsed
        .querySelectorAll("[data-attachment-block][data-attachment-id][data-mime-type]")
        .forEach((node) => {
          const mime = node.getAttribute("data-mime-type") || "";
          if (!mime.includes("image")) return;
          const id = node.getAttribute("data-attachment-id");
          if (id) bucket.add(id);
        });
    };

    const resolveDocHtmlAsync = async (docId: string) => {
      if (docId === currentDocId && activeEditorRef) {
        return activeEditorRef.getHTML();
      }
      const doc = documentsById[docId];
      if (doc?.contentJSON) {
        return generateHTML(doc.contentJSON as JSONContent, exportExtensions);
      }
      if (doc?.legacyHtml) return doc.legacyHtml;
      if (documentContents[docId]) return documentContents[docId];
      if (!doc?.url) return "<p></p>";

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(resolveTemplateUrl(doc.url), {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const converted = await mammoth.convertToHtml({ arrayBuffer });
        return converted.value || "<p></p>";
      } catch {
        return "<p></p>";
      }
    };

    const renderPdfAttachmentPages = async (url: string) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const images: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        images.push(canvas.toDataURL("image/png"));
      }
      return images;
    };

    const embeddedImageIds = new Set<string>();
    if (currentDocId && activeEditorRef) {
      collectImageAttachmentIds(activeEditorRef.getJSON() as JSONContent, embeddedImageIds);
    }
    bundleItems.forEach((item) => {
      if (item.type !== "DOC") return;
      const doc = documentsById[item.refId];
      if (doc?.contentJSON) {
        collectImageAttachmentIds(doc.contentJSON, embeddedImageIds);
        return;
      }
      if (doc?.legacyHtml) {
        collectImageAttachmentIdsFromHtml(doc.legacyHtml, embeddedImageIds);
        return;
      }
      if (documentContents[item.refId]) {
        collectImageAttachmentIdsFromHtml(documentContents[item.refId], embeddedImageIds);
      }
    });

    const docHtmlById = new Map<string, string>();
    for (const item of bundleItems) {
      if (item.type !== "DOC") continue;
      const html = await resolveDocHtmlAsync(item.refId);
      docHtmlById.set(item.refId, html);
    }

    const sections: string[] = [];
    for (const item of bundleItems) {
      if (item.type === "DOC") {
        const html = docHtmlById.get(item.refId) || "<p></p>";
        sections.push(`
          <div style="page-break-after: always;">
            ${html}
          </div>
        `);
        continue;
      }

      const attachment = getAttachment(item.refId);
      if (!attachment) continue;
      const isImage = attachment.type.startsWith("image/");
      const isPdf = attachment.type.includes("pdf");
      if (isImage && embeddedImageIds.has(attachment.id)) continue;

      if (isImage) {
        sections.push(`
          <div style="page-break-after: always;">
            <img src="${attachment.url}" alt="${attachment.name}" style="max-width: 100%; height: auto;" />
          </div>
        `);
        continue;
      }

      if (isPdf) {
        const pages = await renderPdfAttachmentPages(attachment.url);
        pages.forEach((pageDataUrl, pageIndex) => {
          sections.push(`
            <div style="page-break-after: always;">
              <img src="${pageDataUrl}" alt="${attachment.name} page ${pageIndex + 1}" style="max-width: 100%; height: auto;" />
            </div>
          `);
        });
        continue;
      }

      sections.push(`
        <div style="page-break-after: always;">
          <p>${attachment.name}</p>
        </div>
      `);
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Complete Case File - ${latestCase.title}</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.6;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
              color: #000;
            }
            table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
            th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
            figure.image-attachment-wrapper { margin: 16pt 0; }
            figure.image-attachment-wrapper img { max-width: 100%; height: auto; display: block; }
            @media print { body { margin: 0; padding: 1in; } }
          </style>
        </head>
        <body>${sections.join("")}</body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);

    setFeedback({ tone: "info", message: "Complete case file download started." });
  };

  const handleConfirmSubmission = async () => {
    const latestCase = getCaseById(selectedCaseId);
    if (!latestCase) return;

    setSubmitting(true);
    setTechnicalError(undefined);
    setFeedback(null);

    await new Promise((resolve) => setTimeout(resolve, 700));

    const result = submitCaseToRegistrar({
      caseId: selectedCaseId,
      submittedBy: "Lawyer",
      skipReadinessCheck: true,
    });

    setSubmitting(false);

    if (!result.ok) {
      if (result.type === "technical") {
        setTechnicalError(result.error);
        return;
      }
      setConfirmOpen(false);
      setFeedback({
        tone: "error",
        message: result.error || "Unable to submit case file.",
      });
      return;
    }

    setConfirmOpen(false);
    setTechnicalError(undefined);
    const message = latestSubmission
      ? "Updated case file successfully submitted to registrar."
      : "Case successfully submitted to registrar.";
    setFeedback(null);
    setSuccessModalMessage(message);
  };

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Case Filing Submission">
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Submit Case File
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">
                Complete Case File Checklist
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Review included documents in the final PDF bundle, then submit to registrar.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Case: {filingCase?.title || toCaseTitle(selectedCaseId)}
              </p>
            </div>
          </div>
        </div>

        {filingCase && bundle && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  Documents Included in Complete PDF Case File
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {bundle.orderedDocuments.length} document{bundle.orderedDocuments.length === 1 ? "" : "s"}
                </span>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Updated {formatFilingDateTime(bundle.generatedAt)}
              </p>

              {bundle.orderedDocuments.length === 0 ? (
                <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No documents found in this case bundle yet.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {bundle.orderedDocuments.map((doc, index) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-[#f8fafc] px-4 py-3 text-sm"
                    >
                      <div className="flex items-start gap-3">
                        {doc.source === "evidence" ? (
                          <Paperclip className="mt-0.5 h-4 w-4 text-gray-500" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 text-blue-600" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {index + 1}. {doc.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doc.source === "evidence"
                              ? "Attachment"
                              : "Prepared Document"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.signedRequired && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              doc.signedCompleted
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {doc.signedCompleted ? "Signed" : "Signature Pending"}
                          </span>
                        )}
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                          Included
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Submission Actions
                  </h3>
                  {latestSubmission && (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Submitted on {formatFilingDateTime(latestSubmission.submittedAt)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    void handleDownloadBundle();
                  }}
                  disabled={bundle.orderedDocuments.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Download Complete PDF
                </button>
                <button
                  onClick={() => {
                    setTechnicalError(undefined);
                    setConfirmOpen(true);
                  }}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <UploadCloud className="h-4 w-4" />
                  {latestSubmission ? "Submit Updated Case File" : "Submit Case File"}
                </button>
              </div>
            </div>
          </>
        )}

        {feedback && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              feedback.tone === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "border border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            <div className="flex items-start gap-2">
              {feedback.tone === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4" />
              ) : (
                <ClipboardCheck className="mt-0.5 h-4 w-4" />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}
      </div>

      {filingCase && (
        <SubmitConfirmationModal
          open={confirmOpen}
          caseTitle={filingCase.title}
          registrarName={filingCase.assignedRegistrar}
          submitting={submitting}
          technicalError={technicalError}
          onCancel={() => {
            setConfirmOpen(false);
            setTechnicalError(undefined);
          }}
          onConfirm={handleConfirmSubmission}
        />
      )}

      {successModalMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-center text-xl font-semibold text-gray-900">
              Submission Successful
            </h3>
            <p className="mt-2 text-center text-sm text-gray-600">
              {successModalMessage}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setSuccessModalMessage(null)}
                className="rounded-lg bg-[#01411C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </LawyerLayout>
  );
}
