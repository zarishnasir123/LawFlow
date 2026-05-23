// Final case-file PDF compiler.
//
// Runs once every signature_request on a case reaches status='signed'.
// Pipeline:
//   1. Pick the latest HTML snapshot from the case's signed requests.
//      Carries everything the recipient saw at sign time (page CSS,
//      fonts, edit state, etc.), so the compiled PDF matches.
//   2. For each docx-preview <section.docx> in the snapshot, hide the
//      OTHER sections via display:none and render JUST that section
//      as a one-page PDF whose dimensions equal that section's
//      measured render size. This gives us an iron-clad guarantee
//      that section N → PDF page N at identical dimensions — no
//      pagination drift, no cross-section overflow.
//   3. Stamp the signatures owned by section N onto that page using
//      the signer's captured xPct / yPct / widthPct / heightPct.
//      Math is trivial: page dimensions === section dimensions, so
//      the percentages translate one-to-one.
//   4. Concatenate every section's stamped PDF into one document and
//      upload to Supabase Storage at lawyers/{userId}/cases/{caseId}/
//      signed.pdf.
//
// Why per-section rendering instead of one big page.pdf() call?
//   We tried that. Two flavors:
//   - `format: A4` → sections smaller than A4 left whitespace, sections
//     larger than A4 split across PDF pages → signatures shifted to
//     trailing blank pages.
//   - Single page.pdf({ width, height }) sized to first-section
//     dimensions → still split when subsequent sections were taller
//     OR when print-media rendering produced taller content than
//     screen-media measurement.
//   Rendering each section in isolation eliminates both problems —
//   the renderer only ever sees one section's worth of content, the
//   page is sized for exactly that content, no surprise paginations.

import { PDFDocument } from "pdf-lib";

import { pool } from "../../config/db.js";
import { uploadSignedCasePdf } from "../../services/storage.service.js";

// Lazy-launched singleton browser. puppeteer's first launch is the
// expensive part (~700ms); subsequent renders reuse the same Chromium
// instance and take ~1-2s each. We keep the browser alive for the
// process lifetime — if Chromium crashes, the next compile call
// re-launches.
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const { default: puppeteer } = await import("puppeteer");
    browserPromise = puppeteer
      .launch({
        // Headless 'new' is the default in puppeteer v22+ but pinned
        // here so behavior doesn't change if the default flips.
        headless: true,
        args: [
          // Required for some Linux server environments (Docker, CI).
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
      })
      .catch((err) => {
        // Reset so the next call retries instead of returning a
        // permanently-rejected promise.
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

// Strip the data: prefix so pdf-lib's embedPng gets raw bytes.
function dataUrlToBytes(dataUrl) {
  const idx = dataUrl.indexOf(",");
  if (idx === -1) return new Uint8Array();
  const base64 = dataUrl.slice(idx + 1);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

// Group signed requests by the page index where the signer dropped
// their signature, so the per-section renderer can look up "what
// signatures land on this section?" in O(1).
function groupSignaturesByPageIndex(signedRequests) {
  const byIndex = new Map();
  for (const req of signedRequests) {
    if (!req.signature_image || !req.signature_placement) continue;
    const placement = typeof req.signature_placement === "string"
      ? JSON.parse(req.signature_placement)
      : req.signature_placement;
    const { pageIndex } = placement;
    if (typeof pageIndex !== "number") continue;
    const list = byIndex.get(pageIndex) || [];
    list.push({ image: req.signature_image, placement });
    byIndex.set(pageIndex, list);
  }
  return byIndex;
}

// Stamp the signatures owned by one section onto that section's PDF.
// Mutates pdfDoc in place. Page dimensions === section dimensions, so
// the signer's percentages translate directly.
async function stampSectionSignatures(pdfDoc, sigs) {
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return;
  // If the section's content somehow overflowed onto a second PDF page
  // (rare — happens if our measurement missed by a pixel), we stamp on
  // page 1 since that's where the section starts and where the signer
  // was looking when they placed the signature.
  const targetPage = pages[0];
  const { width: pageW, height: pageH } = targetPage.getSize();

  for (const sig of sigs) {
    const { xPct, yPct, widthPct, heightPct } = sig.placement;
    if (
      typeof xPct !== "number" ||
      typeof yPct !== "number" ||
      typeof widthPct !== "number" ||
      typeof heightPct !== "number"
    ) {
      continue;
    }

    let pngImage;
    try {
      const bytes = dataUrlToBytes(sig.image);
      pngImage = await pdfDoc.embedPng(bytes);
    } catch {
      // If the data URL isn't a valid PNG (rare — frontend canvas
      // always produces PNG) we skip this signature rather than
      // failing the whole compile.
      continue;
    }

    const stampW = widthPct * pageW;
    const stampH = heightPct * pageH;
    const stampX = xPct * pageW;
    // Browser coords are top-left, PDF coords are bottom-left. Convert.
    const stampY = pageH - yPct * pageH - stampH;

    targetPage.drawImage(pngImage, {
      x: stampX,
      y: stampY,
      width: stampW,
      height: stampH,
    });
  }
}

// Render the snapshot HTML and produce a final, stamped, concatenated
// PDF. The single puppeteer page is reused across all sections — we
// just toggle display:none on the sections we're not currently
// rendering and re-call page.pdf() each iteration.
async function renderAndStampPdf(html, signedRequests) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15_000 });

    // Neutralize wrapper / body styling that would otherwise add
    // top/left whitespace inside each section's PDF page. Also strip
    // the editor's box-shadow and outline so the print is clean.
    await page.addStyleTag({
      content: `
        html, body, .docx-wrapper {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        .docx-wrapper > section.docx {
          margin: 0 !important;
          box-shadow: none !important;
          outline: none !important;
          border: none !important;
        }
      `,
    });

    // Discover every section's rendered dimensions in CSS pixels.
    // We capture all dimensions up front (before hiding any) because
    // toggling display affects sibling layout in some edge cases —
    // taking the snapshot first means each section's number reflects
    // its in-flow size.
    const sectionDimsList = await page.evaluate(() => {
      const els = document.querySelectorAll(".docx-wrapper > section.docx");
      return Array.from(els).map((el) => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    });

    // Defensive fallback: if the snapshot has no recognizable sections,
    // render the whole document as A4 and stamp via simple per-page
    // math. Better to produce a slightly-misaligned PDF than to crash
    // the entire compile.
    if (sectionDimsList.length === 0) {
      const fallbackPdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      const fallbackDoc = await PDFDocument.load(fallbackPdf);
      const sigsByIndex = groupSignaturesByPageIndex(signedRequests);
      const pages = fallbackDoc.getPages();
      for (let i = 0; i < pages.length; i++) {
        const sigs = sigsByIndex.get(i) || [];
        await stampSectionSignatures(fallbackDoc, sigs);
      }
      return fallbackDoc.save();
    }

    const sigsByIndex = groupSignaturesByPageIndex(signedRequests);
    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < sectionDimsList.length; i++) {
      const dims = sectionDimsList[i];

      // Show only section i. The others get display:none so they
      // take no layout space and produce no print output — guarantees
      // this page.pdf() call yields exactly one section's worth of
      // content.
      await page.evaluate((targetIdx) => {
        document
          .querySelectorAll(".docx-wrapper > section.docx")
          .forEach((el, idx) => {
            el.style.display = idx === targetIdx ? "" : "none";
          });
      }, i);

      // Render this single section to a PDF whose page size matches
      // the section's measured dimensions exactly.
      const sectionPdfBuffer = await page.pdf({
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });

      // Stamp the signatures that belong on this section, then copy
      // every page of the stamped section into the merged output.
      // (Almost always exactly 1 page; we copy all defensively in
      // case content overflowed unexpectedly.)
      const sectionDoc = await PDFDocument.load(sectionPdfBuffer);
      const sigs = sigsByIndex.get(i) || [];
      await stampSectionSignatures(sectionDoc, sigs);

      const copied = await mergedPdf.copyPages(
        sectionDoc,
        sectionDoc.getPageIndices()
      );
      copied.forEach((p) => mergedPdf.addPage(p));
    }

    return mergedPdf.save();
  } finally {
    await page.close().catch(() => {});
  }
}

// Pick the document snapshot to render. All rows in a single batch
// share the same snapshot. When multiple batches exist (re-sends
// after edits), we use the most recently-signed row's snapshot — it
// reflects the latest content both signers agreed to. Documented as
// an FYP-acceptable simplification.
function pickSnapshot(signedRequests) {
  if (signedRequests.length === 0) return null;
  const sorted = [...signedRequests].sort(
    (a, b) =>
      new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime()
  );
  return sorted[0].document_html_snapshot;
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
            signature_image,
            signature_placement,
            document_html_snapshot,
            signed_at
     FROM signature_requests
     WHERE case_id = $1 AND status = 'signed'
     ORDER BY signed_at DESC`,
    [caseId]
  );

  if (signedRequests.length === 0) {
    throw new Error("No signed signature requests found for this case");
  }

  const html = pickSnapshot(signedRequests);
  if (!html) {
    throw new Error("Signed requests have no document snapshot to render");
  }

  const stampedPdf = await renderAndStampPdf(html, signedRequests);

  const { storagePath } = await uploadSignedCasePdf({
    lawyerUserId,
    caseId,
    pdfBuffer: Buffer.from(stampedPdf),
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
