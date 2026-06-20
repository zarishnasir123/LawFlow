import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { renderAsync } from "docx-preview";

type CaseTemplatePreviewProps = {
  // The raw .docx bytes to render. Re-passing a new buffer re-renders.
  arrayBuffer: ArrayBuffer | null;
  isLoading: boolean;
  // Fired after a successful render with the number of rendered pages, so the
  // parent can show "N pages". Page count is a property of the *rendered*
  // document (pagination depends on page size + fonts), not the file.
  onPageCount?: (count: number) => void;
};

// Read-only, page-by-page Word renderer for the admin Templates page. Mirrors
// the lawyer editor's DocxPreviewSurface (same docx-preview options, same
// paper-on-desk look) but strips everything the admin doesn't need: no
// contenteditable, no floating images, no drag/drop. The admin just sees
// exactly what a lawyer would get.
export default function CaseTemplatePreview({
  arrayBuffer,
  isLoading,
  onPageCount,
}: CaseTemplatePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Keep the latest callback on a ref so the render effect only re-runs when
  // the bytes change, not when the parent's callback identity changes.
  const onPageCountRef = useRef(onPageCount);
  useEffect(() => {
    onPageCountRef.current = onPageCount;
  }, [onPageCount]);

  useEffect(() => {
    if (!containerRef.current || !arrayBuffer) return;

    const container = containerRef.current;
    // docx-preview appends into the container and doesn't tear down across
    // re-renders, so wipe the previous render first.
    container.innerHTML = "";

    let cancelled = false;

    renderAsync(arrayBuffer, container, undefined, {
      // breakPages honours Word's page-break markers and renders each page as
      // a separately-sized <section class="docx"> — same options the lawyer
      // editor uses, so the admin sees an identical layout.
      breakPages: true,
      inWrapper: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
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
        // Read-only: leave the rendered pages exactly as docx-preview produced
        // them (no contenteditable). Just count them for the caption.
        const pages = container.querySelectorAll<HTMLElement>(
          ".docx-wrapper > section.docx"
        );
        setRenderError(null);
        onPageCountRef.current?.(pages.length);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[CaseTemplatePreview] render failed:", err);
        setRenderError(
          "This file could not be previewed. Make sure it's a valid Word (.docx) document."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [arrayBuffer]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading document…
      </div>
    );
  }

  if (!arrayBuffer) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No document loaded
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-600">
        {renderError}
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-[#f8f9fa] py-8">
      {/* Tone down docx-preview's default chrome to a clean paper-on-desk look,
          matching the lawyer editor. */}
      <style>{`
        .docx-preview-host .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
        }
        .docx-preview-host .docx-wrapper > section.docx {
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.15),
                      0 4px 8px rgba(60, 64, 67, 0.08) !important;
          margin-bottom: 28px !important;
          border: none !important;
          outline: none !important;
          border-radius: 0;
        }
        .docx-preview-host .docx-wrapper > section.docx::before,
        .docx-preview-host .docx-wrapper > section.docx::after {
          display: none !important;
        }
      `}</style>
      <div ref={containerRef} className="docx-preview-host mx-auto" />
    </div>
  );
}
