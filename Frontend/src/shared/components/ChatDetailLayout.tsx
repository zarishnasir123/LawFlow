import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface ChatDetailLayoutProps {
  clientName?: string;
  clientStatus?: "online" | "offline";
  children: ReactNode;
}

export default function ChatDetailLayout({
  clientName = "Client",
  clientStatus = "offline",
  children,
}: ChatDetailLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar - Sticky */}
      <nav className="sticky top-0 z-50 bg-[#01411C] text-white shadow-md">
        <div className="px-4 py-4 flex items-center justify-between">
          {/* Left: Back button */}
          <button
            onClick={() => navigate({ to: "/lawyer-messages" })}
            className="p-2 hover:bg-[#024a23] rounded-lg transition"
            title="Back to messages"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Center: Client info */}
          <div className="flex-1 ml-4">
            <h1 className="text-lg font-semibold">{clientName}</h1>
            <p className="text-xs text-gray-300">
              {clientStatus === "online" ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
