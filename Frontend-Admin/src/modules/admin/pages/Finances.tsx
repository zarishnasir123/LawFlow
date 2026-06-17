import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Coins,
  Landmark,
  Loader2,
  Percent,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  fetchCommissionRate,
  fetchMoneyOverview,
  updateCommissionRate,
} from "../api/money";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";

function money(value: number) {
  return `Rs ${value.toLocaleString()}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <Icon className={`h-4 w-4 ${accent}`} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

// Admin-editable platform commission rate. Lives on the Finances page since
// it directly shapes the "platform fees" the page reports.
function CommissionRateCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "commission-rate"],
    queryFn: fetchCommissionRate,
  });

  // draft is null until the admin edits, so the field shows the live server
  // value without needing a set-state-in-effect to seed it.
  const [draft, setDraft] = useState<string | null>(null);
  const current = data?.commissionRate ?? null;
  const value = draft ?? (current != null ? String(current) : "");

  const mutation = useMutation({
    mutationFn: (rate: number) => updateCommissionRate(rate),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "commission-rate"] });
    },
  });

  const parsed = Number(value);
  const valid =
    value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const changed = current == null || parsed !== current;
  const canSave = valid && changed && !mutation.isPending;
  const showSaved = mutation.isSuccess && draft === null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Percent className="h-4 w-4 text-[#01411C]" />
        <h2 className="text-lg font-semibold text-gray-900">Platform commission</h2>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        The percentage LawFlow keeps from each client payment. Changing this only
        affects <span className="font-medium">future</span> payments — past
        payments keep the rate they were charged.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Commission rate
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
            />
            <span className="text-lg font-semibold text-gray-500">%</span>
          </div>
        </div>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => mutation.mutate(parsed)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
        {showSaved ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        ) : null}
      </div>

      {!valid && value.trim() !== "" ? (
        <p className="mt-2 text-xs text-rose-600">Enter a rate between 0 and 100.</p>
      ) : null}
      {mutation.isError ? (
        <p className="mt-2 text-xs text-rose-600">
          {extractApiErrorMessage(mutation.error, "Couldn't save the rate. Please try again.")}
        </p>
      ) : null}
    </div>
  );
}

export default function Finances() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "money-overview"],
    queryFn: fetchMoneyOverview,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const totals = data?.totals;
  const recon = data?.reconciliation;
  const perLawyer = data?.perLawyer ?? [];

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Hero / intro */}
        <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-white via-white to-green-50/40 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#01411C] text-white">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#01411C]">Finances</h1>
              <p className="mt-1 max-w-3xl text-sm text-gray-600">
                Every rupee that has flowed through LawFlow: what clients paid in,
                the platform's commission, what's been paid out to lawyers, and
                what's still owed to them.
              </p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="py-12 text-center text-gray-600">Loading finances…</div>
        ) : isError || !totals || !recon ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
            Couldn't load the money overview. Please try again.
          </div>
        ) : (
          <>
            {/* Headline totals */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Coins}
                accent="text-[#01411C]"
                label="Total collected"
                value={money(totals.collected)}
                sub={`From ${totals.paymentsCount} ${totals.paymentsCount === 1 ? "payment" : "payments"}`}
              />
              <StatCard
                icon={Landmark}
                accent="text-emerald-600"
                label="Platform fees earned"
                value={money(totals.platformFees)}
                sub="LawFlow's commission"
              />
              <StatCard
                icon={ArrowUpRight}
                accent="text-blue-600"
                label="Paid out to lawyers"
                value={money(totals.paidOut)}
                sub={`${totals.paidPayoutsCount} ${totals.paidPayoutsCount === 1 ? "payout" : "payouts"}`}
              />
              <StatCard
                icon={Clock}
                accent="text-amber-600"
                label="Still owed to lawyers"
                value={money(totals.owed)}
                sub={
                  totals.inProgressPayouts > 0
                    ? `${money(totals.inProgressPayouts)} in progress`
                    : "Held by the platform"
                }
              />
            </div>

            {/* Reconciliation */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Where the money is
                </h2>
                {recon.balances ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Balanced
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    Mismatch — check data
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <span className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-gray-900">
                  Collected {money(recon.collected)}
                </span>
                <span className="text-gray-400">=</span>
                <span className="rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-800">
                  Platform fees {money(recon.platformFees)}
                </span>
                <span className="text-gray-400">+</span>
                <span className="rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-800">
                  Paid out {money(recon.paidOut)}
                </span>
                <span className="text-gray-400">+</span>
                <span className="rounded-lg bg-amber-50 px-3 py-2 font-medium text-amber-800">
                  Still owed {money(recon.owed)}
                </span>
              </div>
            </div>

            {/* Editable platform commission rate */}
            <CommissionRateCard />

            {/* Per-lawyer breakdown */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#01411C]" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Per-lawyer breakdown
                </h2>
              </div>
              {perLawyer.length === 0 ? (
                <p className="mt-4 text-sm text-gray-600">
                  No lawyer earnings yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-gray-200 bg-slate-50/90">
                        {["Lawyer", "Earned (gross)", "Platform fee", "Net", "Paid out", "Owed"].map(
                          (heading, i) => (
                            <th
                              key={heading}
                              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 ${
                                i === 0 ? "text-left" : "text-right"
                              }`}
                            >
                              {heading}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {perLawyer.map((row) => (
                        <tr
                          key={row.lawyerUserId}
                          className="border-b border-gray-100 odd:bg-white even:bg-slate-50/30"
                        >
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-gray-900">{row.lawyerName}</div>
                            {row.lawyerEmail ? (
                              <div className="text-xs text-gray-400">{row.lawyerEmail}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            {money(row.grossEarned)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-emerald-700">
                            {money(row.platformFee)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            {money(row.netEarned)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-blue-700">
                            {money(row.paidOut)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-amber-700">
                            {money(row.owed)}
                            {row.inProgressPayouts > 0 ? (
                              <span className="block text-xs font-normal text-gray-400">
                                {money(row.inProgressPayouts)} in progress
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
