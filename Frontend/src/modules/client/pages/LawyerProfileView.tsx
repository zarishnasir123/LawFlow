import { useMemo } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Mail, Star } from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import { mockLawyers } from "../data/lawyers.mock";

export default function LawyerProfileView() {
  const navigate = useNavigate();
  const { lawyerId } = useParams({ strict: false });

  const lawyer = useMemo(() => {
    const parsedId = Number(lawyerId);
    if (!Number.isFinite(parsedId)) return null;
    return mockLawyers.find((item) => item.id === parsedId) ?? null;
  }, [lawyerId]);

  return (
    <ClientLayout brandSubtitle="Lawyer Profile">
      <div className="px-4 py-6 md:px-6 md:py-8">
        {!lawyer ? (
          <div className="mx-auto max-w-2xl rounded-xl border bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Lawyer not found
            </h2>
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
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-50" />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#01411C] text-xl font-semibold text-white">
                    {lawyer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                      Verified Lawyer
                    </p>
                    <h1 className="mt-1 text-xl font-semibold text-gray-900">
                      {lawyer.name}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        {lawyer.category}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {lawyer.rating} rating
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (lawyer.threadId) {
                        navigate({
                          to: "/client-messages",
                          search: { thread: lawyer.threadId },
                        });
                        return;
                      }
                      navigate({ to: "/client-messages" });
                    }}
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
                  <h2 className="text-sm font-semibold text-gray-900">
                    About
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    {lawyer.bio ||
                      "Experienced advocate focused on practical outcomes and client clarity throughout the case."}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Professional Details
                  </h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                      <p className="text-xs text-gray-500">Specialization</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {lawyer.category}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                      <p className="text-xs text-gray-500">Experience</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {lawyer.experience} years
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                      <p className="text-xs text-gray-500">Cases Handled</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {lawyer.casesHandled}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                      <p className="text-xs text-gray-500">Success Rate</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {lawyer.successRate}%
                      </p>
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
                    Rs {lawyer.fee.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Fee may vary based on case complexity.
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Quick Stats
                  </h2>
                  <div className="mt-4 grid gap-3">
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                      <span className="text-gray-500">Rating</span>
                      <span className="font-semibold text-gray-900">
                        {lawyer.rating}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                      <span className="text-gray-500">Experience</span>
                      <span className="font-semibold text-gray-900">
                        {lawyer.experience} yrs
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
                      <span className="text-gray-500">Cases handled</span>
                      <span className="font-semibold text-gray-900">
                        {lawyer.casesHandled}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
