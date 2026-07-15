import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  FileSignature,
  GripVertical,
  Loader2,
  MousePointer2,
  Pencil,
  PenLine,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Type as TypeIcon,
  Upload,
} from "lucide-react";

import {
  filterSnapshotToPages,
  mySignaturesApi,
  type ApiSignatureRequestDetail,
  getMySignaturesErrorMessage,
} from "../../api/mySignatures.api";
// Reusing the lawyer editor's floating-image utility — same drag/resize/
// select gestures the lawyer uses for image attachments are what we want
// for placing a signature on the page. Cross-module import is fine; this
// helper has no React/lawyer-store coupling, it just attaches DOM
// listeners to an HTMLElement.
import { mountFloatingImage } from "../../../modules/lawyer/utils/floatingImage";
import {
  applyPriorCapturesToHost,
  captureSignedPages,
  lockDocumentForSigning,
} from "../../../modules/lawyer/utils/capturePages";

// =====================================================================
// Shared signing screen (client + lawyer).
//
// One component powers BOTH signature viewers so the two roles get the
// identical guided experience, themed per role (client = amber accents,
// lawyer = emerald). The flow is presented as three explicit steps:
//   1. Create your signature (type in a cursive font, or upload a PNG/JPG)
//   2. Place it on the paper (drag onto the page, or one-click quick-place
//      at the usual bottom-right signature spot, then drag/resize to taste)
//   3. Review & submit (captures the pages exactly as rendered)
//
// Direct-render mode: the lawyer's HTML snapshot is mounted into a real
// div (not an iframe) so the signature can sit ON TOP of the page as a
// draggable / resizable floating element — exactly like the editor does
// with image attachments. On submit we capture each assigned page as
// rendered, so what the signer sees is what the PDF gets.
//
// Trust note: we use innerHTML on the snapshot. The HTML originates from
// the lawyer's editor (docx-preview output + our own framing CSS) — no
// script tags ever pass through. The trade-off vs an iframe is accepting
// the lawyer as a trusted source in exchange for drag-on-paper UX.
// =====================================================================

type SignMode = "type" | "draw" | "upload";

type SignatureSigningScreenProps = {
  request: ApiSignatureRequestDetail;
  requestId: string;
  // Header eyebrow + sidebar panel title ("Signature request" / "Sign as
  // advocate") — the only copy that differs between the two roles.
  eyebrow: string;
  panelTitle: string;
  // Success modal copy + primary action (navigation differs per role).
  successTitle: string;
  successBody: string;
  successPrimaryLabel: string;
  onSuccessPrimary: () => void;
};

// Cursive signature fonts shipped via Google Fonts. Loaded once per page
// load via a <link> the component injects. The font-family value is what
// we pass to the canvas ctx.font, with serif fallback.
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

// Frequently-used signature ink colours. Black + blue are the common
// choices on legal documents (blue distinguishes a wet original from a
// photocopy); green is LawFlow's default; navy + red round out the set.
const SIGNATURE_COLORS = [
  { label: "Black", value: "#111827" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Navy", value: "#1e3a8a" },
  { label: "Green", value: "#01411C" },
  { label: "Red", value: "#b91c1c" },
] as const;

const DEFAULT_SIGNATURE_COLOR = "#01411C";

// Render a typed name onto a transparent canvas in the chosen font +
// colour and return as PNG data URL. Transparent so it composites
// cleanly over the page background.
function createTypedSignatureDataUrl(
  name: string,
  fontFamily: string,
  color: string
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
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

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Numbered step header for the sidebar. The circle flips to a green
// check once the step completes, so the signer always knows where they
// are in the flow without reading any copy.
function StepHeader({
  number,
  title,
  done,
  active,
}: {
  number: number;
  title: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
          done
            ? "bg-[#01411C] text-white"
            : active
              ? "bg-emerald-100 text-[#01411C] ring-1 ring-emerald-300"
              : "bg-gray-100 text-gray-400"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : number}
      </span>
      <h3
        className={`text-sm font-semibold ${
          done || active ? "text-gray-900" : "text-gray-400"
        }`}
      >
        {title}
      </h3>
    </div>
  );
}

export default function SignatureSigningScreen({
  request,
  requestId,
  eyebrow,
  panelTitle,
  successTitle,
  successBody,
  successPrimaryLabel,
  onSuccessPrimary,
}: SignatureSigningScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Container the snapshot HTML is injected into. We don't use React's
  // children for the snapshot because docx-preview's serialized output
  // contains attributes React's reconciler would warn about.
  const documentHostRef = useRef<HTMLDivElement>(null);
  // The currently-mounted floating signature wrapper. Tracked so:
  //   - subsequent signature changes replace the old one rather than stacking
  //   - placement state stays in sync when the signer deletes it
  const floatingRef = useRef<HTMLSpanElement | null>(null);

  // Draw-mode refs. The pad is a plain canvas driven by pointer events
  // (mouse + touch + stylus alike). Stroke state lives in refs — no
  // re-render per point.
  const drawHolderRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [mode, setMode] = useState<SignMode>("type");
  const [typedName, setTypedName] = useState("");
  const [fontId, setFontId] = useState<(typeof SIGNATURE_FONTS)[number]["id"]>(
    "dancing"
  );
  // Signature ink colour, shared by Type + Draw (Upload keeps the image's
  // own colours). Defaults to LawFlow green.
  const [signatureColor, setSignatureColor] = useState<string>(
    DEFAULT_SIGNATURE_COLOR
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // True while the signature wrapper is actually mounted on a page.
  // Drives step 2/3 state and the submit gate.
  const [hasPlaced, setHasPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccessfully, setSignedSuccessfully] = useState(false);

  useEffect(() => {
    ensureSignatureFontsLoaded();
  }, []);

  const filteredSnapshot = useMemo(
    () => filterSnapshotToPages(request.documentHtmlSnapshot, request.pageIndices),
    [request]
  );

  // Inject the snapshot HTML into the host once the request loads.
  useEffect(() => {
    const host = documentHostRef.current;
    if (!host || !filteredSnapshot) return;
    // The snapshot is a full <!doctype html>...</html> document. Strip
    // down to the inner body content so it sits inside our viewer
    // chrome; move <style> tags from the parsed head into the host so
    // docx-preview's per-page CSS applies without polluting the app.
    //
    // CRITICAL: strip any rule targeting bare `body` selectors before
    // injecting. The snapshot's viewer-framing CSS sets
    // `body { padding: 24px }` for standalone-iframe rendering — but
    // we're injecting INTO a host div, so that rule would leak onto our
    // app's body and push the header down. The regex wipes those rules
    // without touching `.body-*` class selectors or `tbody`.
    const parsed = new DOMParser().parseFromString(filteredSnapshot, "text/html");
    const styleHtml = Array.from(parsed.head.querySelectorAll("style"))
      .map((s) => s.outerHTML)
      .join("\n")
      .replace(/(^|[^.#:\w-])body\s*\{[^}]*\}/g, "$1");
    const bodyHtml = parsed.body.innerHTML;
    host.innerHTML = `${styleHtml}${bodyHtml}`;

    // Read-only: the signer may ONLY drop their signature — never edit
    // the document. Disable contenteditable on every page and neutralize
    // the lawyer's attachment-image chrome (handles/outline).
    lockDocumentForSigning(host);

    // Multi-signer co-page support: if another signer already captured
    // one of these pages, render their capture as the page background so
    // this signer's fresh capture composites the prior signature in.
    if (
      request.priorSignedPages &&
      request.priorSignedPages.length > 0 &&
      request.pageIndices
    ) {
      applyPriorCapturesToHost(host, request.pageIndices, request.priorSignedPages);
    }
  }, [filteredSnapshot, request.priorSignedPages, request.pageIndices]);

  // Live-render the typed signature any time the name or font changes.
  useEffect(() => {
    if (mode !== "type") return;
    // Once type mode drives the signature, any previously-uploaded file
    // label is stale — clear it so the Upload tab never claims an image
    // that is no longer the active signature.
    setUploadedFileName(null);
    const trimmed = typedName.trim();
    if (!trimmed) {
      setSignatureDataUrl(null);
      return;
    }
    const font = SIGNATURE_FONTS.find((f) => f.id === fontId);
    if (!font) return;
    // Wait for the Google Fonts to load — first paint may use the serif
    // fallback, then re-render once the faces are available.
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      setSignatureDataUrl(
        createTypedSignatureDataUrl(trimmed, font.family, signatureColor)
      );
    };
    if (typeof document !== "undefined" && "fonts" in document) {
      (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready
        .then(render)
        .catch(render);
    } else {
      render();
    }
    return () => {
      cancelled = true;
    };
  }, [mode, typedName, fontId, signatureColor]);

  // Size + style the draw pad whenever draw mode opens. The canvas is
  // scaled by devicePixelRatio for crisp ink, round caps for a pen feel.
  // The pen colour is applied per-stroke in handleDrawStart from the
  // current signatureColor, so switching ink never has to clear the pad
  // here. Re-entering draw mode starts a fresh blank pad.
  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = drawCanvasRef.current;
    const holder = drawHolderRef.current;
    if (!canvas || !holder) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = holder.clientWidth;
    const cssHeight = 160;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [mode]);

  // Export the drawing cropped to its ink (plus padding) so the placed
  // signature hugs the strokes the same way the typed canvas hugs the
  // text — no giant transparent margins on the paper.
  const exportDrawing = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    if (!width || !height) return;
    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      const rowStart = y * width;
      for (let x = 0; x < width; x++) {
        if (data[(rowStart + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      // No ink left on the pad.
      setSignatureDataUrl(null);
      return;
    }
    const pad = 10;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(width, maxX + pad) - cropX;
    const cropH = Math.min(height, maxY + pad) - cropY;
    const out = document.createElement("canvas");
    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext("2d");
    if (!outCtx) return;
    outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    setSignatureDataUrl(out.toDataURL("image/png"));
    setError(null);
  }, []);

  const clearDrawing = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current = false;
    lastPointRef.current = null;
    setSignatureDataUrl(null);
  }, []);

  const handleDrawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    // Pen colour is applied at stroke time so switching ink affects the
    // next stroke without wiping what's already on the pad.
    ctx.strokeStyle = signatureColor;
    ctx.fillStyle = signatureColor;
    drawingRef.current = true;
    const p = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    lastPointRef.current = p;
    // A dot for a tap, so single clicks leave a mark too.
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.25, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = drawCanvasRef.current?.getContext("2d");
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const p = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };

  const handleDrawEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    // Live-export after every stroke: the preview in step 2 always
    // mirrors the pad, and adding a stroke re-triggers placement (the
    // signature on the paper never lags behind what was drawn).
    exportDrawing();
  };

  // Placement-state sync. The floating wrapper can leave the DOM through
  // paths we don't control directly (the wrapper's own delete ✕ button,
  // or the document-level Delete-key shortcut), so instead of assuming,
  // we re-derive "is it still on the page?" from the DOM.
  const syncPlacement = useCallback(() => {
    setHasPlaced(Boolean(floatingRef.current && floatingRef.current.isConnected));
  }, []);

  // The Delete-key shortcut removes the selected wrapper without firing
  // the mount onChange — a document-level keyup re-check keeps the step
  // state honest while a placement exists.
  useEffect(() => {
    if (!hasPlaced) return;
    document.addEventListener("keyup", syncPlacement);
    return () => document.removeEventListener("keyup", syncPlacement);
  }, [hasPlaced, syncPlacement]);

  // When the signature image changes — INCLUDING being cleared (draw-pad
  // Clear, emptying the typed name) — drop any existing on-page placement.
  // The signer re-places the new version explicitly, so the paper never
  // shows a signature that no longer matches the panel, and clearing the
  // source can't orphan a stuck signature with no visible remove control.
  useEffect(() => {
    if (floatingRef.current && floatingRef.current.parentElement) {
      floatingRef.current.remove();
      floatingRef.current = null;
      setHasPlaced(false);
    }
  }, [signatureDataUrl]);

  // Mount (or move) the floating signature on a page. Shared by the
  // drag-drop and quick-place paths so both behave identically.
  const placeOnPage = useCallback(
    (page: HTMLElement, left: number, top: number, width: number) => {
      if (!signatureDataUrl) return;
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
        width,
        onChange: syncPlacement,
      });
      setHasPlaced(true);
      setError(null);
    },
    [signatureDataUrl, syncPlacement]
  );

  const removePlacement = useCallback(() => {
    if (floatingRef.current && floatingRef.current.parentElement) {
      floatingRef.current.remove();
    }
    floatingRef.current = null;
    setHasPlaced(false);
  }, []);

  // Drag-from-sidebar onto the document. Custom MIME type so OS-level
  // image drags (a JPEG dragged from the desktop) can't accidentally
  // trigger our placement logic.
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

    // Translate viewport coords → page-relative. Center the signature on
    // the drop point so the cursor feels like it dropped the middle of
    // the preview, not the top-left.
    const pageRect = page.getBoundingClientRect();
    const defaultWidth = Math.min(260, pageRect.width * 0.4);
    const defaultHeight = defaultWidth * (140 / 600);
    const left = Math.max(0, e.clientX - pageRect.left - defaultWidth / 2);
    const top = Math.max(0, e.clientY - pageRect.top - defaultHeight / 2);

    placeOnPage(page, left, top, defaultWidth);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input value so picking the SAME file again still fires
    // onChange (browsers suppress the event when the value is unchanged).
    if (e.target) e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a PNG or JPG image of your signature.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSignatureDataUrl(dataUrl);
      setUploadedFileName(file.name);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const handleSubmit = async () => {
    if (!requestId || !signatureDataUrl) return;
    // Hard gate on the DOM, not just state: the wrapper may have been
    // deleted via the ✕ / Delete key an instant ago.
    if (!floatingRef.current || !floatingRef.current.isConnected) {
      setHasPlaced(false);
      setError("Your signature is no longer on the page — place it again before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    // Strip the selection highlight before capturing — the selected-state
    // outline is applied via a class that only clears on a click INSIDE
    // the document host, and the Submit button lives outside it. Without
    // this, the dashed selection chrome could survive into the captures.
    floatingRef.current.classList.remove("lawflow-floating-image-selected");
    try {
      // Capture each assigned page AS RENDERED in this browser, with the
      // floating signature already on it. The captured PNGs become the
      // final PDF pages — no server-side re-render, so font / media-type
      // drift can't move the surrounding text out from under the
      // signature.
      let signedPages: { pageIndex: number; imageDataUrl: string }[] = [];
      const host = documentHostRef.current;
      if (host && request.pageIndices && request.pageIndices.length > 0) {
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

  const pageCount = request.pageIndices?.length || 0;
  const step1Done = Boolean(signatureDataUrl);
  const step2Done = hasPlaced;
  // Already-signed requests open as a read-only preview: the backend
  // returns the signer's own submit-time captures as priorSignedPages,
  // so the pages below render exactly as signed — the create/place/
  // submit panel is replaced by a signed receipt card.
  const isSigned = Boolean(request.signedAt);

  return (
    // Full-height workspace: a thin request bar pinned on top, then the
    // document desk (left, scrolls) beside the signing panel (right, fixed
    // width). Fills the app-shell's content region so nothing scrolls the
    // whole page.
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* ── Thin request bar ─────────────────────────────────────── */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-slate-200 bg-white px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#01411C]">
            <FileSignature className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {request.caseTitle}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
              <span className="font-medium text-[#01411C]">{eyebrow}</span>
              <span aria-hidden>·</span>
              <span>
                {pageCount} page{pageCount === 1 ? "" : "s"}
              </span>
              {isSigned ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Signed {formatShortDate(request.signedAt)}
                  </span>
                </>
              ) : request.expiresAt ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Expires {formatShortDate(request.expiresAt)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        {isSigned ? (
          <div className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Signed
          </div>
        ) : (
          <div className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
            <CalendarClock className="h-3 w-3" />
            Pending Signature
          </div>
        )}
      </div>

      {/* ── Workspace: document desk (left) + signing panel (right) ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Document desk — the only scrolling region on the left. White
            pages float on a light slate desk with a soft shadow; no card
            wrapper, no inner chrome. */}
        <div
          className={`lawflow-signing-desk relative min-h-0 flex-1 overflow-y-auto bg-slate-100 px-4 py-6 transition-shadow sm:px-6 ${
            isDragOver ? "ring-2 ring-inset ring-emerald-400" : ""
          }`}
          onDragOver={isSigned ? undefined : handleDocumentDragOver}
          onDragLeave={isSigned ? undefined : handleDocumentDragLeave}
          onDrop={isSigned ? undefined : handleDocumentDrop}
        >
            {/* Drop-zone hint pill — sticky so it stays in view if the
                signer scrolls mid-drag. */}
            {isDragOver ? (
              <div
                aria-hidden
                className="pointer-events-none sticky top-2 z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-400 bg-white/95 px-5 py-2.5 text-sm font-semibold text-[#01411C] shadow-lg backdrop-blur"
              >
                <MousePointer2 className="h-4 w-4" />
                Drop on the page to place your signature
              </div>
            ) : null}

            {/* Desk + paper + floating-signature styling. The wrapper
                overrides re-frame docx-preview's own chrome (its gray
                wrapper background / padding) into a clean "paper on a
                desk" look; the floating-image rules give the placed
                signature always-visible, touch-friendly handles. */}
            <style>{`
              .lawflow-signing-desk .docx-wrapper {
                background: transparent !important;
                padding: 8px 0 24px !important;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
              }
              .lawflow-signing-desk .docx-wrapper > section.docx {
                box-shadow:
                  0 1px 2px rgba(15, 23, 42, 0.08),
                  0 12px 32px -12px rgba(15, 23, 42, 0.25),
                  0 0 0 1px rgba(15, 23, 42, 0.05);
                margin-bottom: 0 !important;
              }
              /* Outline + always-visible resize handles apply ONLY to the
                 signature being placed (a fresh floating image), never to
                 the document's locked attachment images. */
              .lawflow-floating-image:not(.lawflow-locked-image) {
                outline: 2px dashed rgba(1, 65, 28, 0.45);
                outline-offset: 3px;
                border-radius: 2px;
                transition: outline-color 0.15s ease;
              }
              /* NOTE: hover/selected feedback is outline-only, NEVER a
                 background — captureSignedPages resets outlines before
                 rasterizing, but a background would survive into the
                 captured PNGs and end up printed in the signed PDF. */
              .lawflow-floating-image:not(.lawflow-locked-image):hover,
              .lawflow-floating-image:not(.lawflow-locked-image).lawflow-floating-image-selected {
                outline: 2px dashed #01411C;
              }
              .lawflow-floating-image.lawflow-locked-image { outline: none; }
              .lawflow-resize-handle {
                position: absolute;
                width: 12px;
                height: 12px;
                background: #01411C;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(15, 23, 42, 0.35);
                opacity: 1;
                z-index: 2;
              }
              .lawflow-resize-handle-nw { top: -8px; left: -8px;  cursor: nwse-resize; }
              .lawflow-resize-handle-ne { top: -8px; right: -8px; cursor: nesw-resize; }
              .lawflow-resize-handle-sw { bottom: -8px; left: -8px; cursor: nesw-resize; }
              .lawflow-resize-handle-se { bottom: -8px; right: -8px; cursor: nwse-resize; }
            `}</style>
            <div
              ref={documentHostRef}
              // docx-preview-host enables the floatingImage utility's
              // click-outside-to-deselect + Delete-to-remove shortcuts
              // (it walks up looking for this class).
              className="docx-preview-host"
            />
          </div>

        {/* ── Signing panel (or signed receipt) ───────────────────── */}
        {isSigned ? (
          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white max-lg:max-h-[45dvh] lg:w-[380px] lg:flex-shrink-0 lg:border-l lg:border-t-0">
            <div className="flex-shrink-0 border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-gray-900">
                Signed document
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                This request is complete.
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50/70 p-3.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      You signed this document
                    </p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {formatShortDate(request.signedAt)}
                    </p>
                  </div>
                </div>
                <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5 text-[11px] leading-relaxed text-gray-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  The pages shown are your signed copy — the signature appears
                  exactly where you placed it. No further action is needed.
                </p>
              </div>
          </aside>
        ) : (
        <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white max-lg:max-h-[55dvh] lg:w-[380px] lg:flex-shrink-0 lg:border-l lg:border-t-0">
          <div className="flex-shrink-0 border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-gray-900">{panelTitle}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Three quick steps — create, place, submit.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {/* Step 1 — create the signature */}
              <section>
                <StepHeader
                  number={1}
                  title="Create your signature"
                  done={step1Done}
                  active={!step1Done}
                />
                <div className="mt-3 space-y-3 pl-[34px]">
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => setMode("type")}
                      className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                        mode === "type"
                          ? "bg-white text-[#01411C] shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <TypeIcon className="h-3.5 w-3.5" />
                      Type
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("draw")}
                      className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                        mode === "draw"
                          ? "bg-white text-[#01411C] shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("upload")}
                      className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                        mode === "upload"
                          ? "bg-white text-[#01411C] shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload
                    </button>
                  </div>

                  {/* Ink colour — applies to Type + Draw. Upload keeps the
                      uploaded image's own colours, so the picker is hidden
                      there. */}
                  {mode !== "upload" && (
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] font-medium text-gray-500">
                        Ink colour
                      </span>
                      <div className="flex items-center gap-1.5">
                        {SIGNATURE_COLORS.map((c) => {
                          const selected = signatureColor === c.value;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setSignatureColor(c.value)}
                              title={c.label}
                              aria-label={`${c.label} ink`}
                              aria-pressed={selected}
                              className={`h-6 w-6 rounded-full ring-offset-1 transition-transform ${
                                selected
                                  ? "scale-110 ring-2 ring-gray-500"
                                  : "ring-1 ring-gray-200 hover:scale-105"
                              }`}
                              style={{ backgroundColor: c.value }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {mode === "type" ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Type your full name"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:border-[#01411C] focus:ring-2 focus:ring-emerald-100"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {SIGNATURE_FONTS.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setFontId(f.id)}
                            className={`relative rounded-lg border px-2 py-2.5 text-center transition-all ${
                              fontId === f.id
                                ? "border-[#01411C] bg-emerald-50/60 ring-1 ring-[#01411C]"
                                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                            }`}
                            style={{
                              fontFamily: f.family,
                              fontSize: "20px",
                              color: signatureColor,
                              lineHeight: 1.15,
                            }}
                          >
                            {fontId === f.id ? (
                              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#01411C]">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </span>
                            ) : null}
                            {typedName.trim() || f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : mode === "draw" ? (
                    <div className="space-y-2">
                      <div
                        ref={drawHolderRef}
                        className="relative overflow-hidden rounded-lg border border-gray-300 bg-white"
                      >
                        <canvas
                          ref={drawCanvasRef}
                          className="block w-full cursor-crosshair"
                          // touch-action none so a finger/stylus draws
                          // instead of scrolling the panel.
                          style={{ touchAction: "none", height: 160 }}
                          onPointerDown={handleDrawStart}
                          onPointerMove={handleDrawMove}
                          onPointerUp={handleDrawEnd}
                          onPointerCancel={handleDrawEnd}
                        />
                        {/* Baseline guide — purely visual. */}
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-x-6 bottom-9 border-t border-dashed border-gray-300"
                        />
                        <span
                          aria-hidden
                          className="pointer-events-none absolute bottom-3 left-6 text-[10px] font-medium uppercase tracking-wide text-gray-300"
                        >
                          Sign above the line
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-gray-400">
                          Draw with your mouse, finger, or stylus.
                        </p>
                        <button
                          type="button"
                          onClick={clearDrawing}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
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
                        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/60 px-3 py-5 text-sm text-gray-600 transition-colors hover:border-[#01411C] hover:bg-emerald-50/40 hover:text-[#01411C]"
                      >
                        <Upload className="h-5 w-5" />
                        <span className="font-medium">
                          {uploadedFileName ?? "Choose a PNG or JPG"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          A photo of your signature on white paper works best
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Step 2 — place it on the paper */}
              <section
                className={step1Done ? "" : "pointer-events-none opacity-40"}
              >
                <StepHeader
                  number={2}
                  title="Place it on the paper"
                  done={step2Done}
                  active={step1Done && !step2Done}
                />
                <div className="mt-3 space-y-2.5 pl-[34px]">
                  {signatureDataUrl ? (
                    <>
                      <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/60 p-3 cursor-grab transition-colors hover:border-[#01411C] active:cursor-grabbing">
                        <GripVertical className="h-4 w-4 flex-shrink-0 text-[#01411C]" />
                        <img
                          src={signatureDataUrl}
                          alt="Signature preview — drag onto document"
                          draggable
                          onDragStart={handlePreviewDragStart}
                          className="mx-auto max-h-16 select-none"
                        />
                      </div>
                      {hasPlaced ? (
                        <button
                          type="button"
                          onClick={removePlacement}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-red-300 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove from page
                        </button>
                      ) : null}
                      <p className="text-[11px] leading-relaxed text-gray-500">
                        {hasPlaced ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Your signature is on the document. Drag it to move it,
                            or pull a corner to make it bigger or smaller.
                          </span>
                        ) : (
                          "Hold and drag the preview onto the page where you want to sign."
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      Create your signature above to unlock placement.
                    </p>
                  )}
                </div>
              </section>

              {/* Step 3 — review & submit */}
              <section
                className={step2Done ? "" : "pointer-events-none opacity-40"}
              >
                <StepHeader
                  number={3}
                  title="Review & submit"
                  done={signedSuccessfully}
                  active={step2Done && !signedSuccessfully}
                />
                <div className="mt-3 space-y-3 pl-[34px]">
                  <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-500">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    Your signature will be embedded on the document exactly where
                    you placed it and recorded with this case file.
                  </p>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!signatureDataUrl || !hasPlaced || submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#024a23] disabled:cursor-not-allowed disabled:opacity-50"
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
              </section>

              {/* Errors live OUTSIDE the step sections — never subject to
                  a step's opacity/pointer-events lock. An upload-validation
                  failure (step 1) or a placement-lost message must render
                  at full strength no matter which step is active. */}
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>
        </aside>
        )}
      </div>

      {/* ── Success modal ─────────────────────────────────────────── */}
      {signedSuccessfully && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signing-success-title"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-emerald-50 via-white to-white px-6 pt-6 pb-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h2
                id="signing-success-title"
                className="mt-4 text-lg font-semibold text-gray-900"
              >
                {successTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {successBody}{" "}
                <span className="font-medium text-gray-900">
                  {request.caseTitle}
                </span>
                .
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
                onClick={onSuccessPrimary}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {successPrimaryLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
