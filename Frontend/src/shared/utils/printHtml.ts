// Print arbitrary HTML in isolation — WITHOUT opening a visible browser tab.
//
// The problem with the old approach (`window.open("", "_blank")`): it spawns a
// real, visible about:blank tab, writes the case-file content into it, and
// prints. When the user Cancels (or closes) the print dialog, that tab is left
// behind showing the raw content — the registrar/lawyer is dumped onto a stray
// page instead of staying on the review/submit screen.
//
// Instead we render the content into an OFF-SCREEN <iframe>, print that iframe,
// and remove it once the print dialog closes. The case file appears ONLY inside
// the print preview; nothing lingers in the page or in a new tab. This is the
// same technique print libraries (print-js, react-to-print) use.

type PrintHtmlOptions = {
  // Document <title> — becomes the default PDF filename in the print dialog.
  title?: string;
  // Raw HTML injected into <head> (e.g. <style>…</style> and any carried-over
  // document styles). Optional.
  headHtml?: string;
  // Raw HTML for the <body> — the content to print.
  bodyHtml: string;
  // Max time (ms) to wait for images to load before printing anyway, so a
  // stuck/slow image can't block the dialog forever. Defaults to 8s.
  imageTimeoutMs?: number;
  // Called once, right before the print dialog is opened (after images have
  // loaded). Handy for clearing an "Opening the print dialog…" message so it
  // doesn't linger after the dialog appears.
  onBeforePrint?: () => void;
};

// Returns true once the print flow has started. Returns false only if the
// hidden iframe's document couldn't be created (extremely rare). Callers no
// longer need to handle popup-blocker errors — no popup is opened.
export function printHtmlDocument({
  title = "",
  headHtml = "",
  bodyHtml,
  imageTimeoutMs = 8000,
  onBeforePrint,
}: PrintHtmlOptions): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  // Off-screen + zero-size + hidden. Printing targets the iframe's OWN document,
  // so the iframe element's on-screen size/visibility doesn't affect the
  // printout — the full content still renders in the print preview.
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }

  // Remove the iframe exactly once — after the dialog closes (afterprint fires
  // for both Print AND Cancel in modern browsers), or via a safety fallback.
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    // Small delay so the browser has fully handed the document to the print
    // subsystem before we tear the iframe down.
    window.setTimeout(() => iframe.remove(), 500);
  };

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8" />` +
      `<title>${title}</title>${headHtml}</head><body>${bodyHtml}</body></html>`
  );
  doc.close();

  const fire = () => {
    onBeforePrint?.();
    win.focus();
    win.onafterprint = cleanup;
    win.print();
    // Fallback cleanup in case afterprint never fires (rare / older browsers).
    window.setTimeout(cleanup, 60000);
  };

  // Don't open the print dialog until images (attachments + signed-page
  // captures) have loaded, or the printout can come out blank/partial.
  const images = Array.from(doc.images);
  let remaining = images.filter((img) => !img.complete).length;
  if (remaining === 0) {
    window.setTimeout(fire, 150);
  } else {
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) fire();
    };
    images.forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    // Safety net: print anyway if an image never resolves.
    window.setTimeout(() => {
      if (remaining > 0) {
        remaining = 0;
        fire();
      }
    }, imageTimeoutMs);
  }

  return true;
}
