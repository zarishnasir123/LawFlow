import type {
  CaseSubmissionRecord,
  CompiledCaseBundle,
  FilingCaseRecord,
} from "../types/caseFiling";

export const filingCasesMock: FilingCaseRecord[] = [];

export const compiledBundlesMock: Record<string, CompiledCaseBundle> = {};

export const submittedCasesMock: CaseSubmissionRecord[] = [];
