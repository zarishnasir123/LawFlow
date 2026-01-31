import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import { useServiceChargesStore } from "../store";
import {
  CIVIL_CASE_TYPES,
  FAMILY_CASE_TYPES,
  getInitialServiceCharges,
  getCaseTypeLabel,
} from "../data/charges.mock";
import type { ServiceCharge, CaseType } from "../types/charges";

export default function ServiceCharges() {
  const { charges, setCharges, updateCharge, deleteCharge } =
    useServiceChargesStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ServiceCharge>>({});
  const [showForm, setShowForm] = useState(false);
  const [newCharge, setNewCharge] = useState<Partial<ServiceCharge>>({
    category: "civil",
    caseType: "recovery_of_money",
    consultationFee: 0,
    documentPreparationFee: 0,
  });

  // Initialize charges from mock data
  useEffect(() => {
    if (charges.length === 0) {
      setCharges(getInitialServiceCharges());
    }
  }, [charges.length, setCharges]);

  const handleEditStart = (charge: ServiceCharge) => {
    setEditingId(charge.id);
    setEditData({ ...charge });
  };

  const handleEditSave = (id: string) => {
    if (editData.consultationFee !== undefined && editData.documentPreparationFee !== undefined) {
      const total = editData.consultationFee + editData.documentPreparationFee;
      updateCharge(id, {
        ...editData,
        totalFee: total,
      });
      setEditingId(null);
    }
  };

  const handleAddCharge = () => {
    if (
      newCharge.caseType &&
      newCharge.category &&
      newCharge.consultationFee &&
      newCharge.documentPreparationFee
    ) {
      const charge: ServiceCharge = {
        id: `sc-${Date.now()}`,
        caseType: newCharge.caseType as CaseType,
        category: newCharge.category as "civil" | "family",
        caseName: getCaseTypeLabel(newCharge.caseType as CaseType),
        consultationFee: newCharge.consultationFee,
        documentPreparationFee: newCharge.documentPreparationFee,
        totalFee: newCharge.consultationFee + newCharge.documentPreparationFee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      useServiceChargesStore.getState().addCharge(charge);
      setNewCharge({
        category: "civil",
        caseType: "recovery_of_money",
        consultationFee: 0,
        documentPreparationFee: 0,
      });
      setShowForm(false);
    }
  };

  const civilCharges = charges.filter((c) => c.category === "civil");
  const familyCharges = charges.filter((c) => c.category === "family");

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Lawyer Portal"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Charges</h1>
            <p className="text-sm text-gray-600 mt-1">
              Define your consultation and document preparation fees for different case types
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition"
          >
            <Plus className="w-4 h-4" />
            Add New Charge
          </button>
        </div>

        {/* Add New Charge Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Add Service Charge</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newCharge.category}
                  onChange={(e) =>
                    setNewCharge({
                      ...newCharge,
                      category: e.target.value as "civil" | "family",
                      caseType:
                        e.target.value === "civil"
                          ? "recovery_of_money"
                          : "khula",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="civil">Civil Cases</option>
                  <option value="family">Family Cases</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Type
                </label>
                <select
                  value={newCharge.caseType}
                  onChange={(e) =>
                    setNewCharge({ ...newCharge, caseType: e.target.value as CaseType })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {(newCharge.category === "civil"
                    ? CIVIL_CASE_TYPES
                    : FAMILY_CASE_TYPES
                  ).map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consultation Fee (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCharge.consultationFee || 0}
                  onChange={(e) =>
                    setNewCharge({
                      ...newCharge,
                      consultationFee: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Preparation Fee (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCharge.documentPreparationFee || 0}
                  onChange={(e) =>
                    setNewCharge({
                      ...newCharge,
                      documentPreparationFee: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAddCharge}
                className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition"
              >
                Save
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Civil Cases */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Civil Cases</h2>
            <p className="text-sm text-gray-600">
              {civilCharges.length} of {CIVIL_CASE_TYPES.length} case types defined
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Case Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Consultation Fee
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Document Prep Fee
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Total Fee
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {civilCharges.map((charge) => (
                  <tr key={charge.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{charge.caseName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {editingId === charge.id ? (
                        <input
                          type="number"
                          min="0"
                          value={editData.consultationFee || 0}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              consultationFee: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        `Rs. ${charge.consultationFee.toLocaleString()}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {editingId === charge.id ? (
                        <input
                          type="number"
                          min="0"
                          value={editData.documentPreparationFee || 0}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              documentPreparationFee: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        `Rs. ${charge.documentPreparationFee.toLocaleString()}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-700">
                      Rs. {charge.totalFee.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {editingId === charge.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(charge.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditStart(charge)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCharge(charge.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Family Cases */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Family Cases</h2>
            <p className="text-sm text-gray-600">
              {familyCharges.length} of {FAMILY_CASE_TYPES.length} case types defined
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Case Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Consultation Fee
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Document Prep Fee
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Total Fee
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {familyCharges.map((charge) => (
                  <tr key={charge.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{charge.caseName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {editingId === charge.id ? (
                        <input
                          type="number"
                          min="0"
                          value={editData.consultationFee || 0}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              consultationFee: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        `Rs. ${charge.consultationFee.toLocaleString()}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {editingId === charge.id ? (
                        <input
                          type="number"
                          min="0"
                          value={editData.documentPreparationFee || 0}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              documentPreparationFee: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        `Rs. ${charge.documentPreparationFee.toLocaleString()}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-purple-700">
                      Rs. {charge.totalFee.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {editingId === charge.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(charge.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditStart(charge)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCharge(charge.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LawyerLayout>
  );
}
