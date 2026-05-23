import { useEffect, useRef } from "react";
import { Scale, User, Users } from "lucide-react";

// Floating right-click context menu for a page row OR a rendered
// <section.docx> on the canvas. Closes on outside-click, Escape,
// scroll, or window-resize so a stale menu can't linger.
//
// Three rows surface "Send for Signature" with the signer baked in,
// per the user's spec. Picking a row fires the request directly —
// no separate Send button, no modal step (fewest clicks for the
// 1-page common case). The advanced multi-page / multi-signer flow
// is still reachable from the toolbar's Signatures button → panel.

export type SignerChoice = "client" | "lawyer" | "both";

export interface PageContextMenuState {
  // Viewport pixel coordinates where the right-click happened.
  x: number;
  y: number;
  // 0-based index of the page the user right-clicked on.
  pageIndex: number;
}

interface PageContextMenuProps {
  state: PageContextMenuState;
  // One callback that receives the chosen signer — keeps the menu
  // dumb (just emits the user's intent) and lets the parent decide
  // how to construct the API payload.
  onSend: (pageIndex: number, signer: SignerChoice) => void;
  onClose: () => void;
}

export default function PageContextMenu({
  state,
  onSend,
  onClose,
}: PageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Outside click + Escape + scroll/resize close the menu. We attach
  // to the document in capture phase so the close fires before any
  // child click handler can also react to the same event.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScrollOrResize = () => onClose();
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [onClose]);

  // Keep the menu on screen even when the click happens near the
  // right/bottom edge. Three rows + header ≈ 168px; bump the clamp
  // height so the menu never spills past the bottom when the lawyer
  // right-clicks near the footer of the viewport.
  const MENU_W = 240;
  const MENU_H = 168;
  const left = Math.min(state.x, window.innerWidth - MENU_W - 8);
  const top = Math.min(state.y, window.innerHeight - MENU_H - 8);

  const handlePick = (signer: SignerChoice) => {
    onSend(state.pageIndex, signer);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[220px] rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden"
      style={{ left, top }}
      role="menu"
    >
      {/* Header — non-interactive label. Mirrors the user's mockup
          so the three rows below read as "options for this action". */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Send for Signature
        </span>
        <span className="text-[10px] font-medium text-gray-400">
          Page {state.pageIndex + 1}
        </span>
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={() => handlePick("client")}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-emerald-50 hover:text-emerald-800"
      >
        <User className="h-4 w-4 text-emerald-600" />
        Client Only
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => handlePick("lawyer")}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-emerald-50 hover:text-emerald-800"
      >
        <Scale className="h-4 w-4 text-emerald-600" />
        Lawyer Only
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => handlePick("both")}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-emerald-50 hover:text-emerald-800"
      >
        <Users className="h-4 w-4 text-emerald-600" />
        Both (Client + Lawyer)
      </button>
    </div>
  );
}
