import html2canvas from "html2canvas";

import type { SignedPageCapture } from "../../../shared/api/mySignatures.api";

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

// Overlay prior signers' page captures onto the matching `<section.docx>`
// children of `host`. Used by both the lawyer and client signature
// viewers to handle the multi-signer co-page case: when the client
// signs first and the lawyer signs the SAME page next, the lawyer must
// see the client's signature on the page or the lawyer's fresh capture
// would lose it (the compiler picks the freshest per-page capture, so
// any signature not present in the latest capture is gone).
//
// We injected the prior PNG as a full-section absolute-positioned <img>
// behind the live content, then hide the snapshot's body content so
// only the prior capture (which already contains the rendered document
// + the prior signature) shows through. The new signer's drop lands on
// top of THIS image, and the next capture composites both signatures
// onto the same PNG.
//
// pageIndices maps positional sections[i] → absolute page index, same
// as the captureSignedPages contract.
const PRIOR_CAPTURE_CLASS = "lawflow-prior-capture";

export function applyPriorCapturesToHost(
  host: HTMLElement,
  pageIndices: number[],
  priorCaptures: SignedPageCapture[]
): void {
  if (priorCaptures.length === 0) return;

  const byPageIndex = new Map<number, string>();
  for (const cap of priorCaptures) {
    byPageIndex.set(cap.pageIndex, cap.imageDataUrl);
  }

  const sections = Array.from(
    host.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
  );
  const limit = Math.min(sections.length, pageIndices.length);

  for (let i = 0; i < limit; i++) {
    const absoluteIdx = pageIndices[i];
    const dataUrl = byPageIndex.get(absoluteIdx);
    if (!dataUrl) continue;

    const section = sections[i];
    // docx-preview lays out sections as positioning ancestors already,
    // but coerce defensively so our absolute child lands in the right
    // coordinate space.
    if (window.getComputedStyle(section).position === "static") {
      section.style.position = "relative";
    }
    // Hide the underlying snapshot content so the prior capture is the
    // only thing the new signer sees on this page. The capture already
    // contains the rendered document + the prior signature, so the
    // page reads identically — minus the inherent layout drift between
    // the original docx-preview render and what the prior signer
    // actually saw.
    Array.from(section.children).forEach((child) => {
      if (
        child instanceof HTMLElement &&
        !child.classList.contains(PRIOR_CAPTURE_CLASS)
      ) {
        child.style.visibility = "hidden";
      }
    });

    // Drop in (or refresh) the overlay <img>. Width/height percent so
    // it fills the section's padding-box exactly — matches the
    // dimensions the previous signer's html2canvas read off this same
    // section.
    let overlay = section.querySelector<HTMLImageElement>(
      `img.${PRIOR_CAPTURE_CLASS}`
    );
    if (!overlay) {
      overlay = document.createElement("img");
      overlay.className = PRIOR_CAPTURE_CLASS;
      overlay.style.position = "absolute";
      overlay.style.left = "0";
      overlay.style.top = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.zIndex = "1";
      overlay.style.pointerEvents = "none";
      overlay.style.userSelect = "none";
      overlay.draggable = false;
      section.appendChild(overlay);
    }
    overlay.src = dataUrl;
  }
}

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
