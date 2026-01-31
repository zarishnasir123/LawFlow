import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import LawyerCard from "../components/LawyerCard";
import { mockLawyers } from "../data/lawyers.mock";

export default function FindLawyer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const navigate = useNavigate();

  const lawyers = useMemo(() => mockLawyers, []);

  const filteredLawyers = useMemo(() => {
    return lawyers.filter((l) => {
      const matchesQuery =
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.category.toLowerCase().includes(query.toLowerCase());

      const matchesCategory = category === "all" || l.category === category;

      return matchesQuery && matchesCategory;
    });
  }, [lawyers, query, category]);

  return (
    <ClientLayout brandSubtitle="Find a Lawyer">
      <div className="mb-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/70 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Find the right expert
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              Browse verified lawyers by specialty
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Compare experience, success rate, and fees to choose the best fit.
            </p>
          </div>
          <div className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
            {filteredLawyers.length} result
            {filteredLawyers.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Search
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or specialization..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/60 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50/60 py-2.5 px-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">All Categories</option>
              <option value="Family Law">Family Law</option>
              <option value="Civil Law">Civil Law</option>
            </select>
          </label>
        </div>
      </div>

      {/* Lawyer Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {filteredLawyers.map((lawyer) => (
          <LawyerCard
            key={lawyer.id}
            lawyer={lawyer}
            onViewProfile={(id) =>
              navigate({ to: `/client-lawyer/${id}` })
            }
            onMessage={() => {
              if (lawyer.threadId) {
                navigate({
                  to: "/client-messages",
                  search: { thread: lawyer.threadId },
                });
                return;
              }
              navigate({ to: "/client-messages" });
            }}
          />
        ))}

        {filteredLawyers.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No lawyers found matching your criteria.
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
