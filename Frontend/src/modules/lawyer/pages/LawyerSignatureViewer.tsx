import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Type as TypeIcon,
  Upload,
} from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import {
  filterSnapshotToPages,
  mySignaturesApi,
  type ApiSignatureRequestDetail,
  type SignaturePlacement,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";
import { mountFloatingImage } from "../utils/floatingImage";

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
    const styleHtml = Array.from(parsed.head.querySelectorAll("style"))
      .map((s) => s.outerHTML)
      .join("\n");
    const bodyHtml = parsed.body.innerHTML;
    host.innerHTML = `${styleHtml}${bodyHtml}`;
  }, [filteredSnapshot]);

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

  useEffect(() => {
    if (!signatureDataUrl) return;
    const host = documentHostRef.current;
    if (!host) return;
    const firstPage = host.querySelector<HTMLElement>(
      ".docx-wrapper > section.docx"
    );
    if (!firstPage) return;

    if (floatingRef.current && floatingRef.current.parentElement) {
      floatingRef.current.remove();
      floatingRef.current = null;
    }

    const pageRect = firstPage.getBoundingClientRect();
    const defaultWidth = Math.min(260, pageRect.width * 0.4);
    const left = Math.max(0, pageRect.width - defaultWidth - 60);
    const top = Math.max(0, pageRect.height - 120);

    floatingRef.current = mountFloatingImage({
      src: signatureDataUrl,
      alt: "Signature",
      page: firstPage,
      left,
      top,
      width: defaultWidth,
    });
  }, [signatureDataUrl]);

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

  if (signedSuccessfully) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Sign Document">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-lg font-semibold text-emerald-900">
            Signature recorded
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            Your signature is now part of {request.caseTitle}.
          </p>
          <button
            onClick={() => navigate({ to: "/lawyer-signatures" })}
            className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Back to inbox
          </button>
        </div>
      </LawyerLayout>
    );
  }

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle={request.caseTitle}>
      <div className="space-y-4">
        <header className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Your signature
          </p>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">
            {request.caseTitle}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {request.pageIndices?.length || 0} page
            {request.pageIndices?.length === 1 ? "" : "s"} need your signature.
            Drag the signature on the page to position. Drag the corner handles
            to resize.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div
            className="rounded-xl border border-gray-200 bg-[#f5f5f5] p-4 overflow-auto"
            style={{ maxHeight: "82vh" }}
          >
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
                {signatureDataUrl
                  ? "Drag it on the page to position. Drag corners to resize."
                  : "Type your name or upload an image, then drag onto the page."}
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Preview
                  </p>
                  <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                    <img
                      src={signatureDataUrl}
                      alt="Signature preview"
                      className="max-h-20 mx-auto"
                    />
                  </div>
                </div>
              )}

              {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!signatureDataUrl || submitting}
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
    </LawyerLayout>
  );
}
