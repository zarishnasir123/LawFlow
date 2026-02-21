import type { CaseSubmissionRecord } from "../../lawyer/types/caseFiling";
import { mockSubmittedCases } from "../data/viewcase.mock";

export type QueueDecisionSnapshot = {
  status: "returned" | "approved";
  decidedAt: string;
  reviewedSubmissionAt?: string;
};

function toEpoch(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getFcfsSubmissionQueue(
  liveSubmittedCases: CaseSubmissionRecord[],
  excludedCaseIds: Set<string> = new Set()
): CaseSubmissionRecord[] {
  const sourceCases =
    liveSubmittedCases.length > 0 ? [...liveSubmittedCases] : [...mockSubmittedCases];

  const merged = sourceCases;
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

export function getProcessedCaseIdsForLatestSubmission(
  queue: CaseSubmissionRecord[],
  decisionsByCaseId: Record<string, QueueDecisionSnapshot>
): Set<string> {
  const processed = new Set<string>();
  queue.forEach((item) => {
    const decision = decisionsByCaseId[item.caseId];
    if (!decision) return;
    const isProcessedStatus =
      decision.status === "approved" || decision.status === "returned";
    if (!isProcessedStatus) return;

    // Prefer exact submission snapshot matching:
    // a decision only applies to the specific submission instance it reviewed.
    if (decision.reviewedSubmissionAt) {
      if (decision.reviewedSubmissionAt === item.submittedAt) {
        processed.add(item.caseId);
      }
      return;
    }

    // Backward-compat fallback for previously persisted decisions.
    if (toEpoch(decision.decidedAt) >= toEpoch(item.submittedAt)) {
      processed.add(item.caseId);
    }
  });
  return processed;
}
