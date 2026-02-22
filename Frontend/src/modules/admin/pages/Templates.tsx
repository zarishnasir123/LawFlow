import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";

const templateRows = [
  {
    name: "Civil Petition Template",
    category: "Civil",
    updatedAt: "Feb 20, 2026",
    status: "Active",
  },
  {
    name: "Family Case Affidavit",
    category: "Family",
    updatedAt: "Feb 18, 2026",
    status: "Active",
  },
  {
    name: "Power of Attorney",
    category: "Civil",
    updatedAt: "Feb 12, 2026",
    status: "Archived",
  },
];

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />

      <div className="min-h-screen bg-gray-50">
        <AdminHeader
          title="Template Documents"
          subtitle="Admin Template Management"
          notificationCount={3}
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onOpenProfile={() => navigate({ to: "/admin-profile" })}
          onLogout={() => setLogoutModalOpen(true)}
        />

        <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
          <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-[#01411C]">Template Documents</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload, update, and maintain official legal templates.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Template Library</h2>
              <button
                type="button"
                className="rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#025227]"
              >
                Upload Template
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="grid grid-cols-12 gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                <div className="col-span-5">Template</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-3">Updated</div>
                <div className="col-span-2">Status</div>
              </div>

              {templateRows.map((row) => (
                <div
                  key={row.name}
                  className="grid grid-cols-12 gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-b-0"
                >
                  <div className="col-span-5 font-medium text-gray-900">{row.name}</div>
                  <div className="col-span-2 text-gray-700">{row.category}</div>
                  <div className="col-span-3 text-gray-600">{row.updatedAt}</div>
                  <div className="col-span-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
