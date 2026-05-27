import html2canvas from "html2canvas";

// Captures the rendered docx-preview sections (the visible pages) the
// signer was looking at, as PNG data URLs — one per page index.
//
// Why this exists: the prior signed-PDF compile re-rendered the
// snapshot HTML server-side via puppeteer, then overlaid the signature
// using fractional coordinates. Any subtle drift between the signer's
// browser layout and puppeteer's layout (font fallback, screen-vs-print
// media, line-height rounding) moved the surrounding text relative to
// the absolute-positioned signature → signature landed on the wrong
// line in the final PDF. Capturing the page on the CLIENT, with the
// signature floating wrapper already in the DOM, eliminates that drift
// entirely: the bytes the server stores are the bytes the signer
// approved.
//
// We capture one PNG per (section, absolute pageIndex). The caller
// passes the docx host element and the absolute page indices the
// signer is responsible for; we look up the corresponding section
// among `.docx-wrapper > section.docx` children. When the viewer has
// filtered the snapshot down to assigned-only pages, the sections
// array length === pageIndices.length and we map positionally.
export type CapturedPage = {
  pageIndex: number;
  // PNG data URL — kept as base64 for trivial server-side embedding via
  // pdf-lib's embedPng(). 96 DPI capture keeps payloads reasonable
  // (~150-300 KB per A4 page) while still printing crisply on screen
  // and at 100% PDF zoom.
  imageDataUrl: string;
};

// Editor chrome on the floating signature wrapper (outline ring,
// corner resize dots, red delete X) is visible interactive UI — useful
// while placing the signature, but it must NOT appear in the captured
// PNG that ends up in the final signed PDF. We temporarily inject a
// global style rule that hides every chrome class for the duration of
// the capture, then remove it. Doing this in CSS rather than per-node
// inline styles avoids stomping any inline display values we'd then
// have to restore.
const HIDE_CHROME_STYLE_ID = "lawflow-hide-signature-chrome";
const HIDE_CHROME_CSS = `
  .lawflow-floating-image { outline: none !important; }
  .lawflow-resize-handle,
  .lawflow-image-delete { display: none !important; }
`;

function installChromeHider() {
  if (document.getElementById(HIDE_CHROME_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIDE_CHROME_STYLE_ID;
  style.textContent = HIDE_CHROME_CSS;
  document.head.appendChild(style);
}

function removeChromeHider() {
  document.getElementById(HIDE_CHROME_STYLE_ID)?.remove();
}

export async function captureSignedPages(
  host: HTMLElement,
  pageIndices: number[]
): Promise<CapturedPage[]> {
  const sections = Array.from(
    host.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
  );
  if (sections.length === 0) return [];

  // If the viewer filtered the snapshot to just the assigned pages,
  // sections[i] corresponds to pageIndices[i] positionally. If we ever
  // change the viewer to show the full document, this needs revisiting
  // — but in that case the assertion below catches the mismatch.
  const limit = Math.min(sections.length, pageIndices.length);

  installChromeHider();
  try {
    const captures: CapturedPage[] = [];
    for (let i = 0; i < limit; i++) {
      const section = sections[i];
      // Pause briefly so a freshly-placed signature has had a paint
      // tick to settle — html2canvas reads computed styles, and a same-
      // frame capture can occasionally race the layout pass.
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const canvas = await html2canvas(section, {
        // Match the viewer's render DPR so the captured PNG is sharp
        // without bloating to absurd sizes.
        scale: Math.min(2, window.devicePixelRatio || 1),
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        // Defensive: ensure html2canvas re-reads computed styles for
        // every element rather than relying on inherited shortcuts.
        // Otherwise positioned descendants (our floating signature
        // wrapper) occasionally render with stale geometry.
        removeContainer: true,
      });
      captures.push({
        pageIndex: pageIndices[i],
        imageDataUrl: canvas.toDataURL("image/png"),
      });
    }
    return captures;
  } finally {
    removeChromeHider();
  }
}
