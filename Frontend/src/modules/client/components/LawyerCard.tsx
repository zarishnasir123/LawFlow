import { BadgeCheck, Mail, MapPin, Clock, Star, ArrowRight } from "lucide-react";
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

function getInitials(lawyer: DirectoryLawyer): string {
  const first = lawyer.firstName?.trim()?.charAt(0) ?? "";
  const last = lawyer.lastName?.trim()?.charAt(0) ?? "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

// Specialization → visual accent. Each lawyer gets a colored top
// stripe + matching avatar ring + chip tint so cards don't all
// blur into a uniform green grid. Civil = emerald (LawFlow brand),
// Family = purple.
function getAccent(specialization: string | null) {
  if (specialization === "Family") {
    return {
      stripe: "bg-purple-500",
      ring: "ring-purple-100",
      avatarBg: "bg-purple-50",
      avatarText: "text-purple-700",
      chip: "bg-purple-50 text-purple-700 ring-purple-100",
    };
  }
  // Default + Civil
  return {
    stripe: "bg-emerald-500",
    ring: "ring-emerald-100",
    avatarBg: "bg-emerald-50",
    avatarText: "text-emerald-700",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };
}

// SaaS-style lawyer card. Visual personality comes from:
//   • Specialization-colored top accent stripe + avatar tint —
//     cards aren't all identically green.
//   • Fee pulled to the top-right as a decision-anchor, mirroring
//     a SaaS pricing card.
//   • Compact KPI strip (experience · district · rating) replaces
//     the prior chip-soup with icon-led inline facts.
//   • Footer separates Message (text + icon) and a directional
//     "View Profile →" so the two buttons read as different
//     intents, not duplicates.
export default function LawyerCard({
  lawyer,
  onViewProfile,
  onMessage,
}: LawyerCardProps) {
  const name = displayName(lawyer);
  const initials = getInitials(lawyer);
  const accent = getAccent(lawyer.specialization);
  const specialization = lawyer.specialization
    ? `${lawyer.specialization} Law specialist`
    : "Specialization pending";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-xl">
      {/* Top accent stripe — specialization-based color. The one
          element that varies card-to-card so the grid doesn't look
          like a wall of identical green pills. */}
      <div className={`h-1 w-full ${accent.stripe}`} />

      <div className="flex flex-col gap-4 p-5">
        {/* Header — identity left, fee right. The fee placement
            mirrors a SaaS pricing card; it's the primary decision
            anchor a client compares between lawyers. */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl ${accent.avatarBg} ${accent.avatarText} text-base font-semibold ring-2 ${accent.ring}`}
            >
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
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="line-clamp-1 text-[15px] font-semibold text-gray-900">
                  {name}
                </h3>
                <BadgeCheck
                  className="h-4 w-4 flex-shrink-0 fill-emerald-600 text-white"
                  aria-label="Verified"
                />
              </div>
              <p className="line-clamp-1 text-xs text-gray-500">{specialization}</p>
            </div>
          </div>

        </div>

        {/* KPI strip — three facts inline with icons. Inline rather
            than stacked chips so it feels lighter and reads more
            like a profile summary line than a tag cloud. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          {lawyer.experienceYears !== null && lawyer.experienceYears !== undefined ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-semibold text-gray-900">{lawyer.experienceYears}</span>
              yrs experience
            </span>
          ) : null}
          {lawyer.districtBar ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {lawyer.districtBar}
            </span>
          ) : null}
          {lawyer.reviewCount > 0 && lawyer.averageRating !== null ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-gray-900">
                {lawyer.averageRating.toFixed(1)}
              </span>
              <span className="text-gray-400">({lawyer.reviewCount})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <Star className="h-3.5 w-3.5" />
              No reviews yet
            </span>
          )}
        </div>

        {/* Bio — quoted, in a soft container. Adds personality
            without making the card feel form-y. Hidden when the
            lawyer hasn't written one. */}
        {lawyer.bio ? (
          <p className="line-clamp-2 rounded-lg bg-gray-50 px-3 py-2 text-xs italic leading-relaxed text-gray-600">
            “{lawyer.bio}”
          </p>
        ) : null}

        {/* Footer — actions. mt-auto pushes this to the bottom so
            cards align flush across a row even if one has a bio
            and another doesn't. */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <button
            onClick={() => onMessage?.(lawyer.userId)}
            type="button"
            aria-label="Message lawyer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Mail className="h-3.5 w-3.5" />
            Message
          </button>
          <button
            onClick={() => onViewProfile(lawyer.lawyerProfileId)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#01411C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#024a23] group-hover:gap-2"
          >
            View Profile
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
