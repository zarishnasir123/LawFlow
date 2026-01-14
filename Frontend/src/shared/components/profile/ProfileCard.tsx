import React from "react";
import { Pencil } from "lucide-react";

interface ProfileCardProps {
  name: string;
  memberSince: string;
  roleLabel: string;
  onEdit?: () => void;
  children: React.ReactNode;
}

export default function ProfileCard({
  name,
  memberSince,
  roleLabel,
  onEdit,
  children,
}: ProfileCardProps) {
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-[#01411C] flex items-center justify-center text-white text-xl font-semibold">
            {name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">
              Member since {memberSince}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs rounded-full bg-gray-100">
            {roleLabel}
          </span>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 border px-3 py-1.5 rounded-md text-sm hover:bg-gray-50"
          >
            <Pencil size={14} />
            Edit Profile
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
