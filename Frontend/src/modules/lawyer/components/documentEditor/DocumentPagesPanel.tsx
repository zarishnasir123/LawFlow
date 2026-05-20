import { useState, useEffect, useMemo } from "react";
import { FileText, ChevronRight, Send } from "lucide-react";
import clsx from "clsx";

interface DocumentPagesPanelProps {
  // Live references to the rendered DOM pages from docx-preview. We use
  // refs (not derived data) because clicking a page should scrollIntoView
  // the exact rendered element — translating through serialized data would
  // lose that connection.
  pages: HTMLElement[];
  // Fired when the lawyer clicks the "send to client" icon on a specific
  // page. The parent owns the signature-request workflow and decides what
  // to do with the page (e.g., extract its content as PDF and open the
  // signature request modal).
  onSendPageToClient?: (pageIndex: number, pageElement: HTMLElement) => void;
}

// Try a series of strategies to find a meaningful label for a page:
//
//   1. A real heading tag (h1/h2/h3) — what docx-preview *should* emit
//      when the source .docx has a Heading style applied.
//   2. The first paragraph whose text matches our generator's section
//      pattern "─── Section Name ───" — docx-preview can also render
//      these as plain styled <p> if the source style is custom.
//   3. The first non-empty block of text on the page — guarantees a
//      meaningful label even for pages that have no heading at all
//      (e.g., the second page of a long Body of the Plaint section).
//
// All three strategies fall back to the page number if nothing matches.
function deriveLabel(page: HTMLElement, fallback: string): string {
  // Strategy 1: real heading tag.
  const heading = page.querySelector("h1, h2, h3, h4, h5, h6");
  if (heading?.textContent?.trim()) {
    return stripDashes(heading.textContent.trim());
  }

  // Strategy 2: paragraph containing the "─── ... ───" pattern that our
  // generator uses for sectionHeading() — these are H1s in the source
  // .docx but docx-preview may render them as styled <p> if the heading
  // style isn't recognised.
  const paragraphs = page.querySelectorAll("p");
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim() || "";
    if (/^[─—-]{2,}\s*.+?\s*[─—-]{2,}$/.test(text)) {
      return stripDashes(text);
    }
  }

  // Strategy 3: first non-empty paragraph, truncated.
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim();
    if (text && text.length > 2) {
      // Trim to a readable preview length; sidebar gets unreadable
      // if the label is a whole paragraph.
      return text.length > 38 ? `${text.slice(0, 38)}…` : text;
    }
  }

  return fallback;
}

function stripDashes(text: string): string {
  return text.replace(/^[─—-]+\s*|\s*[─—-]+$/g, "").trim();
}

export default function DocumentPagesPanel({
  pages,
  onSendPageToClient,
}: DocumentPagesPanelProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Build the displayed page list once per pages-array change. Using
  // useMemo (not state) keeps the label derivation tied to the source
  // pages array — if the parent re-renders with new pages, labels
  // recompute automatically.
  const items = useMemo(
    () =>
      pages.map((page, index) => ({
        index,
        label: deriveLabel(page, `Page ${index + 1}`),
        element: page,
      })),
    [pages]
  );

  // Highlight whichever page is closest to the top of the scroll viewport.
  // This gives the lawyer a "you are here" indicator that stays in sync
  // as they scroll through the document.
  useEffect(() => {
    if (pages.length === 0) return;
    const scrollHost = pages[0].closest(".docx-preview-host")?.parentElement;
    if (!scrollHost) return;

    const handleScroll = () => {
      const hostRect = scrollHost.getBoundingClientRect();
      let closest = 0;
      let closestDistance = Infinity;
      pages.forEach((page, idx) => {
        const rect = page.getBoundingClientRect();
        const distance = Math.abs(rect.top - hostRect.top);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = idx;
        }
      });
      setActiveIndex(closest);
    };

    handleScroll();
    scrollHost.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollHost.removeEventListener("scroll", handleScroll);
  }, [pages]);

  const handlePageClick = (index: number, element: HTMLElement) => {
    setActiveIndex(index);
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="px-4 py-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
            Pages
          </h2>
        </div>
        <p className="text-[11px] text-gray-500 mt-1 ml-6">
          {pages.length} {pages.length === 1 ? "page" : "pages"} · click to jump or send
        </p>
      </div>
      <ol className="py-1">
        {items.map((item) => {
          const isActive = item.index === activeIndex;
          return (
            <li key={item.index}>
              <div
                className={clsx(
                  "group flex items-stretch border-l-2 transition-colors",
                  isActive
                    ? "border-l-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-l-transparent hover:border-l-gray-300 hover:bg-gray-50"
                )}
              >
                <button
                  type="button"
                  onClick={() => handlePageClick(item.index, item.element)}
                  className="flex-1 flex items-start gap-3 pl-3 pr-2 py-2 text-left"
                >
                  <span
                    className={clsx(
                      "flex-shrink-0 mt-0.5 w-6 h-6 rounded-md text-[11px] font-semibold flex items-center justify-center transition-colors",
                      isActive
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                    )}
                  >
                    {item.index + 1}
                  </span>
                  <span
                    className={clsx(
                      "flex-1 text-sm leading-snug pt-0.5",
                      isActive
                        ? "text-[var(--primary)] font-semibold"
                        : "text-gray-700 group-hover:text-gray-900"
                    )}
                  >
                    {item.label}
                  </span>
                  <ChevronRight
                    className={clsx(
                      "w-3.5 h-3.5 mt-1 flex-shrink-0 transition-opacity",
                      isActive
                        ? "text-[var(--primary)] opacity-100"
                        : "text-gray-300 opacity-0 group-hover:opacity-100"
                    )}
                  />
                </button>
                {onSendPageToClient && (
                  <button
                    type="button"
                    onClick={() => onSendPageToClient(item.index, item.element)}
                    title={`Send page ${item.index + 1} to client for signature`}
                    className={clsx(
                      "flex-shrink-0 w-9 flex items-center justify-center transition-colors",
                      "text-gray-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10",
                      "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
