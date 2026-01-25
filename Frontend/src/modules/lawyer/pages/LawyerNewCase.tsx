import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import { CIVIL_CASE_TYPES, FAMILY_CASE_TYPES } from "../constants/caseTypes";
import { useNewCaseStore } from "../store/newCase.store";

//  Import modals
import LogoutConfirmationModal from "../../lawyer/components/modals/LogoutConfirmationModal";
import NotificationPreferencesModal from "../../client/components/modals/NotificationPreferencesModal";

export default function LawyerNewCase() {
  const navigate = useNavigate();
  const { category, selectedCaseType, setCategory, setSelectedCaseType, reset } =
    useNewCaseStore();

  //  Modal states
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);

  const handleLogout = () => {
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  // Reset store on mount
  useEffect(() => {
    reset();
  }, [reset]);

  const handleCategorySelect = (selectedCategory: "civil" | "family") => {
    setCategory(selectedCategory);
    setSelectedCaseType(null);
  };

  const handleCaseTypeSelect = (caseTypeId: string) => {
    const allTypes = [...CIVIL_CASE_TYPES, ...FAMILY_CASE_TYPES];
    const selected = allTypes.find((ct) => ct.id === caseTypeId);
    if (selected) {
      setSelectedCaseType(selected);
    }
  };

  const caseTypes = category === "civil" ? CIVIL_CASE_TYPES : FAMILY_CASE_TYPES;

  return (
    <>
      {/*  Modals */}
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />

      <NotificationPreferencesModal
        isOpen={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
      />

      <DashboardLayout
        brandTitle="LawFlow"
        brandSubtitle="Create New Case"
        actions={[
          {
            label: "Notifications",
            icon: Bell,
            onClick: () => setNotificationModalOpen(true), //  open notification modal
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
            onClick: () => setLogoutModalOpen(true), //  open logout modal
          },
        ]}
      >
        <div className="w-full max-w-5xl mx-auto">
          {/* Step 1: Category Selection */}
          {!category ? (
            <div className="space-y-10">
              <div className="text-center space-y-3">
                <h2 className="text-4xl font-bold text-gray-900">
                  Select Case Category
                </h2>
                <p className="text-lg text-gray-600">
                  Choose the type of case you want to create
                </p>
              </div>

              <div className="grid gap-8 sm:grid-cols-2">
                {/* Civil Case */}
                <button
                  onClick={() => handleCategorySelect("civil")}
                  className="text-left p-10 rounded-2xl border-2 border-gray-200 hover:border-green-500 hover:shadow-2xl hover:shadow-green-100 bg-white transition-all duration-300 group transform hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-100 to-green-200 group-hover:from-green-200 group-hover:to-green-300 flex items-center justify-center transition transform group-hover:scale-110">
                      <span className="text-4xl">⚖️</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 group-hover:text-green-700 transition mb-3">
                    Civil Case
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-base">
                    Cases related to civil disputes, property matters, contracts, and other civil litigation.
                  </p>
                </button>

                {/* Family Case */}
                <button
                  onClick={() => handleCategorySelect("family")}
                  className="text-left p-10 rounded-2xl border-2 border-gray-200 hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-100 bg-white transition-all duration-300 group transform hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 group-hover:from-purple-200 group-hover:to-purple-300 flex items-center justify-center transition transform group-hover:scale-110">
                      <span className="text-4xl">👨‍👩‍👧</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 group-hover:text-purple-700 transition mb-3">
                    Family Case
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-base">
                    Cases related to family law, divorce, custody, maintenance, and other family matters.
                  </p>
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Case Type Selection */
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <h2 className="text-4xl font-bold text-gray-900">
                  {category === "civil" ? "Civil" : "Family"} Case Types
                </h2>
                <p className="text-lg text-gray-600">
                  Select the specific type of case you're handling
                </p>
              </div>

              <div className="space-y-3">
                {caseTypes.map((caseType) => (
                  <button
                    key={caseType.id}
                    onClick={() => handleCaseTypeSelect(caseType.id)}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-300 ${
                      selectedCaseType?.id === caseType.id
                        ? category === "civil"
                          ? "border-green-500 bg-green-50 shadow-lg shadow-green-200"
                          : "border-purple-500 bg-purple-50 shadow-lg shadow-purple-200"
                        : "border-gray-200 hover:border-gray-300 bg-white hover:shadow-md hover:shadow-gray-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3
                          className={`font-bold text-lg transition ${
                            selectedCaseType?.id === caseType.id
                              ? category === "civil"
                                ? "text-green-700"
                                : "text-purple-700"
                              : "text-gray-900"
                          }`}
                        >
                          {caseType.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-2 font-medium">
                          {caseType.governingLaw}
                        </p>
                      </div>
                      {selectedCaseType?.id === caseType.id && (
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center mt-1 transform transition ${
                            category === "civil"
                              ? "bg-green-600"
                              : "bg-purple-600"
                          }`}
                        >
                          <span className="text-white text-sm font-bold">✓</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {selectedCaseType && (
                <div className="flex gap-4 pt-6 border-t-2 border-gray-200">
                  <button
                    onClick={reset}
                    className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => navigate({ to: "/lawyer-create-case" })}
                    className={`flex-1 px-6 py-3 rounded-xl text-white font-semibold transition transform hover:scale-105 ${
                      category === "civil"
                        ? "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200"
                        : "bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
