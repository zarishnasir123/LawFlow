import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { Document, Page, pdfjs } from "react-pdf";
import { casesApi } from "../api/cases.api";
import { signaturesApi, getSignaturesErrorMessage } from "../signatures/api/signatures.api";
import LawyerLayout from "../components/LawyerLayout";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import SubmitConfirmationModal from "../components/caseFiling/SubmitConfirmationModal";
import { useCaseFilingStore } from "../store/caseFiling.store";
import { formatFilingDateTime } from "../utils/caseFiling.utils";
import { useLoginStore } from "../../auth/store";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import type {
  CompiledCaseBundle,
  SubmittedCaseFilePreview,
  SubmittedCaseFilePreviewItem,
} from "../types/caseFiling";

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

function getDisplayNameFromEmail(email: string): string {
  const handle = email.split("@")[0] ?? "";
  if (!handle) return "";
  return handle
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(pdf|docx|doc|jpg|jpeg|png)$/g, "")
    .replace(/-signed\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveTemplateUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

async function buildSubmittedPreviewFromWorkspace(
  caseId: string,
  bundle: CompiledCaseBundle
): Promise<SubmittedCaseFilePreview> {
  useDocumentEditorStore.getState().loadDraft(caseId);
  // Signature linkage temporarily unused while the new per-signer-per-row
  // model is rewired into the submission preview (Phase 2).
  void useSignatureRequestsStore;
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

  const docByBundleId = new Map(bundle.orderedDocuments.map((doc) => [doc.id, doc]));
  const docByTitle = new Map(
    bundle.orderedDocuments.map((doc) => [normalizeTitle(doc.title), doc])
  );
  // Signature linkage rewired in Phase 2 — the new per-signer-per-row
  // model doesn't have bundleItemId / signedAttachmentId, and the
  // signed PDF lives on cases.signed_pdf (one per case) rather than
  // per-request. Until that wiring lands, the preview falls back to
  // "no signature linked" for every item, which matches the data
  // available right now.
  const signatureRequestByBundleItemId = new Map<string, never>();
  const signatureRequestBySignedAttachmentId = new Map<string, never>();
  const signatureRequestByDocTitle = new Map<string, never>();

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
      const response = await fetch(resolveTemplateUrl(doc.url));
      if (!response.ok) return "<p></p>";
      const arrayBuffer = await response.arrayBuffer();
      const converted = await mammoth.convertToHtml({ arrayBuffer });
      return converted.value || "<p></p>";
    } catch {
      return "<p></p>";
    }
  };

  const previewItems: SubmittedCaseFilePreviewItem[] = [];

  for (const item of bundleItems) {
    const bundleDoc =
      docByBundleId.get(item.id) || docByTitle.get(normalizeTitle(item.title));
    const linkedRequest =
      signatureRequestByBundleItemId.get(item.id) ||
      signatureRequestBySignedAttachmentId.get(item.refId) ||
      signatureRequestByDocTitle.get(normalizeTitle(item.title));

    // Phase 1: per-bundle-item signature linkage is gone; signature_requests
    // now key off page indices, and the final signed artifact lives on
    // cases.signed_pdf (one per case, populated in Phase 2). For preview
    // purposes we fall back to bundleDoc's own flags and stop trying to
    // pull request-level state.
    void linkedRequest;
    const signedRequired = bundleDoc?.signedRequired || false;
    const signedByClient = false;
    const signedByLawyer = false;
    const signedCompleted = bundleDoc?.signedCompleted || false;
    const signedDataUrl: string | undefined = undefined;

    if (signedDataUrl) {
      previewItems.push({
        id: item.id,
        title: item.title.toLowerCase().endsWith(".pdf")
          ? item.title
          : `${item.title}-Signed.pdf`,
        type: "ATTACHMENT",
        source: bundleDoc?.source || "evidence",
        signedRequired,
        signedCompleted,
        signedByClient,
        signedByLawyer,
        mimeType: "application/pdf",
        dataUrl: signedDataUrl,
      });
      continue;
    }

    if (item.type === "DOC") {
      const htmlContent = await resolveDocHtmlAsync(item.refId);
      previewItems.push({
        id: item.id,
        title: item.title,
        type: "DOC",
        source: bundleDoc?.source || "prepared_document",
        signedRequired,
        signedCompleted,
        signedByClient,
        signedByLawyer,
        mimeType: "text/html",
        htmlContent,
      });
      continue;
    }

    const attachment =
      attachmentsById[item.refId] ||
      attachments.find((attachmentItem) => attachmentItem.id === item.refId);

    previewItems.push({
      id: item.id,
      title: item.title,
      type: "ATTACHMENT",
      source: bundleDoc?.source || "evidence",
      signedRequired,
      signedCompleted,
      signedByClient,
      signedByLawyer,
      mimeType: attachment?.type,
      dataUrl: attachment?.url,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    items: previewItems,
  };
}

export default function LawyerCaseFilingSubmissionPage() {
  const params = useParams({ strict: false }) as { caseId?: string };
  const loginEmail = useLoginStore((state) => state.email);
  // Pull the lawyer's name from the live /auth/me cache instead of
  // the old localStorage-backed lawyerProfile store. The store
  // contained fake "Adv. Fatima Ali" data; the cache has whatever
  // the lawyer actually registered with, kept in sync server-side.
  const { data: currentLawyer } = useCurrentUser();
  const lawyerFullName = displayFullName(currentLawyer);
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

  const submittedByName =
    getDisplayNameFromEmail(loginEmail).trim() ||
    lawyerFullName.trim() ||
    "Lawyer";
  const displayCaseTitle = getCaseDisplayTitle(filingCase?.title, selectedCaseId);

  const latestSubmission = submittedCases.find(
    (item) => item.caseId === selectedCaseId
  );

  // Pull the backend case record so we can detect whether the signing
  // workflow finished (signedPdfStoragePath is set on the row only after
  // every signature_request reaches status='signed' AND the pdf-lib
  // compile job posts the artifact to Supabase Storage). The editor
  // invalidates this query on caseFullySigned so by the time the lawyer
  // lands here, the field is fresh.
  const { data: backendCase } = useQuery({
    queryKey: ["case", selectedCaseId],
    queryFn: () => casesApi.getCase(selectedCaseId),
    enabled: Boolean(selectedCaseId) && selectedCaseId !== "default-case",
    staleTime: 1000 * 30,
  });

  // Signed PDF preview state. Resolved lazily once we know the case is
  // signed — the signed URL is a short-lived (5-min) Supabase Storage
  // link, so we ask the server only when we're about to render. PDF
  // bytes are pulled into memory once and rendered with react-pdf,
  // matching how the attachment-PDF preview in the editor sidebar works.
  const signedPdfStoragePath = backendCase?.signedPdfStoragePath ?? null;
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [signedPdfError, setSignedPdfError] = useState<string | null>(null);
  const [signedPdfNumPages, setSignedPdfNumPages] = useState(0);
  const [signedPdfContainerWidth, setSignedPdfContainerWidth] = useState(0);
  const signedPdfContainerRef = useRef<HTMLDivElement | null>(null);

  // Refetch a fresh signed URL whenever the signed-pdf path appears /
  // changes on the case row. Storage paths can rotate if the lawyer
  // somehow re-collects signatures, so we key the effect on the path
  // (not just a boolean).
  useEffect(() => {
    if (!signedPdfStoragePath) {
      setSignedPdfUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { downloadUrl } = await signaturesApi.downloadSignedPdf(
          selectedCaseId
        );
        if (cancelled) return;
        setSignedPdfUrl(downloadUrl);
        setSignedPdfError(null);
      } catch (err) {
        if (cancelled) return;
        setSignedPdfError(getSignaturesErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId, signedPdfStoragePath]);

  // Observe the PDF container so each page renders at the natural
  // column width — keeps the signed file legible without needing a
  // horizontal scrollbar.
  useEffect(() => {
    const element = signedPdfContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth;
      setSignedPdfContainerWidth((prev) =>
        Math.abs(prev - nextWidth) > 2 ? nextWidth : prev
      );
    });
    observer.observe(element);
    setSignedPdfContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [signedPdfUrl]);

  const signedPdfPages = useMemo(
    () =>
      signedPdfNumPages > 0 && signedPdfContainerWidth > 0
        ? Array.from({ length: signedPdfNumPages }, (_, i) => i + 1)
        : [],
    [signedPdfNumPages, signedPdfContainerWidth]
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
    const editorItems = editorState.bundleItems.map((item) => {
      const attachment = editorState.attachmentsById[item.refId];
      return {
        bundleItemId: item.id,
        sourceRefId: item.refId,
        title: item.title,
        type: item.type,
        attachmentType: attachment?.type,
      };
    });

    const derivedTitle = getCaseDisplayTitle(filingCase?.title, selectedCaseId);

    ensureCaseContext(selectedCaseId, derivedTitle);
    // Phase 1: the new signature_requests shape doesn't match the
    // submission-bundle's legacy SignatureRequestInput (bundleItemId,
    // requiresClient*, etc). Pass an empty list; Phase 2 will rebuild
    // the linkage once cases.signed_pdf is wired.
    refreshBundleFromWorkspace(selectedCaseId, editorItems, []);
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

    syncWorkspaceBundle();
    const refreshedBundle = useCaseFilingStore.getState().getBundleByCaseId(selectedCaseId);
    if (!refreshedBundle) {
      setSubmitting(false);
      setConfirmOpen(false);
      setFeedback({
        tone: "error",
        message: "Unable to prepare latest case bundle for submission.",
      });
      return;
    }
    useDocumentEditorStore.getState().saveDraft(selectedCaseId);
    const submittedPreview = await buildSubmittedPreviewFromWorkspace(
      selectedCaseId,
      refreshedBundle
    );

    const result = submitCaseToRegistrar({
      caseId: selectedCaseId,
      submittedBy: submittedByName,
      submittedPreview,
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
                Case: {displayCaseTitle}
              </p>
            </div>
          </div>
        </div>

        {filingCase && bundle && (
          <>
            {/* Signed PDF preview — only shown when the case is fully
                signed and the backend compile has finished posting the
                artifact to Supabase Storage. This *replaces* the editable
                document list as the canonical case-file preview because
                once it exists, the signed PDF is the legally-frozen
                artifact the registrar receives. */}
            {signedPdfStoragePath && (
              <div className="rounded-xl border border-emerald-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Signed Case File
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-gray-900">
                      Final PDF — All Signatures Collected
                    </h2>
                    {backendCase?.signedPdfGeneratedAt && (
                      <p className="mt-1 text-xs text-gray-500">
                        Compiled {formatFilingDateTime(backendCase.signedPdfGeneratedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {signedPdfError && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {signedPdfError}
                  </div>
                )}

                <div
                  ref={signedPdfContainerRef}
                  className="mt-4 max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  {signedPdfUrl ? (
                    <Document
                      file={signedPdfUrl}
                      onLoadSuccess={(doc) => setSignedPdfNumPages(doc.numPages)}
                      onLoadError={(err) => setSignedPdfError(err.message)}
                      loading={
                        <div className="p-4 text-sm text-gray-500">
                          Loading signed PDF…
                        </div>
                      }
                    >
                      {signedPdfPages.map((pageNumber) => (
                        <div
                          key={`signed-pdf-page-${pageNumber}`}
                          className="mx-auto mb-4 w-full bg-white shadow-sm"
                        >
                          <Page
                            pageNumber={pageNumber}
                            width={Math.max(signedPdfContainerWidth - 24, 320)}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                        </div>
                      ))}
                    </Document>
                  ) : (
                    <div className="p-4 text-sm text-gray-500">
                      Preparing signed PDF preview…
                    </div>
                  )}
                </div>
              </div>
            )}

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
          caseTitle={displayCaseTitle}
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
