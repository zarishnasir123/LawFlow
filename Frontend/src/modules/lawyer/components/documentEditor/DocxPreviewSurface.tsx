import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { renderAsync } from "docx-preview";
import { rehydrateFloatingImages } from "../../utils/floatingImage";

interface DocxPreviewSurfaceProps {
  // The raw .docx bytes fetched from the backend. We deliberately accept
  // a fresh ArrayBuffer (not Uint8Array / Blob) so the rendering stays
  // pinned to a single source of truth — re-passing the same buffer
  // re-renders, which matches the rest of our editor's React semantics.
  arrayBuffer: ArrayBuffer | null;
  // Previously-saved HTML snapshot for this case (cases.edited_html on
  // the backend). When present, we restore *this* instead of re-rendering
  // the pristine .docx — otherwise the lawyer's edits silently vanish
  // on page refresh. The snapshot already carries docx-preview's
  // per-page styles inside the snapshot HTML, so the restored view
  // matches what they last saw byte-for-byte (page sizes, fonts, table
  // borders, justify). null/empty means "render the .docx bytes".
  editedHtml?: string | null;
  isLoading: boolean;
  // Fired once docx-preview finishes rendering. The caller uses this to
  // build the page navigator sidebar from the actual rendered DOM —
  // page count is a property of the *rendered* document, not the
  // .docx file, because pagination depends on page size + fonts.
  onPagesReady?: (pages: HTMLElement[]) => void;
  // When true, content inside each rendered page becomes editable —
  // lawyer can click to position a caret, type to replace placeholders
  // like "[insert court city]", and use Ctrl+B / Ctrl+I / Ctrl+U for
  // bold / italic / underline.
  editable?: boolean;
  // Called when the lawyer drops a sidebar PNG/JPG attachment onto a
  // page. The handler receives the refId of the dragged attachment
  // plus the drop coordinates so it can position the floating image
  // exactly where the lawyer let go.
  onImageDropped?: (refId: string, clientX: number, clientY: number) => void;
  // Fired when the lawyer right-clicks any rendered <section.docx>.
  // The parent uses this to position a custom context menu at
  // (x, y). Matches the same callback shape DocumentPagesPanel uses
  // for sidebar rows so the parent can route both to one handler.
  onPageContextMenu?: (pageIndex: number, x: number, y: number) => void;
  // Map of attachmentId → fresh signed URL. After restoring a saved
  // HTML snapshot, the floating-image <img src> values are still
  // pointing at last session's signed URLs (which expire in an hour).
  // We use this map to rewrite each wrapper's inner <img> to a fresh
  // URL keyed by its data-attachment-id, so refreshes survive past
  // the original URL's TTL.
  attachmentUrlMap?: Record<string, string>;
}

export default function DocxPreviewSurface({
  arrayBuffer,
  editedHtml,
  isLoading,
  onPagesReady,
  editable = false,
  onImageDropped,
  onPageContextMenu,
  attachmentUrlMap,
}: DocxPreviewSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Visual drop-zone feedback while a sidebar image is being dragged
  // over the editor. Native HTML5 drag events fire many times per
  // second — we just flip a boolean and let the JSX overlay handle
  // the rest. dragLeave is intentionally not used (it fires when the
  // pointer crosses any child element); we reset on drop and on
  // dragend via the window-level listener below.
  const [isDragOver, setIsDragOver] = useState(false);

  // Rewrite every floating-image's <img src> to the fresh signed URL
  // keyed by its data-attachment-id. Runs whenever the parent passes
  // a new attachmentUrlMap (initial fetch lands after mount; the user
  // may also re-open the case past the previous URL's TTL). The
  // rewrite is a no-op when src already matches, so this is cheap.
  // Decoupled from the main render effect so a slow attachments fetch
  // doesn't re-trigger the docx-preview render.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !attachmentUrlMap) return;
    const wrappers = container.querySelectorAll<HTMLSpanElement>(
      ".lawflow-floating-image[data-attachment-id]"
    );
    wrappers.forEach((wrapper) => {
      const id = wrapper.getAttribute("data-attachment-id");
      if (!id) return;
      const freshUrl = attachmentUrlMap[id];
      if (!freshUrl) return;
      const img = wrapper.querySelector("img");
      if (img && img.getAttribute("src") !== freshUrl) {
        img.setAttribute("src", freshUrl);
      }
    });
  }, [attachmentUrlMap, editedHtml]);
  // onPagesReady is stored in a ref so we don't re-run the render effect
  // when the parent's callback identity changes — only re-render when the
  // bytes themselves change.
  const onPagesReadyRef = useRef(onPagesReady);
  useEffect(() => {
    onPagesReadyRef.current = onPagesReady;
  }, [onPagesReady]);

  // Keep the latest context-menu callback on a ref so the per-section
  // listeners attached inside the render effect stay stable. Without
  // this, every parent re-render would replace the listener and we'd
  // leak stale closures.
  const onPageContextMenuRef = useRef(onPageContextMenu);
  useEffect(() => {
    onPageContextMenuRef.current = onPageContextMenu;
  }, [onPageContextMenu]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!arrayBuffer && !editedHtml) return;

    const container = containerRef.current;
    // Wipe any previous render before doing a fresh one — docx-preview
    // appends styles + content into the container and doesn't manage
    // its own teardown across re-renders.
    container.innerHTML = "";

    let cancelled = false;

    // Saved-snapshot fast path. If the case row has an editedHtml
    // snapshot, restore *that* — it's exactly what the lawyer last
    // saw (docx-preview's injected styles + the .docx-wrapper) and
    // includes every edit the user has made. Without this branch
    // refreshing the page would silently wipe their work back to the
    // pristine template.
    if (editedHtml) {
      try {
        const parsed = new DOMParser().parseFromString(
          editedHtml,
          "text/html"
        );
        // We clone *only* the .docx-wrapper because docx-preview keeps
        // its per-document styles (page size, fonts, table borders,
        // theme colors) as <style> tags INSIDE the wrapper — those
        // come along for free with cloneNode(true). Skipping the head
        // styles is intentional: the snapshot also embeds the
        // standalone-viewer framing CSS (body margins, gray page
        // background) which fights this editor's own JSX <style>
        // paper-on-desk styling and produces a flat / borderless look
        // on restore. The editor's framing is already in the DOM, so
        // copying head styles would just duplicate-and-clobber it.
        const wrapper = parsed.body.querySelector(".docx-wrapper");
        if (wrapper) {
          container.appendChild(wrapper.cloneNode(true));
        }

        const pages = container.querySelectorAll<HTMLElement>(
          ".docx-wrapper > section.docx"
        );

        // Honour the editable contract in BOTH directions. The saved
        // snapshot (cases.edited_html) was captured while the editor had
        // each section contenteditable, so `contenteditable="true"` is
        // baked into the restored HTML — a read-only surface (e.g. the
        // submission preview) must explicitly turn it OFF, or the restored
        // pages stay editable.
        pages.forEach((page) => {
          page.setAttribute("contenteditable", editable ? "true" : "false");
          page.setAttribute("spellcheck", "false");
          page.style.outline = "none";
        });

        pages.forEach((page, idx) => {
          page.addEventListener("contextmenu", (e) => {
            const cb = onPageContextMenuRef.current;
            if (!cb) return;
            e.preventDefault();
            cb(idx, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
          });
        });

        // Re-wire drag / resize on floating images that came back from the
        // snapshot. The DOM nodes survived serialization but their
        // imperative mousedown listeners didn't. Only in editable mode — a
        // read-only preview must leave attachment images static (no drag /
        // resize / delete). Idempotent, so re-renders are safe.
        if (editable) {
          rehydrateFloatingImages(container);
        }

        onPagesReadyRef.current?.(Array.from(pages));
      } catch (err) {
        console.error("[DocxPreview] snapshot restore failed:", err);
      }
      return () => {
        cancelled = true;
      };
    }

    renderAsync(arrayBuffer!, container, undefined, {
      // breakPages honours Word's <w:lastRenderedPageBreak/> markers
      // and renders each page as a separately-sized <section class="docx">.
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
        const pages = container.querySelectorAll<HTMLElement>(
          ".docx-wrapper > section.docx"
        );

        pages.forEach((page) => {
          page.setAttribute("contenteditable", editable ? "true" : "false");
          page.setAttribute("spellcheck", "false");
          page.style.outline = "none";
        });

        // Wire each rendered section as a right-click target. The
        // index here matches what the sidebar uses, so the parent
        // can route both surfaces to the same context-menu handler.
        // Reading from the ref keeps the listener stable across
        // parent re-renders.
        pages.forEach((page, idx) => {
          page.addEventListener("contextmenu", (e) => {
            const cb = onPageContextMenuRef.current;
            if (!cb) return;
            e.preventDefault();
            cb(idx, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
          });
        });

        onPagesReadyRef.current?.(Array.from(pages));
      })
      .catch((err) => {
        console.error("[DocxPreview] render failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [arrayBuffer, editedHtml, editable]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Loading document…
      </div>
    );
  }

  if (!arrayBuffer && !editedHtml) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        No document loaded
      </div>
    );
  }

  // The drag-over / drop handlers accept image attachments dragged from
  // the sidebar. We key off the custom "application/x-lawflow-image"
  // MIME type so OS-level drag-and-drop (text, links, files) doesn't
  // accidentally trigger our drop logic.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onImageDropped) return;
    if (!e.dataTransfer.types.includes("application/x-lawflow-image")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  // dragleave fires whenever the pointer crosses a child boundary, so
  // we only reset state when it leaves the scroll container entirely.
  // relatedTarget === null OR not contained inside currentTarget means
  // the cursor genuinely left the editor area.
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDragOver) return;
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onImageDropped) {
      setIsDragOver(false);
      return;
    }
    const raw = e.dataTransfer.getData("application/x-lawflow-image");
    if (!raw) {
      setIsDragOver(false);
      return;
    }
    e.preventDefault();
    setIsDragOver(false);
    try {
      const { refId } = JSON.parse(raw) as { refId?: string };
      if (refId) {
        onImageDropped(refId, e.clientX, e.clientY);
      }
    } catch (err) {
      console.error("[DocxPreview] bad drag payload", err);
    }
  };

  return (
    // The container scrolls — docx-preview renders fixed-size A4/Letter
    // pages, so we let them sit in a centered scroll area like Word does.
    // Slightly darker bg (gray-200) so the white pages read as paper-on-
    // desk; matches Google Docs' editing canvas tone.
    <div
      className="relative h-full overflow-auto bg-[#f8f9fa] py-10"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop-zone overlay — appears only while an image attachment
          is being dragged. Sticky position so it stays in view even
          if the lawyer is mid-scroll on a long document. Background
          stays partly transparent so the lawyer can see exactly which
          page they're about to drop onto. pointer-events: none lets
          the drag/drop events still hit the underlying surface. */}
      {isDragOver && onImageDropped ? (
        <div
          aria-hidden
          className="pointer-events-none sticky top-4 z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--primary)] bg-white/95 px-5 py-3 text-sm font-semibold text-[var(--primary)] shadow-lg backdrop-blur"
        >
          <ImagePlus className="h-5 w-5" />
          Drop to place image on this page
        </div>
      ) : null}
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
          /* Google Docs-style paper shadow — soft, slightly lifted */
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.15),
                      0 4px 8px rgba(60, 64, 67, 0.08) !important;
          margin-bottom: 32px !important;
          border: none !important;
          outline: none !important;
          border-radius: 0;
        }
        .docx-preview-host .docx-wrapper > section.docx::before,
        .docx-preview-host .docx-wrapper > section.docx::after {
          display: none !important;
        }
        /* Subtle focus ring so the lawyer sees which page the caret is in */
        .docx-preview-host .docx-wrapper > section.docx:focus-within {
          box-shadow: 0 0 0 2px var(--primary), 0 1px 3px rgba(0, 0, 0, 0.08) !important;
        }
        /* Floating image — Word's "In Front of Text" positioning.
           Hovering shows a thin primary-color outline + the four
           corner resize handles. Selected (last clicked) image stays
           outlined even after the lawyer moves their mouse away. */
        .lawflow-floating-image {
          outline: 1px solid transparent;
          transition: outline-color 0.15s ease;
        }
        .lawflow-floating-image:hover,
        .lawflow-floating-image.lawflow-floating-image-selected {
          outline: 1.5px solid var(--primary);
        }
        .lawflow-resize-handle {
          position: absolute;
          width: 10px;
          height: 10px;
          background: var(--primary);
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 1px rgba(1, 65, 28, 0.2);
          opacity: 0;
          transition: opacity 0.15s ease;
          z-index: 2;
        }
        .lawflow-floating-image:hover .lawflow-resize-handle,
        .lawflow-floating-image-selected .lawflow-resize-handle {
          opacity: 1;
        }
        /* Corner positions + cursors. The cursor classes (nwse / nesw)
           are the standard "double-headed diagonal arrow" the browser
           draws for resize affordances. */
        .lawflow-resize-handle-nw { top: -6px; left: -6px;  cursor: nwse-resize; }
        .lawflow-resize-handle-ne { top: -6px; right: -6px; cursor: nesw-resize; }
        .lawflow-resize-handle-sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
        .lawflow-resize-handle-se { bottom: -6px; right: -6px; cursor: nwse-resize; }
        /* Delete affordance — red circle with white X just outside
           the top-right corner. Same hover/select gating as the
           resize handles so it doesn't clutter the page when the
           lawyer isn't actively working with an image. */
        .lawflow-image-delete {
          position: absolute;
          top: -10px;
          right: -10px;
          width: 20px;
          height: 20px;
          padding: 0;
          background: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .lawflow-floating-image:hover .lawflow-image-delete,
        .lawflow-floating-image-selected .lawflow-image-delete {
          opacity: 1;
        }
        .lawflow-image-delete:hover {
          background: #dc2626;
          transform: scale(1.08);
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
