import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, CheckCircle2, Loader2 } from "lucide-react";
import { getLawyerPayoutAccount, updateLawyerPayoutAccount } from "../api";

type FormState = {
  accountTitle: string;
  accountNumber: string;
  bankName: string;
};

const FIELDS: Array<{ key: keyof FormState; label: string; placeholder: string }> = [
  { key: "accountTitle", label: "Account Title", placeholder: "Name on the account, e.g. Ahmed Khan" },
  { key: "accountNumber", label: "Account Number / IBAN", placeholder: "e.g. PK36SCBL0000001123456702" },
  { key: "bankName", label: "Bank Name", placeholder: "e.g. HBL, Meezan, UBL" },
];

export default function PayoutAccountCard() {
  const queryClient = useQueryClient();
  const { data: account, isLoading } = useQuery({
    queryKey: ["lawyer-payout-account"],
    queryFn: getLawyerPayoutAccount,
    staleTime: 0,
  });

  const [form, setForm] = useState<FormState>({
    accountTitle: "",
    accountNumber: "",
    bankName: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setForm({
        accountTitle: account.accountTitle || "",
        accountNumber: account.accountNumber || "",
        bankName: account.bankName || "",
      });
    }
  }, [account]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateLawyerPayoutAccount(form);
      await queryClient.invalidateQueries({ queryKey: ["lawyer-payout-account"] });
      setSaved(true);
    } catch {
      setError("Could not save your payout account. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Landmark className="h-3.5 w-3.5 text-gray-500" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Payout Account
        </p>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        LawFlow collects your clients' payments and settles your share to this account.
        Keep it up to date so your money reaches you on time.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                {field.label}
              </span>
              <input
                type="text"
                value={form[field.key]}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({ ...prev, [field.key]: value }));
                  setSaved(false);
                }}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save payout account"
          )}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
