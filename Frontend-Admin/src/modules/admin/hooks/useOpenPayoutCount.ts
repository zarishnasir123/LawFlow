import { useQuery } from "@tanstack/react-query";

import { fetchPayouts } from "../api/payouts";

// Number of payouts awaiting admin action (requested + processing) — the badge
// on the Payouts sidebar item. Shares the ["admin", "payouts", "all"] cache
// with the Payouts page's "All" view, and any payout mutation that invalidates
// the ["admin", "payouts"] key refreshes this badge automatically.
export function useOpenPayoutCount(): number {
  const { data } = useQuery({
    queryKey: ["admin", "payouts", "all"],
    queryFn: () => fetchPayouts(),
    staleTime: 1000 * 30,
  });

  if (!data) return 0;
  return data.filter(
    (payout) => payout.status === "requested" || payout.status === "processing"
  ).length;
}
