import { BadgeCheck, Mail, MapPin, Briefcase, Clock } from "lucide-react";
import type { DirectoryLawyer } from "../api/lawyers";

interface LawyerCardProps {
  lawyer: DirectoryLawyer;
  onViewProfile: (lawyerProfileId: string) => void;
  onMessage?: (userId: string) => void;
}

// Compose first + last for display; fall back to whichever is set,
// or "Unnamed lawyer" so the card never renders an empty header.
function displayName(lawyer: DirectoryLawyer): string {
  const first = lawyer.firstName?.trim() ?? "";
  const last = lawyer.lastName?.trim() ?? "";
  if (first && last) return `Adv. ${first} ${last}`;
  if (first) return `Adv. ${first}`;
  if (last) return `Adv. ${last}`;
  return "Unnamed lawyer";
}

// Two-letter initials for the avatar fallback. Falls back to "?"
// for the (effectively unreachable) case where neither name is
// set on an approved lawyer's row.
function getInitials(lawyer: DirectoryLawyer): string {
  const first = lawyer.firstName?.trim()?.charAt(0) ?? "";
  const last = lawyer.lastName?.trim()?.charAt(0) ?? "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

// Compact service-marketplace card designed for a 2-column grid.
// Vertical layout — identity → credentials → bio → fee + actions —
// so it stays self-contained in any column width. Initials-based
// avatar fallback (no dark photo blocks).
export default function LawyerCard({
  lawyer,
  onViewProfile,
  onMessage,
}: LawyerCardProps) {
  const name = displayName(lawyer);
  const initials = getInitials(lawyer);
  const specialization = lawyer.specialization
    ? `${lawyer.specialization} Law`
    : "Specialization pending";

  return (
    <div className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      {/* Identity row — avatar + name + verified. */}
      <div className="flex items-start gap-3">
        {/* Avatar — image when uploaded; soft-emerald initials
            circle otherwise. Sits at 56px so the card stays
            compact without looking icon-tiny. */}
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-base font-semibold text-emerald-700 ring-2 ring-emerald-100">
          {lawyer.avatarUrl ? (
            <img
              src={lawyer.avatarUrl}
              alt={name}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="line-clamp-1 text-base font-semibold text-gray-900">
            {name}
          </h3>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <BadgeCheck className="h-3 w-3 fill-emerald-600 text-white" />
            Verified Lawyer
          </span>
        </div>
      </div>

      {/* Credentials — practice area + experience + district as
          structured chips. Wraps cleanly in narrow columns. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          <Briefcase className="h-3 w-3" />
          {specialization}
        </span>
        {lawyer.experienceYears !== null && lawyer.experienceYears !== undefined ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-100">
            <Clock className="h-3 w-3" />
            {lawyer.experienceYears} yrs
          </span>
        ) : null}
        {lawyer.districtBar ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-100">
            <MapPin className="h-3 w-3" />
            {lawyer.districtBar}
          </span>
        ) : null}
      </div>

      {/* Bio snippet — two-line clamp keeps height predictable
          across the grid. Hidden when empty. */}
      {lawyer.bio ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">
          {lawyer.bio}
        </p>
      ) : null}

      {/* Divider before the price + actions block. mt-auto pushes
          this section to the bottom so cards align across the row
          even if one has bio and another doesn't. */}
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Consultation
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {lawyer.consultationFee !== null && lawyer.consultationFee !== undefined
                ? `Rs ${lawyer.consultationFee.toLocaleString()}`
                : "On request"}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onMessage?.(lawyer.userId)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              type="button"
              aria-label="Message lawyer"
              title="Message"
            >
              <Mail className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewProfile(lawyer.lawyerProfileId)}
              className="rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23]"
            >
              View Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
