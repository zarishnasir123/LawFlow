import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Mail, Star, Gavel, MapPin, HandCoins, Loader2 } from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import ImageLightbox from "../../../shared/components/ImageLightbox";
import LawyerReviews from "../components/LawyerReviews";
import { fetchLawyer, type DirectoryLawyer } from "../api/lawyers";
import { startConversationWithLawyer } from "../api";
import { getLawyerPublicCaseCharges } from "../../payments/api";

// Stats backed by tables we haven't shipped yet (rating, cases
// handled, success rate). Render an em-dash so the slot stays
// stable for when those values become real.
const PENDING = "—";

// "Adv. First Last" — same composition the directory card uses so
// the two views stay consistent. Falls back to whichever name is
// set; "Unnamed lawyer" only renders if the DB row somehow has
// neither, which shouldn't happen for an approved lawyer.
function displayLawyerName(lawyer: DirectoryLawyer): string {
  const first = lawyer.firstName?.trim() ?? "";
  const last = lawyer.lastName?.trim() ?? "";
  if (first && last) return `Adv. ${first} ${last}`;
  if (first) return `Adv. ${first}`;
  if (last) return `Adv. ${last}`;
  return "Unnamed lawyer";
}

export default function LawyerProfileView() {
  const navigate = useNavigate();
  const { lawyerId } = useParams({ strict: false });
  // Lightbox state — only opens when the avatar is actually set
  // and the user clicks it. Lives at the page level so the modal
  // overlays everything including the hero card.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // While the "Message" button is starting/opening the conversation.
  const [openingChat, setOpeningChat] = useState(false);

  const { data: lawyer, isLoading, isError } = useQuery({
    queryKey: ["lawyer", lawyerId],
    queryFn: () => fetchLawyer(lawyerId as string),
    enabled: Boolean(lawyerId),
    staleTime: 1000 * 60 * 5,
  });

  const { data: caseCharges } = useQuery({
    queryKey: ["lawyer-case-charges", lawyerId],
    queryFn: () => getLawyerPublicCaseCharges(lawyerId as string),
    enabled: Boolean(lawyerId),
    staleTime: 1000 * 60 * 5,
  });

  // Loading state — keep the chrome so the back button is reachable
  // even before the network call resolves.
  if (isLoading) {
    return (
      <ClientLayout brandSubtitle="Lawyer Profile">
        <div className="px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto max-w-2xl rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
            Loading lawyer profile…
          </div>
        </div>
      </ClientLayout>
    );
  }

  // 404 (lawyer doesn't exist or isn't visible to the directory) or
  // any other network error lands here. We don't distinguish so a
  // guessed UUID can't probe for "exists but hidden".
  if (isError || !lawyer) {
    return (
      <ClientLayout brandSubtitle="Lawyer Profile">
        <div className="px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto max-w-2xl rounded-xl border bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900">Lawyer not found</h2>
            <p className="mt-2 text-sm text-gray-500">
              The profile you are looking for is not available.
            </p>
            <button
              onClick={() => navigate({ to: "/FindLawyer" })}
              className="mt-5 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-medium text-white hover:bg-[#024a23]"
            >
              Back to Find a Lawyer
            </button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  const name = displayLawyerName(lawyer);
  const specialization = lawyer.specialization
    ? `${lawyer.specialization} Law`
    : "Specialization pending";
  const initial = (lawyer.firstName?.charAt(0) || "?").toUpperCase();
  const hasAvatar = Boolean(lawyer.avatarUrl);

  // Start (or reopen) a direct conversation with this lawyer, then open the
  // chat. Idempotent on the backend so repeat clicks reuse the same chat.
  const handleMessage = async () => {
    try {
      setOpeningChat(true);
      const conversation = await startConversationWithLawyer(lawyer.userId);
      // Open the split inbox with this conversation preselected (the inbox
      // reads ?thread=<id> on mount) so both sides share the same layout.
      navigate({ to: "/client-messages", search: { thread: conversation.id } });
    } catch (err) {
      console.error("Could not open chat:", err);
      setOpeningChat(false);
    }
  };

  return (
    <ClientLayout brandSubtitle="Lawyer Profile">
      <div className="px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {/* Hero card. Solid dark LawFlow-green strip behind the
              avatar — "lawyer black meets court green" reads as
              professional and on-brand without the loudness of a
              gradient. Avatar overlaps the strip so it feels
              integrated rather than pasted on top. */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="h-24 bg-[#01411C]" />
            <div className="px-6 pb-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-5">
                  {/* Avatar — circular, large, lifted out of the
                      gradient. Clickable only when an image is set
                      (don't open a lightbox for the initials
                      fallback). Ring matches the page background
                      so the avatar appears to float. */}
                  <button
                    type="button"
                    onClick={() => hasAvatar && setLightboxOpen(true)}
                    aria-label={hasAvatar ? "View profile picture" : "Profile picture"}
                    disabled={!hasAvatar}
                    className={`-mt-12 inline-flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#01411C] text-2xl font-semibold text-white shadow-lg ring-4 ring-white ${
                      hasAvatar ? "cursor-zoom-in transition hover:opacity-90" : "cursor-default"
                    }`}
                  >
                    {lawyer.avatarUrl ? (
                      <img
                        src={lawyer.avatarUrl}
                        alt={name}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </button>

                  <div className="md:pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold text-gray-900">{name}</h1>
                      {/* Verified badge — pill with filled
                          BadgeCheck icon. Visually obvious that
                          this is a trust signal, not a label. */}
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <BadgeCheck className="h-3.5 w-3.5 fill-emerald-600 text-white" />
                        Verified Lawyer
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                        {specialization}
                      </span>
                      {lawyer.districtBar ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {lawyer.districtBar} District Bar
                        </span>
                      ) : null}
                      {lawyer.reviewCount > 0 && lawyer.averageRating !== null ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {lawyer.averageRating.toFixed(1)}
                          <span className="font-normal text-amber-600/80">
                            ({lawyer.reviewCount} review{lawyer.reviewCount === 1 ? "" : "s"})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-400">
                          <Star className="h-3.5 w-3.5 text-gray-300" />
                          No reviews yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleMessage}
                    disabled={openingChat}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#01411C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#024a23] disabled:opacity-70"
                  >
                    {openingChat ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Message
                  </button>
                  <button
                    onClick={() => navigate({ to: "/FindLawyer" })}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Back to search
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">About</h2>
                {/* whitespace-pre-wrap so paragraph breaks the
                    lawyer typed into the textarea render correctly. */}
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                  {lawyer.bio?.trim()
                    ? lawyer.bio
                    : "This lawyer hasn't added an about section yet."}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">Professional Details</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <p className="text-xs text-gray-500">Specialization</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {specialization}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <p className="text-xs text-gray-500">District Bar</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {lawyer.districtBar || PENDING}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <p className="text-xs text-gray-500">Experience</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {lawyer.experienceYears !== null && lawyer.experienceYears !== undefined
                        ? `${lawyer.experienceYears} years`
                        : PENDING}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <p className="text-xs text-gray-500">Cases Handled</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{PENDING}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <p className="text-xs text-gray-500">Success Rate</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">{PENDING}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">

              {caseCharges?.charges && caseCharges.charges.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-[#01411C]" />
                    <h2 className="text-sm font-semibold text-gray-900">Case Charges</h2>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {caseCharges.charges.map((row) => (
                      <li
                        key={row.category}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm"
                      >
                        <span className="text-gray-600">{row.category} Case</span>
                        <span className="font-semibold text-gray-900">
                          Rs {row.amount.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">Quick Stats</h2>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                    <span className="text-gray-500">Rating</span>
                    {lawyer.reviewCount > 0 && lawyer.averageRating !== null ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {lawyer.averageRating.toFixed(1)} ({lawyer.reviewCount})
                      </span>
                    ) : (
                      <span className="font-semibold text-gray-400">No reviews</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                    <span className="text-gray-500">Experience</span>
                    <span className="font-semibold text-gray-900">
                      {lawyer.experienceYears !== null && lawyer.experienceYears !== undefined
                        ? `${lawyer.experienceYears} yrs`
                        : PENDING}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                    <span className="text-gray-500">Cases handled</span>
                    <span className="font-semibold text-gray-400">{PENDING}</span>
                  </div>
                  {/* District bar pinned at the bottom as a real
                      data point so the right column isn't all
                      placeholders. */}
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-gray-500">
                      <Gavel className="h-3.5 w-3.5" />
                      District bar
                    </span>
                    <span className="font-semibold text-gray-900">
                      {lawyer.districtBar || PENDING}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <LawyerReviews
            lawyerProfileId={lawyer.lawyerProfileId}
            lawyerName={name}
          />
        </div>
      </div>

      {/* WhatsApp-style full-screen preview of the avatar. Mounted
          unconditionally; the component renders nothing when its
          imageUrl prop is null. */}
      <ImageLightbox
        imageUrl={lightboxOpen ? lawyer.avatarUrl : null}
        alt={`${name} profile picture`}
        onClose={() => setLightboxOpen(false)}
      />
    </ClientLayout>
  );
}
