import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { isAxiosError } from "axios";
import LawyerLayout from "../components/LawyerLayout";
import { useServiceChargesStore } from "../store";
import {
  CIVIL_CASE_TYPES,
  FAMILY_CASE_TYPES,
  getCaseTypeLabel,
} from "../data/charges.mock";
import type { ServiceCharge, CaseType } from "../types/charges";
import {
  createServiceCharge,
  deleteServiceCharge as deleteServiceChargeApi,
  getServiceCharges,
  updateServiceCharge,
} from "../api/charges";
import {
  feeDigitsToNumber,
  feeNumberToDigits,
  sanitizeFeeDigits,
} from "../utils/feeInput";

type FeeInputs = {
  consultationFee: string;
  documentPreparationFee: string;
};

function createEmptyFeeInputs(): FeeInputs {
  return { consultationFee: "", documentPreparationFee: "" };
}

export default function ServiceCharges() {
  const { charges, setCharges } = useServiceChargesStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ServiceCharge>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCharge, setNewCharge] = useState<Partial<ServiceCharge>>({
    category: "civil",
    caseType: "civil_recovery_of_money",
  });
  const [newFeeInputs, setNewFeeInputs] = useState(createEmptyFeeInputs);
  const [editFeeInputs, setEditFeeInputs] = useState(createEmptyFeeInputs);

  const loadCharges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServiceCharges();
      setCharges(data);
    } catch (err) {
      const apiMessage =
        isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : null;
      setError(
        apiMessage ??
          "Could not load service charges. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [setCharges]);

  useEffect(() => {
    void loadCharges();
  }, [loadCharges]);

  const handleEditStart = (charge: ServiceCharge) => {
    setEditingId(charge.id);
    setEditData({ ...charge });
    setEditFeeInputs({
      consultationFee: feeNumberToDigits(charge.consultationFee),
      documentPreparationFee: feeNumberToDigits(charge.documentPreparationFee),
    });
  };

  const updateNewFeeField = (
    field: keyof FeeInputs,
    raw: string
  ) => {
    const digits = sanitizeFeeDigits(raw);
    setNewFeeInputs((prev) => ({ ...prev, [field]: digits }));
    setNewCharge((prev) => ({
      ...prev,
      [field]: feeDigitsToNumber(digits),
    }));
  };

  const updateEditFeeField = (
    field: keyof FeeInputs,
    raw: string
  ) => {
    const digits = sanitizeFeeDigits(raw);
    setEditFeeInputs((prev) => ({ ...prev, [field]: digits }));
    setEditData((prev) => ({
      ...prev,
      [field]: feeDigitsToNumber(digits),
    }));
  };

  const handleEditSave = async (id: string) => {
    if (
      editData.consultationFee === undefined ||
      editData.documentPreparationFee === undefined
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateServiceCharge(id, {
        consultationFee: editData.consultationFee,
        documentPreparationFee: editData.documentPreparationFee,
      });
      setCharges(charges.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } catch (err) {
      setError(
        isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Could not update service charge."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddCharge = async () => {
    if (
      !newCharge.caseType ||
      !newCharge.category ||
      newCharge.consultationFee === undefined ||
      newCharge.documentPreparationFee === undefined
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await createServiceCharge({
        caseType: newCharge.caseType as CaseType,
        category: newCharge.category as "civil" | "family",
        caseName: getCaseTypeLabel(newCharge.caseType as CaseType),
        consultationFee: newCharge.consultationFee,
        documentPreparationFee: newCharge.documentPreparationFee,
      });
      setCharges([...charges, created]);
      setNewCharge({
        category: "civil",
        caseType: "civil_recovery_of_money",
      });
      setNewFeeInputs(createEmptyFeeInputs());
      setShowForm(false);
    } catch (err) {
      setError(
        isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Could not add service charge."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteServiceChargeApi(id);
      setCharges(charges.filter((c) => c.id !== id));
    } catch {
      setError("Could not delete service charge.");
    } finally {
      setSaving(false);
    }
  };

  const civilCharges = charges.filter((c) => c.category === "civil");
  const familyCharges = charges.filter((c) => c.category === "family");

  const renderChargeRow = (charge: ServiceCharge, totalClassName: string) => {
    const displayTotal =
      editingId === charge.id
        ? (editData.consultationFee ?? 0) + (editData.documentPreparationFee ?? 0)
        : charge.totalFee;

    return (
      <tr key={charge.id} className="border-b border-gray-200 hover:bg-gray-50">
        <td className="px-6 py-4 text-sm text-gray-900">{charge.caseName}</td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {editingId === charge.id ? (
            <input
              type="text"
              inputMode="numeric"
              value={editFeeInputs.consultationFee}
              onChange={(e) =>
                updateEditFeeField("consultationFee", e.target.value)
              }
              className="w-24 px-2 py-1 border border-gray-300 rounded"
              placeholder="0"
            />
          ) : (
            `Rs. ${charge.consultationFee.toLocaleString()}`
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {editingId === charge.id ? (
            <input
              type="text"
              inputMode="numeric"
              value={editFeeInputs.documentPreparationFee}
              onChange={(e) =>
                updateEditFeeField("documentPreparationFee", e.target.value)
              }
              className="w-24 px-2 py-1 border border-gray-300 rounded"
              placeholder="0"
            />
          ) : (
            `Rs. ${charge.documentPreparationFee.toLocaleString()}`
          )}
        </td>
        <td className={`px-6 py-4 text-sm font-semibold ${totalClassName}`}>
          Rs. {(displayTotal ?? 0).toLocaleString()}
        </td>
        <td className="px-6 py-4 text-sm">
          {editingId === charge.id ? (
            <div className="flex gap-2">
              <button
                onClick={() => void handleEditSave(charge.id)}
                disabled={saving}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                disabled={saving}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleEditStart(charge)}
                disabled={saving}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-50"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => void handleDelete(charge.id)}
                disabled={saving}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Lawyer Portal">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Charges</h1>
            <p className="text-sm text-gray-600 mt-1">
              Define your consultation and document preparation fees for different case types
            </p>
          </div>
          <button
            onClick={() => {
              if (!showForm) {
                setNewFeeInputs(createEmptyFeeInputs());
                setNewCharge({
                  category: "civil",
                  caseType: "civil_recovery_of_money",
                });
              }
              setShowForm(!showForm);
            }}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add New Charge
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

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
                          ? "civil_recovery_of_money"
                          : "family_khula",
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
                  type="text"
                  inputMode="numeric"
                  value={newFeeInputs.consultationFee}
                  onChange={(e) =>
                    updateNewFeeField("consultationFee", e.target.value)
                  }
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Preparation Fee (PKR)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newFeeInputs.documentPreparationFee}
                  onChange={(e) =>
                    updateNewFeeField("documentPreparationFee", e.target.value)
                  }
                  placeholder="e.g. 8000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => void handleAddCharge()}
                disabled={saving}
                className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-600">Loading service charges…</p>
        ) : (
          <>
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
                    {civilCharges.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-gray-500"
                        >
                          No civil case charges yet. Add one using the button above.
                        </td>
                      </tr>
                    ) : (
                      civilCharges.map((charge) =>
                        renderChargeRow(charge, "text-green-700")
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

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
                    {familyCharges.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-gray-500"
                        >
                          No family case charges yet. Add one using the button above.
                        </td>
                      </tr>
                    ) : (
                      familyCharges.map((charge) =>
                        renderChargeRow(charge, "text-purple-700")
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </LawyerLayout>
  );
}
