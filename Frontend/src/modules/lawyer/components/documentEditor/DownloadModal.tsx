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

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDocTitle: string;
    currentDocContent: string;
}

export default function DownloadModal({
    isOpen,
    onClose,
    currentDocTitle,
    currentDocContent,
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

    const downloadCurrentDocument = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const html = `
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
          ${currentDocContent}
        </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
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

        const sections = bundleItems
            .map((item) => {
                if (item.type === "DOC") {
                    const docTitle = documentsById[item.refId]?.title || item.title || item.refId;
                    const html = docHtmlById.get(item.refId) || resolveDocHtml(item.refId);
                    return `
      <div style="page-break-after: always;">
        <h1 style="text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8pt;">
          ${docTitle}
        </h1>
        ${html}
      </div>
    `;
                }

                const attachment = getAttachment(item.refId);
                if (!attachment) return "";

                const isImage = attachment.type.startsWith("image/");
                if (isImage && embeddedImageIds.has(attachment.id)) {
                    return "";
                }

                if (isImage) {
                    return `
      <div style="page-break-after: always;">
        <h1 style="text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8pt;">
          Attachment - ${attachment.name}
        </h1>
        <div style="margin-top: 12pt;">
          <img src="${attachment.url}" alt="${attachment.name}" style="max-width: 100%; height: auto; border: 1px solid #000;" />
          <p style="font-size: 10pt; margin-top: 6pt;">${attachment.name} (${(attachment.size / 1024).toFixed(1)} KB)</p>
        </div>
      </div>
    `;
                }

                return `
      <div style="page-break-after: always;">
        <h1 style="text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8pt;">
          Attachment - ${attachment.name}
        </h1>
        <p style="margin-top: 12pt;">
          <strong>File:</strong> ${attachment.name}
        </p>
        <p>
          <strong>Type:</strong> ${attachment.type}
        </p>
        <p>
          <strong>Size:</strong> ${(attachment.size / 1024).toFixed(1)} KB
        </p>
      </div>
    `;
            })
            .join("");

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
          <div style="text-align: center; margin-bottom: 24pt;">
            <h1 style="border: none; font-size: 24pt; margin-bottom: 6pt;">
              CASE FILE
            </h1>
            <p style="font-size: 14pt;">Recovery of Money</p>
          </div>
          ${sections}
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
