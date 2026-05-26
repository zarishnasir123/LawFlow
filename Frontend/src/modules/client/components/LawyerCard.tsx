import { Star, Mail, Gavel } from "lucide-react";
import type { DirectoryLawyer } from "../api/lawyers";

interface LawyerCardProps {
  lawyer: DirectoryLawyer;
  onViewProfile: (lawyerProfileId: string) => void;
  onMessage?: (userId: string) => void;
}

// Compose first + last for display; fall back to whichever is set, or
// "Unnamed lawyer" so the card never renders an empty header.
function displayName(lawyer: DirectoryLawyer): string {
  const first = lawyer.firstName?.trim() ?? "";
  const last = lawyer.lastName?.trim() ?? "";
  if (first && last) return `Adv. ${first} ${last}`;
  if (first) return `Adv. ${first}`;
  if (last) return `Adv. ${last}`;
  return "Unnamed lawyer";
}

// Stats that depend on backend tables we haven't shipped yet (rating,
// cases handled, success rate). Render an em-dash so the layout stays
// stable and we can swap the value in once the data exists.
const PENDING = "—";

export default function LawyerCard({
  lawyer,
  onViewProfile,
  onMessage,
}: LawyerCardProps) {
  const name = displayName(lawyer);
  const specialization = lawyer.specialization
    ? `${lawyer.specialization} Law`
    : "Specialization pending";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-emerald-50" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex gap-3">
          {/* Avatar slot. Image when uploaded, gavel icon fallback
              otherwise — same green-on-white motif used elsewhere. */}
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#01411C] text-white shadow-sm">
            {lawyer.avatarUrl ? (
              <img
                src={lawyer.avatarUrl}
                alt={name}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <Gavel className="h-5 w-5" />
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900">{name}</h3>
            <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {specialization}
            </span>
          </div>
        </div>

        {/* Rating placeholder — the rating table is not implemented
            yet, so we render a static dash to keep the visual slot
            but make it obvious there's no real value to compare. */}
        <div className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-400 shadow-sm">
          <Star className="h-4 w-4 text-amber-300" />
          {PENDING}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-xs text-gray-500">Experience</p>
          <p className="mt-1 font-semibold text-gray-900">
            {lawyer.experienceYears !== null && lawyer.experienceYears !== undefined
              ? `${lawyer.experienceYears} yrs`
              : PENDING}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-xs text-gray-500">Cases</p>
          <p className="mt-1 font-semibold text-gray-900">{PENDING}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-xs text-gray-500">Success</p>
          <p className="mt-1 font-semibold text-emerald-700">{PENDING}</p>
        </div>
      </div>

      {/* Fee */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Starting from
        </div>
        <p className="text-base font-semibold text-gray-900">
          {lawyer.consultationFee !== null && lawyer.consultationFee !== undefined
            ? `Rs ${lawyer.consultationFee.toLocaleString()}`
            : "Fee on request"}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          onClick={() => onViewProfile(lawyer.lawyerProfileId)}
          className="flex-1 rounded-xl bg-[#01411C] py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#024a23]"
        >
          View Profile
        </button>

        <button
          onClick={() => onMessage?.(lawyer.userId)}
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
