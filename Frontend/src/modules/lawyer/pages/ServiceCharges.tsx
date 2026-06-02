import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, HandCoins, Loader } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import {
  getServiceCharges,
  updateServiceCharges as updateServiceChargesAPI,
} from "../../payments/api";

export default function ServiceCharges() {
  const [familyFee, setFamilyFee] = useState<number | "">("");
  const [civilFee, setCivilFee] = useState<number | "">("");
  const [isEditing, setIsEditing] = useState(false);
  const [editFamily, setEditFamily] = useState<number | "">("");
  const [editCivil, setEditCivil] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadServiceCharges = async () => {
    try {
      setLoading(true);
      setError(null);
      const charges = await getServiceCharges();
      setFamilyFee(charges?.familyCaseFee ?? "");
      setCivilFee(charges?.civilCaseFee ?? "");
      setEditFamily(charges?.familyCaseFee ?? "");
      setEditCivil(charges?.civilCaseFee ?? "");
    } catch {
      setError("Failed to load service charges. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServiceCharges();
  }, []);

  const isConfigured =
    (typeof familyFee === "number" && familyFee > 0) ||
    (typeof civilFee === "number" && civilFee > 0);

  const handleEditStart = () => {
    setIsEditing(true);
    setEditFamily(familyFee);
    setEditCivil(civilFee);
    setSuccess(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditFamily(familyFee);
    setEditCivil(civilFee);
    setError(null);
  };

  const handleEditSave = async () => {
    const family = typeof editFamily === "number" ? editFamily : parseFloat(String(editFamily));
    const civil = typeof editCivil === "number" ? editCivil : parseFloat(String(editCivil));

    if ((!family || family <= 0) && (!civil || civil <= 0)) {
      setError("Enter at least one category fee greater than zero.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updateServiceChargesAPI({
        ...(family > 0 ? { familyCaseFee: family } : {}),
        ...(civil > 0 ? { civilCaseFee: civil } : {}),
      });
      setFamilyFee(family > 0 ? family : "");
      setCivilFee(civil > 0 ? civil : "");
      setIsEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save service charges. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Service Charges">
        <div className="flex items-center justify-center gap-2 p-12">
          <Loader className="h-6 w-6 animate-spin text-[#01411C]" />
          <p className="text-gray-600">Loading service charges…</p>
        </div>
      </LawyerLayout>
    );
  }

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Service Charges">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <HandCoins className="h-3.5 w-3.5" />
            Case Charges
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Service Charges</h1>
          <p className="mt-1 text-sm text-gray-600">
            Set your fees per case category. These auto-load when you create a payment plan for a
            case.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <p className="text-sm text-green-800">Service charges saved successfully.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-r from-[#01411C]/5 to-emerald-50/80 px-5 py-3">
              <h2 className="font-semibold text-gray-900">Family Case Charges</h2>
            </div>
            <div className="p-5">
              {!isEditing ? (
                <p className="text-3xl font-bold text-[#01411C]">
                  {typeof familyFee === "number" && familyFee > 0
                    ? `PKR ${familyFee.toLocaleString()}`
                    : "—"}
                </p>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500 text-sm">PKR</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editFamily}
                    onChange={(e) =>
                      setEditFamily(e.target.value ? parseFloat(e.target.value) : "")
                    }
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-12 pr-3 focus:border-[#01411C] focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="e.g. 500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-r from-[#01411C]/5 to-emerald-50/80 px-5 py-3">
              <h2 className="font-semibold text-gray-900">Civil Case Charges</h2>
            </div>
            <div className="p-5">
              {!isEditing ? (
                <p className="text-3xl font-bold text-[#01411C]">
                  {typeof civilFee === "number" && civilFee > 0
                    ? `PKR ${civilFee.toLocaleString()}`
                    : "—"}
                </p>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500 text-sm">PKR</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editCivil}
                    onChange={(e) =>
                      setEditCivil(e.target.value ? parseFloat(e.target.value) : "")
                    }
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-12 pr-3 focus:border-[#01411C] focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="e.g. 700"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!isEditing ? (
            <button
              type="button"
              onClick={handleEditStart}
              className="rounded-lg bg-[#01411C] px-6 py-3 text-sm font-semibold text-white hover:bg-[#024a23]"
            >
              {isConfigured ? "Edit Charges" : "Set Charges"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={saving}
                className="rounded-lg bg-[#01411C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#024a23] disabled:bg-gray-400"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleEditCancel}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {isConfigured && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-sm text-emerald-900">
              Charges are active. Open a case payment plan to set installments for your client.
            </p>
            <Link
              to="/lawyer-case-payments"
              className="mt-3 inline-block text-sm font-semibold text-[#01411C] underline hover:text-[#024a23]"
            >
              Go to Case Payment Plans →
            </Link>
          </div>
        )}
      </div>
    </LawyerLayout>
  );
}
