import { Star, Mail, Gavel } from "lucide-react";
import type { Lawyer } from "../data/lawyers.mock";

interface LawyerCardProps {
  lawyer: Lawyer;
  onViewProfile: (id: number) => void;
  onMessage?: (id: number) => void;
}

export default function LawyerCard({
  lawyer,
  onViewProfile,
  onMessage,
}: LawyerCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-emerald-50" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#01411C] text-white shadow-sm">
            <Gavel className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {lawyer.name}
            </h3>
            <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {lawyer.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm">
          <Star className="h-4 w-4 text-amber-500" />
          {lawyer.rating}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-xs text-gray-500">Experience</p>
          <p className="mt-1 font-semibold text-gray-900">
            {lawyer.experience} yrs
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-xs text-gray-500">Cases</p>
          <p className="mt-1 font-semibold text-gray-900">
            {lawyer.casesHandled}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-xs text-gray-500">Success</p>
          <p className="mt-1 font-semibold text-emerald-700">
            {lawyer.successRate}%
          </p>
        </div>
      </div>

      {/* Fee */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Starting from
        </div>
        <p className="text-base font-semibold text-gray-900">
          Rs {lawyer.fee.toLocaleString()}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          onClick={() => onViewProfile(lawyer.id)}
          className="flex-1 rounded-xl bg-[#01411C] py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#024a23]"
        >
          View Profile
        </button>

        <button
          onClick={() => onMessage?.(lawyer.id)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          type="button"
        >
          <Mail className="h-4 w-4" />
          Message
        </button>
      </div>
    </div>
  );
}
