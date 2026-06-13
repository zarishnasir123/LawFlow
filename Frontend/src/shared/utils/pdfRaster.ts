import { pdfjs } from "react-pdf";

// pdfjs needs its worker wired before any getDocument() call. We point it at
// the bundled worker module so Vite resolves it through import.meta.url (no
// CDN, works offline). This mirrors the inline setup in
// LawyerCaseFilingSubmissionPage.tsx; centralising it here lets the registrar
// review page reuse the exact same rasterizer without duplicating the worker
// wiring.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Rasterize every page of a PDF (given a URL) to a PNG data URL. Shared by the
// complete-case-file preview (to pull the signed pages back out of the
// compiled signed.pdf for overlaying) and the print/bundle builders (to
// flatten PDF attachments into printable images). Copied verbatim from the
// lawyer submission page's inline helper so both surfaces produce identical
// output.
export async function renderPdfPagesToDataUrls(url: string): Promise<string[]> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/png"));
  }
  return images;
}
