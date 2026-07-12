import { Download, FileText, Mic } from "lucide-react";
import type { ChatMessage } from "../../types/chat";
import { formatDuration } from "../utils/voiceRecorder";
import { forceDownloadUrl } from "../utils/chatAttachmentUrl";

// Renders the body of a "file" or "voice" chat message: an image preview, a
// download chip for documents, or an inline audio player for voice notes.
// `mine` flips the colors so it reads well on the green (own) bubble vs the
// gray (received) bubble.

function humanSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatAttachment({
  msg,
  mine,
}: {
  msg: ChatMessage;
  mine: boolean;
}) {
  const url = msg.attachmentUrl || undefined;
  const isImage = (msg.attachmentMime || "").startsWith("image/");

  // Voice note → inline audio player + an explicit Download button. We turn
  // OFF the native player's own download menu (controlsList="nodownload") and
  // provide our own button, because the native one overlaps the bubble's
  // options arrow and isn't reliable for signed URLs.
  if (msg.kind === "voice") {
    const voiceName = msg.attachmentName || "voice-message";
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <audio
            controls
            controlsList="nodownload"
            src={url}
            className="max-w-[220px]"
          />
          <span
            className={`flex items-center gap-1 text-[11px] ${mine ? "text-green-200" : "text-gray-400"}`}
          >
            <Mic className="h-3 w-3 flex-shrink-0" />
            Voice message
            {msg.voiceDurationSeconds
              ? ` • ${formatDuration(msg.voiceDurationSeconds)}`
              : ""}
          </span>
        </div>
        {url ? (
          <a
            href={forceDownloadUrl(url, voiceName)}
            download={voiceName}
            title="Download voice message"
            className={`flex-shrink-0 rounded-full p-2 transition ${
              mine
                ? "text-green-100 hover:bg-white/20"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Download className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    );
  }

  // Image → thumbnail that opens full size in a new tab.
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={msg.attachmentName || "Shared image"}
          className="max-h-60 max-w-[240px] rounded-lg object-cover"
          draggable={false}
        />
        {msg.attachmentName ? (
          <span
            className={`mt-1 block max-w-[240px] truncate text-[11px] ${
              mine ? "text-green-200" : "text-gray-400"
            }`}
          >
            {msg.attachmentName}
          </span>
        ) : null}
      </a>
    );
  }

  // Any other document → a download chip. Clicking it saves the file
  // (WhatsApp behavior) via the forced-download URL.
  return (
    <a
      href={url ? forceDownloadUrl(url, msg.attachmentName || "document") : undefined}
      download={msg.attachmentName || undefined}
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
        mine
          ? "bg-white/10 hover:bg-white/20"
          : "border border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <FileText
        className={`h-6 w-6 flex-shrink-0 ${mine ? "text-green-100" : "text-[#01411C]"}`}
      />
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-medium ${
            mine ? "text-white" : "text-gray-900"
          }`}
        >
          {msg.attachmentName || "Document"}
        </p>
        {humanSize(msg.attachmentSize) ? (
          <p
            className={`text-[11px] ${mine ? "text-green-200" : "text-gray-500"}`}
          >
            {humanSize(msg.attachmentSize)}
          </p>
        ) : null}
      </div>
      <Download
        className={`ml-1 h-4 w-4 flex-shrink-0 ${
          mine ? "text-green-100" : "text-gray-500"
        }`}
      />
    </a>
  );
}
