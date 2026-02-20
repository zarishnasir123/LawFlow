import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Rnd } from "react-rnd";
import {
  CheckCircle2,
  Download,
  ImagePlus,
  RotateCcw,
  Type,
} from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import * as mammoth from "mammoth";
import { DEFAULT_CASE_DOCS } from "../data/defaultCaseDocuments";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type SignatureBox = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PageMetrics = {
  pdfWidth: number;
  pdfHeight: number;
  renderWidth: number;
  renderHeight: number;
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function createTypedSignatureDataUrl(name: string): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const fontSize = 64;
  const fontFamily =
    '"Brush Script MT","Segoe Script","Lucida Handwriting","Snell Roundhand",cursive';
  ctx.font = `${fontSize}px ${fontFamily}`;
  const textWidth = Math.ceil(ctx.measureText(name).width);
  canvas.width = Math.max(textWidth + 60, 360);
  canvas.height = 160;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(24, canvas.height / 2 + 6);
  ctx.rotate(-0.02);
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(name, 0, 0);
  ctx.fillText(name, 0, 0);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

function resolveTemplateUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

function formatDateTime(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function wrapText(
  text: string,
  font: Awaited<ReturnType<typeof PDFDocument.prototype.embedFont>>,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);
  return lines;
}

async function generatePdfFromText(
  docTitle: string,
  bodyText: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const page = pdfDoc.addPage([612, 792]);
  const fontSize = 12;
  const margin = 50;
  const maxWidth = page.getWidth() - margin * 2;
  const lines = wrapText(bodyText, font, fontSize, maxWidth);

  let y = page.getHeight() - margin;
  page.drawText(docTitle.toUpperCase(), {
    x: margin,
    y,
    size: 16,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 24;

  lines.forEach((line) => {
    if (y < margin) {
      y = page.getHeight() - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 16;
  });

  return pdfDoc.save();
}

async function generateMockPdf(docTitle: string): Promise<Uint8Array> {
  const body =
    "This document is provided for lawyer review and signature. " +
    "Please verify the details and sign in the designated area.";
  return generatePdfFromText(docTitle, body);
}

export default function LawyerSignatureViewer() {
  const navigate = useNavigate();
  const { requestId } = useParams({ strict: false }) as {
    requestId?: string;
  };

  const { requests, updateRequest } = useSignatureRequestsStore();
  const {
    addSignedAttachment,
    attachmentsById,
    bundleItems,
    removeFromBundle,
  } = useDocumentEditorStore();

  const request = useMemo(
    () => requests.find((item) => item.id === requestId) || null,
    [requests, requestId]
  );

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>(
    {}
  );
  const [signatureImage, setSignatureImage] = useState<string>("");
  const [typedName, setTypedName] = useState("");
  const [signatureBox, setSignatureBox] = useState<SignatureBox | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [signedPdfDataUrl, setSignedPdfDataUrl] = useState<string | null>(null);
  const [isLocallySigned, setIsLocallySigned] = useState(false);
  const isSigned = isLocallySigned || Boolean(request?.lawyerSigned);
  const targetAttachmentUrl =
    signedPdfDataUrl ||
    request?.pdfDataUrl ||
    request?.lawyerSignedPdfDataUrl ||
    request?.signedPdfDataUrl;
  const attachedAttachment =
    request?.signedAttachmentId && attachmentsById[request.signedAttachmentId]
      ? attachmentsById[request.signedAttachmentId]
      : null;
  const isAttached = Boolean(
    attachedAttachment && targetAttachmentUrl && attachedAttachment.url === targetAttachmentUrl
  );
  const statusLabel = request?.clientSigned && request?.lawyerSigned
    ? "Client + Lawyer Signed"
    : isSigned
      ? "Signed"
      : "Awaiting signature";
  const displayPdfUrl =
    signedPdfUrl ||
    request?.pdfDataUrl ||
    request?.lawyerSignedPdfDataUrl ||
    request?.signedPdfDataUrl ||
    pdfUrl;
  const isInteractingRef = useRef(false);
  const interactionCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number>(0);

  useEffect(() => {
    const element = pageContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setPageWidth(element.clientWidth);
    });
    observer.observe(element);
    setPageWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let url: string | null = null;
    const run = async () => {
      if (!request) return;
      const baseDataUrl =
        request.pdfDataUrl ||
        request.lawyerSignedPdfDataUrl ||
        request.signedPdfDataUrl;
      const bytes =
        baseDataUrl && baseDataUrl.startsWith("data:application/pdf")
          ? dataUrlToBytes(baseDataUrl)
          : await (async () => {
              const requestTitle = request.docTitle.toLowerCase();
              const template = DEFAULT_CASE_DOCS.find((doc) => {
                const docTitle = doc.title.toLowerCase();
                return (
                  docTitle === requestTitle ||
                  requestTitle.includes(docTitle) ||
                  docTitle.includes(requestTitle)
                );
              });
              if (template?.url) {
                try {
                  const response = await fetch(resolveTemplateUrl(template.url));
                  if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    const text = result.value?.trim();
                    if (text) {
                      return generatePdfFromText(request.docTitle, text);
                    }
                  }
                } catch (error) {
                  console.warn("[LawyerSignature] Template fetch failed", error);
                }
              }
              return generateMockPdf(request.docTitle);
            })();

      setPdfBytes(bytes);
      const safeBytes = new Uint8Array(bytes);
      const blob = new Blob([safeBytes.buffer], { type: "application/pdf" });
      url = URL.createObjectURL(blob);
      setPdfUrl(url);
    };

    run();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [request]);

  const handlePageClick = (pageNumber: number, event: React.MouseEvent) => {
    if (!signatureImage || isSigned || isInteractingRef.current) return;
    const metrics = pageMetrics[pageNumber];
    if (!metrics) return;
    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const defaultWidth = Math.min(220, metrics.renderWidth * 0.4);
    const defaultHeight = Math.max(60, defaultWidth * 0.35);
    const clampedX = Math.max(
      0,
      Math.min(clickX - defaultWidth / 2, metrics.renderWidth - defaultWidth)
    );
    const clampedY = Math.max(
      0,
      Math.min(clickY - defaultHeight / 2, metrics.renderHeight - defaultHeight)
    );

    setSignatureBox({
      page: pageNumber,
      x: clampedX,
      y: clampedY,
      width: defaultWidth,
      height: defaultHeight,
    });
  };

  const handleConfirmSignature = async () => {
    if (!signatureBox || !pdfBytes || !signatureImage || !request) return;
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const imageBytes = dataUrlToBytes(signatureImage);
    const image = await pdfDoc.embedPng(imageBytes);

    const page = pdfDoc.getPages()[signatureBox.page - 1];
    const metrics = pageMetrics[signatureBox.page];
    if (!metrics) return;

    const scaleX = metrics.pdfWidth / metrics.renderWidth;
    const scaleY = metrics.pdfHeight / metrics.renderHeight;

    const targetWidth = signatureBox.width * scaleX;
    const targetHeight = signatureBox.height * scaleY;
    const pdfX = signatureBox.x * scaleX;
    const pdfY =
      metrics.pdfHeight - signatureBox.y * scaleY - targetHeight;

    page.drawImage(image, {
      x: pdfX,
      y: pdfY,
      width: targetWidth,
      height: targetHeight,
    });

    const signedBytes = await pdfDoc.save();
    const signedArray = new Uint8Array(signedBytes);
    const signedBlob = new Blob([signedArray.buffer], {
      type: "application/pdf",
    });
    const signedUrl = URL.createObjectURL(signedBlob);
    setSignedPdfUrl(signedUrl);
    setIsLocallySigned(true);
    setSignatureBox(null);

    const signedDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.readAsDataURL(signedBlob);
    });
    setSignedPdfDataUrl(signedDataUrl);

    const updates: Record<string, unknown> = {
      lawyerSigned: true,
      lawyerSignedAt: new Date().toISOString(),
      lawyerSignatureName: typedName || "Lawyer",
      // Persist merged PDF as canonical latest version.
      pdfDataUrl: signedDataUrl,
      lawyerSignedPdfDataUrl: signedDataUrl,
    };

    updateRequest(request.id, updates);
  };

  const handleFileUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setSignatureImage(result);
      setSignatureBox(null);
      setIsLocallySigned(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTypedSignature = () => {
    if (!typedName.trim()) return;
    const imageUrl = createTypedSignatureDataUrl(typedName.trim());
    setSignatureImage(imageUrl);
    setSignatureBox(null);
    setIsLocallySigned(false);
  };

  const handleClearPlacement = () => {
    setSignatureBox(null);
    setIsLocallySigned(false);
    setSignedPdfUrl(null);
    setSignedPdfDataUrl(null);
  };

  const handleDownload = () => {
    if (!displayPdfUrl) return;
    const link = document.createElement("a");
    link.href = displayPdfUrl;
    link.download = `${request?.docTitle || "document"}-lawyer-signed.pdf`;
    link.click();
  };

  const handleAttachToCase = async () => {
    if (!request || !request.lawyerSigned) return;
    const dataUrl =
      signedPdfDataUrl ||
      request.pdfDataUrl ||
      request.lawyerSignedPdfDataUrl ||
      request.signedPdfDataUrl;
    if (!dataUrl) return;
    const expectedName = `${request.docTitle}-Signed.pdf`;
    const base64 = dataUrl.split(",")[1] || "";
    const sizeBytes = Math.floor((base64.length * 3) / 4);
    const existingAttachment =
      request.signedAttachmentId && attachmentsById[request.signedAttachmentId]
        ? attachmentsById[request.signedAttachmentId]
        : undefined;
    if (
      existingAttachment &&
      existingAttachment.url === dataUrl &&
      existingAttachment.name === expectedName &&
      existingAttachment.size === sizeBytes
    ) {
      return;
    }

    const oldBundleItem = existingAttachment
      ? bundleItems.find(
          (item) =>
            item.type === "ATTACHMENT" && item.refId === existingAttachment.id
        )
      : undefined;
    const insertAfterId = oldBundleItem?.id || request.bundleItemId;

    const attachmentId = addSignedAttachment(
      {
        name: expectedName,
        type: "application/pdf",
        size: sizeBytes,
        url: dataUrl,
      },
      insertAfterId
    );
    updateRequest(request.id, { signedAttachmentId: attachmentId });

    if (existingAttachment) {
      if (oldBundleItem) {
        removeFromBundle(oldBundleItem.id);
      }
    }
  };

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Sign Documents">
      <div className="grid gap-6 px-4 py-6 lg:grid-cols-[1.4fr_0.9fr] lg:px-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Document for lawyer signature
                </p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">
                  {request?.docTitle || "Document"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Requested on {formatDateTime(request?.requestedAt)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div ref={pageContainerRef} className="space-y-6">
              {displayPdfUrl ? (
                <Document
                  file={displayPdfUrl}
                  onLoadSuccess={(doc) => setNumPages(doc.numPages)}
                >
                  {Array.from({ length: numPages }, (_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <div
                        key={`page-${pageNumber}`}
                        className="relative mx-auto w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-2"
                        onClick={(event) => handlePageClick(pageNumber, event)}
                      >
                        <Page
                          pageNumber={pageNumber}
                          width={pageWidth ? pageWidth - 32 : undefined}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          onRenderSuccess={(pageInfo) =>
                            setPageMetrics((prev) => ({
                              ...prev,
                              [pageNumber]: {
                                pdfWidth: pageInfo.originalWidth,
                                pdfHeight: pageInfo.originalHeight,
                                renderWidth: pageInfo.width,
                                renderHeight: pageInfo.height,
                              },
                            }))
                          }
                        />

                        {!isSigned &&
                          signatureBox?.page === pageNumber &&
                          signatureImage && (
                          <Rnd
                            size={{
                              width: signatureBox.width,
                              height: signatureBox.height,
                            }}
                            position={{ x: signatureBox.x, y: signatureBox.y }}
                            lockAspectRatio
                            onDragStart={() => {
                              isInteractingRef.current = true;
                            }}
                            onDragStop={(_, data) => {
                              setSignatureBox((prev) =>
                                prev
                                  ? { ...prev, x: data.x, y: data.y }
                                  : prev
                              );
                              if (interactionCooldownRef.current) {
                                clearTimeout(interactionCooldownRef.current);
                              }
                              interactionCooldownRef.current = setTimeout(() => {
                                isInteractingRef.current = false;
                              }, 150);
                            }}
                            onResizeStart={() => {
                              isInteractingRef.current = true;
                            }}
                            onResize={(_, __, ref, ___, position) =>
                              setSignatureBox((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      width: ref.offsetWidth,
                                      height: ref.offsetHeight,
                                      x: position.x,
                                      y: position.y,
                                    }
                                  : prev
                              )
                            }
                            onResizeStop={() => {
                              isInteractingRef.current = false;
                              if (interactionCooldownRef.current) {
                                clearTimeout(interactionCooldownRef.current);
                              }
                              interactionCooldownRef.current = setTimeout(() => {
                                isInteractingRef.current = false;
                              }, 150);
                            }}
                            bounds="parent"
                            onMouseDown={(event: MouseEvent) =>
                              event.stopPropagation()
                            }
                            onTouchStart={(event: TouchEvent) =>
                              event.stopPropagation()
                            }
                            onClick={(event: MouseEvent) =>
                              event.stopPropagation()
                            }
                          >
                            <div className="h-full w-full border-2 border-emerald-500 bg-white/80 shadow-sm">
                              <img
                                src={signatureImage}
                                alt="Signature"
                                className="h-full w-full object-contain"
                              />
                            </div>
                          </Rnd>
                        )}
                        {!signatureImage && !isSigned && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-400">
                            Upload or type a signature, then click to place it.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Document>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  Loading document preview...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/30 to-white p-6 shadow-[0_18px_45px_-32px_rgba(16,185,129,0.35)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-700">
                  Signature Setup
                </p>
                <h3 className="mt-2 text-base font-semibold text-gray-900">
                  Add your signature
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Upload an image or type your name to create a signature.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                Step 1
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-dashed border-emerald-200/80 bg-white/70 p-4">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-emerald-800">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shadow-sm">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                  Upload signature image
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(event) => handleFileUpload(event.target.files?.[0])}
                  />
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  PNG or JPG recommended.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100/70 bg-white p-4 shadow-sm">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Type your name
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={typedName}
                    onChange={(event) => setTypedName(event.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleCreateTypedSignature}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                    disabled={!typedName.trim()}
                  >
                    <Type className="h-4 w-4" />
                    Create
                  </button>
                </div>
              </div>

              {signatureImage && !isSigned && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="text-xs font-semibold text-emerald-800">
                    Signature preview
                  </p>
                  <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3">
                    <img
                      src={signatureImage}
                      alt="Signature preview"
                      className="max-h-24 w-full object-contain"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Click on the document to place. Drag to move and resize.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.15)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-gray-500">
                  Final Step
                </p>
                <h3 className="mt-2 text-base font-semibold text-gray-900">
                  Confirm signature
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Finalize and embed your signature into the PDF.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600">
                Step 2
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={handleConfirmSignature}
                disabled={!signatureBox || isSigned}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  signatureBox && !isSigned
                    ? "bg-[#01411C] text-white shadow-[0_14px_30px_-18px_rgba(1,65,28,0.8)] hover:bg-[#024a23]"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSigned ? "Signed" : "Confirm & Embed Signature"}
              </button>

              <button
                onClick={handleClearPlacement}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                Clear placement
              </button>

              {isSigned && (
                <button
                  onClick={handleAttachToCase}
                  disabled={isAttached}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all ${
                    isAttached
                      ? "bg-emerald-50 text-emerald-600"
                      : "border border-emerald-200 bg-white text-emerald-800 shadow-[0_12px_26px_-20px_rgba(16,185,129,0.6)] hover:bg-emerald-50"
                  }`}
                >
                  {isAttached ? "Sent to Case File" : "Send Signed PDF to Case File"}
                </button>
              )}

              <button
                onClick={handleDownload}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-[0_12px_26px_-20px_rgba(16,185,129,0.6)] transition-all hover:bg-emerald-50"
              >
                <Download className="h-4 w-4" />
                Download Signed PDF
              </button>

              <button
                type="button"
                onClick={() => navigate({ to: "/lawyer-signatures" })}
                className="w-full rounded-lg text-xs text-gray-500 hover:text-gray-700"
              >
                Back to signatures
              </button>
            </div>
          </div>
        </div>
      </div>
    </LawyerLayout>
  );
}
