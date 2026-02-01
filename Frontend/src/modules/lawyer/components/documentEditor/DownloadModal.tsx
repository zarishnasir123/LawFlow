import { X, FileText, Package } from "lucide-react";
import * as mammoth from "mammoth";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/react";
import { AttachmentBlock } from "../../extensions/AttachmentBlock";
import { ImageAttachment } from "../../extensions/ImageAttachment";
import { useDocumentEditorStore, type Attachment } from "../../store/documentEditor.store";
import { DEFAULT_CASE_DOCS } from "../../data/defaultCaseDocuments";
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDocTitle: string;
    currentDocContent: string;
    selectedAttachmentId?: string | null;
}

export default function DownloadModal({
    isOpen,
    onClose,
    currentDocTitle,
    currentDocContent,
    selectedAttachmentId,
}: DownloadModalProps) {
    const {
        documentContents,
        attachments,
        documentsById,
        attachmentsById,
        bundleItems,
        currentDocId,
        activeEditorRef,
    } = useDocumentEditorStore();

    if (!isOpen) return null;

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

    const resolveDocHtml = (docId: string) => {
        if (docId === currentDocId && activeEditorRef) {
            return activeEditorRef.getHTML();
        }
        const doc = documentsById[docId];
        if (doc?.contentJSON) {
            return generateHTML(doc.contentJSON as JSONContent, exportExtensions);
        }
        if (doc?.legacyHtml) return doc.legacyHtml;
        if (documentContents[docId]) return documentContents[docId];
        return "<p></p>";
    };

    const resolveTemplateUrl = (path: string) => {
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }
        const base = import.meta.env.BASE_URL || "/";
        const normalizedBase = base.endsWith("/") ? base : `${base}/`;
        const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
        return `${normalizedBase}${normalizedPath}`;
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

        const templateUrl =
            doc?.url || DEFAULT_CASE_DOCS.find((entry) => entry.id === docId)?.url;
        if (!templateUrl) return "<p></p>";

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(resolveTemplateUrl(templateUrl), { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            return result.value || "<p></p>";
        } catch (error) {
            console.error("[Download] Failed to load template for export:", error);
            return "<p></p>";
        }
    };

    const collectImageAttachmentIds = (content: JSONContent | null | undefined, bucket: Set<string>) => {
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
            if (node.content) {
                node.content.forEach((child) => walk(child));
            }
        };
        walk(content);
    };

    const collectImageAttachmentIdsFromHtml = (html: string, bucket: Set<string>) => {
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

    const getAttachment = (attachmentId: string): Attachment | undefined => {
        return attachmentsById[attachmentId] || attachments.find((att) => att.id === attachmentId);
    };

    const renderPdfAttachmentPages = async (url: string) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const images: string[] = [];

        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
            const page = await pdf.getPage(pageIndex);
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

    const downloadCurrentDocument = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const selectedAttachment = selectedAttachmentId
            ? getAttachment(selectedAttachmentId)
            : undefined;

        const buildHtml = (bodyContent: string) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${currentDocTitle}</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.6;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
              color: #000;
            }
            h1 { font-size: 18pt; margin-bottom: 12pt; }
            h2 { font-size: 16pt; margin-bottom: 10pt; }
            p { margin-bottom: 8pt; }
            table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
            th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
            figure.image-attachment-wrapper { margin: 16pt 0; }
            figure.image-attachment-wrapper img { max-width: 100%; height: auto; display: block; }
            figure.image-attachment-wrapper figcaption { font-size: 10pt; color: #333; margin-top: 6pt; }
            @media print {
              body { margin: 0; padding: 1in; }
            }
          </style>
        </head>
        <body>
          ${bodyContent}
        </body>
      </html>
    `;

        const printHtml = (bodyContent: string) => {
            const html = buildHtml(bodyContent);
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        };

        if (selectedAttachment && selectedAttachment.type.includes("pdf")) {
            renderPdfAttachmentPages(selectedAttachment.url)
                .then((pages) => {
                    if (!pages.length) {
                        printHtml("<p></p>");
                        return;
                    }
                    const body = pages
                        .map(
                            (pageDataUrl) => `
          <div style="page-break-after: always;">
            <img src="${pageDataUrl}" alt="${selectedAttachment.name}" style="max-width: 100%; height: auto;" />
          </div>
        `
                        )
                        .join("");
                    printHtml(body);
                })
                .catch(() => {
                    printHtml("<p></p>");
                });
            return;
        }

        if (selectedAttachment && selectedAttachment.type.startsWith("image/")) {
            printHtml(`
        <div style="page-break-after: always;">
          <img src="${selectedAttachment.url}" alt="${selectedAttachment.name}" style="max-width: 100%; height: auto;" />
        </div>
      `);
            return;
        }

        printHtml(currentDocContent || "<p></p>");
    };

    const downloadEntireCaseFile = async () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

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
                const html = docHtmlById.get(item.refId) || resolveDocHtml(item.refId);
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
            if (isImage && embeddedImageIds.has(attachment.id)) {
                continue;
            }

            if (isImage) {
                sections.push(`
      <div style="page-break-after: always;">
        <div style="margin-top: 12pt;">
          <img src="${attachment.url}" alt="${attachment.name}" style="max-width: 100%; height: auto;" />
        </div>
      </div>
    `);
                continue;
            }

            if (isPdf) {
                const pages = await renderPdfAttachmentPages(attachment.url);
                if (pages.length === 0) {
                    continue;
                }
                pages.forEach((pageDataUrl, pageIndex) => {
                    sections.push(`
      <div style="page-break-after: always;">
        <div style="margin-top: 12pt;">
          <img src="${pageDataUrl}" alt="${attachment.name} page ${pageIndex + 1}" style="max-width: 100%; height: auto;" />
        </div>
      </div>
    `);
                });
                continue;
            }

            sections.push(`
      <div style="page-break-after: always;">
        <p style="margin-top: 12pt;">
          ${attachment.name}
        </p>
      </div>
    `);
        }

        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Complete Case File - Recovery of Money</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.6;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
              color: #000;
            }
            h1 { font-size: 18pt; margin-bottom: 12pt; }
            h2 { font-size: 16pt; margin-bottom: 10pt; }
            p { margin-bottom: 8pt; }
            table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
            th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
            figure.image-attachment-wrapper { margin: 16pt 0; }
            figure.image-attachment-wrapper img { max-width: 100%; height: auto; display: block; }
            figure.image-attachment-wrapper figcaption { font-size: 10pt; color: #333; margin-top: 6pt; }
            ul { margin: 12pt 0; }
            li { margin-bottom: 6pt; }
            @media print {
              body { margin: 0; padding: 1in; }
            }
          </style>
        </head>
        <body>
          ${sections.join("")}
        </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Download Options
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-3">
                    <button
                        onClick={() => {
                            downloadCurrentDocument();
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="font-semibold text-gray-900">Current Document</p>
                            <p className="text-sm text-gray-500">{currentDocTitle}</p>
                        </div>
                    </button>

                    <button
                        onClick={async () => {
                            await downloadEntireCaseFile();
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                    >
                        <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                            <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="font-semibold text-gray-900">Entire Case File</p>
                            <p className="text-sm text-gray-500">
                                All documents + attachments list
                            </p>
                        </div>
                    </button>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                    <p className="text-xs text-gray-600">
                        Tip: Use your browser's print dialog to save as PDF
                    </p>
                </div>
            </div>
        </div>
    );
}
