import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, User, Briefcase } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import { useNewCaseStore } from "../store/newCase.store";

export default function CreateCase() {
  const navigate = useNavigate();
  const { category, selectedCaseType } = useNewCaseStore();

  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    oppositeParty: "",
    caseTitle: "",
    description: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateCase = () => {
    if (
      formData.clientName &&
      formData.clientEmail &&
      formData.clientPhone &&
      formData.oppositeParty &&
      formData.caseTitle
    ) {
      // Store case data (in real app, would be sent to backend)
      const newCase = {
        ...formData,
        caseType: category,
        caseTypeId: selectedCaseType?.id,
        caseTypeName: selectedCaseType?.name,
        governingLaw: selectedCaseType?.governingLaw,
      };

      console.log("Creating case:", newCase);

      // Navigate back to lawyer dashboard
      navigate({ to: "/Lawyer-dashboard" });
    }
  };

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Case Details"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => navigate({ to: "/Lawyer-dashboard" }),
          badge: 3,
        },
        {
          label: "Profile",
          icon: User,
          onClick: () => navigate({ to: "/lawyer-profile" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
    >
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 border-l-4 border-green-500">
          <div className="flex items-center gap-3 mb-6">
            <Briefcase className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Client Information
            </h1>
          </div>

          <div className="space-y-5">
            {/* Client Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Client Full Name *
              </label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleInputChange}
                placeholder="Enter client's full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Client Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Client Email *
              </label>
              <input
                type="email"
                name="clientEmail"
                value={formData.clientEmail}
                onChange={handleInputChange}
                placeholder="Enter client's email address"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Client Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Client Phone Number *
              </label>
              <input
                type="tel"
                name="clientPhone"
                value={formData.clientPhone}
                onChange={handleInputChange}
                placeholder="+92-300-XXXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Opposite Party */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Opposite Party / Respondent *
              </label>
              <input
                type="text"
                name="oppositeParty"
                value={formData.oppositeParty}
                onChange={handleInputChange}
                placeholder="Enter name of opposite party"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Case Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Case Title *
              </label>
              <input
                type="text"
                name="caseTitle"
                value={formData.caseTitle}
                onChange={handleInputChange}
                placeholder="Enter brief case title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Case Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Provide details about the case"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => navigate({ to: "/lawyer-new-case" })}
              className="flex-1 px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCase}
              disabled={
                !formData.clientName ||
                !formData.clientEmail ||
                !formData.clientPhone ||
                !formData.oppositeParty ||
                !formData.caseTitle
              }
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Create Case
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
