// Derive a human-readable label for a rendered document page (a docx-preview
// `<section.docx>` element): the same names the editor's page sidebar shows
// (e.g. "Cause Title & Parties", "Verification", "Vakalatnama"). Prefers a
// heading, then a dashed section-title paragraph like "── Cause Title ──",
// then the first meaningful paragraph, else the caller's fallback.
//
// Shared by the Send-signature panel (naming the pages a signer covers) and the
// Submit-Case page (naming which sections each signer signed), so the two stay
// in sync with one source of truth.
export function derivePageLabel(page: HTMLElement, fallback: string): string {
  const heading = page.querySelector("h1, h2, h3, h4, h5, h6");
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim().replace(/[─—-]+/g, "").trim();
  }
  const paragraphs = page.querySelectorAll("p");
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim() || "";
    if (/^[─—-]{2,}\s*.+?\s*[─—-]{2,}$/.test(text)) {
      return text.replace(/[─—-]+/g, "").trim();
    }
  }
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim();
    if (text && text.length > 2) {
      return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    }
  }
  return fallback;
}
