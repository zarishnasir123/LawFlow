import * as mammoth from "mammoth";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/react";
import type { CompiledCaseBundle } from "../../lawyer/types/caseFiling";
import { useDocumentEditorStore } from "../../lawyer/store/documentEditor.store";
import { AttachmentBlock } from "../../lawyer/extensions/AttachmentBlock";
import { ImageAttachment } from "../../lawyer/extensions/ImageAttachment";

type OpenSubmittedCaseFileOptions = {
  caseId: string;
  caseTitle: string;
  fallbackBundle?: CompiledCaseBundle;
};

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

function resolveTemplateUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

function openHtmlInNewWindow(title: string, bodyHtml: string): boolean {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) return false;

  previewWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Complete Case File - ${title}</title>
        <style>
          body {
            margin: 0;
            padding: 28px;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #f8fafc;
          }
          .header {
            margin-bottom: 20px;
            border: 1px solid #d1fae5;
            background: #ecfdf5;
            border-radius: 12px;
            padding: 14px 16px;
          }
          .header h1 {
            margin: 0;
            font-size: 22px;
            color: #064e3b;
          }
          .header p {
            margin: 8px 0 0;
            font-size: 13px;
            color: #065f46;
          }
          .section {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 14px;
          }
          .section h2 {
            margin: 0 0 10px;
            font-size: 17px;
            color: #111827;
          }
          .meta {
            margin-bottom: 10px;
            color: #6b7280;
            font-size: 12px;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
          }
          iframe {
            width: 100%;
            min-height: 720px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #fff;
          }
          .empty {
            color: #6b7280;
            font-size: 14px;
          }
          ul {
            margin: 0;
            padding-left: 18px;
          }
          li {
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Complete Case File</h1>
          <p>${title}</p>
        </div>
        ${bodyHtml}
      </body>
    </html>
  `);
  previewWindow.document.close();
  return true;
}

export async function openSubmittedCaseFile({
  caseId,
  caseTitle,
  fallbackBundle,
}: OpenSubmittedCaseFileOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    useDocumentEditorStore.getState().loadDraft(caseId);
    const editorState = useDocumentEditorStore.getState();

    const {
      bundleItems,
      documentsById,
      attachmentsById,
      attachments,
      documentContents,
    } = editorState;

    const hasWorkspaceBundle = bundleItems.length > 0;

    if (!hasWorkspaceBundle) {
      const fallbackHtml = fallbackBundle
        ? `
            <div class="section">
              <h2>Checklist</h2>
              <ul>
                ${fallbackBundle.orderedDocuments
                  .map(
                    (doc, index) =>
                      `<li>${index + 1}. ${doc.title} (${doc.signedRequired ? (doc.signedCompleted ? "Signed" : "Signature pending") : "No signature required"})</li>`
                  )
                  .join("")}
              </ul>
            </div>
            <div class="section">
              <h2>Evidence</h2>
              ${
                fallbackBundle.evidenceFiles.length
                  ? `<ul>${fallbackBundle.evidenceFiles
                      .map((file) => `<li>${file.title}</li>`)
                      .join("")}</ul>`
                  : `<p class="empty">No evidence attached.</p>`
              }
            </div>
          `
        : `<div class="section"><p class="empty">No case file content available for preview.</p></div>`;

      const opened = openHtmlInNewWindow(caseTitle, fallbackHtml);
      if (!opened) {
        return {
          ok: false,
          error: "Popup blocked. Please allow popups to open the complete case file.",
        };
      }
      return { ok: true };
    }

    const getAttachment = (attachmentId: string) =>
      attachmentsById[attachmentId] ||
      attachments.find((attachment) => attachment.id === attachmentId);

    const resolveDocHtmlAsync = async (docId: string) => {
      const doc = documentsById[docId];
      if (doc?.contentJSON) {
        return generateHTML(doc.contentJSON as JSONContent, exportExtensions);
      }
      if (doc?.legacyHtml) return doc.legacyHtml;
      if (documentContents[docId]) return documentContents[docId];
      if (!doc?.url) return "<p class='empty'>Document content is not available.</p>";

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
        return converted.value || "<p class='empty'>Unable to render this document.</p>";
      } catch {
        return "<p class='empty'>Unable to load this document in preview.</p>";
      }
    };

    const sections: string[] = [];
    for (const item of bundleItems) {
      if (item.type === "DOC") {
        const html = await resolveDocHtmlAsync(item.refId);
        sections.push(`
          <section class="section">
            <h2>${item.title}</h2>
            ${html}
          </section>
        `);
        continue;
      }

      const attachment = getAttachment(item.refId);
      if (!attachment) continue;
      const isImage = attachment.type.startsWith("image/");
      const isPdf = attachment.type.includes("pdf");

      if (isImage) {
        sections.push(`
          <section class="section">
            <h2>${attachment.name}</h2>
            <div class="meta">Image Attachment</div>
            <img src="${attachment.url}" alt="${attachment.name}" />
          </section>
        `);
        continue;
      }

      if (isPdf) {
        sections.push(`
          <section class="section">
            <h2>${attachment.name}</h2>
            <div class="meta">PDF Attachment</div>
            <iframe src="${attachment.url}" title="${attachment.name}"></iframe>
          </section>
        `);
        continue;
      }

      sections.push(`
        <section class="section">
          <h2>${attachment.name}</h2>
          <div class="meta">Attachment</div>
          <p class="empty">Preview is unavailable for this file type.</p>
        </section>
      `);
    }

    const opened = openHtmlInNewWindow(caseTitle, sections.join(""));
    if (!opened) {
      return {
        ok: false,
        error: "Popup blocked. Please allow popups to open the complete case file.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Unable to open complete case file preview right now.",
    };
  }
}
