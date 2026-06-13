import type { CaseSubmissionRecord } from "../../lawyer/types/caseFiling";

// Orders the still-local Schedule Hearing data by submission time
// (first-come-first-served). The registrar review queue itself is now
// backend-backed; this helper only survives for the Schedule Hearing
// page, which remains on the local filing store for this round.
export function getFcfsSubmissionQueue(
  liveSubmittedCases: CaseSubmissionRecord[],
  excludedCaseIds: Set<string> = new Set()
): CaseSubmissionRecord[] {
  const deduped = [...liveSubmittedCases].filter(
    (item, index, arr) =>
      index === arr.findIndex((candidate) => candidate.caseId === item.caseId)
  );

  return deduped
    .filter((item) => !excludedCaseIds.has(item.caseId))
    .sort((a, b) => {
      const aTime = new Date(a.submittedAt).getTime();
      const bTime = new Date(b.submittedAt).getTime();
      if (aTime !== bTime) return aTime - bTime; // FCFS: oldest first
      return a.caseId.localeCompare(b.caseId);
    });
}
