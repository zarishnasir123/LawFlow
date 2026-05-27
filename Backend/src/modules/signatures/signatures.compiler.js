// Final case-file PDF compiler.
//
// Runs once every signature_request on a case reaches status='signed'.
//
// Architecture (v2 — client-rendered pages):
//   The compiler no longer re-renders the case HTML server-side. Each
//   signer's browser captures the assigned pages AS THEY APPEARED — with
//   their signature already drag-placed on them — and uploads the
//   per-page PNGs alongside the signature submission. This compiler's
//   job is to glue those captured PNGs into a single PDF and upload it
//   to Supabase Storage. No puppeteer, no font availability concerns,
//   no @media print vs @media screen drift: the signed PDF is
//   byte-identical to what the signer reviewed.
//
//   Why we ripped out puppeteer:
//     v1 re-rendered the snapshot HTML via puppeteer and overlaid the
//     signature using fractional coordinates. The snapshot contained no
//     embedded fonts, so puppeteer's headless Chromium occasionally
//     laid out text with slightly different line heights than the
//     signer's browser — moving the surrounding text rows up or down
//     while the signature stayed at its fixed fractional position.
//     Signatures were landing on the wrong line in the compiled PDF.
//
//   When multiple signers sign the SAME page (rare but possible if a
//   page is co-assigned), the LATEST-signed capture wins — that signer
//   saw all prior signatures already on the page, so their capture is
//   the most up-to-date composite.

import { PDFDocument } from "pdf-lib";

import { pool } from "../../config/db.js";
import { uploadSignedCasePdf } from "../../services/storage.service.js";

// Strip the data: prefix and decode the base64 payload so pdf-lib's
// embedPng / embedJpg can accept raw bytes.
function dataUrlToBytes(dataUrl) {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;
  const base64 = dataUrl.slice(commaIdx + 1);
  const meta = dataUrl.slice(0, commaIdx);
  const isJpeg = /image\/(jpeg|jpg)/i.test(meta);
  try {
    return { bytes: Uint8Array.from(Buffer.from(base64, "base64")), isJpeg };
  } catch {
    return null;
  }
}

// Pick the most-recently-signed page capture for each absolute page
// index. We iterate signed_requests in signed_at DESC order, so the
// FIRST entry we see for a given pageIndex is the freshest one.
// Returns Map<pageIndex, imageDataUrl>.
function collectFreshestPageCaptures(signedRequests) {
  const byIndex = new Map();
  for (const req of signedRequests) {
    if (!req.signed_page_images) continue;
    const captures =
      typeof req.signed_page_images === "string"
        ? JSON.parse(req.signed_page_images)
        : req.signed_page_images;
    if (!Array.isArray(captures)) continue;
    for (const capture of captures) {
      if (
        !capture ||
        typeof capture.pageIndex !== "number" ||
        typeof capture.imageDataUrl !== "string"
      ) {
        continue;
      }
      // signed_at DESC ordering means the first hit per index is the
      // freshest — don't overwrite it with an older signer's capture.
      if (!byIndex.has(capture.pageIndex)) {
        byIndex.set(capture.pageIndex, capture.imageDataUrl);
      }
    }
  }
  return byIndex;
}

// Build the final PDF by embedding the captured page PNGs in absolute-
// pageIndex order. Each PNG becomes one PDF page sized to the image's
// intrinsic pixel dimensions (converted to PDF points 1 CSS px = 0.75 pt
// at 96 dpi). This keeps the output at the same visual scale the signer
// saw without baking in a hard A4 assumption — if a case template
// happens to use Letter or a custom size, the captured PNG carries the
// correct aspect ratio.
async function buildPdfFromCaptures(captureMap) {
  const pdfDoc = await PDFDocument.create();

  // Sort by absolute page index so multi-page cases come out in the
  // signer's reading order.
  const orderedIndices = Array.from(captureMap.keys()).sort((a, b) => a - b);

  for (const pageIndex of orderedIndices) {
    const dataUrl = captureMap.get(pageIndex);
    const decoded = dataUrlToBytes(dataUrl);
    if (!decoded) continue;

    let embedded;
    try {
      embedded = decoded.isJpeg
        ? await pdfDoc.embedJpg(decoded.bytes)
        : await pdfDoc.embedPng(decoded.bytes);
    } catch (err) {
      console.error("[COMPILE] Failed to embed page image", {
        pageIndex,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // Image dimensions are in CSS pixels (html2canvas reports the
    // captured element's CSS size × scale factor; the resulting PNG's
    // intrinsic pixel dimensions match). Convert to PDF points at
    // 96 dpi for a 1:1 visual scale.
    const widthPt = (embedded.width / 96) * 72;
    const heightPt = (embedded.height / 96) * 72;
    const page = pdfDoc.addPage([widthPt, heightPt]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: widthPt,
      height: heightPt,
    });
  }

  return pdfDoc.save();
}

// =====================================================================
// Public entry point.
// =====================================================================
//
// Called from submitSignature() when the case transitions to fully
// signed. Throws on compile / upload failure; caller decides whether
// to surface the error to the signer.
export async function compileCaseSignedPdf({ caseId, lawyerUserId }) {
  const { rows: signedRequests } = await pool.query(
    `SELECT id,
            page_indices,
            signature_placement,
            signed_page_images,
            signed_at
     FROM signature_requests
     WHERE case_id = $1 AND status = 'signed'
     ORDER BY signed_at DESC`,
    [caseId]
  );

  if (signedRequests.length === 0) {
    throw new Error("No signed signature requests found for this case");
  }

  const captureMap = collectFreshestPageCaptures(signedRequests);

  if (captureMap.size === 0) {
    // Every signed request shipped without page captures. This should
    // only happen for rows signed under the v1 model before the
    // signed_page_images column existed. Surface a clear error rather
    // than producing an empty PDF.
    throw new Error(
      "No page captures available for this case — was it signed under the legacy flow?"
    );
  }

  const pdfBytes = await buildPdfFromCaptures(captureMap);

  const { storagePath } = await uploadSignedCasePdf({
    lawyerUserId,
    caseId,
    pdfBuffer: Buffer.from(pdfBytes),
  });

  await pool.query(
    `UPDATE cases
     SET signed_pdf_storage_path = $1,
         signed_pdf_generated_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [storagePath, caseId]
  );

  return { storagePath };
}
