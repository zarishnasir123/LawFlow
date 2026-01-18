import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  FileText,
  Briefcase,
  AlertCircle,
  Bell,
  LogOut,
  User,
} from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";

// Civil case types with governing laws
const CIVIL_CASES = [
  {
    id: 1,
    name: "Suit for Recovery of Money",
    law: "Civil Procedure Code (CPC), 1908",
  },
  {
    id: 2,
    name: "Suit for Permanent Injunction",
    law: "Specific Relief Act, 1877",
  },
  {
    id: 3,
    name: "Suit for Declaration",
    law: "Specific Relief Act, 1877",
  },
  {
    id: 4,
    name: "Suit for Specific Performance of Agreement",
    law: "Specific Relief Act, 1877",
  },
  {
    id: 5,
    name: "Suit for Possession of Property",
    law: "Civil Procedure Code (CPC), 1908",
  },
];

// Family case types with governing laws
const FAMILY_CASES = [
  {
    id: 1,
    name: "Khula (Wife's Judicial Divorce)",
    law: "Dissolution of Muslim Marriages Act, 1939 & MFLO, 1961",
  },
  {
    id: 2,
    name: "Maintenance (Wife & Children)",
    law: "MFLO, 1961 & Family Courts Act, 1964",
  },
  {
    id: 3,
    name: "Recovery of Dowry Articles / Personal Property",
    law: "Dowry & Bridal Gifts Act, 1976 & Family Courts Act, 1964",
  },
  {
    id: 4,
    name: "Custody of Minors (Hizanat)",
    law: "Guardian and Wards Act, 1890 & Family Courts Act, 1964",
  },
  {
    id: 5,
    name: "Restitution of Conjugal Rights",
    law: "Family Courts Act, 1964",
  },
];

export default function CreateCase() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"client-info" | "case-type">("client-info");
  const [selectedCategory, setSelectedCategory] = useState<"civil" | "family" | null>(null);
  const [selectedCaseType, setSelectedCaseType] = useState<number | null>(null);

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

  const handleContinue = () => {
    if (
      formData.clientName &&
      formData.clientEmail &&
      formData.clientPhone &&
      formData.oppositeParty &&
      formData.caseTitle
    ) {
      setStep("case-type");
    }
  };

  const handleSelectCaseType = (caseType: number) => {
    setSelectedCaseType(caseType);
  };

  const handleCreateCase = () => {
    if (selectedCategory && selectedCaseType) {
      // Get selected case details
      const caseList =
        selectedCategory === "civil" ? CIVIL_CASES : FAMILY_CASES;
      const selected = caseList.find((c) => c.id === selectedCaseType);

      if (selected) {
        // Store case data (in real app, would be sent to backend)
        const newCase = {
          ...formData,
          caseType: selectedCategory,
          caseCategory: selected.name,
          governingLaw: selected.law,
        };

        console.log("Creating case:", newCase);

        // Navigate back to lawyer dashboard
        navigate({ to: "/Lawyer-dashboard" });
      }
    }
  };

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Start New Case"
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
          onClick: () => navigate({ to: "/Lawyer-dashboard" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
    >
      <div className="max-w-4xl mx-auto">
        {step === "client-info" ? (
          <div className="bg-white rounded-lg shadow-md p-8 border-l-4 border-green-500 hover:shadow-lg hover:shadow-green-200 transition-all duration-300">
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
                onClick={() => navigate({ to: "/Lawyer-dashboard" })}
                className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Cancel
              </button>
              <button
                onClick={handleContinue}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition ml-auto"
              >
                Continue
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Case Category Selection */}
            <div className="bg-white rounded-lg shadow-md p-8 border-l-4 border-green-500 hover:shadow-lg hover:shadow-green-200 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-6 h-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Select Case Category
                </h1>
              </div>

              {/* Civil Cases */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  ⚖️ Civil Cases (District / Tehsil Civil Courts – Pakistan)
                </h2>
                <div className="space-y-3">
                  {CIVIL_CASES.map((caseType) => (
                    <button
                      key={caseType.id}
                      onClick={() => {
                        setSelectedCategory("civil");
                        handleSelectCaseType(caseType.id);
                      }}
                      className={`w-full p-4 border-2 rounded-lg text-left transition ${
                        selectedCategory === "civil" &&
                        selectedCaseType === caseType.id
                          ? "border-green-600 bg-green-50"
                          : "border-gray-300 bg-gray-50 hover:border-green-400"
                      }`}
                    >
                      <p className="font-semibold text-gray-900">
                        {caseType.name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {caseType.law}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 my-8"></div>

              {/* Family Cases */}
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  👨‍👩‍👧‍👦 Family Cases (Family Courts – Pakistan)
                </h2>
                <div className="space-y-3">
                  {FAMILY_CASES.map((caseType) => (
                    <button
                      key={caseType.id}
                      onClick={() => {
                        setSelectedCategory("family");
                        handleSelectCaseType(caseType.id);
                      }}
                      className={`w-full p-4 border-2 rounded-lg text-left transition ${
                        selectedCategory === "family" &&
                        selectedCaseType === caseType.id
                          ? "border-green-600 bg-green-50"
                          : "border-gray-300 bg-gray-50 hover:border-green-400"
                      }`}
                    >
                      <p className="font-semibold text-gray-900">
                        {caseType.name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {caseType.law}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Case Summary */}
            {selectedCategory && selectedCaseType && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">
                      Case Summary
                    </p>
                    <p className="text-blue-800 text-sm mt-1">
                      <strong>Client:</strong> {formData.clientName}
                    </p>
                    <p className="text-blue-800 text-sm">
                      <strong>Case Type:</strong>{" "}
                      {selectedCategory === "civil" ? "Civil" : "Family"}
                    </p>
                    <p className="text-blue-800 text-sm">
                      <strong>Category:</strong>{" "}
                      {selectedCategory === "civil"
                        ? CIVIL_CASES.find((c) => c.id === selectedCaseType)
                            ?.name
                        : FAMILY_CASES.find((c) => c.id === selectedCaseType)
                            ?.name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 bg-white rounded-lg shadow-md p-8">
              <button
                onClick={() => setStep("client-info")}
                className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={handleCreateCase}
                disabled={!selectedCategory || !selectedCaseType}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition ml-auto disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                Create Case
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
