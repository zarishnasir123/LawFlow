import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import LawyerCard from "../components/LawyerCard";
import type { Lawyer } from "../components/LawyerCard";

export default function FindLawyer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("all");
  const navigate = useNavigate();

  const lawyers = useMemo<Lawyer[]>(
    () => [
      {
        id: 1,
        name: "Adv. Fatima Ali",
        category: "Civil Law",
        city: "Islamabad",
        experience: 6,
        casesHandled: 120,
        successRate: 92,
        rating: 4.8,
        fee: 50000,
      },
      {
        id: 2,
        name: "Adv. Ayesha Khan",
        category: "Family Law",
        city: "Islamabad",
        experience: 5,
        casesHandled: 85,
        successRate: 88,
        rating: 4.7,
        fee: 40000,
      },
    ],
    []
  );

  const filteredLawyers = useMemo(() => {
    return lawyers.filter((l) => {
      const matchesQuery =
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.category.toLowerCase().includes(query.toLowerCase());

      const matchesCategory = category === "all" || l.category === category;
      const matchesCity = city === "all" || l.city === city;

      return matchesQuery && matchesCategory && matchesCity;
    });
  }, [lawyers, query, category, city]);

  return (
    <DashboardLayout
      brandTitle={
        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => navigate({ to: "/client-dashboard" })}
        >
          <ArrowLeft className="mt-1 h-5 w-5 text-white" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Find a Lawyer</span>
            <p className="text-sm text-green-100">
              Browse and select from verified lawyers
            </p>
          </div>
        </div>
      }
    >
      {/* Filters */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or specialization..."
              className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border py-2 px-3 text-sm"
          >
            <option value="all">All Categories</option>
            <option value="Family Law">Family Law</option>
            <option value="Civil Law">Civil Law</option>
          </select>

          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border py-2 px-3 text-sm"
          >
            <option value="all">All Locations</option>
            <option value="Islamabad">Islamabad</option>
          </select>
        </div>
      </div>

      {/* Lawyer Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredLawyers.map((lawyer) => (
          <LawyerCard
            key={lawyer.id}
            lawyer={lawyer}
            onViewProfile={() => {}}
          />
        ))}

        {filteredLawyers.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
            No lawyers found matching your criteria.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
