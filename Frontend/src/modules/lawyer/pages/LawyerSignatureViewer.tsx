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

import LawyerLayout from "../components/LawyerLayout";
import {
  filterSnapshotToPages,
  mySignaturesApi,
  type ApiSignatureRequestDetail,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";
import { mountFloatingImage } from "../utils/floatingImage";
import {
  applyPriorCapturesToHost,
  captureSignedPages,
} from "../utils/capturePages";

// Lawyer self-signing viewer (FE-7) — see ClientSignatureViewer for the
// architecture comment. Same direct-render + floating-image flow,
// wrapped in LawyerLayout instead of ClientLayout.

type SignMode = "type" | "upload";

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

export default function LawyerSignatureViewer() {
  const navigate = useNavigate();
  const { requestId } = useParams({ strict: false }) as { requestId?: string };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentHostRef = useRef<HTMLDivElement>(null);
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
  // Drag-from-sidebar UX state. isDragOver drives the drop-zone
  // overlay; hasPlaced gates the submit button so the lawyer can't
  // submit a signature that never landed on a page.
  const [isDragOver, setIsDragOver] = useState(false);
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

  useEffect(() => {
    const host = documentHostRef.current;
    if (!host || !filteredSnapshot) return;
    const parsed = new DOMParser().parseFromString(filteredSnapshot, "text/html");
    // Strip bare `body { ... }` rules from the snapshot's stylesheets
    // before injection. The snapshot's viewer-framing CSS sets
    // `body { padding: 24px }` for standalone-iframe rendering, but
    // here we're injecting INTO a host div, so that rule would leak
    // onto our app's body and push the green header down with a 24px
    // gap above it. The negative-character class on the regex avoids
    // matching `.body-*` classes or selectors like `tbody`.
    const styleHtml = Array.from(parsed.head.querySelectorAll("style"))
      .map((s) => s.outerHTML)
      .join("\n")
      .replace(/(^|[^.#:\w-])body\s*\{[^}]*\}/g, "$1");
    const bodyHtml = parsed.body.innerHTML;
    host.innerHTML = `${styleHtml}${bodyHtml}`;

    // Multi-signer co-page support: if another signer already captured
    // one of these pages, render their capture as the page background
    // so this signer's fresh capture composites the prior signature in
    // automatically. See applyPriorCapturesToHost for the mechanism.
    if (
      request?.priorSignedPages &&
      request.priorSignedPages.length > 0 &&
      request.pageIndices
    ) {
      applyPriorCapturesToHost(
        host,
        request.pageIndices,
        request.priorSignedPages
      );
    }
  }, [filteredSnapshot, request?.priorSignedPages, request?.pageIndices]);

  useEffect(() => {
    if (mode !== "type") return;
    const trimmed = typedName.trim();
    if (!trimmed) {
      setSignatureDataUrl(null);
      return;
    }
    const font = SIGNATURE_FONTS.find((f) => f.id === fontId);
    if (!font) return;
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

  // When the signature data URL changes (re-type or new upload),
  // drop any existing placement so the lawyer re-drags the new
  // preview onto a page. Mirrors the ClientSignatureViewer flow —
  // explicit placement beats surprise auto-mount.
  useEffect(() => {
    if (!signatureDataUrl) return;
    if (floatingRef.current && floatingRef.current.parentElement) {
      floatingRef.current.remove();
      floatingRef.current = null;
      setHasPlaced(false);
    }
  }, [signatureDataUrl]);

  // Drag-from-sidebar handlers. Custom MIME type isolates from
  // OS-level image drags (a JPEG dragged off the desktop won't
  // accidentally land a stray image on the document).
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

    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    const page = elementAtPoint?.closest("section.docx") as HTMLElement | null;
    if (!page) return;

    const pageRect = page.getBoundingClientRect();
    const defaultWidth = Math.min(260, pageRect.width * 0.4);
    const defaultHeight = defaultWidth * (140 / 600); // canvas aspect (600x140)
    const left = Math.max(0, e.clientX - pageRect.left - defaultWidth / 2);
    const top = Math.max(0, e.clientY - pageRect.top - defaultHeight / 2);

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

  const handleSubmit = async () => {
    if (!requestId || !signatureDataUrl) return;
    setSubmitting(true);
    setError(null);
    try {
      // Capture each assigned page AS RENDERED, with the floating
      // signature wrapper already on it. The captured PNGs become the
      // final PDF pages — no server-side puppeteer re-render, no
      // chance of font / media-type drift moving content out from
      // under the signature.
      let signedPages: { pageIndex: number; imageDataUrl: string }[] = [];
      const host = documentHostRef.current;
      if (host && request?.pageIndices && request.pageIndices.length > 0) {
        signedPages = await captureSignedPages(host, request.pageIndices);
      }

      await mySignaturesApi.submit(requestId, signatureDataUrl, signedPages);
      setSignedSuccessfully(true);
    } catch (err) {
      setError(getMySignaturesErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Sign Document">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading signature request…
        </div>
      </LawyerLayout>
    );
  }

  if (error && !request) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Sign Document">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
          <div className="mt-3">
            <button
              onClick={() => navigate({ to: "/lawyer-signatures" })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Back to your inbox
            </button>
          </div>
        </div>
      </LawyerLayout>
    );
  }

  if (!request) return null;

  const pageCount = request.pageIndices?.length || 0;

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Sign Document">
      <div className="space-y-4">
        {/* Hero — emerald-tinted to match the lawyer's brand color and
            visually distinguish the self-sign flow from the client's
            (amber). Same shape as /case-tracking's pending card so the
            two viewers feel like one family. */}
        <header className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 shadow-[0_18px_45px_-32px_rgba(1,65,28,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 text-[#01411C]">
                <FileSignature className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#01411C]">
                  Sign as advocate
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-[#01411C]">
              <CalendarClock className="h-3 w-3" />
              Pending Signature
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Document host — drop target for the signature preview
              being dragged from the sidebar. Border changes to
              emerald while a drag is hovering. */}
          <div
            className={`relative rounded-xl border bg-[#f5f5f5] p-4 overflow-auto transition-colors ${
              isDragOver ? "border-emerald-400" : "border-gray-200"
            }`}
            style={{ maxHeight: "82vh" }}
            onDragOver={handleDocumentDragOver}
            onDragLeave={handleDocumentDragLeave}
            onDrop={handleDocumentDrop}
          >
            {/* Drop-zone hint pill — sticky at the top of the document
                area so it stays in view if the lawyer scrolls mid-drag. */}
            {isDragOver ? (
              <div
                aria-hidden
                className="pointer-events-none sticky top-2 z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-400 bg-white/95 px-5 py-2.5 text-sm font-semibold text-[#01411C] shadow-lg backdrop-blur"
              >
                <MousePointer2 className="h-4 w-4" />
                Drop on the page to place your signature
              </div>
            ) : null}
            {/* See ClientSignatureViewer for why these styles live here. */}
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
            <div ref={documentHostRef} className="docx-preview-host" />
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">
                Sign as advocate
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
                  {/* Draggable preview — grip icon + cursor-grab teach
                      the affordance without an explicit tutorial. */}
                  <div className="mt-2 flex items-center gap-2 rounded-md border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-3 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 flex-shrink-0 text-[#01411C]" />
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

              {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

              {/* Submit gated on actual placement so the lawyer
                  can't submit a signature that never reached a page. */}
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

      {signedSuccessfully && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lawyer-sign-success-title"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-emerald-50 via-white to-white px-6 pt-6 pb-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h2
                id="lawyer-sign-success-title"
                className="mt-4 text-lg font-semibold text-gray-900"
              >
                Signature recorded
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Your signature has been added to{" "}
                <span className="font-medium text-gray-900">
                  {request.caseTitle}
                </span>
                . The case will be marked fully signed once every signer
                has completed their part.
              </p>
            </div>
            <div className="flex gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
              <button
                type="button"
                onClick={() => setSignedSuccessfully(false)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Stay here
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/lawyer-signatures" })}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Back to inbox
              </button>
            </div>
          </div>
        </div>
      )}
    </LawyerLayout>
  );
}
