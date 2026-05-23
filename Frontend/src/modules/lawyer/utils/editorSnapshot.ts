// Shared editor-HTML snapshot helper.
//
// Used by:
//   1. SignatureRequestPanel — captures the document at "Send for
//      signature" time so the recipient sees what the lawyer was
//      looking at (frozen on the server as document_html_snapshot).
//   2. CaseDocumentEditor auto-save — same snapshot logic, but the
//      result is PUT to cases.edited_html so the case is restorable
//      across devices and survives a browser crash.
//
// The naive approach — concatenating pages.map(p => p.outerHTML) —
// loses the per-page A4 sizing, fonts, margins, and table styling
// that docx-preview injects as <style> tags in the host. The viewer
// would then render the document as wall-to-wall text with no page
// shapes. We pull docx-preview's injected stylesheets from the host
// along with the .docx-wrapper element so the snapshot carries
// everything the renderer set up. Viewer-side framing CSS is added
// so the pages sit centered on a soft gray background in any iframe.
export function buildEditorSnapshot(pages: HTMLElement[]): string {
  if (pages.length === 0) return "";
  const host =
    pages[0].closest(".docx-preview-host") ||
    pages[0].closest(".docx-wrapper")?.parentElement ||
    null;

  const injectedStyleHtml = host
    ? Array.from(host.querySelectorAll("style"))
        .map((s) => s.outerHTML)
        .join("\n")
    : "";

  const wrapper = pages[0].closest(".docx-wrapper");
  const bodyHtml = wrapper
    ? wrapper.outerHTML
    : `<div class="docx-wrapper">${pages
        .map((p) => p.outerHTML)
        .join("")}</div>`;

  // Viewer-side framing — pages sit on a gray paper-on-desk
  // background, matching the editor canvas. The !important overrides
  // defend against any leftover docx-preview wrapper styles that
  // would otherwise paint an L-shaped corner cropmark in viewer mode.
  const viewerFramingCss = `
    body { margin: 0; background: #f5f5f5; padding: 24px; font-family: 'Times New Roman', Times, serif; }
    .docx-wrapper { background: transparent !important; padding: 0 !important; }
    .docx-wrapper > section.docx {
      margin: 0 auto 24px !important;
      box-shadow: 0 1px 3px rgba(60, 64, 67, 0.15), 0 4px 8px rgba(60, 64, 67, 0.08) !important;
      border: none !important;
      outline: none !important;
    }
    .docx-wrapper > section.docx::before,
    .docx-wrapper > section.docx::after { display: none !important; }
  `;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Document snapshot</title>
${injectedStyleHtml}
<style>${viewerFramingCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
