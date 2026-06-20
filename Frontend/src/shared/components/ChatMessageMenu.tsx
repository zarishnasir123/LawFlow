import { ChevronDown, Copy, Download, ExternalLink, Reply } from "lucide-react";
import { useState } from "react";
import type { ChatMessage } from "../../types/chat";
import { forceDownloadUrl } from "../utils/chatAttachmentUrl";

// WhatsApp-web-style per-message options menu: a small chevron that appears on
// hover and opens a dropdown. Offers Reply, Download/Open (attachments), and
// Copy (text).

export default function ChatMessageMenu({
  msg,
  mine,
  onReply,
}: {
  msg: ChatMessage;
  mine: boolean;
  // Start replying to this message (sets the composer's reply bar).
  onReply?: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Voice notes carry their own inline Download button (and the audio player's
  // controls fill the bubble), so they don't get the hover menu.
  if (msg.kind === "voice") return null;

  const isAttachment = msg.kind === "file";
  const url = msg.attachmentUrl || undefined;
  const hasText = !isAttachment && Boolean(msg.text);

  // Nothing actionable (e.g. an attachment whose signed URL failed) → no menu.
  if (!isAttachment && !hasText) return null;
  if (isAttachment && !url) return null;

  const close = () => setOpen(false);

  const handleDownload = () => {
    if (!url) return;
    const name =
      msg.attachmentName || (msg.kind === "voice" ? "voice-message" : "download");
    const a = document.createElement("a");
    a.href = forceDownloadUrl(url, name);
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    close();
  };

  const handleOpen = () => {
    if (url) window.open(url, "_blank", "noreferrer");
    close();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text || "");
    } catch (err) {
      console.error("Copy failed:", err);
    }
    close();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Options"
        className={`rounded p-0.5 opacity-0 transition group-hover/msg:opacity-100 focus:opacity-100 ${
          mine
            ? "text-green-100 hover:bg-white/20"
            : "text-gray-400 hover:bg-gray-200"
        } ${open ? "opacity-100" : ""}`}
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm text-gray-700 shadow-lg">
            {onReply && (
              <button
                type="button"
                onClick={() => {
                  onReply();
                  close();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <Reply className="h-4 w-4" /> Reply
              </button>
            )}
            {isAttachment && (
              <button
                type="button"
                onClick={handleDownload}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            )}
            {isAttachment && (
              <button
                type="button"
                onClick={handleOpen}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4" /> Open
              </button>
            )}
            {hasText && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
