import { create } from "zustand";
import type { CaseType } from "../constants/caseTypes";

interface NewCaseState {
  category: "civil" | "family" | null;
  selectedCaseType: CaseType | null;
  setCategory: (category: "civil" | "family") => void;
  setSelectedCaseType: (caseType: CaseType | null) => void;
  reset: () => void;
}

export const useNewCaseStore = create<NewCaseState>((set) => ({
  category: null,
  selectedCaseType: null,

  setCategory: (category) => set({ category }),

  setSelectedCaseType: (caseType) => set({ selectedCaseType: caseType }),

  reset: () => set({ category: null, selectedCaseType: null }),
}));
