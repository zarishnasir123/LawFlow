import { useQuery } from "@tanstack/react-query";

import { fetchPendingLawyers } from "../api/lawyerVerifications";

// Returns the number of lawyer accounts currently awaiting admin verification.
// Shares the ["admin", "pending-lawyers"] cache with the Verifications page,
// so navigating between the dashboard, the sidebar, and the page does NOT
// re-fetch the list — the cache is the single source of truth, and any
// review action (approve / reject) that calls queryClient.invalidateQueries
// against that key refreshes every component using this hook automatically.
export function usePendingLawyerCount(): number {
  const { data } = useQuery({
    queryKey: ["admin", "pending-lawyers"],
    queryFn: () => fetchPendingLawyers({ limit: 50 }),
    staleTime: 1000 * 30,
  });

  // Prefer the server-side total (includes any rows beyond the paginated
  // window), falling back to the locally-loaded array length, then 0 while
  // the query is in flight.
  return data?.pagination?.total ?? data?.items?.length ?? 0;
}
