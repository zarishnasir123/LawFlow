import { X, Mail, FileText, Download, Scale } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ClientChatThread, ChatMessage } from "../../../types/chat";
import { getClientConversationParticipant } from "../api";
import ChatAvatar from "../../../shared/components/ChatAvatar";

interface LawyerInfoSidebarProps {
  thread: ClientChatThread;
  isOpen: boolean;
  onClose: () => void;
  // The conversation's messages — the shared-documents list is derived from the
  // real "file" messages (no session-only state).
  messages?: ChatMessage[];
}

// Force a browser download of a Supabase signed URL (append &download=<name>).
function downloadHref(url?: string | null, name?: string | null) {
  if (!url) return undefined;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(name || "document")}`;
}

// Open Gmail's compose window (new tab) with the recipient pre-filled. Avoids
// the blank page a bare mailto: gives when no desktop mail app is registered.
function mailHref(email?: string | null) {
  if (!email) return undefined;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

export default function LawyerInfoSidebar({
  thread,
  isOpen,
  onClose,
  messages = [],
}: LawyerInfoSidebarProps) {
  // Real lawyer profile (name, specialization, district bar, license number,
  // phone, email). Fetched only while the panel is open.
  const { data: profile } = useQuery({
    queryKey: ["chat", "participant", thread.id],
    queryFn: () => getClientConversationParticipant(thread.id),
    enabled: isOpen && Boolean(thread.id),
    staleTime: 60_000,
  });

  // Shared documents = the real "file" messages in this conversation, newest first.
  const documents = useMemo(
    () =>
      messages
        .filter((m) => m.kind === "file" && m.attachmentName)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [messages]
  );

  const email = profile?.email ?? null;
  const specialization = profile?.specialization ?? null;
  const districtBar = profile?.districtBar ?? null;

  return (
    <div
      className={`fixed sm:relative inset-y-0 right-0 sm:inset-auto flex-shrink-0 bg-white border-l-2 border-gray-300 overflow-hidden transition-all duration-300 ease-out transform z-50 sm:z-40 ${
        isOpen ? "w-full sm:w-96 opacity-100 visible" : "w-0 opacity-0 invisible"
      }`}
    >
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed sm:hidden inset-0 bg-black/40 z-40"
          onClick={onClose}
        />
      )}

      <div className="h-full w-full sm:w-96 flex flex-col bg-white">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-[#01411C] to-green-700 text-white px-5 py-4 flex items-center justify-between border-b-2 border-gray-300">
          <h3 className="font-semibold text-base">Lawyer Profile</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1.5 rounded-lg transition duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Lawyer Profile */}
          <div className="px-5 py-6">
            <div className="flex flex-col items-center">
              {/* Avatar */}
              <ChatAvatar
                name={thread.lawyer.name}
                initials={thread.lawyer.initials}
                avatarUrl={thread.lawyer.avatarUrl}
                className="w-16 h-16 text-2xl mb-3"
              />

              {/* Name */}
              <h2 className="text-lg font-bold text-gray-900 text-center">
                {thread.lawyer.name}
              </h2>

              {/* Specialization badge */}
              {specialization && (
                <span className="mt-1 text-xs font-medium text-[#01411C] bg-green-50 px-2.5 py-0.5 rounded-full">
                  {specialization} Law
                </span>
              )}

              {/* Status */}
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    thread.lawyer.status === "online"
                      ? "bg-green-500"
                      : "bg-gray-400"
                  }`}
                ></div>
                <span
                  className={`text-xs font-medium ${
                    thread.lawyer.status === "online"
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {thread.lawyer.status === "online" ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="px-5 py-4 border-t border-gray-200">
            {/* Email */}
            <a
              href={mailHref(email)}
              target="_blank"
              rel="noreferrer"
              className={`w-full flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 transition duration-200 group ${
                email ? "hover:bg-gray-100 hover:border-[#01411C]" : "opacity-60 cursor-default"
              }`}
            >
              <Mail className="h-5 w-5 text-[#01411C] flex-shrink-0 group-hover:scale-110 transition" />
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs text-gray-600 font-medium">Email</p>
                <p className="text-sm text-gray-900 break-all group-hover:text-[#01411C] transition">
                  {email ?? "—"}
                </p>
              </div>
            </a>

            {/* District Bar */}
            <div className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Scale className="h-5 w-5 text-[#01411C] flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs text-gray-600 font-medium">District Bar</p>
                <p className="text-sm text-gray-900">{districtBar ?? "—"}</p>
              </div>
            </div>
          </div>

          {/* Shared Documents */}
          <div className="px-5 py-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#01411C]" />
              Shared Documents
            </h3>

            {documents.length === 0 ? (
              <div className="text-center py-4">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No documents shared</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {documents.map((doc) => {
                  const mine = doc.sender === "client";
                  const status = mine
                    ? doc.seen
                      ? "Seen"
                      : "Sent"
                    : "Received";
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 hover:border-[#01411C] transition duration-200 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {doc.attachmentName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {doc.attachmentSize
                            ? `${(doc.attachmentSize / 1024).toFixed(1)} KB · `
                            : ""}
                          {new Date(doc.createdAt).toLocaleDateString()} · {status}
                        </p>
                      </div>
                      {doc.attachmentUrl && (
                        <a
                          href={downloadHref(doc.attachmentUrl, doc.attachmentName)}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-[#01411C] hover:bg-[#01411C] hover:text-white p-1.5 rounded transition duration-200 flex-shrink-0 group-hover:scale-110"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
