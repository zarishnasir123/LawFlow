import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, Star, Gavel } from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import { fetchLawyer, type DirectoryLawyer } from "../api/lawyers";

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

  const { data: lawyer, isLoading, isError } = useQuery({
    queryKey: ["lawyer", lawyerId],
    queryFn: () => fetchLawyer(lawyerId as string),
    enabled: Boolean(lawyerId),
    // The detail page is short-lived (user comes from the list,
    // clicks View Profile, then either Messages or Back). Stale
    // window of 5 min mirrors useCurrentUser so refetch noise stays
    // low while the data is reasonably fresh.
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

  return (
    <ClientLayout brandSubtitle="Lawyer Profile">
      <div className="px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-50" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                {/* Avatar — image when uploaded, initial letter
                    otherwise. Same fallback motif the directory
                    card uses. */}
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#01411C] text-xl font-semibold text-white">
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
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Verified Lawyer
                  </p>
                  <h1 className="mt-1 text-xl font-semibold text-gray-900">{name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {specialization}
                    </span>
                    {/* Rating placeholder — same dash convention as
                        the directory card until the ratings table
                        ships. */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-400">
                      <Star className="h-3.5 w-3.5 text-amber-300" />
                      {PENDING} rating
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate({ to: "/client-messages" })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#01411C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#024a23]"
                >
                  <Mail className="h-4 w-4" />
                  Message
                </button>
                <button
                  onClick={() => navigate({ to: "/FindLawyer" })}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Back to search
                </button>
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
              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Consultation Fee
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {lawyer.consultationFee !== null && lawyer.consultationFee !== undefined
                    ? `Rs ${lawyer.consultationFee.toLocaleString()}`
                    : "Fee on request"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Fee may vary based on case complexity.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">Quick Stats</h2>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                    <span className="text-gray-500">Rating</span>
                    <span className="font-semibold text-gray-400">{PENDING}</span>
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
        </div>
      </div>
    </ClientLayout>
  );
}
