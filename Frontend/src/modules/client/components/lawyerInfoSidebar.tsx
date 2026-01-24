import { X, Mail, Phone, FileText, Download } from "lucide-react";
import type { ClientChatThread } from "../../../types/chat";

interface LawyerInfoSidebarProps {
  thread: ClientChatThread;
  isOpen: boolean;
  onClose: () => void;
  sharedDocuments?: Array<{ name: string; size: number; uploadedAt: string }>;
}

export default function LawyerInfoSidebar({
  thread,
  isOpen,
  onClose,
  sharedDocuments = [],
}: LawyerInfoSidebarProps) {
  // Handle click actions
  const handlePhoneClick = () => {
    const phoneNumber = "+923001234567";
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleEmailClick = () => {
    const email = `${thread.lawyer.name.toLowerCase().replace(" ", ".")}@lawflow.com`;
    window.location.href = `mailto:${email}`;
  };

  return (
    <div
      className={`fixed sm:relative inset-y-0 right-0 sm:inset-auto flex-shrink-0 bg-white border-l-2 border-gray-300 overflow-hidden transition-all duration-300 ease-out transform z-50 ${
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
          <h3 className="font-semibold text-base">Lawyer Info</h3>
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
              <div className="w-16 h-16 rounded-full bg-[#01411C] text-white text-2xl font-bold flex items-center justify-center mb-3">
                {thread.lawyer.initials}
              </div>

              {/* Name */}
              <h2 className="text-lg font-bold text-gray-900 text-center">
                {thread.lawyer.name}
              </h2>

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
            <button
              onClick={handleEmailClick}
              className="w-full flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-[#01411C] transition duration-200 group"
            >
              <Mail className="h-5 w-5 text-[#01411C] flex-shrink-0 group-hover:scale-110 transition" />
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs text-gray-600 font-medium">Email</p>
                <p className="text-sm text-gray-900 break-all group-hover:text-[#01411C] transition">
                  {thread.lawyer.name.toLowerCase().replace(" ", ".")}@lawflow.com
                </p>
              </div>
            </button>

            {/* Phone */}
            <button
              onClick={handlePhoneClick}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-[#01411C] transition duration-200 group"
            >
              <Phone className="h-5 w-5 text-[#01411C] flex-shrink-0 group-hover:scale-110 transition" />
              <div className="text-left flex-1">
                <p className="text-xs text-gray-600 font-medium">Phone</p>
                <p className="text-sm text-gray-900 group-hover:text-[#01411C] transition">
                  +92 300 1234567
                </p>
              </div>
            </button>
          </div>

          {/* Shared Documents */}
          <div className="px-5 py-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#01411C]" />
              Shared Documents
            </h3>

            {sharedDocuments.length === 0 ? (
              <div className="text-center py-4">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No documents shared</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sharedDocuments.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 hover:border-[#01411C] transition duration-200 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(doc.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <button
                      className="ml-2 text-[#01411C] hover:bg-[#01411C] hover:text-white p-1.5 rounded transition duration-200 flex-shrink-0 group-hover:scale-110"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
