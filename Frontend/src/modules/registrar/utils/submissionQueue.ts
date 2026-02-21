import type { CaseSubmissionRecord } from "../../lawyer/types/caseFiling";
import { mockSubmittedCases } from "../data/viewcase.mock";

export function getFcfsSubmissionQueue(
  liveSubmittedCases: CaseSubmissionRecord[],
  excludedCaseIds: Set<string> = new Set()
): CaseSubmissionRecord[] {
  const merged = [...liveSubmittedCases, ...mockSubmittedCases];
  const deduped = merged.filter(
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
