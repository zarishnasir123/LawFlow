import { create } from "zustand";

import type { ApiCaseType, CaseCategory } from "../api/cases.api";

// In-flight selection while the lawyer steps from "pick category" through
// "pick case type" into the "fill client details" form. Source of truth for
// the saved case is the backend; this store only holds the lawyer's
// not-yet-submitted picks.
interface NewCaseState {
  category: CaseCategory | null;
  selectedCaseType: ApiCaseType | null;
  setCategory: (category: CaseCategory) => void;
  setSelectedCaseType: (caseType: ApiCaseType | null) => void;
  reset: () => void;
}

export const useNewCaseStore = create<NewCaseState>((set) => ({
  category: null,
  selectedCaseType: null,

  setCategory: (category) => set({ category }),

  setSelectedCaseType: (caseType) => set({ selectedCaseType: caseType }),

  reset: () => set({ category: null, selectedCaseType: null }),
}));
