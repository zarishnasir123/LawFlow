import { BadgeCheck, Gavel, MapPin } from "lucide-react";
import type { DirectoryLawyer } from "../api/lawyers";

interface LawyerCardProps {
  lawyer: DirectoryLawyer;
  onViewProfile: (lawyerProfileId: string) => void;
  // Kept on the props for backwards-compat with FindLawyer; the
  // photo-first grid doesn't render a Message button per card to
  // keep each tile visually clean. Reach out from the detail page.
  onMessage?: (userId: string) => void;
}

// Compose first + last for display; fall back to whichever is set,
// or "Unnamed lawyer" so the tile never renders an empty header.
function displayName(lawyer: DirectoryLawyer): string {
  const first = lawyer.firstName?.trim() ?? "";
  const last = lawyer.lastName?.trim() ?? "";
  if (first && last) return `Adv. ${first} ${last}`;
  if (first) return `Adv. ${first}`;
  if (last) return `Adv. ${last}`;
  return "Unnamed lawyer";
}

// Photo-first tile, Airbnb / Upwork talent style.
//   • Big square photo at top — fallback to a gavel icon on the
//     LawFlow-green when no avatar uploaded.
//   • Verified badge overlays the photo, top-right.
//   • Below the photo: name, specialization chip, district line,
//     fee, View Profile button.
// The whole tile is clickable so the cursor matches the user's
// instinct to click anywhere on the card.
export default function LawyerCard({
  lawyer,
  onViewProfile,
}: LawyerCardProps) {
  const name = displayName(lawyer);
  const specialization = lawyer.specialization
    ? `${lawyer.specialization} Law`
    : "Specialization pending";

  return (
    <button
      type="button"
      onClick={() => onViewProfile(lawyer.lawyerProfileId)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
    >
      {/* Photo block — square aspect ratio so every card has the
          same vertical weight regardless of the source image. */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#01411C]">
        {lawyer.avatarUrl ? (
          <img
            src={lawyer.avatarUrl}
            alt={name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gavel className="h-14 w-14 text-white/80" />
          </div>
        )}

        {/* Verified pill — overlays the photo, top-right. White
            background + backdrop blur reads against any photo
            tone without losing the trust-signal weight. */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm backdrop-blur">
          <BadgeCheck className="h-3 w-3 fill-emerald-600 text-white" />
          Verified
        </span>
      </div>

      {/* Card body — tight, scannable. Padding lines up with the
          edges of the photo so name aligns with the photo's left. */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-gray-900">
          {name}
        </h3>

        {/* Specialization + experience on one line — primary
            facts a client filters by. */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-100">
            {specialization}
          </span>
          {lawyer.experienceYears !== null && lawyer.experienceYears !== undefined ? (
            <span className="text-gray-500">
              <span className="font-semibold text-gray-700">{lawyer.experienceYears}</span> yrs
            </span>
          ) : null}
        </div>

        {/* District line — secondary. Hidden when missing so the
            spacing collapses cleanly. */}
        {lawyer.districtBar ? (
          <p className="inline-flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3 w-3" />
            {lawyer.districtBar} Bar
          </p>
        ) : null}

        {/* Spacer + fee + CTA pinned to the bottom. mt-auto keeps
            them aligned across tiles even when the meta rows wrap
            differently. */}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              From
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {lawyer.consultationFee !== null && lawyer.consultationFee !== undefined
                ? `Rs ${lawyer.consultationFee.toLocaleString()}`
                : "On request"}
            </p>
          </div>
          <span className="rounded-lg bg-[#01411C] px-3 py-1.5 text-xs font-semibold text-white transition group-hover:bg-[#024a23]">
            View Profile
          </span>
        </div>
      </div>
    </button>
  );
}
