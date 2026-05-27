import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  CalendarClock,
  CheckCircle2,
  FileSignature,
  GripVertical,
  Loader2,
  MousePointer2,
  Pencil,
  Type as TypeIcon,
  Upload,
} from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import {
  filterSnapshotToPages,
  mySignaturesApi,
  type ApiSignatureRequestDetail,
  type SignaturePlacement,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";
// Reusing the lawyer editor's floating-image utility — same drag/resize/
// select gestures the lawyer uses for image attachments are what we want
// for placing a signature on the page. Cross-module import is fine; this
// helper has no React/lawyer-store coupling, it just attaches DOM
// listeners to an HTMLElement.
import { mountFloatingImage } from "../../lawyer/utils/floatingImage";

// =====================================================================
// Client signing viewer (FE-6).
//
// Direct-render mode: the lawyer's HTML snapshot is mounted into a real
// div (not an iframe) so we can drop the signature ON TOP of the page
// as a draggable / resizable floating element, exactly like the editor
// does with image attachments. When the client submits, we capture both
// the signature PNG and its placement as page-relative percentages so
// Phase 2's PDF compile can embed at the same spot.
//
// Trust note: we use dangerouslySetInnerHTML on the snapshot. The HTML
// originates from the lawyer's editor (docx-preview output + our own
// framing CSS) — no script tags ever pass through. The trade-off vs
// the previous iframe is that we accept the lawyer as a trusted source
// in exchange for drag-on-paper UX.
// =====================================================================

type SignMode = "type" | "upload";

// Cursive signature fonts shipped via Google Fonts. Loaded once per
// page load via a <link> the component injects. The font-family value
// is what we pass to the canvas ctx.font, with serif fallback.
const SIGNATURE_FONTS = [
  { id: "dancing", label: "Dancing Script", family: "'Dancing Script', cursive" },
  { id: "great-vibes", label: "Great Vibes", family: "'Great Vibes', cursive" },
  { id: "sacramento", label: "Sacramento", family: "'Sacramento', cursive" },
  { id: "allura", label: "Allura", family: "'Allura', cursive" },
] as const;

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&family=Great+Vibes&family=Sacramento&family=Allura&display=swap";

function ensureSignatureFontsLoaded() {
  if (typeof document === "undefined") return;
  if (document.getElementById("lawflow-signature-fonts")) return;
  const link = document.createElement("link");
  link.id = "lawflow-signature-fonts";
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
}

// Render a typed name onto a transparent canvas in the chosen font and
// return as PNG data URL. Transparent so it composites cleanly over
// the page background.
function createTypedSignatureDataUrl(name: string, fontFamily: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#01411C";
  ctx.font = `60px ${fontFamily}`;
  ctx.textBaseline = "middle";
  // Center vertically; leave a small left margin.
  ctx.fillText(name, 16, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ClientSignatureViewer() {
  const navigate = useNavigate();
  const { requestId } = useParams({ strict: false }) as { requestId?: string };
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Container the snapshot HTML is injected into. We don't use React's
  // children for the snapshot because docx-preview's serialized output
  // contains attributes (e.g., style with vendor prefixes) that React's
  // reconciler would warn about.
  const documentHostRef = useRef<HTMLDivElement>(null);
  // The currently-mounted floating signature wrapper. Tracked so:
  //   - subsequent signature changes replace the old one rather than stacking
  //   - submit can read its final position/size and the page it sits on
  const floatingRef = useRef<HTMLSpanElement | null>(null);

  const [request, setRequest] = useState<ApiSignatureRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<SignMode>("type");
  const [typedName, setTypedName] = useState("");
  const [fontId, setFontId] = useState<(typeof SIGNATURE_FONTS)[number]["id"]>(
    "dancing"
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  // Drop-zone visual feedback while the user is dragging the preview
  // from the sidebar over the document area.
  const [isDragOver, setIsDragOver] = useState(false);
  // True once the signature has been placed on a page. Drives the
  // submit button enablement and the helper copy.
  const [hasPlaced, setHasPlaced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccessfully, setSignedSuccessfully] = useState(false);

  useEffect(() => {
    ensureSignatureFontsLoaded();
  }, []);

  useEffect(() => {
    if (!requestId) {
      setError("No signature request selected.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    mySignaturesApi
      .getOne(requestId)
      .then((data) => {
        if (!cancelled) setRequest(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getMySignaturesErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const filteredSnapshot = useMemo(
    () =>
      request
        ? filterSnapshotToPages(request.documentHtmlSnapshot, request.pageIndices)
        : "",
    [request]
  );

  // Inject the snapshot HTML into the host once the request loads.
  useEffect(() => {
    const host = documentHostRef.current;
    if (!host || !filteredSnapshot) return;
    // The snapshot is a full <!doctype html>...</html> document. We
    // strip down to the inner body content so it sits inside our
    // viewer chrome. Stylesheets in the snapshot's <head> get injected
    // into our document head so docx-preview's per-page CSS applies.
    const parsed = new DOMParser().parseFromString(filteredSnapshot, "text/html");
    // Move <style> tags from the parsed head into our host so the
    // wrapper-scoped CSS that docx-preview generated takes effect
    // without polluting the rest of the app.
    //
    // CRITICAL: strip any rule targeting bare `body` selectors before
    // injecting. The snapshot's viewer-framing CSS sets
    // `body { padding: 24px }` for when the snapshot renders
    // standalone in an iframe — but we're injecting INTO a host div,
    // so that rule leaks out and applies to OUR app's body, pushing
    // the green header down with a 24px gap above it. The regex below
    // wipes those rules without touching `.body-*` class selectors or
    // selectors like `tbody`.
    const styleHtml = Array.from(parsed.head.querySelectorAll("style"))
      .map((s) => s.outerHTML)
      .join("\n")
      .replace(/(^|[^.#:\w-])body\s*\{[^}]*\}/g, "$1");
    const bodyHtml = parsed.body.innerHTML;
    host.innerHTML = `${styleHtml}${bodyHtml}`;
  }, [filteredSnapshot]);

  // Live-render the typed signature into a canvas any time the name
  // or the chosen font changes. Stays in sync without an explicit
  // "regenerate" button.
  useEffect(() => {
    if (mode !== "type") return;
    const trimmed = typedName.trim();
    if (!trimmed) {
      setSignatureDataUrl(null);
      return;
    }
    const font = SIGNATURE_FONTS.find((f) => f.id === fontId);
    if (!font) return;
    // Wait one tick for the Google Fonts to load — first paint may use
    // serif fallback, then re-render. document.fonts.ready resolves
    // once the requested faces are available.
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      setSignatureDataUrl(createTypedSignatureDataUrl(trimmed, font.family));
    };
    if (typeof document !== "undefined" && "fonts" in document) {
      (document as Document & {
        fonts: { ready: Promise<unknown> };
      }).fonts.ready.then(render).catch(render);
    } else {
      render();
    }
    return () => {
      cancelled = true;
    };
  }, [mode, typedName, fontId]);

  // When the signature data URL changes (re-type, new upload), drop
  // any existing on-document placement. The user re-drags the new
  // preview onto a page to position it. This sidesteps the previous
  // "auto-mount on first page bottom-right" UX which the user found
  // confusing — now the placement is always explicit.
  useEffect(() => {
    if (!signatureDataUrl) return;
    if (floatingRef.current && floatingRef.current.parentElement) {
      floatingRef.current.remove();
      floatingRef.current = null;
      setHasPlaced(false);
    }
  }, [signatureDataUrl]);

  // Drag-from-sidebar onto the document. Uses a custom MIME type so
  // OS-level image drags (e.g., a JPEG dragged from the desktop)
  // don't accidentally trigger our placement logic. Mirrors the
  // lawyer-editor's attachment drag-drop UX.
  const handlePreviewDragStart = (e: React.DragEvent<HTMLImageElement>) => {
    if (!signatureDataUrl) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/x-lawflow-signature", "1");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDocumentDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!signatureDataUrl) return;
    if (!e.dataTransfer.types.includes("application/x-lawflow-signature")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDocumentDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDragOver) return;
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) setIsDragOver(false);
  };

  const handleDocumentDrop = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    if (!signatureDataUrl) return;
    if (!e.dataTransfer.types.includes("application/x-lawflow-signature")) return;
    e.preventDefault();

    // Find which page the drop landed on. elementFromPoint gives the
    // topmost element under the cursor; closest("section.docx") walks
    // up to the page container.
    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    const page = elementAtPoint?.closest("section.docx") as HTMLElement | null;
    if (!page) return;

    // Translate viewport coords → page-relative. Center the signature
    // on the drop point so the cursor feels like it dropped the
    // middle of the preview, not the top-left.
    const pageRect = page.getBoundingClientRect();
    const defaultWidth = Math.min(260, pageRect.width * 0.4);
    const defaultHeight = defaultWidth * (140 / 600); // canvas aspect (600x140)
    const left = Math.max(0, e.clientX - pageRect.left - defaultWidth / 2);
    const top = Math.max(0, e.clientY - pageRect.top - defaultHeight / 2);

    // Replace any previously-mounted signature so dragging again
    // moves the placement instead of stacking copies.
    if (floatingRef.current && floatingRef.current.parentElement) {
      floatingRef.current.remove();
      floatingRef.current = null;
    }

    floatingRef.current = mountFloatingImage({
      src: signatureDataUrl,
      alt: "Signature",
      page,
      left,
      top,
      width: defaultWidth,
    });
    setHasPlaced(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a PNG or JPG image of your signature.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSignatureDataUrl(dataUrl);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  // Read the floating signature's final position + size + which page
  // it ended up on. Returns null if the signature was never placed.
  const computePlacement = (): SignaturePlacement | null => {
    if (!floatingRef.current || !request) return null;
    const wrapper = floatingRef.current;
    const page = wrapper.parentElement as HTMLElement | null;
    if (!page) return null;
    const pageWidth = page.clientWidth || 1;
    const pageHeight = page.clientHeight || 1;
    const left = parseFloat(wrapper.style.left) || 0;
    const top = parseFloat(wrapper.style.top) || 0;
    const width = wrapper.offsetWidth;
    const height = wrapper.offsetHeight;

    // Figure out the ABSOLUTE page index in the original document.
    // The filtered snapshot only contains the assigned pages, so the
    // order of section.docx elements maps 1:1 to request.pageIndices.
    const host = documentHostRef.current;
    if (!host) return null;
    const sections = Array.from(
      host.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
    );
    const sectionIdx = sections.indexOf(page);
    if (sectionIdx < 0) return null;
    const absolutePageIndex =
      request.pageIndices && request.pageIndices[sectionIdx] !== undefined
        ? request.pageIndices[sectionIdx]
        : sectionIdx;

    return {
      pageIndex: absolutePageIndex,
      xPct: left / pageWidth,
      yPct: top / pageHeight,
      widthPct: width / pageWidth,
      heightPct: height / pageHeight,
    };
  };

  const handleSubmit = async () => {
    if (!requestId || !signatureDataUrl) return;
    const placement = computePlacement();
    setSubmitting(true);
    setError(null);
    try {
      await mySignaturesApi.submit(requestId, signatureDataUrl, placement);
      setSignedSuccessfully(true);
    } catch (err) {
      setError(getMySignaturesErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ClientLayout brandSubtitle="Sign Document">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading signature request…
        </div>
      </ClientLayout>
    );
  }

  if (error && !request) {
    return (
      <ClientLayout brandSubtitle="Sign Document">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
          <div className="mt-3">
            <button
              onClick={() => navigate({ to: "/case-tracking" })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Back to pending signatures
            </button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (!request) return null;

  if (signedSuccessfully) {
    return (
      <ClientLayout brandSubtitle="Sign Document">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-lg font-semibold text-emerald-900">
            Signature submitted
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            Your signature has been recorded for {request.caseTitle}.
          </p>
          <button
            onClick={() => navigate({ to: "/case-tracking" })}
            className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Back to pending signatures
          </button>
        </div>
      </ClientLayout>
    );
  }

  const pageCount = request.pageIndices?.length || 0;

  return (
    // pageSubtitle shows the case title under the "LawFlow" brand
    // wordmark (same pattern the editor uses for "umar's property
    // case") so the header carries real context, not just a generic
    // "Sign Document" label. Back arrow returns to /case-tracking.
    <ClientLayout
      brandSubtitle="Sign Document"
      pageSubtitle={request.caseTitle}
      showBackButton
      onBackClick={() => navigate({ to: "/case-tracking" })}
      backLabel="Back to pending"
    >
      <div className="space-y-4">
        {/* Hero card — amber-tinted to match the /case-tracking
            pending signatures card, so the signing surface visually
            belongs to the same workflow. */}
        <header className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white via-amber-50/40 to-white p-6 shadow-[0_18px_45px_-32px_rgba(120,53,15,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <FileSignature className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Signature request
                </p>
                <h1 className="mt-1 text-lg font-semibold text-gray-900">
                  {request.caseTitle}
                </h1>
                <p className="mt-1 text-xs text-gray-600">
                  {pageCount} page{pageCount === 1 ? "" : "s"} need your signature.
                  Drag your signature from the panel onto the page, then submit.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              <CalendarClock className="h-3 w-3" />
              Pending Signature
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Document with the signature placed as a floating draggable.
              relative + onDragOver/onDrop turn this into a drop target
              for the signature preview being dragged from the sidebar. */}
          <div
            className={`relative rounded-xl border bg-[#f5f5f5] p-4 overflow-auto transition-colors ${
              isDragOver ? "border-amber-400" : "border-gray-200"
            }`}
            style={{ maxHeight: "82vh" }}
            onDragOver={handleDocumentDragOver}
            onDragLeave={handleDocumentDragLeave}
            onDrop={handleDocumentDrop}
          >
            {/* Drop-zone hint pill — appears at the top of the
                document area while the user is dragging the
                signature preview. Sticky so it stays in view if
                they scroll mid-drag. */}
            {isDragOver ? (
              <div
                aria-hidden
                className="pointer-events-none sticky top-2 z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400 bg-white/95 px-5 py-2.5 text-sm font-semibold text-amber-700 shadow-lg backdrop-blur"
              >
                <MousePointer2 className="h-4 w-4" />
                Drop on the page to place your signature
              </div>
            ) : null}
            {/* Styles for the floating signature wrapper + its corner
                resize handles. mountFloatingImage creates the elements
                but the editor owns the CSS — we duplicate the rules
                here so the signing viewer shows handles. Handles are
                ALWAYS visible (not just on hover) so first-time
                signers can see the resize affordance immediately. */}
            <style>{`
              .lawflow-floating-image {
                outline: 1.5px solid rgba(1, 65, 28, 0.5);
                transition: outline-color 0.15s ease;
              }
              .lawflow-floating-image:hover,
              .lawflow-floating-image.lawflow-floating-image-selected {
                outline: 2px solid #01411C;
              }
              .lawflow-resize-handle {
                position: absolute;
                width: 12px;
                height: 12px;
                background: #01411C;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 0 0 1px rgba(1, 65, 28, 0.25);
                opacity: 1;
                z-index: 2;
              }
              .lawflow-resize-handle-nw { top: -7px; left: -7px;  cursor: nwse-resize; }
              .lawflow-resize-handle-ne { top: -7px; right: -7px; cursor: nesw-resize; }
              .lawflow-resize-handle-sw { bottom: -7px; left: -7px; cursor: nesw-resize; }
              .lawflow-resize-handle-se { bottom: -7px; right: -7px; cursor: nwse-resize; }
            `}</style>
            <div
              ref={documentHostRef}
              // docx-preview-host class enables the floatingImage utility's
              // click-outside-to-deselect + Delete-to-remove keyboard
              // shortcuts (it walks up looking for this class).
              className="docx-preview-host"
            />
          </div>

          {/* Signing sidebar */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">
                Your signature
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {!signatureDataUrl
                  ? "Type your name or upload an image — then drag the preview onto the document."
                  : hasPlaced
                    ? "Placed on the document. Drag to reposition, or drag the preview again to move it."
                    : "Drag the preview below onto the page where you want to sign."}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("type")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                    mode === "type"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <TypeIcon className="h-3.5 w-3.5" />
                  Type
                </button>
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                    mode === "upload"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </button>
              </div>

              {mode === "type" ? (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    placeholder="Type your full name"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Style
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {SIGNATURE_FONTS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFontId(f.id)}
                          className={`rounded-md border px-2 py-2 text-center text-xs transition-colors ${
                            fontId === f.id
                              ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                          style={{
                            fontFamily: f.family,
                            fontSize: "18px",
                            color: "#01411C",
                            lineHeight: 1.2,
                          }}
                        >
                          {typedName.trim() || f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <Upload className="h-4 w-4" />
                    Choose image
                  </button>
                </div>
              )}

              {signatureDataUrl && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Drag onto document
                    </p>
                    {hasPlaced ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Placed
                      </span>
                    ) : null}
                  </div>
                  {/* Draggable signature preview. The cursor-grab +
                      GripVertical icon teach the affordance without
                      a separate tutorial. */}
                  <div className="mt-2 flex items-center gap-2 rounded-md border-2 border-dashed border-amber-200 bg-amber-50/40 p-3 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 flex-shrink-0 text-amber-700" />
                    <img
                      src={signatureDataUrl}
                      alt="Signature preview — drag onto document"
                      draggable
                      onDragStart={handlePreviewDragStart}
                      className="max-h-20 mx-auto select-none"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    Hold and drag the preview onto the page where you want to sign.
                  </p>
                </div>
              )}

              {error && (
                <p className="mt-3 text-xs text-red-700">{error}</p>
              )}

              {/* Submit is gated on actual placement — not just having a
                  preview — so the signer can't submit a signature that
                  was never dropped on a page. */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!signatureDataUrl || !hasPlaced || submitting}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Submit signature
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </ClientLayout>
  );
}
