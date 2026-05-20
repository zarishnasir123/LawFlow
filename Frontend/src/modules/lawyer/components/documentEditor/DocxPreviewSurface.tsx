import { useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";

interface DocxPreviewSurfaceProps {
  // The raw .docx bytes fetched from the backend. We deliberately accept
  // a fresh ArrayBuffer (not Uint8Array / Blob) so the rendering stays
  // pinned to a single source of truth — re-passing the same buffer
  // re-renders, which matches the rest of our editor's React semantics.
  arrayBuffer: ArrayBuffer | null;
  isLoading: boolean;
  // Fired once docx-preview finishes rendering. The caller uses this to
  // build the page navigator sidebar from the actual rendered DOM —
  // page count is a property of the *rendered* document, not the
  // .docx file, because pagination depends on page size + fonts.
  onPagesReady?: (pages: HTMLElement[]) => void;
  // When true, content inside each rendered page becomes editable —
  // lawyer can click to position a caret, type to replace placeholders
  // like "[insert court city]", and use Ctrl+B / Ctrl+I / Ctrl+U for
  // bold / italic / underline. Page borders + layout chrome stay
  // non-editable so the Word-style page shape is preserved.
  editable?: boolean;
}

export default function DocxPreviewSurface({
  arrayBuffer,
  isLoading,
  onPagesReady,
  editable = false,
}: DocxPreviewSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // onPagesReady is stored in a ref so we don't re-run the render effect
  // when the parent's callback identity changes — only re-render when the
  // bytes themselves change.
  const onPagesReadyRef = useRef(onPagesReady);
  useEffect(() => {
    onPagesReadyRef.current = onPagesReady;
  }, [onPagesReady]);

  useEffect(() => {
    if (!containerRef.current || !arrayBuffer) return;

    const container = containerRef.current;
    // Wipe any previous render before doing a fresh one — docx-preview
    // appends styles + content into the container and doesn't manage
    // its own teardown across re-renders.
    container.innerHTML = "";

    let cancelled = false;

    renderAsync(arrayBuffer, container, undefined, {
      // breakPages is the whole point of switching from mammoth → docx-preview:
      // it honours Word's <w:lastRenderedPageBreak/> markers and renders
      // each page as a separately-sized <section class="docx">.
      breakPages: true,
      // inWrapper keeps the rendered pages inside a single .docx-wrapper
      // element so we can query them as a group for the navigator.
      inWrapper: true,
      // Render headers/footers if the .docx defines them (our generated
      // templates don't yet, but this future-proofs the surface).
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      // Don't strip the .docx's own widths/heights — that's what makes the
      // result look like a real Word page rather than a flowing column.
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      // Embed images as data URLs so they render without a separate fetch.
      useBase64URL: true,
      className: "docx",
      trimXmlDeclaration: true,
      debug: false,
      experimental: false,
      ignoreLastRenderedPageBreak: false,
      hideWrapperOnPrint: false,
      renderChanges: false,
      renderComments: false,
      renderAltChunks: false,
    })
      .then(() => {
        if (cancelled) return;
        const pages = container.querySelectorAll<HTMLElement>(
          ".docx-wrapper > section.docx"
        );

        // Turn each rendered page into a Word-style editable surface.
        // We set contenteditable on the page itself (not the wrapper or
        // individual paragraphs) so the lawyer can click anywhere,
        // position a caret, and type — including across paragraphs and
        // through placeholder brackets like "[insert court city]".
        //
        // spellcheck off because legal documents are full of CNICs,
        // section references, and Latinate phrases that browser
        // spellcheckers love to underline in red.
        if (editable) {
          pages.forEach((page) => {
            page.setAttribute("contenteditable", "true");
            page.setAttribute("spellcheck", "false");
            // Suppress the focus outline browsers add by default for
            // contenteditable — the page already has its own border and
            // the outline looks out-of-place on a Word page.
            page.style.outline = "none";
          });
        }

        onPagesReadyRef.current?.(Array.from(pages));
      })
      .catch((err) => {
        console.error("[DocxPreview] render failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [arrayBuffer, editable]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Loading document…
      </div>
    );
  }

  if (!arrayBuffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        No document loaded
      </div>
    );
  }

  return (
    // The container scrolls — docx-preview renders fixed-size A4/Letter
    // pages, so we let them sit in a centered scroll area like Word does.
    <div className="h-full overflow-auto bg-gray-100 py-8">
      {/* Override docx-preview's default chrome:
          - It sets `background: gray` on .docx-wrapper which fights our
            own bg-gray-100 and produces the dark "frame" the user saw.
          - Its box-shadow looks like corner blots against gray; we tone
            it down to a soft drop shadow that reads as paper-on-desk.
          - Suppress any ::before / ::after the renderer adds — those
            were the L-shaped marks at each page corner. */}
      <style>{`
        .docx-preview-host .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
        }
        .docx-preview-host .docx-wrapper > section.docx {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          margin-bottom: 24px !important;
          border: none !important;
          outline: none !important;
          border-radius: 2px;
        }
        .docx-preview-host .docx-wrapper > section.docx::before,
        .docx-preview-host .docx-wrapper > section.docx::after {
          display: none !important;
        }
        /* Subtle focus ring so the lawyer sees which page the caret is in */
        .docx-preview-host .docx-wrapper > section.docx:focus-within {
          box-shadow: 0 0 0 2px var(--primary), 0 1px 3px rgba(0, 0, 0, 0.08) !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className="docx-preview-host mx-auto"
        // docx-preview will inject the .docx-wrapper and per-page styles
        // into this element. The "mx-auto" centers each page horizontally
        // within the scroll area.
      />
    </div>
  );
}
