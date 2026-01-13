import { MapPin, Star, Phone, Mail, Gavel } from "lucide-react";

export interface Lawyer {
  id: number;
  name: string;
  category: "Family Law" | "Civil Law";
  city: string;
  experience: number;
  casesHandled: number;
  successRate: number;
  rating: number;
  fee: number;
}

interface LawyerCardProps {
  lawyer: Lawyer;
  onViewProfile: (id: number) => void;
}

export default function LawyerCard({
  lawyer,
  onViewProfile,
}: LawyerCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#01411C] text-white">
            <Gavel />
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">
              {lawyer.name}
            </h3>
            <span className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
              {lawyer.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-sm font-medium">
          <Star className="h-4 w-4 text-yellow-500" />
          {lawyer.rating}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Experience</p>
          <p className="font-medium">{lawyer.experience} yrs</p>
        </div>
        <div>
          <p className="text-gray-500">Cases</p>
          <p className="font-medium">{lawyer.casesHandled}</p>
        </div>
        <div>
          <p className="text-gray-500">Success</p>
          <p className="font-medium text-green-600">
            {lawyer.successRate}%
          </p>
        </div>
      </div>

      {/* Location & Fee */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          {lawyer.city}
        </div>
        <p className="font-semibold">
          Rs {lawyer.fee.toLocaleString()}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => onViewProfile(lawyer.id)}
          className="flex-1 rounded-lg bg-[#01411C] py-2 text-sm font-medium text-white hover:bg-[#024a23]"
        >
          View Profile
        </button>

        <button className="rounded-lg border p-2 hover:bg-gray-50">
          <Phone className="h-4 w-4" />
        </button>

        <button className="rounded-lg border p-2 hover:bg-gray-50">
          <Mail className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
