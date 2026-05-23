import { useState, useEffect, useMemo } from "react";
import { ChevronRight, Send } from "lucide-react";
import clsx from "clsx";

// Per-page signature status. The parent computes this from
// signature_requests' page_indices + signer_role + status='signed' and
// passes it in. Each entry signals which signer(s) have completed their
// signature on that page, so the sidebar can render the right badge.
export interface PageSignatureStatus {
  clientSigned: boolean;
  lawyerSigned: boolean;
}

interface DocumentPagesPanelProps {
  // Live references to the rendered DOM pages from docx-preview. We use
  // refs (not derived data) because clicking a page should scrollIntoView
  // the exact rendered element — translating through serialized data
  // would lose that connection.
  pages: HTMLElement[];
  // Fired when the lawyer clicks the "send to client" icon on a specific
  // page. The parent owns the signature-request workflow.
  onSendPageToClient?: (pageIndex: number, pageElement: HTMLElement) => void;
  // Fired when the lawyer right-clicks a page row. The parent renders
  // the floating context menu at (x, y). We bubble the raw viewport
  // coords + the page index up so the menu can sit at the cursor.
  onPageContextMenu?: (pageIndex: number, x: number, y: number) => void;
  // Map of 0-based page index → signature status. Pages absent from
  // the map (or with both flags false) get no badge.
  signatureStatusByPageIndex?: Record<number, PageSignatureStatus>;
  // Sidebar collapsed mode — compact number-only pills.
  collapsed?: boolean;
}

// Try a series of strategies to find a meaningful label for a page:
//   1. A real heading tag (h1/h2/h3) — what docx-preview emits when the
//      source .docx has a Heading style applied.
//   2. The first paragraph whose text matches our generator's section
//      pattern "─── Section Name ───".
//   3. The first non-empty block of text on the page.
// All three fall back to the page number if nothing matches.
function deriveLabel(page: HTMLElement, fallback: string): string {
  const heading = page.querySelector("h1, h2, h3, h4, h5, h6");
  if (heading?.textContent?.trim()) {
    return stripDashes(heading.textContent.trim());
  }

  const paragraphs = page.querySelectorAll("p");
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim() || "";
    if (/^[─—-]{2,}\s*.+?\s*[─—-]{2,}$/.test(text)) {
      return stripDashes(text);
    }
  }

  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim();
    if (text && text.length > 2) {
      return text.length > 38 ? `${text.slice(0, 38)}…` : text;
    }
  }

  return fallback;
}

function stripDashes(text: string): string {
  return text.replace(/^[─—-]+\s*|\s*[─—-]+$/g, "").trim();
}

// Returns the badge to show next to a page, or null when the page has
// no signature activity yet. Both flags = green; client only = amber;
// lawyer only = indigo. Kept inline so the visual decision sits with
// the panel that renders it.
function deriveSignatureBadge(status: PageSignatureStatus | undefined) {
  if (!status) return null;
  if (status.clientSigned && status.lawyerSigned) {
    return { label: "Client + Lawyer Signed", className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200" };
  }
  if (status.clientSigned) {
    return { label: "Client Signed", className: "bg-amber-100 text-amber-800 ring-1 ring-amber-200" };
  }
  if (status.lawyerSigned) {
    return { label: "Lawyer Signed", className: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200" };
  }
  return null;
}

export default function DocumentPagesPanel({
  pages,
  onSendPageToClient,
  onPageContextMenu,
  signatureStatusByPageIndex,
  collapsed = false,
}: DocumentPagesPanelProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const items = useMemo(
    () =>
      pages.map((page, index) => ({
        index,
        label: deriveLabel(page, `Page ${index + 1}`),
        element: page,
      })),
    [pages]
  );

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

  if (collapsed) {
    return (
      <div className="border-t border-gray-100 bg-white py-2">
        <ol className="flex flex-col items-center gap-1 px-1">
          {items.map((item) => {
            const isActive = item.index === activeIndex;
            const badge = deriveSignatureBadge(
              signatureStatusByPageIndex?.[item.index]
            );
            return (
              <li key={item.index}>
                <button
                  type="button"
                  onClick={() => handlePageClick(item.index, item.element)}
                  title={
                    badge
                      ? `${item.index + 1}. ${item.label} — ${badge.label}`
                      : `${item.index + 1}. ${item.label}`
                  }
                  className={clsx(
                    "relative flex items-center justify-center w-9 h-9 rounded-md text-[12px] font-semibold transition-colors",
                    isActive
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  {item.index + 1}
                  {badge && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-white">
      <div className="px-4 py-3 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em]">
            Pages
          </h2>
          <span className="text-[10px] text-gray-400 font-medium">
            {pages.length}
          </span>
        </div>
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
                onContextMenu={(e) => {
                  if (!onPageContextMenu) return;
                  e.preventDefault();
                  onPageContextMenu(item.index, e.clientX, e.clientY);
                }}
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
                    {(() => {
                      const badge = deriveSignatureBadge(
                        signatureStatusByPageIndex?.[item.index]
                      );
                      if (!badge) return null;
                      return (
                        <span
                          className={clsx(
                            "ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
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
