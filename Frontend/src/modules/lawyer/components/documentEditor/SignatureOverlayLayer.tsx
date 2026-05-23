import { useEffect, useRef } from "react";

import type { ApiSignatureRequest } from "../../signatures/api/signatures.api";

// Read-only signature overlays for the lawyer's editor canvas.
//
// When the lawyer is editing a case that already has signed signature
// requests, each captured signature PNG is rendered as an absolutely-
// positioned <img> on the matching <section.docx> page at the exact
// fractional placement the signer chose (xPct/yPct/widthPct/heightPct
// from signature_placement). The overlays are non-interactive
// (pointer-events: none) so the lawyer can still edit text on other
// parts of the page; the signature sits on top of the contenteditable
// content like a sealed stamp.
//
// Lifecycle:
//   - On pages OR signatureRequests change, all overlays are torn
//     down and re-mounted. Cheap because there are only a handful per
//     case, and it avoids stale positions if signed_placements ever
//     change.
//   - Tracked via data-lawflow-signature-id so we only touch our own
//     overlays — any DOM the docx-preview renderer owns is untouched.

interface SignatureOverlayLayerProps {
  // Rendered DOM page elements from docx-preview. Same shape the
  // sidebar's PAGES panel consumes.
  pages: HTMLElement[];
  // The case's signed signature requests. Only rows with
  // status === 'signed', signature_image, AND signature_placement
  // produce an overlay.
  signedRequests: ApiSignatureRequest[];
}

const OVERLAY_DATA_ATTR = "data-lawflow-signature-id";

export default function SignatureOverlayLayer({
  pages,
  signedRequests,
}: SignatureOverlayLayerProps) {
  // Hold mounted DOM nodes outside of React's render tree because they
  // live INSIDE docx-preview-rendered pages, which React doesn't own.
  // The pattern mirrors mountFloatingImage in floatingImage.ts.
  const mountedRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    // Tear down any overlays from the previous render. We only touch
    // elements we tagged ourselves; the rest of the page DOM is
    // owned by docx-preview and stays untouched.
    mountedRef.current.forEach((node) => {
      node.remove();
    });
    mountedRef.current = [];

    if (pages.length === 0 || signedRequests.length === 0) return;

    const newNodes: HTMLImageElement[] = [];
    for (const req of signedRequests) {
      if (req.status !== "signed") continue;
      if (!req.signatureImage) continue;
      const placement = req.signaturePlacement;
      if (!placement) continue;

      const page = pages[placement.pageIndex];
      if (!page) continue;

      // Ensure the parent page is a positioning context. docx-preview
      // sections are usually `position: relative` already; this is a
      // defensive coerce in case a future version isn't.
      const computed = window.getComputedStyle(page);
      if (computed.position === "static") {
        page.style.position = "relative";
      }

      const img = document.createElement("img");
      img.src = req.signatureImage;
      img.alt = "Signature";
      img.setAttribute(OVERLAY_DATA_ATTR, req.id);
      img.style.position = "absolute";
      img.style.left = `${placement.xPct * 100}%`;
      img.style.top = `${placement.yPct * 100}%`;
      img.style.width = `${placement.widthPct * 100}%`;
      img.style.height = `${placement.heightPct * 100}%`;
      img.style.objectFit = "contain";
      // Non-interactive: lawyer can still click through to position the
      // caret in the underlying contenteditable text.
      img.style.pointerEvents = "none";
      // Sit above the page's text but below any future modal/overlay.
      img.style.zIndex = "5";
      img.draggable = false;

      page.appendChild(img);
      newNodes.push(img);
    }
    mountedRef.current = newNodes;

    return () => {
      mountedRef.current.forEach((node) => node.remove());
      mountedRef.current = [];
    };
  }, [pages, signedRequests]);

  // This component renders nothing itself — it just imperatively mounts
  // <img> nodes inside docx-preview's page DOM.
  return null;
}
